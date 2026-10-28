# ZapMesaj 💬

WhatsApp benzeri, gerçek zamanlı mesajlaşma uygulaması. **Durum (story) özelliği yok** — sadece sohbet.

## Özellikler

- 🔐 E-posta/şifre ile hesap oluşturma ve giriş (Supabase Auth)
- 💬 Birebir sohbetler + 👥 grup sohbetleri (yönetici, üye ekle/çıkar, gruptan ayrıl)
- 📷 Fotoğraf, 🎬 video, 🎤 ses kaydı ve 📎 dosya gönderimi (Supabase Storage, 50 MB'a kadar)
- ⚡ Gerçek zamanlı mesajlar, "yazıyor..." göstergesi, çevrimiçi/son görülme
- ✅✓✓ Okundu (mavi tik) bilgisi
- ↩️ Yanıtla, ✏️ düzenle, 🗑️ sil, emoji tepkileri, emoji klavyesi
- 🔍 Sohbet ve kişi arama, sohbet içi arama
- 🌙 Açık/koyu tema, mobil uyumlu tasarım
- 🖼️ Fotoğraf/video önizleme (lightbox), ses oynatıcı

## Teknolojiler

| Katman | Teknoloji |
| --- | --- |
| Arayüz | React + TypeScript + Vite |
| Kimlik & Veritabanı | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| Dağıtım | Vercel (statik SPA) |
| Kod | GitHub |

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase URL + anon key gir
npm run dev
```

## Ortam değişkenleri

```
VITE_SUPABASE_URL=https://<proje>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## Veritabanı

Şema `supabase/migrations/0001_init.sql` dosyasındadır: `profiles`, `chats`, `chat_members`,
`messages`, `reactions` tabloları; RLS politikaları; `start_direct_chat`, `create_group`,
`add_group_members`, `remove_member`, `leave_chat`, `mark_chat_read` fonksiyonları ve
`media` / `avatars` storage bucket'ları.

## Canlı

- Uygulama: https://zapmesaj.vercel.app
- Supabase projesi: `zapmesaj` (`szhpjbuuiltkqhhgmphm`)
- Kaynak kod yedeği + SQL şeması: Google Drive → **ZapMesaj — Medya Deposu / exports**

## Demo hesapları

| E-posta | Şifre |
| --- | --- |
| demo@zapmesaj.app | ZapMesaj123 |
| ayse@zapmesaj.app | ZapMesaj123 |
| mehmet@zapmesaj.app | ZapMesaj123 |

Giriş ekranındaki **Demo hesabıyla gir** düğmesiyle tek tıkla deneyebilirsin.
Ayrıca kendi hesabını "Kayıt ol" sekmesinden saniyeler içinde açabilirsin.

## Özellikler

- Metin, fotoğraf, video, ses kaydı ve dosya paylaşımı · gruplar · tepkiler · yanıtlama
- **Durum (story)**: 24 saatlik metin/fotoğraf/video durumları, görüntüleme sayacı
- **Sesli ve görüntülü arama**: WebRTC (Supabase Realtime broadcast ile sinyalleşme), arama kaydı `call_logs`
- **Yönetim paneli**: kullanıcı listesi, yönetici yetkisi verme/alma, yasaklama (ban), duyuru yayınlama, istatistikler

## Notlar

- Durum (story) 24 saat sonra otomatik olarak kaybolur (RLS `expires_at` filtresi).
- Yöneticilik `profiles.is_admin` ile verilir; ilk yöneticiler `akif` ve `admin`.
- Aramalar P2P WebRTC ile kurulur; yalnızca STUN sunucuları kullanılır (TURN yok).
- Medya dosyaları Supabase Storage (`media`, `avatars`) üzerinde tutulur; Drive klasörü
  yedek/arşiv amacıyla kullanılır.
