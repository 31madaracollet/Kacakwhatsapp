import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import type { Messenger } from '../hooks/useMessenger'
import { Modal } from './Modal'
import { Avatar } from './Avatar'

interface Props {
  open: boolean
  onClose: () => void
  m: Messenger
  onStarted: (chatId: string) => void
}

export function NewChatModal({ open, onClose, m, onStarted }: Props) {
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const list = await m.searchUsers(query)
        if (alive) setUsers(list.filter((u) => u.id !== m.meId))
      } catch (e: any) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, open, m.searchUsers, m.meId])

  const start = async (userId: string) => {
    try {
      const chatId = await m.startDirectChat(userId)
      onStarted(chatId)
      onClose()
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Modal open={open} title="Yeni sohbet" onClose={onClose}>
      <div className="search-wrap modal-search">
        <Search size={16} />
        <input autoFocus placeholder="İsim veya @kullanıcıadı ara" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="muted small center">Aranıyor...</p>}

      <div className="user-list">
        {users.map((u) => (
          <button key={u.id} className="user-row" onClick={() => start(u.id)}>
            <Avatar name={u.full_name} src={u.avatar_url} size={42} seed={u.username} online={m.onlineUsers.has(u.id)} />
            <div>
              <strong>{u.full_name}</strong>
              <span className="muted tiny">@{u.username}</span>
            </div>
          </button>
        ))}
        {!loading && users.length === 0 && (
          <p className="muted small center pad">
            Kimse bulunamadı. Uygulamaya kayıtlı başka kullanıcılar burada listelenir.
          </p>
        )}
      </div>
    </Modal>
  )
}
