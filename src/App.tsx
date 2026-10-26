import { useEffect, useState } from 'react'
import { MessageCircle, ShieldCheck, Users, Wifi, Zap } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useMessenger } from './hooks/useMessenger'
import { AuthScreen } from './components/AuthScreen'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { NewChatModal } from './components/NewChatModal'
import { NewGroupModal } from './components/NewGroupModal'
import { ProfileModal } from './components/ProfileModal'
import { ChatInfoModal } from './components/ChatInfoModal'

export default function App() {
  const { user, loading } = useAuth()
  const m = useMessenger()
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('zap-theme') as 'light' | 'dark') || 'light')
  const [newChat, setNewChat] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('zap-theme', theme)
  }, [theme])

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  if (loading) {
    return (
      <div className="boot">
        <div className="boot-logo">
          <MessageCircle size={36} />
        </div>
        <p>ZapMesaj yükleniyor...</p>
      </div>
    )
  }

  if (!user) return <AuthScreen />

  const activeChat = m.chats.find((c) => c.id === m.activeChatId) || null

  return (
    <div className={`app ${m.activeChatId ? 'chat-open' : ''}`}>
      <Sidebar
        m={m}
        onNewChat={() => setNewChat(true)}
        onNewGroup={() => setNewGroup(true)}
        onProfile={() => setProfileOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />

      {m.activeChatId ? (
        <ChatWindow
          m={m}
          chatId={m.activeChatId}
          onBack={() => m.selectChat(null)}
          onOpenInfo={() => setInfoOpen(true)}
          onToast={showToast}
        />
      ) : (
        <main className="chat-area empty">
          <div className="empty-chat">
            <div className="empty-logo">
              <MessageCircle size={46} />
            </div>
            <h1>ZapMesaj</h1>
            <p className="muted">
              Sohbet etmek için soldan bir sohbet seç ya da yeni bir sohbet başlat.
            </p>
            <div className="feature-grid">
              <div>
                <Zap size={18} /> <span>Anlık mesaj</span>
              </div>
              <div>
                <Users size={18} /> <span>Gruplar</span>
              </div>
              <div>
                <ShieldCheck size={18} /> <span>Güvenli altyapı</span>
              </div>
              <div>
                <Wifi size={18} /> <span>Gerçek zamanlı</span>
              </div>
            </div>
            <button className="primary-btn" onClick={() => setNewChat(true)}>
              Yeni sohbet başlat
            </button>
            <p className="tiny muted">Durum özelliği yok — sadece gerçek sohbetler.</p>
          </div>
        </main>
      )}

      <NewChatModal open={newChat} onClose={() => setNewChat(false)} m={m} onStarted={(id) => m.selectChat(id)} />
      <NewGroupModal open={newGroup} onClose={() => setNewGroup(false)} m={m} onCreated={(id) => m.selectChat(id)} />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} onToast={showToast} />
      <ChatInfoModal
        open={infoOpen && !!activeChat}
        onClose={() => setInfoOpen(false)}
        chat={activeChat}
        m={m}
        onToast={showToast}
        onLeft={() => m.selectChat(null)}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
