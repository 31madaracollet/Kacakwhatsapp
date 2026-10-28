import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Info, Phone, Search, Video, X } from 'lucide-react'
import type { Messenger } from '../hooks/useMessenger'
import { useAuth } from '../hooks/useAuth'
import { Avatar } from './Avatar'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { uploadMedia } from '../lib/supabase'
import type { Message } from '../lib/types'
import { chatAvatar, chatTitle, groupByDay, lastSeenText, otherMember } from '../lib/utils'

interface Props {
  m: Messenger
  chatId: string
  onBack: () => void
  onOpenInfo: () => void
  onToast: (msg: string) => void
  onCall?: (kind: 'audio' | 'video') => void
}

export function ChatWindow({ m, chatId, onBack, onOpenInfo, onToast, onCall }: Props) {
  const { profile, user } = useAuth()
  const chat = m.chats.find((c) => c.id === chatId)
  const meId = user?.id || ''
  const list = m.messages[chatId] || []
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [lightbox, setLightbox] = useState<{ url: string; type: 'image' | 'video' } | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastCount = useRef(0)

  useEffect(() => {
    setReplyTo(null)
    setEditing(null)
    setSearch('')
    setSearchOpen(false)
  }, [chatId])

  useEffect(() => {
    const nearBottom =
      !scrollRef.current ||
      scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 320
    if (list.length !== lastCount.current && (nearBottom || list.length > lastCount.current)) {
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: lastCount.current ? 'smooth' : 'auto' }))
    }
    lastCount.current = list.length
  }, [list.length, chatId])

  useEffect(() => {
    m.markRead(chatId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, list.length])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return list
    return list.filter((msg) => (msg.body || msg.media_name || '').toLowerCase().includes(term))
  }, [list, search])

  const days = useMemo(() => groupByDay(visible), [visible])

  if (!chat) {
    return (
      <main className="chat-area empty">
        <div className="empty-chat">
          <h2>Sohbet bulunamadı</h2>
          <button className="ghost-btn" onClick={onBack}>
            Sohbetlere dön
          </button>
        </div>
      </main>
    )
  }

  const title = chatTitle(chat, meId)
  const other = otherMember(chat, meId)
  const online = other ? m.onlineUsers.has(other.user_id) : false
  const typing = m.typingUsers[chatId] || []

  const subtitle =
    chat.type === 'group'
      ? typing.length
        ? `${typing.join(', ')} yazıyor...`
        : chat.members.map((x) => x.profile?.full_name || 'Üye').join(', ').slice(0, 70)
      : typing.length
        ? 'yazıyor...'
        : online
          ? 'çevrimiçi'
          : lastSeenText(other?.profile?.last_seen)

  const sendText = async (text: string) => {
    try {
      await m.sendMessage({ chatId, body: text, reply_to: replyTo?.id || null })
      setReplyTo(null)
      requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (e: any) {
      onToast('Mesaj gönderilemedi: ' + (e.message || 'bilinmeyen hata'))
    }
  }

  const sendFiles = async (files: File[], kind: 'image' | 'video' | 'file') => {
    try {
      for (const file of files) {
        const isImage = file.type.startsWith('image/')
        const isVideo = file.type.startsWith('video/')
        const type: Message['type'] = isImage ? 'image' : isVideo ? 'video' : 'file'
        const uploaded = await uploadMedia(file, `chat/${chatId}`, file.name)
        await m.sendMessage({
          chatId,
          type,
          media_url: uploaded.url,
          media_name: file.name,
          media_size: file.size,
          body: null,
          reply_to: replyTo?.id || null,
        })
      }
      setReplyTo(null)
      onToast('Medya gönderildi ✅')
    } catch (e: any) {
      onToast('Yükleme hatası: ' + (e.message || 'bilinmeyen hata'))
    }
  }

  const sendVoice = async (blob: Blob, duration: number) => {
    try {
      const name = `ses-${Date.now()}.webm`
      const uploaded = await uploadMedia(blob, `chat/${chatId}`, name)
      await m.sendMessage({
        chatId,
        type: 'audio',
        media_url: uploaded.url,
        media_name: name,
        media_size: blob.size,
        media_duration: duration,
        body: null,
      })
    } catch (e: any) {
      onToast('Ses gönderilemedi: ' + (e.message || 'hata'))
    }
  }

  return (
    <main className="chat-area">
      <header className="chat-head">
        <button className="icon-btn back-btn" onClick={onBack} aria-label="Geri">
          <ArrowLeft size={20} />
        </button>
        <button className="chat-head-user" onClick={onOpenInfo}>
          <Avatar name={title} src={chatAvatar(chat, meId)} size={42} online={online} seed={chat.id} />
          <div>
            <strong>{title}</strong>
            <span className={`chat-sub ${typing.length ? 'typing' : online ? 'online' : ''}`}>{subtitle}</span>
          </div>
        </button>

        <div className="chat-head-actions">
          <button className="icon-btn light" title="Ara" onClick={() => setSearchOpen((v) => !v)}>
            <Search size={19} />
          </button>
          <button
            className="icon-btn light"
            title="Sesli arama"
            onClick={() => (onCall ? onCall('audio') : onToast('Arama başlatılamadı'))}
          >
            <Phone size={19} />
          </button>
          <button
            className="icon-btn light"
            title="Görüntülü arama"
            onClick={() => (onCall ? onCall('video') : onToast('Arama başlatılamadı'))}
          >
            <Video size={19} />
          </button>
          <button className="icon-btn light" title="Sohbet bilgisi" onClick={onOpenInfo}>
            <Info size={19} />
          </button>
        </div>
      </header>

      {searchOpen && (
        <div className="in-chat-search">
          <Search size={16} />
          <input autoFocus placeholder="Sohbette ara..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button className="icon-btn" onClick={() => { setSearchOpen(false); setSearch('') }}>
            <X size={18} />
          </button>
        </div>
      )}

      <div className="messages" ref={scrollRef}>
        <div className="encryption-note">
          🔒 Mesajlar Supabase altyapısında saklanır. ZapMesaj gizliliğine önem verir.
        </div>

        {days.map((group) => (
          <div key={group.day}>
            <div className="day-sep">
              <span>{group.day}</span>
            </div>
            {group.items.map((msg, idx) => {
              const prev = group.items[idx - 1]
              const showSender = !prev || prev.sender_id !== msg.sender_id
              return (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  meId={meId}
                  chat={chat}
                  reactions={m.reactions.filter((r) => r.message_id === msg.id)}
                  replied={msg.reply_to ? list.find((x) => x.id === msg.reply_to) || null : null}
                  showSender={showSender}
                  sender={chat.members.find((x) => x.user_id === msg.sender_id)}
                  onlineUsers={m.onlineUsers}
                  onReply={setReplyTo}
                  onDelete={async (target) => {
                    if (!confirm('Bu mesajı silmek istiyor musun?')) return
                    try {
                      await m.deleteMessage(target)
                    } catch (e: any) {
                      onToast(e.message)
                    }
                  }}
                  onEdit={(target) => setEditing(target)}
                  onReact={(id, emoji) => m.toggleReaction(id, emoji)}
                  onOpenMedia={(url, type) => setLightbox({ url, type })}
                />
              )
            })}
          </div>
        ))}

        {typing.length > 0 && (
          <div className="msg-row theirs">
            <div className="bubble received typing-bubble">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <MessageInput
        onSendText={sendText}
        onSendFiles={sendFiles}
        onSendVoice={sendVoice}
        onTyping={() => m.sendTyping(profile?.full_name || 'Birisi')}
        replyTo={replyTo}
        editing={editing}
        onCancelReply={() => setReplyTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSaveEdit={async (text) => {
          if (!editing) return
          try {
            await m.editMessage(editing, text)
          } catch (e: any) {
            onToast(e.message)
          }
          setEditing(null)
        }}
      />

      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)}>
          <button className="lightbox-close" onClick={() => setLightbox(null)}>
            <X size={24} />
          </button>
          {lightbox.type === 'image' ? (
            <img src={lightbox.url} alt="medya" onClick={(e) => e.stopPropagation()} />
          ) : (
            <video src={lightbox.url} controls autoPlay onClick={(e) => e.stopPropagation()} />
          )}
        </div>
      )}
    </main>
  )
}
