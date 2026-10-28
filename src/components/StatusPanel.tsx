import { useEffect, useRef, useState } from 'react'
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Plus, Trash2, Type, X } from 'lucide-react'
import type { Statuses } from '../hooks/useStatuses'
import type { Status, StatusKind } from '../lib/types'
import { Avatar } from './Avatar'
import { formatTime } from '../lib/utils'

const RENKLER = ['#0a7c5a', '#1f3c88', '#7b2d8e', '#b23a48', '#0f4c5c', '#3d405b', '#8d5524']

interface Props {
  s: Statuses
  meId: string
  onClose: () => void
  onToast?: (msg: string) => void
}

export function StatusPanel({ s, meId, onClose, onToast }: Props) {
  const [viewing, setViewing] = useState<{ items: Status[]; index: number } | null>(null)
  const [composer, setComposer] = useState(false)
  const [text, setText] = useState('')
  const [bg, setBg] = useState(RENKLER[0])
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<StatusKind>('text')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const startViewing = (items: Status[]) => {
    if (!items.length) return
    setViewing({ items, index: 0 })
  }

  const create = async () => {
    if (!text.trim() && !file) return
    setBusy(true)
    setProgress('Paylaşılıyor…')
    try {
      await s.createStatus(kind, text, file, bg, setProgress)
      setComposer(false)
      setText('')
      setFile(null)
      setKind('text')
      onToast?.('Durum paylaşıldı ✅')
    } catch (e: any) {
      onToast?.(e?.message || 'Durum paylaşılamadı')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal durum-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>Durum</h3>
          <button className="icon-round" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="durum-list">
          <button className="durum-row mine" onClick={() => setComposer(true)}>
            <div className="durum-ring add">
              <Avatar name={s.myStatuses[0]?.profile?.full_name || 'Ben'} src={s.myStatuses[0]?.profile?.avatar_url} size={48} seed={meId} />
              <span className="ring-plus">
                <Plus size={14} />
              </span>
            </div>
            <div className="durum-info">
              <strong>Durumum</strong>
              <span className="muted tiny">
                {s.myStatuses.length
                  ? `${s.myStatuses.length} durum · ${formatTime(s.myStatuses[s.myStatuses.length - 1].created_at)}`
                  : 'Durum eklemek için dokun'}
              </span>
            </div>
          </button>

          {s.groups
            .filter((g) => !g.isMine)
            .map((g) => (
              <button key={g.userId} className="durum-row" onClick={() => startViewing(g.items)}>
                <div className="durum-ring">
                  <Avatar
                    name={g.profile?.full_name}
                    src={g.profile?.avatar_url}
                    size={48}
                    seed={g.userId}
                  />
                </div>
                <div className="durum-info">
                  <strong>{g.profile?.full_name || g.profile?.username || 'Kullanıcı'}</strong>
                  <span className="muted tiny">
                    {g.items.length} durum · {formatTime(g.lastAt)}
                  </span>
                </div>
              </button>
            ))}

          {!s.groups.filter((g) => !g.isMine).length && !s.loading && (
            <p className="muted center small pad">
              Henüz kimse durum paylaşmadı. İlk durumu sen ekle ✨
            </p>
          )}

          {s.myStatuses.length > 0 && (
            <div className="durum-mine-actions">
              <span className="tiny muted">Durumlarım</span>
              <button className="mini" onClick={() => startViewing(s.myStatuses)}>
                Görüntüle
              </button>
            </div>
          )}
        </div>

        {composer && (
          <div className="durum-composer">
            <div className="composer-head">
              <strong>Yeni durum</strong>
              <button className="icon-round" onClick={() => setComposer(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="composer-preview" style={{ background: kind === 'text' ? bg : '#111' }}>
              {file && kind === 'image' && <img src={URL.createObjectURL(file)} alt="önizleme" />}
              {file && kind === 'video' && <video src={URL.createObjectURL(file)} controls />}
              {!file && (
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Ne düşünüyorsun?"
                  maxLength={280}
                />
              )}
            </div>

            <div className="composer-tools">
              <label className="mini" title="Fotoğraf">
                <ImagePlus size={16} />
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setFile(f)
                    if (f) setKind('image')
                  }}
                />
              </label>
              <label className="mini" title="Video">
                <Camera size={16} />
                <input
                  type="file"
                  accept="video/*"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setFile(f)
                    if (f) setKind('video')
                  }}
                />
              </label>
              <button
                className={`mini ${kind === 'text' ? 'on' : ''}`}
                title="Yazı"
                onClick={() => {
                  setFile(null)
                  setKind('text')
                }}
              >
                <Type size={16} />
              </button>
              {kind === 'text' && (
                <div className="renk-sec">
                  {RENKLER.map((c) => (
                    <button
                      key={c}
                      className={bg === c ? 'on' : ''}
                      style={{ background: c }}
                      onClick={() => setBg(c)}
                      aria-label="renk"
                    />
                  ))}
                </div>
              )}
            </div>

            <button className="primary-btn" disabled={busy || (!text.trim() && !file)} onClick={create}>
              {busy ? progress || 'Paylaşılıyor…' : 'Durumu paylaş'}
            </button>
          </div>
        )}
      </div>

      {viewing && (
        <StatusViewer
          s={s}
          meId={meId}
          items={viewing.items}
          index={viewing.index}
          setIndex={(i) => setViewing((v) => (v ? { ...v, index: i } : v))}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/* --------------------------------------------------------------- görüntüleyici */
function StatusViewer({
  s,
  meId,
  items,
  index,
  setIndex,
  onClose,
}: {
  s: Statuses
  meId: string
  items: Status[]
  index: number
  setIndex: (i: number) => void
  onClose: () => void
}) {
  const current = items[index]
  const [progress, setProgress] = useState(0)
  const seen = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!current) return
    setProgress(0)
    if (current.user_id !== meId && !seen.current.has(current.id)) {
      seen.current.add(current.id)
      void s.markViewed(current.id)
    }
    const started_at = Date.now()
    const sure = current.kind === 'text' ? 6000 : 12000
    const id = window.setInterval(() => {
      const p = Math.min(100, ((Date.now() - started_at) / sure) * 100)
      setProgress(p)
      if (p >= 100) {
        window.clearInterval(id)
        if (index < items.length - 1) setIndex(index + 1)
        else onClose()
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [current, index, items.length, meId, onClose, s, setIndex])

  if (!current) return null

  const next = () => (index < items.length - 1 ? setIndex(index + 1) : onClose())
  const prev = () => (index > 0 ? setIndex(index - 1) : undefined)

  return (
    <div className="durum-viewer" onClick={(e) => e.stopPropagation()}>
      <div className="durum-bars">
        {items.map((_, i) => (
          <span key={i} className="bar">
            <i style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }} />
          </span>
        ))}
      </div>

      <header className="durum-viewer-head">
        <Avatar name={current.profile?.full_name} src={current.profile?.avatar_url} size={36} seed={current.user_id} />
        <div>
          <strong>{current.profile?.full_name || 'Durum'}</strong>
          <span className="tiny">{formatTime(current.created_at)}</span>
        </div>
        {current.user_id === meId && (
          <button
            className="icon-round danger"
            title="Durumu sil"
            onClick={async () => {
              await s.removeStatus(current.id)
              onClose()
            }}
          >
            <Trash2 size={16} />
          </button>
        )}
        <button className="icon-round" onClick={onClose}>
          <X size={18} />
        </button>
      </header>

      <div className="durum-stage" style={{ background: current.kind === 'text' ? current.bg || '#0a7c5a' : '#000' }}>
        {current.kind === 'image' && current.media_url && <img src={current.media_url} alt="durum" />}
        {current.kind === 'video' && current.media_url && <video src={current.media_url} autoPlay controls />}
        {current.body && <p className="durum-text">{current.body}</p>}
      </div>

      <button className="nav prev" onClick={prev} aria-label="önceki">
        <ChevronLeft size={26} />
      </button>
      <button className="nav next" onClick={next} aria-label="sonraki">
        <ChevronRight size={26} />
      </button>

      {current.user_id === meId && (
        <span className="durum-views">{s.views[current.id] || 0} görüntüleme</span>
      )}
    </div>
  )
}
