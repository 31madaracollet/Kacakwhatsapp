import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export interface AdminUser {
  id: string
  username: string
  display_name: string
  email: string | null
  avatar_url: string | null
  is_admin: boolean
  is_banned: boolean
  last_seen: string | null
  created_at: string
  mesaj?: number
}

export interface AdminStats {
  kullanici: number
  yonetici: number
  yasakli: number
  sohbet: number
  mesaj: number
  durum: number
  arama: number
  bugun_aktif: number
}

/** Yönetici paneli: kullanıcılar, yasak, duyuru, istatistik */
export function useAdmin() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = Boolean(profile?.is_admin)

  const load = useCallback(async () => {
    if (!isAdmin) return
    setLoading(true)
    setError(null)
    try {
      const [{ data: list, error: uErr }, { data: st }] = await Promise.all([
        supabase.rpc('admin_list_users'),
        supabase.rpc('admin_stats'),
      ])
      if (uErr) throw uErr
      setUsers((list || []) as AdminUser[])
      setStats((st || null) as AdminStats | null)
    } catch (e: any) {
      setError(e.message || 'Yönetici verileri alınamadı')
    } finally {
      setLoading(false)
    }
  }, [isAdmin])

  useEffect(() => {
    void load()
  }, [load])

  const setAdmin = useCallback(
    async (userId: string, value: boolean) => {
      const { error } = await supabase.rpc('admin_set_admin', { target: userId, value })
      if (error) throw new Error(error.message)
      await load()
    },
    [load],
  )

  const setBanned = useCallback(
    async (userId: string, value: boolean) => {
      const { error } = await supabase.rpc('admin_set_banned', { target: userId, value })
      if (error) throw new Error(error.message)
      await load()
    },
    [load],
  )

  const broadcast = useCallback(
    async (message: string) => {
      const { data, error } = await supabase.rpc('admin_broadcast', { msg: message })
      if (error) throw new Error(error.message)
      await load()
      return data as number
    },
    [load],
  )

  const deleteMessage = useCallback(async (messageId: string) => {
    const { error } = await supabase.rpc('admin_delete_message', { mid: messageId })
    if (error) throw new Error(error.message)
  }, [])

  return { users, stats, loading, error, isAdmin, reload: load, setAdmin, setBanned, broadcast, deleteMessage }
}

export type Admin = ReturnType<typeof useAdmin>
