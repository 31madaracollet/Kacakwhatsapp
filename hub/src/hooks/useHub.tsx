import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { adminCall, supabase } from '../lib/supabase'
import type { Activity, HubApp, HubProfile } from '../lib/types'

interface HubContextValue {
  session: Session | null
  profile: HubProfile | null
  apps: HubApp[]
  myApps: HubApp[]
  users: HubProfile[]
  activity: Activity[]
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  loadUsers: () => Promise<void>
  loadActivity: () => Promise<void>
  openApp: (app: HubApp) => Promise<void>
  access: string[]
  hasAccess: (slug: string) => boolean
}

const HubContext = createContext<HubContextValue | null>(null)

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<HubProfile | null>(null)
  const [apps, setApps] = useState<HubApp[]>([])
  const [users, setUsers] = useState<HubProfile[]>([])
  const [access, setAccess] = useState<string[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)

  const loadApps = useCallback(async () => {
    const { data } = await supabase.from('hub_apps').select('*').order('sort')
    setApps((data as HubApp[]) ?? [])
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    const [{ data }, { data: acc }] = await Promise.all([
      supabase.from('hub_profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('hub_access').select('app_slug').eq('user_id', userId),
    ])
    setAccess(((acc ?? []) as { app_slug: string }[]).map((a) => a.app_slug))
    if (data) {
      setProfile(data as HubProfile)
      // son giriş zamanı
      await supabase.from('hub_profiles').update({ last_login: new Date().toISOString() }).eq('id', userId)
    } else {
      setProfile(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    setSession(data.session)
    if (data.session?.user) await loadProfile(data.session.user.id)
    await loadApps()
  }, [loadApps, loadProfile])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      await loadApps()
      setLoading(false)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s?.user) await loadProfile(s.user.id)
      else {
        setProfile(null)
        setUsers([])
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadApps, loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) {
      const m = error.message.toLowerCase()
      if (m.includes('invalid login credentials')) throw new Error('E-posta veya şifre hatalı')
      if (m.includes('email not confirmed')) throw new Error('E-posta adresi henüz onaylanmadı')
      throw new Error(error.message)
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  const isAdmin = profile?.role === 'admin' && profile?.is_active !== false

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return
    const res = await adminCall('list_users')
    if (Array.isArray(res.users)) setUsers(res.users as HubProfile[])
  }, [isAdmin])

  const loadActivity = useCallback(async () => {
    if (!isAdmin) return
    const res = await adminCall('list_activity')
    if (Array.isArray(res.activity)) setActivity(res.activity as Activity[])
  }, [isAdmin])

  /** Uygulamayı açar; oturumu hash üzerinden karşı tarafa devreder (SSO). */
  const openApp = useCallback(async (app: HubApp) => {
    if (!app.url) return
    const { data } = await supabase.auth.getSession()
    const s = data.session
    if (!s) {
      window.open(app.url, '_blank', 'noopener')
      return
    }
    const base = app.url.replace(/\/$/, '')
    const params = new URLSearchParams({
      sso_access_token: s.access_token,
      sso_refresh_token: s.refresh_token,
      sso_provider: 'happyprojects',
    })
    window.open(`${base}/#${params.toString()}`, '_blank', 'noopener')
  }, [])

  const myApps = useMemo(() => apps.filter((a) => a.is_active), [apps])
  const hasAccess = useCallback(
    (slug: string) => isAdmin || access.length === 0 || access.includes(slug),
    [isAdmin, access],
  )

  const value: HubContextValue = {
    session,
    profile,
    apps,
    myApps,
    users,
    activity,
    loading,
    isAdmin,
    signIn,
    signOut,
    refresh,
    loadUsers,
    loadActivity,
    openApp,
    access,
    hasAccess,
  }

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>
}

export function useHub() {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHub bir HubProvider içinde kullanılmalı')
  return ctx
}
