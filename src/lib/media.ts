/**
 * Medya hazırlama yardımcıları.
 *
 * Supabase Storage'ın ücretsiz planında dosya başına sınır ~50 MB. Telefonla çekilen
 * videolar bunu kolayca aştığı için göndermeden önce tarayıcıda küçültüyoruz.
 */

/** güvenli üst sınır (50 MB sunucu sınırının altında kalalım) */
export const MAX_UPLOAD_BYTES = 45 * 1024 * 1024
/** bu boyutun altındaki videolar olduğu gibi gider */
export const VIDEO_COMPRESS_OVER = 40 * 1024 * 1024
/** küçültmede en uzun kenar */
const MAX_EDGE = 1280
const VIDEO_BITRATE = 1_100_000
const AUDIO_BITRATE = 96_000

export function humanSize(bytes: number) {
  if (!bytes || bytes < 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function pickVideoMime(preferMp4 = false): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const webm = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
  const mp4 = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4']
  const list = preferMp4 ? [...mp4, ...webm] : [...webm, ...mp4]
  for (const t of list) {
    try {
      if (MediaRecorder.isTypeSupported(t)) return t
    } catch {
      /* devam */
    }
  }
  return ''
}

function captureStreamOf(video: HTMLVideoElement): MediaStream | null {
  const anyVideo = video as any
  const fn = anyVideo.captureStream || anyVideo.mozCaptureStream
  if (typeof fn !== 'function') return null
  try {
    return fn.call(video) as MediaStream
  } catch {
    return null
  }
}

/**
 * Videoyu gönderilebilir hale getirir: gerekiyorsa 720p/1.1 Mbps'ye küçültür.
 * Küçültme gerçek zamanlıdır (video süresi kadar sürer), ilerleme 0..1 bildirilir.
 */
export async function prepareVideo(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  if (!file.type.startsWith('video/')) return file
  if (file.size <= VIDEO_COMPRESS_OVER) return file

  const mime = pickVideoMime(/mp4|quicktime/i.test(file.type))
  if (!mime) {
    throw new Error(
      `Video ${humanSize(file.size)} — tarayıcı videoyu küçültemiyor. Lütfen daha kısa bir video seç (en fazla 45 MB).`,
    )
  }

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.playsInline = true
  video.preload = 'auto'
  video.controls = false

  const cleanup = () => {
    try {
      video.pause()
    } catch {
      /* yoksay */
    }
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
  }

  try {
    await new Promise<void>((res, rej) => {
      const fail = () => rej(new Error('Video okunamadı (bozuk ya da desteklenmeyen format)'))
      video.onloadedmetadata = () => res()
      video.onerror = fail
      window.setTimeout(() => {
        if (!video.videoWidth) fail()
      }, 15000)
    })

    const duration = Number.isFinite(video.duration) ? video.duration : 0
    if (duration > 20 * 60) {
      throw new Error('Video 20 dakikadan uzun. Lütfen daha kısa bir video seç.')
    }

    const srcW = video.videoWidth || 1280
    const srcH = video.videoHeight || 720
    const scale = Math.min(1, MAX_EDGE / Math.max(srcW, srcH))
    const w = Math.max(2, Math.round((srcW * scale) / 2) * 2)
    const h = Math.max(2, Math.round((srcH * scale) / 2) * 2)

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Video küçültülemedi (canvas yok)')

    const out = canvas.captureStream(30)
    const media = captureStreamOf(video)
    if (media) for (const track of media.getAudioTracks()) out.addTrack(track)

    const recorder = new MediaRecorder(out, {
      mimeType: mime,
      videoBitsPerSecond: VIDEO_BITRATE,
      audioBitsPerSecond: AUDIO_BITRATE,
    })
    const chunks: BlobPart[] = []
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data)
    }
    const finished = new Promise<Blob>((res) => {
      recorder.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] }))
    })

    recorder.start(1000)

    let raf = 0
    const draw = () => {
      if (video.paused || video.ended) return
      try {
        ctx.drawImage(video, 0, 0, w, h)
      } catch {
        /* tek kare atlanabilir */
      }
      if (duration) onProgress?.(Math.min(0.99, video.currentTime / duration))
      raf = requestAnimationFrame(draw)
    }

    // video hiç bitmezse (bozuk süre bilgisi) sonsuza kadar bekleme
    const limit = (duration > 0 && Number.isFinite(duration) ? duration : 180) * 1000 + 45000
    let guard = 0
    const safety = new Promise<void>((res) => {
      guard = window.setTimeout(res, limit)
    })

    await video.play()
    draw()
    await Promise.race([
      new Promise<void>((res) => {
        video.onended = () => res()
      }),
      safety,
    ])
    window.clearTimeout(guard)
    if (raf) cancelAnimationFrame(raf)
    if (recorder.state !== 'inactive') recorder.stop()
    const blob = await finished
    out.getTracks().forEach((t) => t.stop())

    if (!blob.size) throw new Error('Video küçültülemedi, lütfen başka bir video dene.')

    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
    const base = file.name.replace(/\.[^.]+$/, '') || 'video'
    const outFile = new File([blob], `${base}.${ext}`, { type: blob.type || 'video/webm' })

    if (outFile.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `Video ${humanSize(file.size)} → küçültülünce ${humanSize(outFile.size)} kaldı, sınır 45 MB. Daha kısa bir video seç.`,
      )
    }
    onProgress?.(1)
    return outFile
  } finally {
    cleanup()
  }
}

/** Gönderim öncesi genel kontrol (foto/dosya/video) */
export async function prepareFile(
  file: File,
  onProgress?: (ratio: number) => void,
): Promise<File> {
  if (file.type.startsWith('video/')) return prepareVideo(file, onProgress)
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `"${file.name}" ${humanSize(file.size)} — tek dosya sınırı 45 MB. Lütfen daha küçük bir dosya seç.`,
    )
  }
  return file
}

/** Storage yükleme hatalarını anlaşılır Türkçe metne çevirir */
export function uploadErrorText(e: any, size: number) {
  const raw = String(e?.message || e?.error_description || e?.error || e?.statusCode || e || '')
  if (/too large|exceeded|maximum|payload|413|entity/i.test(raw))
    return `Dosya çok büyük (${humanSize(size)}). Tek dosya sınırı 45 MB — daha küçük bir video/fotoğraf seç.`
  if (/mime|content.?type|not supported/i.test(raw)) return 'Bu dosya türü desteklenmiyor.'
  if (/network|fetch|failed to fetch|timeout/i.test(raw))
    return 'Yükleme sırasında bağlantı koptu. İnterneti kontrol edip tekrar dene.'
  if (/row-level security|policy/i.test(raw)) return 'Yükleme izni yok (oturumu yenile ve tekrar dene).'
  return 'Yükleme hatası: ' + (raw || 'bilinmeyen hata')
}
