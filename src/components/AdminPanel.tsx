import { useMemo, useState } from 'react'
import {
  Ban,
  CheckCircle2,
  Megaphone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Users,
  X,
} from 'lucide-react'
import type { Admin, AdminUser } from '../hooks/useAdmin'
import { Avatar } from './Avatar'
import { lastSeenText } from '../lib/utils'

interface Props {
  a: Admin
  open: boolean
  onClose: () => void
  onToast: (msg: string) => void
}

const STAT_LABEL: Record<string, string> = {
  kullanici: 'Kullanıcı',
  yonetici: 'Yönetici',
  yasakli: 'Yasaklı',
  sohbet: 'Sohbet',
  mesaj: 'Mesaj',
  durum: 'Durum',
  arama: 'Arama',
  bugun_aktif: 'Bugün aktif',
}

export function AdminPanel({ a, open, onClose, onToast }: Props) {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [duyuru, setDuyuru] = useState('')
  const [tab, setTab] = useState<'kullanicilar' | 'duyuru'>('kullanicilar')

  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    if (!term) return a.users
    return a.users.filter(
      (u) =>
        (u.display_name || '').toLowerCase().includes(term) ||
        (u.username || '').toLowerCase().includes(term) ||
        (u.email || '').toLowerCase().includes(term),
    )
  }, [a.users, q])

  if (!open) return null

  const run = async (key: string, fn: () => Promise<void>, okMsg: string) => {
    setBusy(key)
    try {
      await fn()
      onToast(okMsg)
    } catch (e: any) {
      onToast(e.message || 'İşlem başarısız')
    } finally {
      setBusy(null)
    }
  }

  const row = (u: AdminUser) => (
    <div className="admin-row" key={u.id}>
      <Avatar name={u.display_name || u.username} src={u.avatar_url} size={40} seed={u.username} />
      <div className="admin-user-info">
        <strong>
          {u.display_name || u.username}
          {u.is_admin && (
            <span className="badge admin">
              <ShieldCheck size={11} /> yönetici
            </span>
          )}
          {u.is_banned && (
            <span className="badge ban">
              <Ban size={11} /> yasaklı
            </span>
          )}
        </strong>
        <span className="tiny muted">
          @{u.username}
          {u.email ? ` · ${u.email}` : ''} · {lastSeenText(u.last_seen)}
          {typeof u.mesaj === 'number' ? ` · ${u.mesaj} mesaj` : ''}
        </span>
      </div>
      <div className="admin-actions">
        <button
          className="mini"
          disabled={busy === u.id + 'a'}
          title={u.is_admin ? 'Yöneticiliği al' : 'Yönetici yap'}
          onClick={() =>
            run(
              u.id + 'a',
              () => a.setAdmin(u.id, !u.is_admin),
              u.is_admin ? 'Yöneticilik alındı' : 'Yönetici yapıldı',
            )
          }
        >
          {u.is_admin ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
          {u.is_admin ? 'Yetkiyi al' : 'Yönetici yap'}
        </button>
        <button
          className={`mini ${u.is_banned ? 'ok' : 'danger'}`}
          disabled={busy === u.id + 'b'}
          title={u.is_banned ? 'Yasağı kaldır' : 'Kullanıcıyı yasakla'}
          onClick={() => run(u.id + 'b', () => a.setBanned(u.id, !u.is_banned), u.is_banned ? 'Yasak kaldırıldı' : 'Kullanıcı yasaklandı')}
        >
          {u.is_banned ? <CheckCircle2 size={14} /> : <Ban size={14} />}
          {u.is_banned ? 'Yasağı kaldır' : 'Yasakla'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal admin-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-head">
          <h3>
            <ShieldCheck size={18} /> Yönetim Paneli
          </h3>
          <div className="head-tools">
            <button className="icon-round" title="Yenile" onClick={() => void a.reload()}>
              <RefreshCw size={16} className={a.loading ? 'spin' : ''} />
            </button>
            <button className="icon-round" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        {!a.isAdmin ? (
          <p className="pad muted center">Bu panel yalnızca yöneticiler içindir.</p>
        ) : (
          <>
            {a.stats && (
              <div className="admin-stats">
                {Object.entries(a.stats).map(([k, v]) => (
                  <div className="stat" key={k}>
                    <strong>{v as number}</strong>
                    <span>{STAT_LABEL[k] || k}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="admin-tabs">
              <button className={tab === 'kullanicilar' ? 'on' : ''} onClick={() => setTab('kullanicilar')}>
                <Users size={15} /> Kullanıcılar ({a.users.length})
              </button>
              <button className={tab === 'duyuru' ? 'on' : ''} onClick={() => setTab('duyuru')}>
                <Megaphone size={15} /> Duyuru
              </button>
            </div>

            {a.error && <p className="admin-error">{a.error}</p>}

            {tab === 'kullanicilar' && (
              <>
                <div className="admin-search">
                  <Search size={16} />
                  <input placeholder="Kullanıcı ara…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="admin-list">{list.map(row)}</div>
              </>
            )}

            {tab === 'duyuru' && (
              <div className="admin-broadcast">
                <p className="muted small">
                  Duyuru, herkesin sohbet listesinde <strong>Duyurular</strong> adlı grupta yönetici mesajı olarak
                  yayınlanır.
                </p>
                <textarea
                  rows={4}
                  placeholder="Duyuru metni…"
                  value={duyuru}
                  onChange={(e) => setDuyuru(e.target.value)}
                />
                <button
                  className="primary-btn"
                  disabled={!duyuru.trim() || busy === 'duyuru'}
                  onClick={() =>
                    run(
                      'duyuru',
                      async () => {
                        const n = await a.broadcast(duyuru.trim())
                        setDuyuru('')
                        onToast(`Duyuru ${n} kişiye gönderildi 📣`)
                      },
                      'Duyuru gönderildi',
                    )
                  }
                >
                  <Megaphone size={16} /> Duyuruyu yayınla
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
