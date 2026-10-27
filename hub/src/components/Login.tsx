import { useState } from 'react'
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { useHub } from '../hooks/useHub'

export function Login() {
  const { signIn } = useHub()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-hero">
        <div className="hp-logo big">
          <span />
          <span />
          <span />
        </div>
        <h1>HappyProjects</h1>
        <p>Tüm projelerin tek çatı altında. Tek hesap, tek şifre, hepsine giriş.</p>

        <div className="login-points">
          <div>
            <Sparkles size={18} /> <span>Tüm uygulamalar tek panelde</span>
          </div>
          <div>
            <Lock size={18} /> <span>Tek hesapla güvenli giriş (SSO)</span>
          </div>
          <div>
            <ShieldCheck size={18} /> <span>Yönetici onaylı hesap açma</span>
          </div>
        </div>
      </div>

      <div className="login-card">
        <h2>Oturum aç</h2>
        <p className="muted">HappyProjects hesabınla devam et</p>

        <form onSubmit={submit}>
          <label className="input-line">
            <Mail size={17} />
            <input
              type="email"
              placeholder="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>

          <label className="input-line">
            <Lock size={17} />
            <input
              type="password"
              placeholder="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button className="primary" disabled={busy}>
            {busy ? 'Giriş yapılıyor...' : 'Giriş yap'}
            {!busy && <ArrowRight size={17} />}
          </button>
        </form>

        <div className="login-foot">
          <p className="tiny muted">
            Hesabın yok mu? Hesaplar güvenlik gereği <strong>yönetici</strong> tarafından açılır.
            Yöneticine ulaş: <a href="mailto:admin@happyprojects.app">admin@happyprojects.app</a>
          </p>
        </div>
      </div>
    </div>
  )
}
