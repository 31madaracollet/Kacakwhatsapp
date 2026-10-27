import { useEffect, useState } from 'react'
import {
  ArrowLeft,
  Check,
  KeyRound,
  Link2,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserX,
  X,
} from 'lucide-react'
import { useHub } from '../hooks/useHub'
import { adminCall } from '../lib/supabase'
import type { HubApp, HubProfile } from '../lib/types'

interface Props {
  onBack: () => void
  onToast: (msg: string) => void
}

type Tab = 'users' | 'apps' | 'activity'

export function AdminPanel({ onBack, onToast }: Props) {
  const { users, apps, activity, loadUsers, loadActivity, isAdmin, refresh, profile } = useHub()
  const [tab, setTab] = useState<Tab>('users')
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<HubProfile | null>(null)
  const [pwdFor, setPwdFor] = useState<HubProfile | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    void loadUsers()
    void loadActivity()
  }, [isAdmin, loadUsers, loadActivity])

  if (!isAdmin) {
    return (
      <div className="panel-page">
        <p className="muted">Bu sayfaya yalnızca yönetici erişebilir.</p>
        <button className="ghost" onClick={onBack}>
          <ArrowLeft size={16} /> Geri dön
        </button>
      </div>
    )
  }

  const filteredUsers = users.filter(
    (u) =>
      !query.trim() ||
      u.email?.toLowerCase().includes(query.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(query.toLowerCase()),
  )

  const setRole = async (u: HubProfile, role: 'admin' | 'user') => {
    setBusy(true)
    const res = await adminCall('set_role', { user_id: u.id, role })
    setBusy(false)
    if (res.error) return onToast(res.error)
    onToast(`${u.full_name} artık ${role === 'admin' ? 'yönetici' : 'kullanıcı'}`)
    void loadUsers()
  }

  const toggleActive = async (u: HubProfile) => {
    setBusy(true)
    const res = await adminCall('set_active', { user_id: u.id, is_active: !u.is_active })
    setBusy(false)
    if (res.error) return onToast(res.error)
    onToast(u.is_active ? 'Hesap kapatıldı' : 'Hesap açıldı')
    void loadUsers()
  }

  const removeUser = async (u: HubProfile) => {
    if (!confirm(`${u.full_name} (${u.email}) hesabını kalıcı olarak silmek istiyor musun?`)) return
    setBusy(true)
    const res = await adminCall('delete_user', { user_id: u.id })
    setBusy(false)
    if (res.error) return onToast(res.error)
    onToast('Hesap silindi')
    void loadUsers()
  }

  return (
    <div className="panel-page">
      <header className="panel-head">
        <button className="icon-round" onClick={onBack} title="Panele dön">
          <ArrowLeft size={19} />
        </button>
        <div>
          <h1>Yönetici Paneli</h1>
          <p className="muted small">Hesapları, erişimleri ve uygulamaları buradan yönet</p>
        </div>
        <button className="primary small" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Hesap aç
        </button>
      </header>

      <div className="tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
          Kullanıcılar ({users.length})
        </button>
        <button className={tab === 'apps' ? 'active' : ''} onClick={() => setTab('apps')}>
          Uygulamalar ({apps.length})
        </button>
        <button className={tab === 'activity' ? 'active' : ''} onClick={() => setTab('activity')}>
          Hareketler
        </button>
      </div>

      {error && <div className="alert error">{error}</div>}

      {tab === 'users' && (
        <>
          <div className="search-line">
            <Search size={16} />
            <input placeholder="İsim veya e-posta ara" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Rol</th>
                  <th>Erişim</th>
                  <th>Durum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className={!u.is_active ? 'dim' : ''}>
                    <td>
                      <div className="cell-user">
                        <span className="avatar sm">{initials(u.full_name)}</span>
                        <div>
                          <strong>{u.full_name || '—'}</strong>
                          <span className="muted tiny">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {u.role === 'admin' ? (
                        <span className="pill admin">
                          <ShieldCheck size={12} /> yönetici
                        </span>
                      ) : (
                        <span className="pill">kullanıcı</span>
                      )}
                    </td>
                    <td>
                      <div className="app-chips">
                        {(u.apps || []).map((slug) => (
                          <span key={slug} className="chip">
                            {apps.find((a) => a.slug === slug)?.emoji} {apps.find((a) => a.slug === slug)?.name || slug}
                          </span>
                        ))}
                        {(u.apps || []).length === 0 && <span className="muted tiny">erişim yok</span>}
                      </div>
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="pill ok">aktif</span>
                      ) : (
                        <span className="pill off">kapalı</span>
                      )}
                    </td>
                    <td>
                      <div className="row-btns">
                        <button className="mini" title="Erişim ver" onClick={() => setEditing(u)}>
                          <Link2 size={15} />
                        </button>
                        <button className="mini" title="Şifre yenile" onClick={() => setPwdFor(u)}>
                          <KeyRound size={15} />
                        </button>
                        <button
                          className="mini"
                          title={u.role === 'admin' ? 'Yöneticiliği kaldır' : 'Yönetici yap'}
                          disabled={busy || u.id === profile?.id}
                          onClick={() => setRole(u, u.role === 'admin' ? 'user' : 'admin')}
                        >
                          <ShieldCheck size={15} />
                        </button>
                        <button className="mini" title={u.is_active ? 'Hesabı kapat' : 'Hesabı aç'} onClick={() => toggleActive(u)}>
                          {u.is_active ? <UserX size={15} /> : <UserCheck size={15} />}
                        </button>
                        <button
                          className="mini danger"
                          title="Hesabı sil"
                          disabled={u.id === profile?.id}
                          onClick={() => removeUser(u)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length === 0 && <p className="muted center pad">Kullanıcı bulunamadı</p>}
          </div>
        </>
      )}

      {tab === 'apps' && (
        <div className="apps-admin">
          {apps.map((app) => (
            <AppRow key={app.slug} app={app} onToast={onToast} onSaved={() => void refresh()} />
          ))}
          <p className="muted small">
            Yeni bir proje eklemek için önce alt depoyu bağla, sonra burada adresini tanımla.
            Şu an <strong>apps/</strong> klasöründeki depolarla eşleşen kayıtlar listeleniyor.
          </p>
        </div>
      )}

      {tab === 'activity' && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>İşlem</th>
                <th>Detay</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((a) => (
                <tr key={a.id}>
                  <td className="muted tiny">{new Date(a.created_at).toLocaleString('tr-TR')}</td>
                  <td>{a.action}</td>
                  <td className="muted tiny">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {activity.length === 0 && <p className="muted center pad">Henüz hareket yok</p>}
        </div>
      )}

      {createOpen && (
        <CreateUserModal
          apps={apps}
          onClose={() => setCreateOpen(false)}
          onDone={() => {
            setCreateOpen(false)
            void loadUsers()
            void loadActivity()
            onToast('Hesap oluşturuldu ✅')
          }}
          onError={(m) => setError(m)}
        />
      )}

      {editing && (
        <AccessModal
          user={editing}
          apps={apps}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            void loadUsers()
            onToast('Erişimler güncellendi')
          }}
          onError={(m) => setError(m)}
        />
      )}

      {pwdFor && (
        <PasswordModal
          user={pwdFor}
          onClose={() => setPwdFor(null)}
          onDone={() => {
            setPwdFor(null)
            onToast('Şifre yenilendi')
          }}
          onError={(m) => setError(m)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ alt parçalar */

function AppRow({ app, onToast, onSaved }: { app: HubApp; onToast: (m: string) => void; onSaved: () => void }) {
  const [name, setName] = useState(app.name)
  const [url, setUrl] = useState(app.url || '')
  const [desc, setDesc] = useState(app.description)
  const [emoji, setEmoji] = useState(app.emoji)
  const [active, setActive] = useState(app.is_active)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const res = await adminCall('update_app', {
      slug: app.slug,
      name,
      url,
      description: desc,
      emoji,
      is_active: active,
    })
    setSaving(false)
    if (res.error) return onToast(res.error)
    onToast(`${name} güncellendi`)
    onSaved()
  }

  return (
    <div className="app-admin-card">
      <div className="app-admin-top">
        <input className="emoji-input" value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} />
        <div className="grow">
          <label className="mini-label">Ad</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <label className="switch">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          <span />
        </label>
      </div>
      <label className="mini-label">Adres (URL)</label>
      <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
      <label className="mini-label">Açıklama</label>
      <input value={desc} onChange={(e) => setDesc(e.target.value)} />
      <div className="app-admin-foot">
        <code className="muted tiny">apps/{app.slug}</code>
        <button className="primary small" onClick={save} disabled={saving}>
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
      </div>
    </div>
  )
}

function CreateUserModal({
  apps,
  onClose,
  onDone,
  onError,
}: {
  apps: HubApp[]
  onClose: () => void
  onDone: () => void
  onError: (m: string) => void
}) {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [selected, setSelected] = useState<string[]>(apps.map((a) => a.slug))
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    const res = await adminCall('create_user', {
      email,
      password,
      full_name: fullName,
      role,
      apps: selected,
    })
    setBusy(false)
    if (res.error) return onError(res.error)
    onDone()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Yeni hesap aç</h3>
          <button className="icon-round" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <label className="mini-label">Ad Soyad</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ali Veli" />
          <label className="mini-label">E-posta</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ali@ornek.com" type="email" />
          <label className="mini-label">Geçici şifre</label>
          <div className="inline">
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="mini" title="Yeni şifre üret" onClick={() => setPassword(generatePassword())}>
              <KeyRound size={15} />
            </button>
          </div>

          <label className="mini-label">Rol</label>
          <div className="seg">
            <button className={role === 'user' ? 'active' : ''} onClick={() => setRole('user')}>
              Kullanıcı
            </button>
            <button className={role === 'admin' ? 'active' : ''} onClick={() => setRole('admin')}>
              Yönetici
            </button>
          </div>

          <label className="mini-label">Uygulama erişimi</label>
          <div className="check-list">
            {apps.map((a) => {
              const on = selected.includes(a.slug)
              return (
                <button
                  key={a.slug}
                  className={`check-row ${on ? 'on' : ''}`}
                  onClick={() =>
                    setSelected((prev) => (on ? prev.filter((s) => s !== a.slug) : [...prev, a.slug]))
                  }
                >
                  <span>{a.emoji}</span>
                  <span className="grow">{a.name}</span>
                  <span className="tick">{on && <Check size={14} />}</span>
                </button>
              )
            })}
          </div>
        </div>
        <footer className="modal-foot">
          <button className="ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="primary" onClick={submit} disabled={busy || !email || password.length < 6}>
            {busy ? 'Oluşturuluyor...' : 'Hesabı oluştur'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function AccessModal({
  user,
  apps,
  onClose,
  onDone,
  onError,
}: {
  user: HubProfile
  apps: HubApp[]
  onClose: () => void
  onDone: () => void
  onError: (m: string) => void
}) {
  const [selected, setSelected] = useState<string[]>(user.apps || [])
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await adminCall('set_access', { user_id: user.id, apps: selected })
    setBusy(false)
    if (res.error) return onError(res.error)
    onDone()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>{user.full_name} — erişimler</h3>
          <button className="icon-round" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="check-list">
            {apps.map((a) => {
              const on = selected.includes(a.slug)
              return (
                <button
                  key={a.slug}
                  className={`check-row ${on ? 'on' : ''}`}
                  onClick={() =>
                    setSelected((prev) => (on ? prev.filter((s) => s !== a.slug) : [...prev, a.slug]))
                  }
                >
                  <span>{a.emoji}</span>
                  <span className="grow">{a.name}</span>
                  <span className="tick">{on && <Check size={14} />}</span>
                </button>
              )
            })}
          </div>
        </div>
        <footer className="modal-foot">
          <button className="ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function PasswordModal({
  user,
  onClose,
  onDone,
  onError,
}: {
  user: HubProfile
  onClose: () => void
  onDone: () => void
  onError: (m: string) => void
}) {
  const [password, setPassword] = useState(generatePassword())
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    const res = await adminCall('reset_password', { user_id: user.id, password })
    setBusy(false)
    if (res.error) return onError(res.error)
    onDone()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Şifre yenile</h3>
          <button className="icon-round" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <p className="muted small">{user.email} için yeni şifre</p>
          <div className="inline">
            <input value={password} onChange={(e) => setPassword(e.target.value)} />
            <button className="mini" onClick={() => setPassword(generatePassword())}>
              <KeyRound size={15} />
            </button>
          </div>
        </div>
        <footer className="modal-foot">
          <button className="ghost" onClick={onClose}>
            Vazgeç
          </button>
          <button className="primary" onClick={save} disabled={busy || password.length < 6}>
            {busy ? 'Kaydediliyor...' : 'Şifreyi yenile'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function generatePassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = ''
  for (let i = 0; i < 10; i++) out += chars[Math.floor(Math.random() * chars.length)]
  return out
}

function initials(name?: string | null) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
