import { useEffect, useRef, useState } from 'react'
import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  MoreVertical,
  Pause,
  Pencil,
  Play,
  Reply,
  Trash2,
} from 'lucide-react'
import type { Chat, Member, Message, Reaction } from '../lib/types'
import { formatBytes, formatDuration, formatTime } from '../lib/utils'
import { copyText } from '../lib/utils'

interface Props {
  message: Message
  meId: string
  chat: Chat
  reactions: Reaction[]
  replied?: Message | null
  showSender: boolean
  sender?: Member
  onlineUsers: Set<string>
  onReply: (msg: Message) => void
  onDelete: (msg: Message) => void
  onEdit: (msg: Message) => void
  onReact: (messageId: string, emoji: string) => void
  onOpenMedia: (url: string, type: 'image' | 'video') => void
}

const QUICK = ['👍', '❤️', '😂', '😮', '😢', '🙏']

export function MessageBubble({
  message,
  meId,
  chat,
  reactions,
  replied,
  showSender,
  sender,
  onlineUsers,
  onReply,
  onDelete,
  onEdit,
  onReact,
  onOpenMedia,
}: Props) {
  const mine = message.sender_id === meId
  const [menu, setMenu] = useState(false)
  const [picker, setPicker] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu && !picker) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu(false)
        setPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu, picker])

  const myReaction = reactions.find((r) => r.user_id === meId)
  const grouped = new Map<string, number>()
  for (const r of reactions) grouped.set(r.emoji, (grouped.get(r.emoji) || 0) + 1)

  /* okundu bilgisi: karşı taraf (grupta herkes) okudu mu? */
  const readByOthers = chat.members
    .filter((m) => m.user_id !== meId)
    .every((m) => new Date(m.last_read_at) >= new Date(message.created_at))

  if (message.type === 'system') {
    return (
      <div className="system-msg">
        <span>{message.deleted_at ? 'Mesaj silindi' : message.body}</span>
      </div>
    )
  }

  return (
    <div className={`msg-row ${mine ? 'mine' : 'theirs'}`} id={`msg-${message.id}`}>
      {!mine && chat.type === 'group' && showSender && (
        <div className="msg-avatar-col">
          <div className="mini-avatar" style={{ background: '#7bc862' }}>
            {sender?.profile?.avatar_url ? (
              <img src={sender.profile.avatar_url} alt="" />
            ) : (
              <span>{(sender?.profile?.full_name || '?').slice(0, 1).toUpperCase()}</span>
            )}
          </div>
        </div>
      )}

      <div className={`bubble ${mine ? 'sent' : 'received'} ${message.deleted_at ? 'deleted' : ''}`}>
        {!mine && chat.type === 'group' && showSender && (
          <div className="bubble-sender">{sender?.profile?.full_name || 'Kullanıcı'}</div>
        )}

        {replied && (
          <div className="quoted">
            <div className="quoted-bar" />
            <div>
              <strong>{replied.sender_id === meId ? 'Sen' : 'Karşı taraf'}</strong>
              <p>
                {replied.deleted_at
                  ? 'Silinmiş mesaj'
                  : replied.type === 'text'
                    ? replied.body
                    : replied.type === 'image'
                      ? '📷 Fotoğraf'
                      : replied.type === 'video'
                        ? '🎬 Video'
                        : replied.type === 'audio'
                          ? '🎤 Sesli mesaj'
                          : `📎 ${replied.media_name || 'Dosya'}`}
              </p>
            </div>
          </div>
        )}

        {message.deleted_at ? (
          <div className="text deleted-text">Bu mesaj silindi</div>
        ) : (
          <>
            {message.type === 'image' && message.media_url && (
              <img
                className="media-img"
                src={message.media_url}
                alt={message.media_name || 'fotoğraf'}
                loading="lazy"
                onClick={() => onOpenMedia(message.media_url!, 'image')}
              />
            )}

            {message.type === 'video' && message.media_url && (
              <video
                className="media-video"
                src={message.media_url}
                controls
                preload="metadata"
                playsInline
                onDoubleClick={() => onOpenMedia(message.media_url!, 'video')}
              />
            )}

            {message.type === 'audio' && message.media_url && (
              <AudioPlayer src={message.media_url} duration={message.media_duration} mine={mine} />
            )}

            {message.type === 'file' && message.media_url && (
              <a className="file-card" href={message.media_url} target="_blank" rel="noreferrer" download>
                <span className="file-icon">
                  <FileText size={22} />
                </span>
                <span className="file-info">
                  <strong>{message.media_name || 'Dosya'}</strong>
                  <small>{formatBytes(message.media_size)}</small>
                </span>
                <Download size={18} />
              </a>
            )}

            {message.body && <div className="text">{message.body}</div>}
          </>
        )}

        <div className="bubble-meta">
          {message.edited_at && !message.deleted_at && <span className="edited">düzenlendi</span>}
          <span>{formatTime(message.created_at)}</span>
          {mine &&
            (readByOthers ? (
              <CheckCheck size={15} className="tick read" />
            ) : (
              <Check size={15} className="tick" />
            ))}
        </div>

        {grouped.size > 0 && (
          <div className="reactions">
            {Array.from(grouped.entries()).map(([emoji, count]) => (
              <button
                key={emoji}
                className={`reaction ${myReaction?.emoji === emoji ? 'mine' : ''}`}
                onClick={() => onReact(message.id, emoji)}
              >
                {emoji} {count > 1 ? count : ''}
              </button>
            ))}
          </div>
        )}

        {!message.deleted_at && (
          <div className="bubble-menu-wrap" ref={menuRef}>
            <button className="bubble-more" onClick={() => setMenu((v) => !v)} aria-label="Mesaj menüsü">
              <MoreVertical size={15} />
            </button>

            {menu && (
              <div className={`bubble-menu ${mine ? 'right' : 'left'}`}>
                <div className="quick-reactions">
                  {QUICK.map((e) => (
                    <button
                      key={e}
                      onClick={() => {
                        onReact(message.id, e)
                        setMenu(false)
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    onReply(message)
                    setMenu(false)
                  }}
                >
                  <Reply size={15} /> Yanıtla
                </button>
                {message.body && (
                  <button
                    onClick={async () => {
                      await copyText(message.body || '')
                      setMenu(false)
                    }}
                  >
                    <Copy size={15} /> Kopyala
                  </button>
                )}
                {mine && message.type === 'text' && (
                  <button
                    onClick={() => {
                      onEdit(message)
                      setMenu(false)
                    }}
                  >
                    <Pencil size={15} /> Düzenle
                  </button>
                )}
                {mine && (
                  <button
                    className="danger"
                    onClick={() => {
                      onDelete(message)
                      setMenu(false)
                    }}
                  >
                    <Trash2 size={15} /> Sil
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function AudioPlayer({ src, duration, mine }: { src: string; duration?: number | null; mine: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [total, setTotal] = useState(duration || 0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onTime = () => setCurrent(el.currentTime)
    const onMeta = () => setTotal(el.duration || duration || 0)
    const onEnd = () => {
      setPlaying(false)
      setCurrent(0)
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
    }
  }, [duration])

  const toggle = async () => {
    const el = ref.current
    if (!el) return
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      await el.play()
      setPlaying(true)
    }
  }

  const progress = total ? (current / total) * 100 : 0

  return (
    <div className={`audio-player ${mine ? 'on-dark' : ''}`}>
      <audio ref={ref} src={src} preload="metadata" />
      <button onClick={toggle} className="audio-btn">
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <div className="audio-track" onClick={(e) => {
        const el = ref.current
        if (!el || !total) return
        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
        const ratio = (e.clientX - rect.left) / rect.width
        el.currentTime = ratio * total
      }}>
        <div className="audio-progress" style={{ width: `${progress}%` }} />
        <div className="audio-bars">
          {Array.from({ length: 28 }).map((_, i) => (
            <i key={i} style={{ height: `${20 + ((i * 37) % 70)}%` }} />
          ))}
        </div>
      </div>
      <span className="audio-time">{formatDuration(playing || current ? current : total)}</span>
    </div>
  )
}
