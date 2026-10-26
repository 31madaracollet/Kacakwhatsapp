import type { Chat, Member, Message } from './types'

export const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤔','😅','😭','😡','🥳','🤩','😴','🤗',
  '👍','👎','👏','🙏','💪','🤝','✌️','👌','🫶','❤️','🧡','💛','💚','💙','💜','🖤',
  '🔥','✨','🎉','🎂','🌹','☀️','🌙','⭐','⚡','💯','💔','🥰','😇','🤯','😱','🤐',
  '🍕','☕','🍵','🎵','🎬','⚽','🏆','📌','📎','✅','❌','⚠️','💡','🚀','💬','👀',
]

export function initials(name?: string | null) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const AVATAR_COLORS = [
  '#e17076', '#7bc862', '#e5ca77', '#65aadd', '#a695e7',
  '#ee7aae', '#6ec9cb', '#faa774', '#7f8fa6', '#c56cf0',
]

export function colorFor(seed?: string | null) {
  if (!seed) return AVATAR_COLORS[0]
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function dayLabel(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, now)) return 'Bugün'
  if (isSameDay(d, yesterday)) return 'Dün'
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function chatTime(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (isSameDay(d, now)) return formatTime(iso)
  const yesterday = new Date()
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(d, yesterday)) return 'Dün'
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export function lastSeenText(iso?: string | null) {
  if (!iso) return 'son görülme bilinmiyor'
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'az önce görüldü'
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce görüldü`
  if (isSameDay(d, new Date())) return `bugün ${formatTime(iso)} görüldü`
  return `${dayLabel(iso)} ${formatTime(iso)} görüldü`
}

export function formatBytes(bytes?: number | null) {
  if (!bytes && bytes !== 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(sec?: number | null) {
  if (!sec || !isFinite(sec)) return '0:00'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Birebir sohbetlerde karşı tarafı bulur. */
export function otherMember(chat: Chat, meId: string): Member | undefined {
  return chat.members.find((m) => m.user_id !== meId)
}

export function chatTitle(chat: Chat, meId: string) {
  if (chat.type === 'group') return chat.name || 'Grup'
  const other = otherMember(chat, meId)
  return other?.profile?.full_name || other?.profile?.username || 'Sohbet'
}

export function chatAvatar(chat: Chat, meId: string) {
  if (chat.type === 'group') return chat.avatar_url
  return otherMember(chat, meId)?.profile?.avatar_url || null
}

export function previewOf(msg: Message | undefined, meId: string) {
  if (!msg) return ''
  if (msg.deleted_at) return 'Bu mesaj silindi'
  const mine = msg.sender_id === meId
  const prefix = mine ? 'Sen: ' : ''
  switch (msg.type) {
    case 'image': return `${prefix}📷 Fotoğraf${msg.body ? ': ' + msg.body : ''}`
    case 'video': return `${prefix}🎬 Video${msg.body ? ': ' + msg.body : ''}`
    case 'audio': return `${prefix}🎤 Sesli mesaj`
    case 'file': return `${prefix}📎 ${msg.media_name || 'Dosya'}`
    case 'system': return msg.body || ''
    default: return prefix + (msg.body || '')
  }
}

export function sortChats(chats: Chat[]) {
  return [...chats].sort((a, b) => {
    const at = a.last_message_at || a.created_at
    const bt = b.last_message_at || b.created_at
    return new Date(bt).getTime() - new Date(at).getTime()
  })
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function groupByDay(messages: Message[]) {
  const groups: { day: string; items: Message[] }[] = []
  for (const m of messages) {
    const day = dayLabel(m.created_at)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(m)
    else groups.push({ day, items: [m] })
  }
  return groups
}
