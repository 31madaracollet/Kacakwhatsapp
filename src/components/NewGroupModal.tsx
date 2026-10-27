import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, Search, Users } from 'lucide-react'
import type { Messenger } from '../hooks/useMessenger'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { uploadAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Props {
  open: boolean
  onClose: () => void
  m: Messenger
  onCreated: (chatId: string) => void
}

export function NewGroupModal({ open, onClose, m, onCreated }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [name, setName] = useState('')
  const [avatar, setAvatar] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setStep(1)
      setQuery('')
      setSelected([])
      setName('')
      setAvatar(null)
      setError(null)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    let alive = true
    const t = setTimeout(async () => {
      try {
        const list = await m.searchUsers(query)
        if (alive) setUsers(list.filter((u) => u.id !== m.meId))
      } catch (e: any) {
        if (alive) setError(e.message)
      }
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, open, m.searchUsers, m.meId])

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const pickAvatar = async (file?: File | null) => {
    if (!file || !user) return
    setUploading(true)
    try {
      const url = await uploadAvatar(user.id, file)
      setAvatar(url)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setUploading(false)
    }
  }

  const create = async () => {
    if (!name.trim()) {
      setError('Gruba bir isim ver')
      return
    }
    setCreating(true)
    setError(null)
    try {
      const id = await m.createGroup(name.trim(), selected, avatar)
      onCreated(id)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      title={step === 1 ? 'Grup üyelerini seç' : 'Grup bilgileri'}
      onClose={onClose}
      footer={
        step === 1 ? (
          <button className="primary-btn" onClick={() => setStep(2)} disabled={selected.length === 0}>
            İleri ({selected.length})
          </button>
        ) : (
          <div className="row-actions">
            <button className="ghost-btn" onClick={() => setStep(1)}>
              <ArrowLeft size={16} /> Geri
            </button>
            <button className="primary-btn" onClick={create} disabled={creating}>
              {creating ? 'Oluşturuluyor...' : 'Grubu oluştur'}
            </button>
          </div>
        )
      }
    >
      {error && <div className="alert error">{error}</div>}

      {step === 1 ? (
        <>
          <div className="search-wrap modal-search">
            <Search size={16} />
            <input autoFocus placeholder="Kişi ara..." value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="user-list">
            {users.map((u) => {
              const active = selected.includes(u.id)
              return (
                <button key={u.id} className={`user-row ${active ? 'selected' : ''}`} onClick={() => toggle(u.id)}>
                  <Avatar name={u.full_name} src={u.avatar_url} size={42} seed={u.username} />
                  <div>
                    <strong>{u.full_name}</strong>
                    <span className="muted tiny">@{u.username}</span>
                  </div>
                  <span className={`check ${active ? 'on' : ''}`}>{active && <Check size={14} />}</span>
                </button>
              )
            })}
            {users.length === 0 && (
              <p className="muted small center pad">
                <Users size={16} /> Kişi bulunamadı
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="group-form">
          <button className="group-avatar-pick" onClick={() => fileRef.current?.click()}>
            {avatar ? (
              <img src={avatar} alt="grup" />
            ) : (
              <div className="group-avatar-empty">
                <Camera size={26} />
                <span>Fotoğraf ekle</span>
              </div>
            )}
            {uploading && <span className="uploading-overlay">Yükleniyor...</span>}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => pickAvatar(e.target.files?.[0])}
          />
          <label className="field plain">
            <input
              autoFocus
              placeholder="Grup adı"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </label>
          <p className="muted small">{selected.length + 1} üye · Sen yönetici olacaksın</p>
          <div className="selected-chips">
            {selected.map((id) => {
              const u = users.find((x) => x.id === id)
              if (!u) return null
              return (
                <span key={id} className="chip">
                  {u.full_name}
                  <button onClick={() => toggle(id)}>×</button>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </Modal>
  )
}
