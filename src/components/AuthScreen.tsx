import React, { useState } from 'react'
import { Lock, Mail, MessageCircle, ShieldCheck, User, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        const { needsConfirm } = await signUp({ email, password, username, fullName })
        if (needsConfirm) {
          setInfo('Sana bir onay e-postası gönderdik. E-postanı onaylayıp giriş yapabilirsin.')
          setMode('login')
        }
      }
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
            <ShieldCheck size={18} /> Supabase altyapısı, güvenli hesaplar
          </li>
        </ul>

        <p className="hero-note">Durum özelliği yok — sadece sohbet. Tam istediğin gibi.</p>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2>{mode === 'login' ? 'Tekrar hoş geldin' : 'Hesap oluştur'}</h2>
          <p className="muted">
            {mode === 'login' ? 'Devam etmek için giriş yap' : 'Saniyeler içinde aramıza katıl'}
          </p>

          <div className="segmented">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')} type="button">
              Giriş yap
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
              Kayıt ol
            </button>
          </div>

          <form onSubmit={submit}>
            {mode === 'register' && (
              <>
                <label className="field">
                  <User size={16} />
                  <input
                    placeholder="Ad Soyad"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </label>
                <label className="field">
                  <span className="at">@</span>
                  <input
                    placeholder="kullanici_adi"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    minLength={3}
                  />
                </label>
              </>
            )}

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
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </label>

            {error && <div className="alert error">{error}</div>}
            {info && <div className="alert ok">{info}</div>}

            <button className="primary-btn" disabled={busy}>
              {busy ? 'İşleniyor...' : mode === 'login' ? 'Giriş yap' : 'Hesabımı oluştur'}
            </button>
          </form>

          <p className="tiny muted center">
            Devam ederek uygulamanın kurallarını kabul etmiş olursun. Mesajların Supabase üzerinde saklanır.
          </p>
        </div>
      </div>
    </div>
  )
}
