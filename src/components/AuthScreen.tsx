import React, { useState } from 'react'
import { Lock, Mail, MessageCircle, Phone, ShieldCheck, User, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function AuthScreen() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message || 'Bir şeyler ters gitti')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-hero">
        <div className="brand">
          <span className="brand-logo">
            <MessageCircle size={30} />
          </span>
          <div>
            <h1>ZapMesaj</h1>
            <p>Konuşmanın en hızlı hali</p>
          </div>
        </div>

        <ul className="hero-features">
          <li>
            <Zap size={18} /> Anlık mesajlaşma — mesajlar göz açıp kapayana kadar karşıda
          </li>
          <li>
            <Mail size={18} /> Fotoğraf, video, ses kaydı ve dosya paylaşımı
          </li>
          <li>
            <User size={18} /> Grup sohbetleri, okundu bilgisi, yazıyor göstergesi
          </li>
          <li>
            <Phone size={18} /> Sesli ve görüntülü arama (WebRTC)
          </li>
          <li>
            <ShieldCheck size={18} /> Supabase altyapısı, güvenli hesaplar · hesapları yönetici açar
          </li>
        </ul>

        <p className="hero-note">24 saatlik durumlar · sesli ve görüntülü arama · yönetim paneli</p>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>Tekrar hoş geldin</h2>
          <p className="muted">Devam etmek için giriş yap</p>

          <form onSubmit={submit}>
            <label className="field">
              <Mail size={16} />
              <input
                type="email"
                placeholder="E-posta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="field">
              <Lock size={16} />
              <input
                type="password"
                placeholder="Şifre (en az 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="current-password"
              />
            </label>

            {error && <div className="alert error">{error}</div>}
            {info && <div className="alert ok">{info}</div>}

            <button className="primary-btn" disabled={busy}>
              {busy ? 'İşleniyor...' : 'Giriş yap'}
            </button>
          </form>

          <div className="demo-box">
            <span>Hesabın yok mu?</span>
            <p className="tiny muted">
              Hesap açma yetkisi yalnızca yöneticidedir. HappyProjects hesabınla giriş yapabilir ya da
              yöneticiden hesap açmasını isteyebilirsin.
            </p>
            <a className="ghost-btn" href="https://happyprojects-delta.vercel.app" target="_blank" rel="noreferrer">
              HappyProjects'e git
            </a>
          </div>

          <p className="tiny muted center">
            Devam ederek uygulamanın kurallarını kabul etmiş olursun. Mesajların Supabase üzerinde saklanır.
          </p>
        </div>
      </div>
    </div>
  )
}
