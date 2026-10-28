import { useEffect, useState } from 'react'
import { LogOut, ShieldCheck, X } from 'lucide-react'
import { useHub } from '../hooks/useHub'
import { supabase } from '../lib/supabase'

export function ProfileModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string) => void }) {
  const { profile, isAdmin, signOut, refresh, apps } = useHub()
  const [fullName, setFullName] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setFullName(profile?.full_name || '')
  }, [profile])

  const save = async () => {
    if (!profile) return
    setBusy(true)
    const { error } = await supabase.from('hub_profiles').update({ full_name: fullName.trim() }).eq('id', profile.id)
    setBusy(false)
    if (error) return onToast(error.message)
    await refresh()
    onToast('Profil güncellendi')
    onClose()
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Hesabım</h3>
          <button className="icon-round" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="profile-top">
            <span className="avatar xl">{initials(fullName || profile?.full_name)}</span>
            <span className="muted small">{profile?.email}</span>
            {isAdmin && (
              <span className="pill admin">
                <ShieldCheck size={12} /> yönetici
              </span>
            )}
          </div>

          <label className="mini-label">Ad Soyad</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} />

          <label className="mini-label">Erişimin olan uygulamalar</label>
          <div className="app-chips">
            {apps.map((a) => (
              <span key={a.slug} className="chip">
                {a.emoji} {a.name}
              </span>
            ))}
          </div>
        </div>
        <footer className="modal-foot">
          <button className="ghost danger" onClick={() => signOut()}>
            <LogOut size={16} /> Çıkış
          </button>
          <button className="primary" onClick={save} disabled={busy}>
            {busy ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </footer>
      </div>
    </div>
  )
}

function initials(name?: string | null) {
  if (!name) return '?'
  const p = name.trim().split(/\s+/)
  return p.length === 1 ? p[0].slice(0, 2).toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase()
}
