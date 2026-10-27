// HappyProjects SSO köprüsü — Sucuk-Agent
// Yol: src/app/api/auth/sso/route.ts
//
// Hub, uygulamayı şu adresle açar:
//   https://sucuk-agent.vercel.app/sso#sso_access_token=<jwt>&sso_refresh_token=<t>
// Bu uç, token'ı HappyProjects Supabase'inde doğrular ve yerel oturum çerezini yazar.
import { NextResponse } from "next/server"
import { createSession } from "@/lib/auth"

export const dynamic = "force-dynamic"

const HUB_URL = process.env.HUB_SUPABASE_URL || "https://szhpjbuuiltkqhhgmphm.supabase.co"
const HUB_ANON = process.env.HUB_SUPABASE_ANON_KEY || ""
const ADMIN_EMAILS = (process.env.HUB_ADMIN_EMAILS || "admin@happyprojects.app")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)

export async function POST(req: Request) {
  try {
    const { access_token } = (await req.json()) as { access_token?: string }
    if (!access_token) {
      return NextResponse.json({ error: "access_token gerekli" }, { status: 400 })
    }

    // 1) Hub oturumunu doğrula
    const r = await fetch(`${HUB_URL}/auth/v1/user`, {
      headers: { apikey: HUB_ANON, Authorization: `Bearer ${access_token}` },
      cache: "no-store",
    })
    if (!r.ok) {
      return NextResponse.json({ error: "HappyProjects oturumu geçersiz" }, { status: 401 })
    }
    const u = (await r.json()) as { id?: string; email?: string; user_metadata?: any }
    if (!u.id || !u.email) {
      return NextResponse.json({ error: "Hesap bilgisi alınamadı" }, { status: 401 })
    }

    const email = u.email.toLowerCase()
    const username =
      (u.user_metadata?.username as string | undefined) ||
      email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "") ||
      `user${u.id.slice(0, 6)}`
    const role: "admin" | "user" = ADMIN_EMAILS.includes(email) ? "admin" : "user"

    // 2) Yerel oturum çerezini yaz
    const token = createSession({ id: u.id, username, role })
    const res = NextResponse.json({ ok: true, user: { id: u.id, username, role } })
    res.cookies.set("sucuk_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })
    return res
  } catch (err: any) {
    return NextResponse.json({ error: "SSO hatası: " + (err?.message ?? String(err)) }, { status: 500 })
  }
}
