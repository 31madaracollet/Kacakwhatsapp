import { useMemo, useState } from 'react'
import { LogOut, MessageSquarePlus, Moon, Search, Sun, UserCircle2, Users } from 'lucide-react'
import type { Messenger } from '../hooks/useMessenger'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'
import { chatAvatar, chatTime, chatTitle, previewOf, sortChats } from '../lib/utils'

interface Props {
  m: Messenger
  onNewChat: () => void
  onNewGroup: () => void
  onProfile: () => void
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

type Filter = 'all' | 'unread' | 'groups'

export function Sidebar({ m, onNewChat, onNewGroup, onProfile, theme, onToggleTheme }: Props) {
  const { profile, signOut } = useAuth()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [menuOpen, setMenuOpen] = useState(false)

  const items = useMemo(() => {
    const meId = m.meId
    if (!meId) return []
    const list = sortChats(m.chats).map((chat) => {
      const me = chat.members.find((x) => x.user_id === meId)
      const msgs = m.messages[chat.id] || []
      const last = msgs[msgs.length - 1]
      const unread = me
        ? msgs.filter((msg) => msg.sender_id !== meId && new Date(msg.created_at) > new Date(me.last_read_at)).length
        : 0
      const other = chat.members.find((x) => x.user_id !== meId)
      return {
        chat,
        title: chatTitle(chat, meId),
        avatar: chatAvatar(chat, meId),
        preview: previewOf(last, meId),
        time: chatTime(chat.last_message_at || chat.created_at),
        unread,
        online: chat.type === 'direct' && other ? m.onlineUsers.has(other.user_id) : false,
      }
    })
    const term = search.trim().toLowerCase()
    return list.filter((i) => {
      if (term && !i.title.toLowerCase().includes(term) && !i.preview.toLowerCase().includes(term)) return false
      if (filter === 'unread') return i.unread > 0
      if (filter === 'groups') return i.chat.type === 'group'
      return true
    })
  }, [m.chats, m.messages, m.meId, m.onlineUsers, search, filter])

  return (
    <aside className={`sidebar ${m.activeChatId ? 'has-active' : ''}`}>
      <header className="sidebar-head">
        <button className="avatar-btn" onClick={() => setMenuOpen((v) => !v)}>
          <Avatar name={profile?.full_name} src={profile?.avatar_url} size={40} seed={profile?.username} />
        </button>

        <div className="sidebar-title">
          <strong>{profile?.full_name || 'ZapMesaj'}</strong>
          <span className="muted tiny">
            {m.onlineUsers.has(m.meId || '') ? 'çevrimiçi' : 'bağlı'} · @{profile?.username}
          </span>
        </div>

        <div className="sidebar-actions">
          <button className="icon-btn light" title="Yeni grup" onClick={onNewGroup}>
            <Users size={19} />
          </button>
          <button className="icon-btn light" title="Yeni sohbet" onClick={onNewChat}>
            <MessageSquarePlus size={19} />
          </button>
          <button className="icon-btn light" title="Tema" onClick={onToggleTheme}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
        </div>

        {menuOpen && (
          <div className="profile-menu" onMouseLeave={() => setMenuOpen(false)}>
            <button
              onClick={() => {
                setMenuOpen(false)
                onProfile()
              }}
            >
              <UserCircle2 size={16} /> Profilim
            </button>
            <button onClick={() => signOut()}>
              <LogOut size={16} /> Çıkış yap
            </button>
          </div>
        )}
      </header>

      <div className="search-wrap">
        <Search size={16} />
        <input placeholder="Ara veya yeni sohbet başlat" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="filters">
        {(
          [
            ['all', 'Tümü'],
            ['unread', `Okunmamış${m.totalUnread ? ` (${m.totalUnread})` : ''}`],
            ['groups', 'Gruplar'],
          ] as [Filter, string][]
        ).map(([key, label]) => (
          <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>
            {label}
          </button>
        ))}
      </div>

      <div className="chat-list">
        {m.loading && <p className="muted center small pad">Sohbetler yükleniyor...</p>}
        {!m.loading && items.length === 0 && (
          <div className="empty-sidebar">
            <MessageSquarePlus size={34} />
            <p>Henüz sohbet yok</p>
            <button className="ghost-btn" onClick={onNewChat}>
              İlk sohbetini başlat
            </button>
          </div>
        )}

        {items.map(({ chat, title, avatar, preview, time, unread, online }) => (
          <button
            key={chat.id}
            className={`chat-item ${m.activeChatId === chat.id ? 'active' : ''}`}
            onClick={() => m.selectChat(chat.id)}
          >
            <Avatar name={title} src={avatar} size={48} online={online} seed={chat.id} />
            <div className="chat-item-body">
              <div className="chat-item-top">
                <strong>{title}</strong>
                <span className={`time ${unread ? 'unread' : ''}`}>{time}</span>
              </div>
              <div className="chat-item-bottom">
                <span className="preview">{preview || 'Mesaj yok'}</span>
                {unread > 0 && <span className="badge">{unread > 99 ? '99+' : unread}</span>}
              </div>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}
