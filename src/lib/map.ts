import type { Chat, Member, Message, Profile, Reaction, Status } from './types'

/** Canlı şema → uygulama tipleri (conversations / conversation_members / messages.media_meta) */

export function mapProfile(p: any): Profile | undefined {
  if (!p) return undefined
  return {
    id: p.id,
    username: p.username,
    full_name: p.display_name ?? p.full_name ?? p.username ?? '',
    avatar_url: p.avatar_url ?? null,
    about: p.about ?? null,
    last_seen: p.last_seen ?? new Date().toISOString(),
    created_at: p.created_at,
    is_admin: p.is_admin ?? false,
    is_banned: p.is_banned ?? false,
    terms_version: p.sozlesme_surumu ?? p.terms_version ?? null,
    terms_accepted_at: p.sozlesme_tarihi ?? p.terms_accepted_at ?? null,
  }
}

export function mapMember(m: any): Member {
  return {
    chat_id: m.conversation_id ?? m.chat_id,
    user_id: m.user_id,
    role: (m.role as 'admin' | 'member') ?? 'member',
    last_read_at: m.last_read_at ?? m.joined_at,
    is_muted: m.muted ?? m.is_muted ?? false,
    joined_at: m.joined_at,
    profile: mapProfile(m.profile),
  }
}

export function mapChat(c: any, members: Member[] = []): Chat {
  // eski sürüm grup fotoğrafını description içine "avatar:<url>" olarak yazıyordu
  const legacyAvatar =
    typeof c.description === 'string' && c.description.startsWith('avatar:')
      ? c.description.slice('avatar:'.length)
      : null
  return {
    id: c.id,
    type: c.type,
    name: c.name ?? null,
    avatar_url: c.avatar_url ?? legacyAvatar,
    description: legacyAvatar ? null : (c.description ?? null),
    created_by: c.created_by ?? null,
    created_at: c.created_at,
    members,
    last_message_at: c.last_message_at ?? c.created_at,
  }
}

export function mapMessage(m: any): Message {
  const meta = m.media_meta ?? {}
  return {
    id: m.id,
    chat_id: m.conversation_id ?? m.chat_id,
    sender_id: m.sender_id,
    body: m.content ?? m.body ?? null,
    type: m.type ?? 'text',
    media_url: m.media_url ?? null,
    media_name: meta.name ?? m.media_name ?? null,
    media_size: meta.size ?? m.media_size ?? null,
    media_duration: meta.duration ?? m.media_duration ?? null,
    media_thumb: meta.thumb ?? m.media_thumb ?? null,
    reply_to: m.reply_to ?? null,
    created_at: m.created_at,
    edited_at: m.edited_at ?? null,
    deleted_at: m.deleted_at ?? null,
  }
}

export function mapReaction(r: any): Reaction {
  return {
    message_id: r.message_id,
    user_id: r.user_id,
    emoji: r.emoji,
    created_at: r.created_at,
  }
}

export function mapStatus(s: any): Status {
  return {
    id: s.id,
    user_id: s.user_id,
    kind: s.kind,
    body: s.body,
    media_url: s.media_url,
    media_meta: s.media_meta,
    bg: s.bg,
    created_at: s.created_at,
    expires_at: s.expires_at,
    profile: mapProfile(s.profile),
  }
}
