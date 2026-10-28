/**
 * Cloudflare R2 köprüsü (Supabase Edge Function).
 *
 * Anahtarlar sunucuda durur; tarayıcıya yalnızca kısa ömürlü imzalı yükleme
 * adresi verilir. Böylece gizli anahtar paket içinde görünmez.
 *
 * Gerekli secret'lar (Supabase → Edge Functions → Secrets):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 */
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20'

const ACCOUNT = Deno.env.get('R2_ACCOUNT_ID') ?? ''
const ACCESS_KEY = Deno.env.get('R2_ACCESS_KEY_ID') ?? ''
const SECRET_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY') ?? ''
const BUCKET = Deno.env.get('R2_BUCKET') ?? ''
const PUBLIC_URL = (Deno.env.get('R2_PUBLIC_URL') ?? '').replace(/\/+$/, '')

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const aws = new AwsClient({
  accessKeyId: ACCESS_KEY || 'yok',
  secretAccessKey: SECRET_KEY || 'yok',
  service: 's3',
  region: 'auto',
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

function objectUrl(key: string) {
  return `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${key}`
}

function safeKey(key: unknown): string | null {
  const k = String(key ?? '').replace(/^\/+/, '')
  if (!k || k.length > 400 || k.includes('..') || k.startsWith('.')) return null
  return k
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const eksik = [
    ['R2_ACCOUNT_ID', ACCOUNT],
    ['R2_ACCESS_KEY_ID', ACCESS_KEY],
    ['R2_SECRET_ACCESS_KEY', SECRET_KEY],
    ['R2_BUCKET', BUCKET],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k)

  if (eksik.length) {
    return json({ error: `R2 anahtarları tanımlı değil: ${eksik.join(', ')}` }, 500)
  }

  const auth = req.headers.get('Authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return json({ error: 'yetkisiz' }, 401)

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return json({ error: 'geçersiz istek' }, 400)
  }

  const action = body?.action

  /* ---------------------------------------------------- yükleme adresi */
  if (action === 'put') {
    const key = safeKey(body?.key)
    if (!key) return json({ error: 'geçersiz dosya yolu' }, 400)

    const contentType = typeof body?.contentType === 'string' && body.contentType ? body.contentType : 'application/octet-stream'
    const url = new URL(objectUrl(key))
    url.searchParams.set('X-Amz-Expires', '900')

    const signed = await aws.sign(url.toString(), {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      aws: { signQuery: true },
    })

    return json({
      url: signed.url,
      key,
      contentType,
      publicUrl: PUBLIC_URL ? `${PUBLIC_URL}/${key}` : null,
      expiresIn: 900,
    })
  }

  /* --------------------------------------------------------- silme */
  if (action === 'delete') {
    const keys: unknown[] = Array.isArray(body?.keys) ? body.keys : []
    const results: Array<{ key: string; ok: boolean; status: number }> = []

    for (const raw of keys.slice(0, 50)) {
      const key = safeKey(raw)
      if (!key) continue
      try {
        const res = await aws.fetch(objectUrl(key), { method: 'DELETE' })
        results.push({ key, ok: res.ok || res.status === 404, status: res.status })
      } catch {
        results.push({ key, ok: false, status: 0 })
      }
    }
    return json({ ok: results.every((r) => r.ok), results })
  }

  /* ------------------------------------------------------- sağlık */
  if (action === 'ping') {
    return json({ ok: true, bucket: BUCKET, publicUrl: PUBLIC_URL || null })
  }

  return json({ error: 'bilinmeyen işlem' }, 400)
})
