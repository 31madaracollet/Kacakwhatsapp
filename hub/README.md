# HappyProjects 🎛️

Tüm projelerin **tek hesap** altında buluştuğu merkez (hub) — Google tarzı bir panel.
Tek oturumla bağlı tüm uygulamalara girilir; hesapları **yönetici** açar.

- Canlı: https://happyprojects-delta.vercel.app
- Supabase: `zapmesaj` projesi (`szhpjbuuiltkqhhgmphm`)
- Yönetici: **admin@happyprojects.app**

## Yapı — tek ana depo, tüm depolar altında

```
hub/                              ← ana site (hub), kendi deposu: HappyProjects
├── src/                          ← React + TypeScript + Vite arayüzü
├── supabase/
│   ├── functions/hub-admin/      ← yönetici Edge Function kaynağı
│   └── migrations/0001_hub.sql   ← tablolar + RLS + rol koruması
├── scripts/
│   ├── bagla.sh                  ← tüm depoları alt depo olarak bağlar
│   └── tasi.sh                   ← hub'ı kendi deposuna taşır
└── apps/                         ← ALT DEPOLAR (git submodule)
    ├── Kacakwhatsapp/           → ZapChat
    ├── haber-hatti/
    ├── IsikHolding/
    ├── AliKeremYayinlari/
    ├── TurkAI-app/
    ├── Sucuk-Agent/             → bağlanmayı bekliyor
    └── TurkAIV2/                → boş depo
```

Tek komutla hepsini indir:

```bash
git clone --recurse-submodules https://github.com/31madaracollet/HappyProjects.git
# veya mevcut klonda:
git submodule update --init --recursive
```

Alt depoları son hallerine getir:

```bash
./scripts/sync-submodules.sh      # her birinde git pull
```

## Uygulamalar

| Uygulama | Depo | Adres | SSO |
|---|---|---|---|
| ZapChat 💬 | `Kacakwhatsapp` | https://zapmesaj.vercel.app | ✅ |
| Sucuk Agent 🤖 | `Sucuk-Agent` | https://sucuk-agent.vercel.app | ⏳ |
| TurkAI 🧠 | `TurkAI` | https://turkai.vercel.app | ⏳ |

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
npm run dev      # http://localhost:5180
npm run build    # dist/
```

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyala. Vercel'de `VITE_SUPABASE_URL` ve
`VITE_SUPABASE_ANON_KEY` tanımlı.

## Veritabanı

`supabase/migrations/0001_hub.sql` — `hub_profiles`, `hub_apps`, `hub_access`, `hub_activity`
tabloları, RLS politikaları, yeni kullanıcı trigger'ı ve **rol koruma tetikleyicisi**
(normal kullanıcı kendini admin yapamaz).

## SSO sözleşmesi (uygulama tarafı)

Hub, uygulamayı şu adresle açar:

```
https://<uygulama>/#sso_access_token=<jwt>&sso_refresh_token=<token>&sso_provider=happyprojects
```

Uygulama `setSession({ access_token, refresh_token })` yapıp adres çubuğundaki hash'i temizler.
Aynı Supabase projesi kullanıldığı için ek API gerekmez. Örnek uygulama: ZapChat
(`src/hooks/useAuth.tsx` → `readSsoParams()`).

## Tek hesap — hesaplar her uygulamada birlikte açılır

`supabase/migrations/0002_tek_hesap.sql` şunları garanti eder:

| Olay | Sonuç |
|---|---|
| Yönetici hub'da hesap açar | ZapChat profili + tüm açık uygulamalara erişim **otomatik** oluşur |
| Bir uygulamada hesap açılır (kayıt) | Hub'da profil olarak düşer; yönetici panelinde görünür |
| Hub'da hesap **kapatılır** | Supabase Auth'ta banlanır → hiçbir uygulamaya giremez, açık oturumları düşer |
| Hub'da hesap **açılır** | Ban kalkar, tüm açık uygulamalara erişim verilir |
| Hub'da hesap **silinir** | Uygulama profilleri de silinir |

Aynı Supabase projesi (`szhpjbuuiltkqhhgmphm`) kullanıldığı için **tek şifre her yerde geçerli**.
