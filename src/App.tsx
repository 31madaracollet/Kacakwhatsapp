import { useEffect, useMemo, useRef, useState } from 'react'
import { CircleDot, MessageCircle, Phone, ShieldCheck, Users, Video, Wifi, Zap } from 'lucide-react'
import { useAuth } from './hooks/useAuth'
import { useMessenger } from './hooks/useMessenger'
import { useStatuses } from './hooks/useStatuses'
import { useCalls } from './hooks/useCalls'
import { useAdmin } from './hooks/useAdmin'
import { AuthScreen } from './components/AuthScreen'
import { Sidebar } from './components/Sidebar'
import { ChatWindow } from './components/ChatWindow'
import { NewChatModal } from './components/NewChatModal'
import { NewGroupModal } from './components/NewGroupModal'
import { ProfileModal } from './components/ProfileModal'
import { ChatInfoModal } from './components/ChatInfoModal'
import { StatusPanel } from './components/StatusPanel'
import { CallOverlay } from './components/CallOverlay'
import { AdminPanel } from './components/AdminPanel'
import { otherMember, chatTitle } from './lib/utils'
import {
  disableNotifications,
  enableNotifications,
  notificationsEnabled,
  notificationsSupported,
  registerNotificationWorker,
  showNotification,
} from './lib/notify'

export default function App() {
  const { user, profile, loading } = useAuth()
  const m = useMessenger()
  const s = useStatuses()
  const c = useCalls()
  const a = useAdmin()

  const [theme, setTheme] = useState<'light' | 'dark'>(() => (localStorage.getItem('zap-theme') as 'light' | 'dark') || 'light')
  const [newChat, setNewChat] = useState(false)
  const [newGroup, setNewGroup] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [notifOn, setNotifOn] = useState(() => notificationsEnabled())
  const notifAvailable = notificationsSupported()
  const selectChatRef = useRef(m.selectChat)
  selectChatRef.current = m.selectChat

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('zap-theme', theme)
  }, [theme])

  const showToast = (msg: string) => {
    if (!msg) return
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  /* bildirim servis çalışanı (mobilde bildirim için şart) */
  useEffect(() => {
    registerNotificationWorker()
  }, [])

  /* bildirime tıklanınca ilgili sohbeti aç */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMsg = (e: MessageEvent) => {
      const chatId = e.data?.chatId
      if (e.data?.type === 'zap-notification-click' && chatId) selectChatRef.current(chatId)
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])

  const toggleNotif = async () => {
    if (notifOn) {
      disableNotifications()
      setNotifOn(false)
      showToast('Bildirimler kapatıldı 🔕')
      return
    }
    const res = await enableNotifications()
    if (res === 'unsupported') {
      showToast('Bu tarayıcı bildirimleri desteklemiyor')
      return
    }
    if (res === 'denied') {
      showToast('Bildirim izni verilmedi — tarayıcı ayarlarından bu siteye izin ver')
      return
    }
    setNotifOn(true)
    registerNotificationWorker()
    showToast('Bildirimler etkin 🔔')
    void showNotification('ZapMesaj', 'Bildirimler açık. Yeni mesajlarda haber vereceğim.')
  }

  /* yeni gelen mesaj → bildirim */
  const seenMsgs = useRef<Set<string>>(new Set())
  const primed = useRef(false)
  useEffect(() => {
    const list = Object.values(m.messages).flat()
    if (!primed.current) {
      for (const x of list) seenMsgs.current.add(x.id)
      primed.current = true
      return
    }
    for (const msg of list) {
      if (seenMsgs.current.has(msg.id)) continue
      seenMsgs.current.add(msg.id)
      if (!notifOn || !m.meId || msg.sender_id === m.meId) continue
      if (msg.deleted_at) continue
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      const elsewhere = msg.chat_id !== m.activeChatId
      if (!hidden && !elsewhere) continue

      const chat = m.chats.find((c) => c.id === msg.chat_id)
      const sender = chat?.members.find((x) => x.user_id === msg.sender_id)?.profile
      const senderName = sender?.full_name || sender?.username || 'Birisi'
      const where = chat ? chatTitle(chat, m.meId) : 'ZapMesaj'
      const baslik = chat?.type === 'group' ? `${senderName} · ${where}` : senderName
      const govde =
        msg.type === 'image'
          ? '📷 Fotoğraf'
          : msg.type === 'video'
            ? '🎬 Video'
            : msg.type === 'audio'
              ? '🎤 Sesli mesaj'
              : msg.type === 'file'
                ? `📎 ${msg.media_name || 'Dosya'}`
                : msg.body || 'Yeni mesaj'

      void showNotification(baslik, govde, {
        chatId: msg.chat_id,
        onClick: () => selectChatRef.current(msg.chat_id),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.messages, m.chats, m.activeChatId, m.meId, notifOn])

  /* gizli sekmede gelen arama bildirimi */
  useEffect(() => {
    if (!c.incoming) return
    if (typeof document === 'undefined' || document.visibilityState !== 'hidden') return
    void showNotification(
      `${c.incoming.fromName} arıyor…`,
      c.incoming.kind === 'video' ? 'Görüntülü arama' : 'Sesli arama',
    )
  }, [c.incoming])

  const activeChat = m.chats.find((x) => x.id === m.activeChatId) || null

  const callPeer = useMemo(() => {
    if (!activeChat || !m.meId) return null
    const other = otherMember(activeChat, m.meId)
    if (!other) return null
    return {
      id: other.user_id,
      name: other.profile?.full_name || other.profile?.username || 'Kullanıcı',
      avatar_url: other.profile?.avatar_url ?? null,
    }
  }, [activeChat, m.meId])

  const peerCallLogs = useMemo(() => {
    if (!callPeer) return []
    return c.logs.filter(
      (l) =>
        (l.caller_id === callPeer.id && l.callee_id === m.meId) ||
        (l.callee_id === callPeer.id && l.caller_id === m.meId),
    )
  }, [c.logs, callPeer, m.meId])

  /* gelen çağrı bildirimi */
  useEffect(() => {
    if (c.incoming) showToast(`📞 ${c.incoming.fromName} arıyor…`)
  }, [c.incoming])

  /* arama hatası (sesli/görüntülü) kullanıcıya görünsün */
  useEffect(() => {
    if (c.error) showToast('Arama hatası: ' + c.error)
  }, [c.error])

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

  const startCall = (kind: 'audio' | 'video') => {
    if (activeChat?.type === 'group') {
      showToast('Sesli/görüntülü arama şimdilik birebir sohbetlerde 👤')
      return
    }
    if (!callPeer) {
      showToast('Arama için birebir sohbet seç 👤')
      return
    }
    void c.startCall(callPeer, kind, activeChat?.id ?? null)
  }

  return (
    <div className={`app ${m.activeChatId ? 'chat-open' : ''}`}>
      <Sidebar
        m={m}
        onNewChat={() => setNewChat(true)}
        onNewGroup={() => setNewGroup(true)}
        onProfile={() => setProfileOpen(true)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        onStatus={() => setStatusOpen(true)}
        onAdmin={() => setAdminOpen(true)}
        statusCount={s.groups.filter((g) => !g.isMine).length}
        notifOn={notifOn}
        notifAvailable={notifAvailable}
        onToggleNotif={toggleNotif}
      />

      {m.activeChatId ? (
        <ChatWindow
          m={m}
          chatId={m.activeChatId}
          onBack={() => m.selectChat(null)}
          onOpenInfo={() => setInfoOpen(true)}
          onToast={showToast}
          onCall={startCall}
        />
      ) : (
        <main className="chat-area empty">
          <div className="empty-chat">
            <div className="empty-logo">
              <MessageCircle size={46} />
            </div>
            <h1>ZapMesaj</h1>
            <p className="muted">Sohbet etmek için soldan bir sohbet seç ya da yeni bir sohbet başlat.</p>
            <div className="feature-grid">
              <div>
                <Zap size={18} /> <span>Anlık mesaj</span>
              </div>
              <div>
                <Users size={18} /> <span>Gruplar</span>
              </div>
              <div>
                <CircleDot size={18} /> <span>Durumlar</span>
              </div>
              <div>
                <Phone size={18} /> <span>Sesli arama</span>
              </div>
              <div>
                <Video size={18} /> <span>Görüntülü arama</span>
              </div>
              <div>
                <Wifi size={18} /> <span>Gerçek zamanlı</span>
              </div>
              {profile?.is_admin && (
                <div>
                  <ShieldCheck size={18} /> <span>Yönetim paneli</span>
                </div>
              )}
            </div>
            <div className="empty-cta">
              <button className="primary-btn" onClick={() => setNewChat(true)}>
                Yeni sohbet başlat
              </button>
              <button className="ghost-btn" onClick={() => setStatusOpen(true)}>
                <CircleDot size={16} /> Durum ekle
              </button>
            </div>
            <p className="tiny muted">Durumlar 24 saat sonra kaybolur · Aramalar uçtan uca WebRTC ile yapılır.</p>
          </div>
        </main>
      )}

      <NewChatModal open={newChat} onClose={() => setNewChat(false)} m={m} onStarted={(id) => m.selectChat(id)} />
      <NewGroupModal
        open={newGroup}
        onClose={() => setNewGroup(false)}
        m={m}
        onToast={showToast}
        onCreated={(id) => m.selectChat(id)}
      />
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} onToast={showToast} />
      <ChatInfoModal
        open={infoOpen && !!activeChat}
        onClose={() => setInfoOpen(false)}
        chat={activeChat}
        m={m}
        onToast={showToast}
        onLeft={() => m.selectChat(null)}
        callLogs={peerCallLogs}
        onCall={(kind) => {
          setInfoOpen(false)
          startCall(kind)
        }}
      />
      {statusOpen && m.meId && (
        <StatusPanel s={s} meId={m.meId} onClose={() => setStatusOpen(false)} onToast={showToast} />
      )}
      <AdminPanel a={a} open={adminOpen} onClose={() => setAdminOpen(false)} onToast={showToast} />
      <CallOverlay c={c} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
