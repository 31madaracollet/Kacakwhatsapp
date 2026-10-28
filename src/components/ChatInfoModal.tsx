import { useEffect, useRef, useState } from 'react'
import { Camera, LogOut, Phone, PhoneIncoming, PhoneMissed, PhoneOutgoing, Search, ShieldCheck, UserMinus, UserPlus, Users, Video } from 'lucide-react'
import type { Chat, CallLog } from '../lib/types'
import type { Messenger } from '../hooks/useMessenger'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { chatAvatar, chatTitle, lastSeenText, otherMember } from '../lib/utils'
import { useAuth } from '../hooks/useAuth'
import { uploadAvatar } from '../lib/supabase'

interface Props {
  open: boolean
  onClose: () => void
  chat: Chat | null
  m: Messenger
  onToast: (msg: string) => void
  onLeft: () => void
  callLogs?: CallLog[]
  onCall?: (kind: 'audio' | 'video') => void
}

export function ChatInfoModal({ open, onClose, chat, m, onToast, onLeft, callLogs = [], onCall }: Props) {
  const { user } = useAuth()
  const meId = user?.id || ''
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setAdding(false)
      setQuery('')
      setEditingName(false)
    } else if (chat) {
      setName(chat.name || '')
    }
  }, [open, chat])

  useEffect(() => {
    if (!adding) return
    let alive = true
    const t = setTimeout(async () => {
      const list = await m.searchUsers(query)
      if (alive) setResults(list.filter((u) => u.id !== meId && !chat?.members.some((x) => x.user_id === u.id)))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [adding, query, m.searchUsers, chat, meId])

  if (!chat) return null

  const me = chat.members.find((x) => x.user_id === meId)
  const isAdmin = me?.role === 'admin'
  const title = chatTitle(chat, meId)
  const other = otherMember(chat, meId)

  const changePhoto = async (file?: File | null) => {
    if (!file || !user) return
    try {
      const url = await uploadAvatar(user.id, file)
      await m.updateChat(chat.id, { avatar_url: url })
      onToast('Grup fotoğrafı güncellendi')
    } catch (e: any) {
      onToast(e.message)
    }
  }

  return (
    <Modal open={open} title={chat.type === 'group' ? 'Grup bilgisi' : 'Kişi bilgisi'} onClose={onClose} wide>
      <div className="info-top">
        {chat.type === 'group' && isAdmin ? (
          <button className="profile-avatar" onClick={() => fileRef.current?.click()}>
            <Avatar name={title} src={chatAvatar(chat, meId)} size={92} seed={chat.id} />
            <span className="avatar-edit">
              <Camera size={16} />
            </span>
          </button>
        ) : (
          <Avatar name={title} src={chatAvatar(chat, meId)} size={92} seed={chat.id} online={other ? m.onlineUsers.has(other.user_id) : false} />
        )}
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => changePhoto(e.target.files?.[0])} />

        {chat.type === 'group' && editingName ? (
          <div className="inline-edit">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} autoFocus />
            <button
              className="primary-btn small"
              onClick={async () => {
                await m.updateChat(chat.id, { name: name.trim() })
                setEditingName(false)
                onToast('Grup adı güncellendi')
              }}
            >
              Kaydet
            </button>
          </div>
        ) : (
          <h3
            className={chat.type === 'group' && isAdmin ? 'editable' : ''}
            onClick={() => chat.type === 'group' && isAdmin && setEditingName(true)}
          >
            {title}
          </h3>
        )}

        <p className="muted small">
          {chat.type === 'group'
            ? `${chat.members.length} üye`
            : other?.profile
              ? `@${other.profile.username} · ${lastSeenText(other.profile.last_seen)}`
              : ''}
        </p>
        {chat.type === 'direct' && other?.profile?.about && <p className="about-text">{other.profile.about}</p>}
      </div>

      {chat.type === 'group' && (
        <>
          <div className="info-section">
            <div className="info-section-head">
              <h4>
                <Users size={16} /> Üyeler
              </h4>
              <button className="link-btn" onClick={() => setAdding((v) => !v)}>
                <UserPlus size={15} /> Üye ekle
              </button>
            </div>

            {adding && (
              <div className="add-member-box">
                <div className="search-wrap modal-search">
                  <Search size={15} />
                  <input autoFocus placeholder="Kişi ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                {results.map((u) => (
                  <button
                    key={u.id}
                    className="user-row"
                    onClick={async () => {
                      await m.addMembers(chat.id, [u.id])
                      setResults((prev) => prev.filter((x) => x.id !== u.id))
                      onToast(`${u.full_name} eklendi`)
                    }}
                  >
                    <Avatar name={u.full_name} src={u.avatar_url} size={36} seed={u.username} />
                    <div>
                      <strong>{u.full_name}</strong>
                      <span className="muted tiny">@{u.username}</span>
                    </div>
                    <UserPlus size={16} />
                  </button>
                ))}
                {results.length === 0 && <p className="muted tiny center pad">Eklenebilecek kişi yok</p>}
              </div>
            )}

            <div className="member-list">
              {chat.members.map((member) => (
                <div key={member.user_id} className="member-row">
                  <Avatar
                    name={member.profile?.full_name}
                    src={member.profile?.avatar_url}
                    size={38}
                    seed={member.profile?.username}
                    online={m.onlineUsers.has(member.user_id)}
                  />
                  <div className="member-info">
                    <strong>
                      {member.profile?.full_name || 'Kullanıcı'}
                      {member.user_id === meId && <span className="you"> (sen)</span>}
                    </strong>
                    <span className="muted tiny">@{member.profile?.username}</span>
                  </div>
                  {member.role === 'admin' && (
                    <span className="role-chip">
                      <ShieldCheck size={13} /> yönetici
                    </span>
                  )}
                  {isAdmin && member.user_id !== meId && (
                    <button
                      className="icon-btn danger"
                      title="Gruptan çıkar"
                      onClick={async () => {
                        if (!confirm(`${member.profile?.full_name} gruptan çıkarılsın mı?`)) return
                        await m.removeMember(chat.id, member.user_id)
                        onToast('Üye çıkarıldı')
                      }}
                    >
                      <UserMinus size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            className="ghost-btn danger full"
            onClick={async () => {
              if (!confirm('Bu gruptan ayrılmak istediğine emin misin?')) return
              await m.leaveChat(chat.id)
              onLeft()
              onClose()
              onToast('Gruptan ayrıldın')
            }}
          >
            <LogOut size={16} /> Gruptan ayrıl
          </button>
        </>
      )}

      {chat.type === 'direct' && (
        <>
          <div className="info-actions">
            <button
              className="primary-btn"
              onClick={async () => {
                onClose()
                onToast('Kişiyle sohbet açık 💬')
              }}
            >
              Mesaj gönder
            </button>
            {onCall && (
              <>
                <button className="ghost-btn" onClick={() => onCall('audio')}>
                  <Phone size={16} /> Sesli
                </button>
                <button className="ghost-btn" onClick={() => onCall('video')}>
                  <Video size={16} /> Görüntülü
                </button>
              </>
            )}
          </div>

          {callLogs.length > 0 && (
            <div className="info-section">
              <h4>Son aramalar</h4>
              <div className="call-log-list">
                {callLogs.slice(0, 8).map((log) => {
                  const giden = log.caller_id === meId
                  const kacti = log.status === 'missed' || log.status === 'rejected'
                  const Icon = kacti ? PhoneMissed : giden ? PhoneOutgoing : PhoneIncoming
                  return (
                    <div className={`call-log ${kacti && !giden ? 'missed' : ''}`} key={log.id}>
                      <Icon size={15} />
                      <span>
                        {giden ? 'Giden' : 'Gelen'} {log.kind === 'video' ? 'görüntülü' : 'sesli'} arama
                      </span>
                      <span className="tiny muted">
                        {new Date(log.started_at).toLocaleString('tr-TR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
