import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, uploadAvatar } from '../lib/supabase'
import { mapProfile } from '../lib/map'
import type { Profile } from '../lib/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (p: { email: string; password: string; username: string; fullName: string }) => Promise<{ needsConfirm: boolean }>
  signOut: () => Promise<void>
  saveProfile: (patch: Partial<Pick<Profile, 'full_name' | 'username' | 'about' | 'avatar_url'>>) => Promise<void>
  changeAvatar: (file: File) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    const mapped = mapProfile(data) ?? null
    if (mapped) setProfile(mapped)
    return mapped
  }, [])

  useEffect(() => {
    let mounted = true

    const boot = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    }
    void boot()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession)
      if (newSession?.user) await loadProfile(newSession.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(translateAuthError(error.message))
  }

  const signUp = async ({ email, password, username, fullName }: { email: string; password: string; username: string; fullName: string }) => {
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
    if (cleanUsername.length < 3) throw new Error('Kullanıcı adı en az 3 karakter olmalı (harf, rakam, _)')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username: cleanUsername, full_name: fullName.trim() || cleanUsername } },
    })
    if (error) throw new Error(translateAuthError(error.message))
    return { needsConfirm: !data.session }
  }

  const signOut = async () => {
    await supabase.rpc('touch_last_seen')
    await supabase.auth.signOut()
    setProfile(null)
  }

  const saveProfile: AuthContextValue['saveProfile'] = async (patch) => {
    if (!session?.user) return
    // uygulama tipi (full_name) → canlı şema (display_name)
    const row: Record<string, any> = { ...patch }
    if ('full_name' in row) {
      row.display_name = row.full_name
      delete row.full_name
    }
    const { data, error } = await supabase
      .from('profiles')
      .update(row)
      .eq('id', session.user.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setProfile(mapProfile(data) ?? null)
  }

  const changeAvatar = async (file: File) => {
    if (!session?.user) return
    const url = await uploadAvatar(session.user.id, file)
    await saveProfile({ avatar_url: url })
  }

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        saveProfile,
        changeAvatar,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth bir AuthProvider içinde kullanılmalı')
  return ctx
}

function translateAuthError(msg: string) {
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials')) return 'E-posta veya şifre hatalı'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Bu e-posta ile zaten bir hesap var'
  if (m.includes('password should be at least')) return 'Şifre en az 6 karakter olmalı'
  if (m.includes('invalid email')) return 'Geçersiz e-posta adresi'
  if (m.includes('email not confirmed')) return 'E-posta adresin henüz onaylanmadı'
  if (m.includes('rate limit')) return 'Çok fazla deneme yaptın, biraz bekleyip tekrar dene'
  return msg
}
