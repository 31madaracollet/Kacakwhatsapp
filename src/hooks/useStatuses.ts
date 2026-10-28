import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteMediaByUrl, supabase, uploadMedia } from '../lib/supabase'
import { prepareFile, humanSize, uploadErrorText } from '../lib/media'
import { mapStatus } from '../lib/map'
import type { Status, StatusKind } from '../lib/types'
import { useAuth } from './useAuth'

/** WhatsApp tarzı 24 saatlik durumlar */
export function useStatuses() {
  const { user } = useAuth()
  const meId = user?.id

  const [statuses, setStatuses] = useState<Status[]>([])
  const [loading, setLoading] = useState(true)
  const [views, setViews] = useState<Record<string, number>>({})

  const load = useCallback(async () => {
    setLoading(true)
    try {
      // süre süzgecini sunucuya bırakıyoruz: RLS "expires_at > now()" ile süzüyor.
      // (cihaz saati ileri/geri olunca durumlar görünmez oluyordu)
      const { data, error } = await supabase
        .from('statuses')
        .select('*, profile:profiles(*)')
        .order('created_at', { ascending: true })
      if (error) throw error
      setStatuses(((data || []) as any[]).map(mapStatus))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /* süresi dolmuş durumları (ve dosyalarını) temizle: depo şişmesin */
  useEffect(() => {
    if (!meId) return
    void (async () => {
      try {
        await supabase.rpc('purge_expired_statuses')
        await supabase.rpc('purge_orphan_media')
        await load()
      } catch {
        /* yoksay */
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meId])

  /* görüntüleme sayıları */
  const loadViews = useCallback(async () => {
    if (!meId) return
    const { data } = await supabase.from('status_views').select('status_id')
    const map: Record<string, number> = {}
    for (const row of (data || []) as any[]) map[row.status_id] = (map[row.status_id] || 0) + 1
    setViews(map)
  }, [meId])

  useEffect(() => {
    void loadViews()
  }, [loadViews])

  /* realtime: yeni durum / silinen durum */
  useEffect(() => {
    if (!meId) return
    const ch = supabase
      .channel('zap-durumlar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, () => {
        void load()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_views' }, () => {
        void loadViews()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [meId, load, loadViews])

  const createStatus = useCallback(
    async (
      kind: StatusKind,
      body: string,
      file?: File | null,
      bg?: string,
      onProgress?: (msg: string) => void,
    ) => {
      if (!meId) throw new Error('Oturum bulunamadı')
      let media_url: string | null = null
      let media_meta: any = null

      if (file && (kind === 'image' || kind === 'video')) {
        onProgress?.(kind === 'video' ? 'Video hazırlanıyor…' : 'Fotoğraf hazırlanıyor…')
        const prepared = await prepareFile(file, (ratio) =>
          onProgress?.(`Video küçültülüyor %${Math.round(ratio * 100)} (${humanSize(file.size)})`),
        )
        onProgress?.(`Yükleniyor… (${humanSize(prepared.size)})`)
        let up: { url: string; path: string; size: number; name: string }
        try {
          up = await uploadMedia(prepared, `durum/${meId}`, prepared.name)
        } catch (e: any) {
          throw new Error(uploadErrorText(e, prepared.size))
        }
        media_url = up.url
        media_meta = { name: up.name, size: up.size, type: prepared.type, path: up.path }
      }

      onProgress?.('Paylaşılıyor…')
      const { error } = await supabase.from('statuses').insert({
        user_id: meId,
        kind,
        body: body.trim() || null,
        media_url,
        media_meta,
        bg: bg || '#0a7c5a',
      })
      if (error) {
        // durum satırı yazılamadıysa yüklediğimiz dosyayı geri sil
        if (media_url) await deleteMediaByUrl(media_url)
        throw new Error(statusErrorText(error.message))
      }
      await load()
    },
    [meId, load],
  )

  const removeStatus = useCallback(
    async (id: string) => {
      const target = statuses.find((s) => s.id === id)
      const { error } = await supabase.from('statuses').delete().eq('id', id)
      if (error) throw new Error(error.message)
      // yer kaplamasın: medya dosyasını da depodan kaldır
      if (target?.media_url) await deleteMediaByUrl(target.media_url)
      await load()
    },
    [load, statuses],
  )

  const markViewed = useCallback(
    async (statusId: string) => {
      if (!meId) return
      await supabase
        .from('status_views')
        .upsert({ status_id: statusId, viewer_id: meId }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true })
      setViews((prev) => ({ ...prev, [statusId]: (prev[statusId] || 0) + 1 }))
    },
    [meId],
  )

  const myStatuses = useMemo(() => statuses.filter((s) => s.user_id === meId), [statuses, meId])

  /** kullanıcıya göre grupla: [ben, ...diğerleri] */
  const groups = useMemo(() => {
    const byUser = new Map<string, Status[]>()
    for (const s of statuses) {
      const list = byUser.get(s.user_id) || []
      list.push(s)
      byUser.set(s.user_id, list)
    }
    const rows = Array.from(byUser.entries()).map(([userId, list]) => ({
      userId,
      profile: list[0]?.profile,
      items: list,
      isMine: userId === meId,
      lastAt: list[list.length - 1]?.created_at,
    }))
    return rows.sort((a, b) => {
      if (a.isMine) return -1
      if (b.isMine) return 1
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime()
    })
  }, [statuses, meId])

  return {
    statuses,
    myStatuses,
    groups,
    views,
    loading,
    createStatus,
    removeStatus,
    markViewed,
    reload: load,
  }
}

export type Statuses = ReturnType<typeof useStatuses>


function statusErrorText(msg: string) {
  if (/row-level security|policy/i.test(msg)) return 'Durum paylaşma yetkin yok (oturumu yenile).'
  if (/kind/i.test(msg)) return 'Durum türü desteklenmiyor.'
  return 'Durum paylaşılamadı: ' + msg
}
