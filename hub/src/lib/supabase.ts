import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://szhpjbuuiltkqhhgmphm.supabase.co'
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN6aHBqYnV1aWx0a3FoaGdtcGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzM1NDAsImV4cCI6MjEwODYwOTU0MH0.cx2mB8PnCH2HOk7g46VIJwkz5UdQwy6mfvK7Y_5xOEM'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

/** hub şemasındaki tablolara erişim */
export const hub = () => supabase.schema('hub')

export interface AdminResult {
  ok?: boolean
  error?: string
  [key: string]: unknown
}

export async function adminCall(action: string, payload: Record<string, unknown> = {}): Promise<AdminResult> {
  const { data, error } = await supabase.functions.invoke('hub-admin', {
    body: { action, ...payload },
  })
  if (error) {
    // fonksiyon 4xx döndürdüğünde gövdedeki mesajı yakalamaya çalış
    try {
      const ctx = (error as any).context
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json()
        if (body?.error) return { error: body.error }
      }
    } catch {
      /* yoksay */
    }
    return { error: (error as any).message || 'İşlem başarısız' }
  }
  return (data as AdminResult) ?? {}
}
