export interface HubProfile {
  id: string
  email: string | null
  full_name: string
  avatar_url: string | null
  role: 'admin' | 'user'
  is_active: boolean
  created_at: string
  last_login: string | null
  apps?: string[]
}

export interface HubApp {
  slug: string
  name: string
  description: string
  url: string | null
  emoji: string
  color: string
  category: string
  sort: number
  is_active: boolean
}

export interface Activity {
  id: number
  user_id: string | null
  action: string
  detail: string | null
  created_at: string
}
