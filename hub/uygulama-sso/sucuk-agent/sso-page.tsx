// HappyProjects SSO giriş sayfası — Sucuk-Agent
// Yol: src/app/sso/page.tsx
//
// Hub'dan gelen #sso_access_token hash'ini okur, /api/auth/sso'ya gönderir,
// başarılıysa /dashboard'a geçer.
"use client"

import { useEffect, useState } from "react"

export default function SsoPage() {
  const [mesaj, setMesaj] = useState("HappyProjects oturumu devralınıyor…")

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "")
    const p = new URLSearchParams(hash)
    const token = p.get("sso_access_token")

    if (!token) {
      setMesaj("Oturum bilgisi bulunamadı. Yönlendiriliyorsunuz…")
      setTimeout(() => (window.location.href = "/login"), 1500)
      return
    }

    // hash'i adres çubuğundan temizle
    history.replaceState(null, "", window.location.pathname)

    fetch("/api/auth/sso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token }),
      credentials: "include",
    })
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Giriş yapılamadı")
        try {
          if (d.user) sessionStorage.setItem("sucuk_user_tab", JSON.stringify(d.user))
        } catch {}
        window.location.href = "/dashboard"
      })
      .catch((e) => {
        setMesaj("Giriş yapılamadı: " + e.message)
        setTimeout(() => (window.location.href = "/login"), 2500)
      })
  }, [])

  return (
    <div className="min-h-screen grid place-items-center bg-[var(--canvas)]">
      <p className="text-sm opacity-70">{mesaj}</p>
    </div>
  )
}
