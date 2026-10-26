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

Vercel üzerinde yayında: https://zapmesaj.vercel.app
