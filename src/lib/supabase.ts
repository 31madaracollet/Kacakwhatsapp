import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://szhpjbuuiltkqhhgmphm.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aHBqYnV1aWx0a3FoaGdtcGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzM1NDAsImV4cCI6MjEwODYwOTU0MH0.cx2mB8PnCH2HOk7g46VIJwkz5UdQwy6mfvK7Y_5xOEM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 20 } },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

export const MEDIA_BUCKET = 'media'
export const AVATAR_BUCKET = 'avatars'

function extOf(name: string, fallback = 'bin') {
  const clean = name.split('?')[0]
  const parts = clean.split('.')
  if (parts.length < 2) return fallback
  return parts.pop()!.toLowerCase().slice(0, 6)
}

export function publicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/** Dosyayı Supabase Storage'a yükler ve herkese açık URL döner. */
export async function uploadMedia(
  file: Blob,
  folder: string,
  name: string,
  bucket = MEDIA_BUCKET,
): Promise<{ url: string; path: string; size: number; name: string }> {
  const ext = extOf(name || (file instanceof File ? file.name : 'dosya'))
  const path = `${folder}/${crypto.randomUUID()}.${ext}`
  const contentType = file.type || 'application/octet-stream'
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return { url: publicUrl(bucket, path), path, size: file.size, name: name || `dosya.${ext}` }
}

export async function uploadAvatar(userId: string, file: Blob) {
  const ext = extOf(file instanceof File ? file.name : 'jpg', 'jpg')
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) throw error
  return publicUrl(AVATAR_BUCKET, path)
}
