import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, LogOut, Lock, Search, Settings, ShieldCheck, User } from 'lucide-react'
import { useHub } from '../hooks/useHub'
import type { HubApp } from '../lib/types'

interface Props {
  onOpenAdmin: () => void
  onOpenProfile: () => void
  onToast: (msg: string) => void
}

export function Dashboard({ onOpenAdmin, onOpenProfile, onToast }: Props) {
  const { profile, apps, isAdmin, openApp, signOut, hasAccess } = useHub()
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apps.filter((a) => a.is_active)
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
    )
  }, [apps, query])

  const launch = async (app: HubApp) => {
    if (!app.is_active) return onToast(`${app.name} şu anda bakımda 🔧`)
    if (!hasAccess(app.slug)) return onToast(`${app.name} için erişimin yok — yöneticiden iste`)
    if (!app.url) return onToast(`${app.name} adresi henüz tanımlı değil`)
    await openApp(app)
  }

  const hour = new Date().getHours()
  const greeting = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'

  return (
    <div className="dash">
      <header className="topbar">
        <div className="brand-mini">
          <div className="hp-logo">
            <span />
            <span />
            <span />
          </div>
          <strong>HappyProjects</strong>
        </div>

        <div className="search-pill">
          <Search size={18} />
          <input
            ref={searchRef}
            placeholder="Uygulama ara..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <kbd>/</kbd>
        </div>

        <div className="topbar-right">
          {isAdmin && (
            <button className="icon-round" title="Yönetici paneli" onClick={onOpenAdmin}>
              <Settings size={19} />
            </button>
          )}
          <button className="avatar-btn" onClick={() => setMenu((v) => !v)}>
            <span className="avatar">{initials(profile?.full_name)}</span>
          </button>

          {menu && (
            <div className="account-menu" onMouseLeave={() => setMenu(false)}>
              <div className="account-head">
                <span className="avatar big">{initials(profile?.full_name)}</span>
                <div>
                  <strong>{profile?.full_name}</strong>
                  <span className="muted tiny">{profile?.email}</span>
                  {isAdmin && (
                    <span className="pill admin">
                      <ShieldCheck size={12} /> yönetici
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => { setMenu(false); onOpenProfile() }}>
                <User size={16} /> Hesabım
              </button>
              {isAdmin && (
                <button onClick={() => { setMenu(false); onOpenAdmin() }}>
                  <Settings size={16} /> Yönetici paneli
                </button>
              )}
              <button className="danger" onClick={() => signOut()}>
                <LogOut size={16} /> Çıkış yap
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="dash-body">
        <section className="hello">
          <h1>
            {greeting}, {profile?.full_name?.split(' ')[0] || 'dostum'} 👋
          </h1>
          <p className="muted">
            Tek hesapla {apps.filter((a) => a.is_active).length} uygulamaya erişimin var.
          </p>
        </section>

        <section>
          <div className="section-head">
            <h2>Uygulamalar</h2>
            <span className="muted small">{filtered.length} sonuç</span>
          </div>

          {filtered.length === 0 && (
            <p className="muted center pad">"{query}" için sonuç yok.</p>
          )}

          <div className="app-grid">
            {filtered.map((app) => {
              const locked = !hasAccess(app.slug)
              return (
                <button
                  key={app.slug}
                  className={`app-card ${locked ? 'locked' : ''} ${!app.is_active ? 'off' : ''}`}
                  onClick={() => launch(app)}
                  style={{ ['--accent' as any]: app.color }}
                >
                  <span className="app-icon" style={{ background: `${app.color}1f`, color: app.color }}>
                    {app.emoji}
                  </span>
                  <span className="app-meta">
                    <strong>{app.name}</strong>
                    <span className="muted tiny">{app.category}</span>
                    <span className="app-desc">{app.description}</span>
                  </span>
                  <span className="app-open">
                    {locked ? <Lock size={15} /> : <ExternalLink size={15} />}
                  </span>
                </button>
              )
            })}

            {isAdmin && (
              <button className="app-card add" onClick={onOpenAdmin}>
                <span className="app-icon">＋</span>
                <span className="app-meta">
                  <strong>Uygulama ekle</strong>
                  <span className="app-desc">Yeni proje bağla, adresini tanımla</span>
                </span>
              </button>
            )}
          </div>
        </section>

        <section className="info-strip">
          <div>
            <ShieldCheck size={18} /> Tek hesap (SSO) — bu hesapla bağlı tüm uygulamalara giriş yaparsın.
          </div>
          <div>
            <Lock size={18} /> Hesaplar yönetici tarafından açılır, erişimler tek yerden yönetilir.
          </div>
        </section>
      </main>
    </div>
  )
}

function initials(name?: string | null) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
