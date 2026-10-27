import { useState } from 'react'
import { useHub } from './hooks/useHub'
import { Login } from './components/Login'
import { Dashboard } from './components/Dashboard'
import { AdminPanel } from './components/AdminPanel'
import { ProfileModal } from './components/ProfileModal'

export default function App() {
  const { session, loading, profile } = useHub()
  const [view, setView] = useState<'home' | 'admin'>('home')
  const [profileOpen, setProfileOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 3200)
  }

  if (loading) {
    return (
      <div className="boot">
        <div className="hp-logo big">
          <span />
          <span />
          <span />
        </div>
        <p>HappyProjects yükleniyor...</p>
      </div>
    )
  }

  if (!session) return <Login />

  if (profile && profile.is_active === false) {
    return (
      <div className="boot">
        <h2>Hesabın kapatılmış</h2>
        <p className="muted">Erişim için yöneticine ulaş.</p>
      </div>
    )
  }

  return (
    <>
      {view === 'admin' ? (
        <AdminPanel onBack={() => setView('home')} onToast={showToast} />
      ) : (
        <Dashboard
          onOpenAdmin={() => setView('admin')}
          onOpenProfile={() => setProfileOpen(true)}
          onToast={showToast}
        />
      )}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onToast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  )
}
