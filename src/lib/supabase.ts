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

/** Fotoğrafı ortadan kare kırpar, 512 px'e küçültür (profil fotoğrafı bozulmasın). */
export async function squareImage(file: File | Blob, size = 512): Promise<Blob> {
  try {
    const bitmap = 'createImageBitmap' in window ? await createImageBitmap(file) : await loadImage(file)
    const w = 'width' in bitmap ? bitmap.width : 0
    const h = 'height' in bitmap ? bitmap.height : 0
    if (!w || !h) throw new Error('görsel okunamadı')
    const side = Math.min(w, h)
    const sx = (w - side) / 2
    const sy = (h - side) / 2
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('canvas yok')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap as CanvasImageSource, sx, sy, side, side, 0, 0, size, size)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9))
    if (!blob) throw new Error('dönüştürme başarısız')
    return blob
  } catch {
    return file // olmazsa ham dosya yüklenir
  }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      res(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('görsel yüklenemedi'))
    }
    img.src = url
  })
}

/**
 * Yüklenen bir dosyayı depodan (Storage) siler; böylece yer kaplamaz.
 * URL'den yolu çıkarır. Sahibi olmadığımız dosyalarda yönetici RPC'sini dener.
 */
export async function deleteMediaByUrl(url?: string | null, bucket = MEDIA_BUCKET): Promise<boolean> {
  if (!url) return false
  const marker = `/object/public/${bucket}/`
  const at = url.indexOf(marker)
  if (at < 0) return false
  const path = decodeURIComponent(url.slice(at + marker.length).split('?')[0])
  if (!path) return false

  try {
    const { error } = await supabase.storage.from(bucket).remove([path])
    if (!error) return true
  } catch {
    /* alta düş */
  }

  // kendi dosyamız değilse yönetici olarak silmeyi dene
  try {
    const { data, error } = await supabase.rpc('delete_media_admin', { p_path: path })
    return !error && data === true
  } catch {
    return false
  }
}

export async function uploadAvatar(userId: string, file: Blob) {
  const isImage = (file.type || '').startsWith('image/')
  const blob = isImage ? await squareImage(file, 512) : file
  const name = file instanceof File ? file.name : 'avatar.jpg'
  const ext = blob.type === 'image/jpeg' ? 'jpg' : extOf(name, 'jpg')
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: true,
  })
  if (error) throw error
  return publicUrl(AVATAR_BUCKET, path)
}
