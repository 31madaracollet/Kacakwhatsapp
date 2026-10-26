import { useEffect, useRef, useState } from 'react'
import { Camera, LogOut } from 'lucide-react'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { useAuth } from '../hooks/useAuth'

interface Props {
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

export function ProfileModal({ open, onClose, onToast }: Props) {
  const { profile, saveProfile, changeAvatar, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [about, setAbout] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile && open) {
      setFullName(profile.full_name || '')
      setUsername(profile.username || '')
      setAbout(profile.about || '')
      setError(null)
    }
  }, [profile, open])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveProfile({
        full_name: fullName.trim(),
        username: username.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''),
        about: about.trim(),
      })
      onToast('Profil güncellendi ✅')
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const uploadAvatarFile = async (file?: File | null) => {
    if (!file) return
    try {
      await changeAvatar(file)
      onToast('Profil fotoğrafı güncellendi')
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <Modal
      open={open}
      title="Profilim"
      onClose={onClose}
      footer={
        <div className="row-actions">
          <button className="ghost-btn danger" onClick={() => signOut()}>
            <LogOut size={16} /> Çıkış
          </button>
          <button className="primary-btn" onClick={save} disabled={saving}>
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </div>
      }
    >
      <div className="profile-top">
        <button className="profile-avatar" onClick={() => fileRef.current?.click()}>
          <Avatar name={fullName} src={profile?.avatar_url} size={96} seed={profile?.username} />
          <span className="avatar-edit">
            <Camera size={16} />
          </span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => uploadAvatarFile(e.target.files?.[0])} />
        <p className="muted small">Fotoğrafa dokunarak değiştir</p>
      </div>

      {error && <div className="alert error">{error}</div>}

      <label className="stack-field">
        <span>Ad Soyad</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={50} />
      </label>

      <label className="stack-field">
        <span>Kullanıcı adı</span>
        <input value={username} onChange={(e) => setUsername(e.target.value)} maxLength={30} />
      </label>

      <label className="stack-field">
        <span>Hakkımda</span>
        <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={120} placeholder="Kısa bir not" />
      </label>

      <p className="tiny muted center">Hesap kimliği: {profile?.id?.slice(0, 8)}</p>
    </Modal>
  )
}
