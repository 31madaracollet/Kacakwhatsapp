// HappyProjects — yönetici işlemleri (hesap açma, rol, uygulama erişimi)
// Supabase Edge Function · tablolar public şemasında hub_ önekiyle durur.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Sadece POST' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader) return json({ error: 'Yetkisiz' }, 401)

  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: authData, error: authErr } = await userClient.auth.getUser()
  if (authErr || !authData.user) return json({ error: 'Geçersiz oturum' }, 401)

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

  // istek sahibi gerçekten yönetici mi?
  const { data: me } = await admin
    .from('hub_profiles')
    .select('role, is_active')
    .eq('id', authData.user.id)
    .maybeSingle()
  if (!me || me.role !== 'admin' || !me.is_active) {
    return json({ error: 'Bu işlem için yönetici olmalısın' }, 403)
  }

  let payload: any = {}
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Geçersiz istek gövdesi' }, 400)
  }
  const action = payload.action

  const log = async (a: string, detail: string) => {
    await admin.from('hub_activity').insert({ user_id: authData.user!.id, action: a, detail })
  }

  try {
    switch (action) {
      /* ------------------------------------------------------ kullanıcılar */
      case 'list_users': {
        const { data: profiles, error } = await admin
          .from('hub_profiles')
          .select('*')
          .order('created_at', { ascending: false })
        if (error) throw error
        const { data: access } = await admin.from('hub_access').select('*')
        const byUser: Record<string, string[]> = {}
        for (const a of access ?? []) {
          byUser[a.user_id] = [...(byUser[a.user_id] ?? []), a.app_slug]
        }
        const users = (profiles ?? []).map((p: any) => ({ ...p, apps: byUser[p.id] ?? [] }))
        return json({ users })
      }

      case 'create_user': {
        const email = String(payload.email ?? '').trim().toLowerCase()
        const password = String(payload.password ?? '')
        const fullName = String(payload.full_name ?? '').trim()
        const role = payload.role === 'admin' ? 'admin' : 'user'
        const apps: string[] = Array.isArray(payload.apps) ? payload.apps : []

        if (!email.includes('@')) return json({ error: 'Geçerli bir e-posta gir' }, 400)
        if (password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı' }, 400)

        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || email.split('@')[0] },
        })
        if (error) return json({ error: error.message }, 400)

        const uid = created.user!.id
        await admin
          .from('hub_profiles')
          .upsert(
            { id: uid, email, full_name: fullName || email.split('@')[0], role },
            { onConflict: 'id' },
          )

        if (apps.length) {
          await admin.from('hub_access').insert(apps.map((slug) => ({ user_id: uid, app_slug: slug })))
        }
        await log('create_user', `${email} (${role})`)
        return json({ ok: true, user_id: uid })
      }

      case 'set_access': {
        const uid = String(payload.user_id ?? '')
        const apps: string[] = Array.isArray(payload.apps) ? payload.apps : []
        if (!uid) return json({ error: 'user_id gerekli' }, 400)
        await admin.from('hub_access').delete().eq('user_id', uid)
        if (apps.length) {
          await admin.from('hub_access').insert(apps.map((slug) => ({ user_id: uid, app_slug: slug })))
        }
        await log('set_access', `${uid}: ${apps.join(', ') || 'yok'}`)
        return json({ ok: true })
      }

      case 'set_role': {
        const uid = String(payload.user_id ?? '')
        const role = payload.role === 'admin' ? 'admin' : 'user'
        if (!uid) return json({ error: 'user_id gerekli' }, 400)
        if (uid === authData.user.id && role !== 'admin')
          return json({ error: 'Kendi yöneticiliğini kaldıramazsın' }, 400)
        const { error } = await admin.from('hub_profiles').update({ role }).eq('id', uid)
        if (error) throw error
        await log('set_role', `${uid} → ${role}`)
        return json({ ok: true })
      }

      case 'set_active': {
        const uid = String(payload.user_id ?? '')
        const isActive = Boolean(payload.is_active)
        if (uid === authData.user.id && !isActive)
          return json({ error: 'Kendi hesabını kapatamazsın' }, 400)
        const { error } = await admin.from('hub_profiles').update({ is_active: isActive }).eq('id', uid)
        if (error) throw error
        await log('set_active', `${uid} → ${isActive}`)
        return json({ ok: true })
      }

      case 'reset_password': {
        const uid = String(payload.user_id ?? '')
        const password = String(payload.password ?? '')
        if (password.length < 6) return json({ error: 'Şifre en az 6 karakter olmalı' }, 400)
        const { error } = await admin.auth.admin.updateUserById(uid, { password })
        if (error) return json({ error: error.message }, 400)
        await log('reset_password', uid)
        return json({ ok: true })
      }

      case 'delete_user': {
        const uid = String(payload.user_id ?? '')
        if (uid === authData.user.id) return json({ error: 'Kendi hesabını silemezsin' }, 400)
        const { error } = await admin.auth.admin.deleteUser(uid)
        if (error) return json({ error: error.message }, 400)
        await log('delete_user', uid)
        return json({ ok: true })
      }

      /* --------------------------------------------------------- uygulamalar */
      case 'update_app': {
        const slug = String(payload.slug ?? '')
        if (!slug) return json({ error: 'slug gerekli' }, 400)
        const patch: Record<string, unknown> = {}
        for (const key of ['name', 'description', 'url', 'emoji', 'color', 'category', 'sort', 'is_active']) {
          if (payload[key] !== undefined) patch[key] = payload[key]
        }
        const { error } = await admin.from('hub_apps').update(patch).eq('slug', slug)
        if (error) throw error
        await log('update_app', slug)
        return json({ ok: true })
      }

      case 'create_app': {
        const slug = String(payload.slug ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-')
        if (!slug) return json({ error: 'slug gerekli' }, 400)
        const { error } = await admin.from('hub_apps').upsert(
          {
            slug,
            name: String(payload.name ?? slug),
            description: String(payload.description ?? ''),
            url: payload.url ?? null,
            emoji: String(payload.emoji ?? '🚀'),
            color: String(payload.color ?? '#1a73e8'),
            category: String(payload.category ?? 'Uygulama'),
            sort: Number(payload.sort ?? 100),
            is_active: payload.is_active !== false,
          },
          { onConflict: 'slug' },
        )
        if (error) throw error
        await log('create_app', slug)
        return json({ ok: true })
      }

      case 'list_activity': {
        const { data } = await admin
          .from('hub_activity')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50)
        return json({ activity: data ?? [] })
      }

      default:
        return json({ error: `Bilinmeyen işlem: ${action}` }, 400)
    }
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500)
  }
})
