# HappyProjects 🎛️

Tüm projelerin **tek hesap** altında buluştuğu merkez (hub) — Google tarzı bir panel.
Tek oturumla bağlı tüm uygulamalara girilir; hesapları **yönetici** açar.

- Canlı: https://happyprojects.vercel.app
- Supabase: `zapmesaj` projesi (`szhpjbuuiltkqhhgmphm`)
- Yönetici: **admin@happyprojects.app**

## Konum

Bu klasör şu an **`Kacakwhatsapp` deposunun içinde** (`hub/`) duruyor.
Kendi deposu olan `31madaracollet/HappyProjects` hazır olduğunda bu klasör oraya taşınacak
(`scripts/tasi.sh` bunu yapar). Vercel projesi `happyprojects` bu klasörü kök dizin kabul eder.

```
hub/                            ← bu klasör = ana site (hub)
├── src/                        ← React + TypeScript + Vite arayüzü
├── supabase/functions/hub-admin ← yönetici Edge Function kaynağı
├── supabase/migrations/         ← tablo + RLS şeması
└── scripts/bagla.sh            ← alt depoları (submodule) bağlar
```

## Bağlı uygulamalar

| Uygulama | Depo | Adres |
|---|---|---|
| ZapChat 💬 | `31madaracollet/Kacakwhatsapp` | https://zapmesaj.vercel.app |
| Sucuk Agent 🤖 | `31madaracollet/Sucuk-Agent` | https://sucuk-agent.vercel.app |

## Özellikler

- 🔐 **Tek hesap (SSO):** hub'a gir → uygulamaya tıkla → oturum `#sso_access_token` ile devredilir, tekrar giriş yok
- 👤 **Yönetici paneli:** hesap açma, geçici şifre üretme, şifre yenileme, rol verme, hesap kapatma/silme
- 🎯 **Uygulama bazlı erişim:** hangi kullanıcı hangi uygulamayı görür
- ➕ **Uygulama yönetimi:** ad, adres, açıklama, emoji, aktif/pasif
- 📊 **Hareket kaydı:** kim ne zaman ne yaptı
- 🔍 Google tarzı arama (`/` kısayolu), mobil uyumlu

## Geliştirme

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # dist/
```

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala. Vercel'de `VITE_SUPABASE_URL` ve
`VITE_SUPABASE_ANON_KEY` tanımlı.

## Veritabanı

`supabase/migrations/0001_hub.sql` — `hub_profiles`, `hub_apps`, `hub_access`, `hub_activity`
tabloları, RLS politikaları, yeni kullanıcı trigger'ı ve rol koruma tetikleyicisi.
