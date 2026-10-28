import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { deleteMediaUrls } from '../lib/storage'
import { useAuth } from './useAuth'

/**
 * Mesaj saklama süresi temizliği.
 *
 * Sunucudaki `purge_expired_messages()` üç günden eski mesajları siler ve
 * dosya adreslerini döndürür; dosyaları da burada depodan siliyoruz ki
 * kota şişmesin. Uygulama açılışında, sekme öne gelince ve 10 dakikada bir
 * çalışır (uzun açık kalan oturumlarda da süre dolanlar gitsin).
 */
export function useRetention(onTemizlendi?: (adet: number) => void) {
  const { user } = useAuth()
  const meId = user?.id
  const calisiyor = useRef(false)
  const geriCagri = useRef(onTemizlendi)
  geriCagri.current = onTemizlendi

  useEffect(() => {
    if (!meId) return

    const temizle = async () => {
      if (calisiyor.current) return
      calisiyor.current = true
      try {
        const adresler: string[] = []

        // 1) süresi dolmuş mesajlar (3 gün)
        const { data: mesajlar, error } = await supabase.rpc('purge_expired_messages')
        if (!error && Array.isArray(mesajlar)) {
          for (const u of mesajlar) if (typeof u === 'string' && u) adresler.push(u)
        }

        // 2) sahipsiz kalmış dosyalar (yükleme yarıda kaldıysa vb.)
        const { data: sahipsiz } = await supabase.rpc('purge_orphan_media')
        if (Array.isArray(sahipsiz)) {
          for (const p of sahipsiz) if (typeof p === 'string' && p) adresler.push(p)
        }

        if (adresler.length) {
          await deleteMediaUrls(adresler)
          geriCagri.current?.(adresler.length)
        }
      } catch {
        /* temizlik asla uygulamayı engellemez */
      } finally {
        calisiyor.current = false
      }
    }

    void temizle()

    const zamanlayici = window.setInterval(() => void temizle(), 10 * 60 * 1000)
    const onGorunurluk = () => {
      if (document.visibilityState === 'visible') void temizle()
    }
    document.addEventListener('visibilitychange', onGorunurluk)

    return () => {
      window.clearInterval(zamanlayici)
      document.removeEventListener('visibilitychange', onGorunurluk)
    }
  }, [meId])
}
