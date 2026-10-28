import React, { useState } from 'react'
import { AtSign, Lock, Mail, MessageCircle, Phone, ShieldCheck, User, UserPlus, Zap } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setInfo(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setError(null)
    setInfo(null)
    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
      } else {
        const { needsConfirm } = await signUp({ email, password, username, fullName })
        if (needsConfirm) {
          setInfo('Hesabın oluşturuldu. E-postana gelen onay bağlantısına tıkladıktan sonra giriş yapabilirsin.')
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
            <Phone size={18} /> Sesli ve görüntülü arama (WebRTC)
          </li>
          <li>
            <ShieldCheck size={18} /> Supabase altyapısı, güvenli hesaplar · hesaplar burada açılır
          </li>
        </ul>

        <p className="hero-note">24 saatlik durumlar · sesli ve görüntülü arama · yönetim paneli</p>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs">
            <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')} type="button">
              Giriş yap
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">
              Hesap aç
            </button>
          </div>

          <h2>{mode === 'login' ? 'Tekrar hoş geldin' : 'Hesabını oluştur'}</h2>
          <p className="muted">
            {mode === 'login' ? 'Devam etmek için giriş yap' : 'Birkaç saniyede ZapMesaj’a katıl'}
          </p>

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
                    autoComplete="name"
                  />
                </label>

                <label className="field">
                  <AtSign size={16} />
                  <input
                    placeholder="Kullanıcı adı (örn. akif)"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    required
                    minLength={3}
                    maxLength={24}
                    pattern="[a-z0-9_]{3,24}"
                    autoComplete="username"
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
                type={showPass ? 'text' : 'password'}
                placeholder="Şifre (en az 6 karakter)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button type="button" className="field-eye" onClick={() => setShowPass((v) => !v)} tabIndex={-1}>
                {showPass ? 'gizle' : 'göster'}
              </button>
            </label>

            {error && <div className="alert error">{error}</div>}
            {info && <div className="alert ok">{info}</div>}

            <button className="primary-btn" disabled={busy}>
              {busy ? 'İşleniyor...' : mode === 'login' ? 'Giriş yap' : 'Hesabı oluştur'}
            </button>
          </form>

          <div className="demo-box">
            {mode === 'login' ? (
              <>
                <span>Hesabın yok mu?</span>
                <button className="ghost-btn" type="button" onClick={() => switchMode('register')}>
                  <UserPlus size={16} /> Hemen hesap aç
                </button>
              </>
            ) : (
              <>
                <span>Zaten hesabın var mı?</span>
                <button className="ghost-btn" type="button" onClick={() => switchMode('login')}>
                  Giriş yap
                </button>
              </>
            )}
          </div>

          <p className="tiny muted center">
            Devam ederek uygulamanın kurallarını kabul etmiş olursun. Mesajların Supabase üzerinde saklanır.
          </p>
        </div>
      </div>
    </div>
  )
}
