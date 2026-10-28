import React, { useState } from 'react'
import { Check, FileText, LogOut, MessageCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { MESSAGE_RETENTION_DAYS, TERMS_SECTIONS, TERMS_UPDATED, TERMS_VERSION } from '../lib/terms'

/** Ortak metin gövdesi — hem tam ekran kapıda hem de önizleme penceresinde kullanılır. */
export function TermsBody() {
  return (
    <div className="terms-text">
      <p className="terms-meta">
        Sürüm {TERMS_VERSION} · Yürürlük: {TERMS_UPDATED}
      </p>
      {TERMS_SECTIONS.map((s) => (
        <section key={s.title}>
          <h4>{s.title}</h4>
          <ul>
            {s.items.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="terms-meta">ZapMesaj · zapmesaj.vercel.app</p>
    </div>
  )
}

/**
 * Kabul kapısı: hüküm ve koşullar onaylanmadan uygulama açılmaz.
 * App.tsx içinde `termsAccepted` false ise bu ekran döndürülür.
 */
export function TermsScreen() {
  const { acceptTerms, signOut, profile } = useAuth()
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toplandi, setToplandi] = useState(false)

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const ad = profile?.full_name || profile?.username || ''

  const onScroll = () => {
    const el = scrollRef.current
    if (!el || toplandi) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setToplandi(true)
  }

  const kabul = async () => {
    if (!ok || busy) return
    setBusy(true)
    setError(null)
    try {
      await acceptTerms()
    } catch (e: any) {
      setError(e?.message || 'Onay kaydedilemedi, tekrar dene')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="terms-page">
      <div className="terms-card">
        <header className="terms-head">
          <span className="brand-logo">
            <MessageCircle size={26} />
          </span>
          <div>
            <h1>Hüküm ve Koşullar</h1>
            <p className="muted">
              {ad ? `${ad}, devam etmek için ` : 'Devam etmek için '}
              bu metni okuyup kabul etmen gerekiyor.
            </p>
          </div>
        </header>

        <div className="terms-scroll" ref={scrollRef} onScroll={onScroll}>
          <TermsBody />
        </div>

        <div className="terms-foot">
          {!toplandi && (
            <p className="tiny muted">
              <FileText size={14} /> Metnin sonuna kadar kaydırıp okuyabilirsin.
            </p>
          )}

          <label className="terms-check">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>
              Hüküm ve koşulların tamamını okudum; mesajlarımın en fazla {MESSAGE_RETENTION_DAYS} gün
              saklanacağını anladım ve kabul ediyorum.
            </span>
          </label>

          {error && <div className="alert error">{error}</div>}

          <div className="terms-actions">
            <button className="primary-btn" disabled={!ok || busy} onClick={kabul}>
              <Check size={18} /> {busy ? 'Kaydediliyor...' : 'Kabul ediyorum, devam et'}
            </button>
            <button className="ghost-btn" type="button" onClick={() => void signOut()} disabled={busy}>
              <LogOut size={16} /> Kabul etmiyorum, çıkış yap
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
