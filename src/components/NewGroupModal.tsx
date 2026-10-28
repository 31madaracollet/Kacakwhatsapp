import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Camera, Check, Loader2, Search, Users } from 'lucide-react'
import type { Messenger } from '../hooks/useMessenger'
import type { Profile } from '../lib/types'
import { Modal } from './Modal'
import { Avatar } from './Avatar'
import { uploadAvatar } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

interface Props {
  open: boolean
  onClose: () => void
  m: Messenger
  onCreated: (chatId: string) => void
  onToast?: (msg: string) => void
}

export function NewGroupModal({ open, onClose, m, onCreated, onToast }: Props) {
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  /** üyeler aramadan bağımsız tutulur (arama değişince kaybolmasın) */
  const [picked, setPicked] = useState<Profile[]>([])
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
      setPicked([])
      setName('')
      setAvatar(null)
      setError(null)
      setCreating(false)
      setUploading(false)
    }
  }, [open])

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

  const isPicked = (id: string) => picked.some((p) => p.id === id)

  const toggle = (u: Profile) =>
    setPicked((prev) => (prev.some((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]))

  const pickAvatar = async (file?: File | null) => {
    if (!file || !user) return
    setUploading(true)
    setError(null)
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
    if (picked.length === 0) {
      setError('En az bir kişi seç')
      setStep(1)
      return
    }
    setCreating(true)
    setError(null)
    try {
      const id = await m.createGroup(name.trim(), picked.map((p) => p.id), avatar)
      onToast?.('Grup oluşturuldu ✅')
      onCreated(id)
      onClose()
    } catch (e: any) {
      setError(e.message || 'Grup oluşturulamadı')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Modal
      open={open}
      title={step === 1 ? `Grup üyelerini seç${picked.length ? ` (${picked.length})` : ''}` : 'Grup bilgileri'}
      onClose={onClose}
      footer={
        step === 1 ? (
          <button className="primary-btn" onClick={() => setStep(2)} disabled={picked.length === 0}>
            İleri ({picked.length})
          </button>
        ) : (
          <div className="row-actions">
            <button className="ghost-btn" onClick={() => setStep(1)} disabled={creating}>
              <ArrowLeft size={16} /> Geri
            </button>
            <button className="primary-btn" onClick={create} disabled={creating || uploading}>
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

          {picked.length > 0 && (
            <div className="selected-chips">
              {picked.map((u) => (
                <span key={u.id} className="chip">
                  {u.full_name || u.username}
                  <button type="button" onClick={() => toggle(u)} aria-label="çıkar">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="user-list">
            {users.map((u) => {
              const active = isPicked(u.id)
              return (
                <button key={u.id} className={`user-row ${active ? 'selected' : ''}`} onClick={() => toggle(u)}>
                  <Avatar name={u.full_name} src={u.avatar_url} size={42} seed={u.username} />
                  <div>
                    <strong>{u.full_name || u.username}</strong>
                    <span className="muted tiny">@{u.username}</span>
                  </div>
                  <span className={`check ${active ? 'on' : ''}`}>{active && <Check size={14} />}</span>
                </button>
              )
            })}
            {loading && (
              <p className="muted small center pad">
                <Loader2 size={16} className="spin" /> Kişiler yükleniyor...
              </p>
            )}
            {!loading && users.length === 0 && (
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
          <p className="muted small">{picked.length + 1} üye · Sen yönetici olacaksın</p>
          <div className="selected-chips">
            {picked.map((u) => (
              <span key={u.id} className="chip">
                {u.full_name || u.username}
                <button type="button" onClick={() => toggle(u)} aria-label="çıkar">
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
