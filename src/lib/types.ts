export type ChatType = 'direct' | 'group'

export interface Profile {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  about: string | null
  last_seen: string
  created_at?: string
}

export interface Member {
  chat_id: string
  user_id: string
  role: 'admin' | 'member'
  last_read_at: string
  is_muted: boolean
  joined_at: string
  profile?: Profile
}

export interface Chat {
  id: string
  type: ChatType
  name: string | null
  avatar_url: string | null
  description: string | null
  created_by: string | null
  created_at: string
  members: Member[]
  last_message_at?: string | null
}

export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'file' | 'system'

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  body: string | null
  type: MessageType
  media_url: string | null
  media_name: string | null
  media_size: number | null
  media_duration: number | null
  media_thumb: string | null
  reply_to: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

export interface Reaction {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}
