/**
 * Cloudflare R2 depolama köprüsü.
 *
 * Neden böyle: R2'nin gizli anahtarı tarayıcıya konmaz (VITE_* değişkenleri
 * paket içinde herkese açıktır). Bunun yerine Supabase Edge Function
 * (`supabase/functions/r2`) anahtarları sunucu tarafında tutar ve tarayıcıya
 * yalnızca 15 dakikalık imzalı yükleme adresi üretir. Yükleme sonrası dosya
 * herkese açık kalıcı adresten (r2.dev / özel alan adı) servis edilir.
 *
 * Anahtarlar tanımlı değilse her şey eskisi gibi Supabase Storage'a gider.
 */
import { MEDIA_BUCKET, publicUrl as supabasePublicUrl, supabase } from './supabase'

const env = import.meta.env as Record<string, string | undefined>

const R2_PUBLIC = (env.VITE_R2_PUBLIC_URL || '').trim().replace(/\/+$/, '')
const FORCE = (env.VITE_STORAGE_PROVIDER || '').trim().toLowerCase()

/** depolar: 'r2' | 'supabase' */
export const storageMode: 'r2' | 'supabase' =
  R2_PUBLIC && FORCE !== 'supabase' ? 'r2' : 'supabase'

function extOf(name: string, fallback = 'bin') {
  const clean = (name || '').split('?')[0]
  const parts = clean.split('.')
  if (parts.length < 2) return fallback
  return parts.pop()!.toLowerCase().slice(0, 6) || fallback
}

export interface Uploaded {
  url: string
  path: string
  size: number
  name: string
}

function r2ErrorMessage(e: any): string {
  const raw = String(e?.message || e?.error || e || '')
  if (/Failed to send|FunctionsFetchError|not found|404/i.test(raw))
    return 'Depo köprüsü (r2) bulunamadı. Supabase Edge Function kurulu değil ya da adı farklı.'
  if (/R2 anahtarları|R2_/i.test(raw)) return raw
  if (/CORS|blocked/i.test(raw))
    return 'R2 kovasında CORS ayarı eksik. Cloudflare → R2 → kovan → Settings → CORS bölümüne KURULUM-R2.md dosyasındaki ayarı ekle.'
  return raw || 'Yükleme başarısız'
}

/** tarayıcıdan doğrudan R2'ye yükle (imzalı adresle) */
async function uploadToR2(file: Blob, path: string, name: string): Promise<Uploaded> {
  const contentType = file.type || 'application/octet-stream'
  const { data, error } = await supabase.functions.invoke('r2', {
    body: { action: 'put', key: path, contentType },
  })
  if (error) throw new Error(r2ErrorMessage(error))
  if (!data?.url) throw new Error(r2ErrorMessage(data?.error || 'imzalı adres alınamadı'))

  const res = await fetch(data.url as string, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file as BodyInit,
  }).catch((e) => {
    throw new Error(r2ErrorMessage(e))
  })
  if (!res.ok) {
    throw new Error(
      res.status === 403
        ? 'R2 yükleme reddedildi (403). Anahtarların/kovanın doğru olduğundan emin ol.'
        : `R2 yükleme hatası (${res.status})`,
    )
  }
  return {
    url: data.publicUrl || `${R2_PUBLIC}/${path}`,
    path,
    size: file.size,
    name: name || path.split('/').pop() || 'dosya',
  }
}

/** Dosyayı depoya yükler ve herkese açık kalıcı URL döner. */
export async function uploadMedia(
  file: Blob,
  folder: string,
  name: string,
  bucket = MEDIA_BUCKET,
): Promise<Uploaded> {
  const ext = extOf(name || (file instanceof File ? file.name : 'dosya'))
  const path = `${folder}/${crypto.randomUUID()}.${ext}`

  if (storageMode === 'r2' && bucket === MEDIA_BUCKET) {
    return uploadToR2(file, path, name)
  }

  const contentType = file.type || 'application/octet-stream'
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return {
    url: supabasePublicUrl(bucket, path),
    path,
    size: file.size,
    name: name || `dosya.${ext}`,
  }
}

/** R2 anahtarı üretir: "chat/xxx/uuid.mp4" */
export function mediaKey(path: string) {
  return path
}

function r2KeyFromUrl(url: string): string | null {
  if (!R2_PUBLIC) return null
  const prefix = `${R2_PUBLIC}/`
  if (!url.startsWith(prefix)) return null
  return decodeURIComponent(url.slice(prefix.length).split('?')[0]) || null
}

function supabasePathFromUrl(url: string, bucket: string): string | null {
  const marker = `/object/public/${bucket}/`
  const at = url.indexOf(marker)
  if (at < 0) return null
  return decodeURIComponent(url.slice(at + marker.length).split('?')[0]) || null
}

/** Verilen yolları depodan siler (R2 ise sunucu tarafında, değilse Storage API). */
export async function deleteMediaPaths(paths: string[], bucket = MEDIA_BUCKET): Promise<boolean> {
  const list = paths.filter(Boolean)
  if (!list.length) return true

  if (storageMode === 'r2' && bucket === MEDIA_BUCKET) {
    const { error } = await supabase.functions.invoke('r2', { body: { action: 'delete', keys: list } })
    return !error
  }

  const { error } = await supabase.storage.from(bucket).remove(list)
  return !error
}

/**
 * Karışık adres listesini (R2 + eski Supabase adresleri) depodan siler.
 * Sunucudan gelen "şu dosyaları sil" listeleri için kullanılır; hata yutulur,
 * çünkü zaten silinmiş bir dosya yüzünden temizlik durmamalı.
 */
export async function deleteMediaUrls(urls: (string | null | undefined)[], bucket = MEDIA_BUCKET): Promise<number> {
  const r2Keys: string[] = []
  const sbPaths: string[] = []

  for (const url of urls) {
    if (!url) continue
    const r2Key = r2KeyFromUrl(url)
    if (r2Key) {
      r2Keys.push(r2Key)
      continue
    }
    const sbPath = supabasePathFromUrl(url, bucket)
    if (sbPath) sbPaths.push(sbPath)
  }

  let silinen = 0

  for (let i = 0; i < r2Keys.length; i += 50) {
    try {
      const { error } = await supabase.functions.invoke('r2', {
        body: { action: 'delete', keys: r2Keys.slice(i, i + 50) },
      })
      if (!error) silinen += Math.min(50, r2Keys.length - i)
    } catch {
      /* sıradaki partla devam */
    }
  }

  for (let i = 0; i < sbPaths.length; i += 20) {
    try {
      const { error } = await supabase.storage.from(bucket).remove(sbPaths.slice(i, i + 20))
      if (!error) silinen += Math.min(20, sbPaths.length - i)
    } catch {
      /* sıradaki partla devam */
    }
  }

  return silinen
}

/**
 * URL'den dosyayı siler (mesaj/durum silinince çağrılır).
 * Hem R2 hem Supabase adreslerini tanır.
 */
export async function deleteMediaByUrl(url?: string | null, bucket = MEDIA_BUCKET): Promise<boolean> {
  if (!url) return false

  const r2Key = r2KeyFromUrl(url)
  if (r2Key) return deleteMediaPaths([r2Key], bucket)

  const sbPath = supabasePathFromUrl(url, bucket)
  if (sbPath) {
    const { error } = await supabase.storage.from(bucket).remove([sbPath])
    return !error
  }
  return false
}
