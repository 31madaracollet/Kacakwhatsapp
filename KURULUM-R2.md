# Cloudflare R2 kurulumu (ZapMesaj medya deposu)

Amaç: fotoğraf/video/ses dosyaları Supabase'in 1 GB'lık deposu yerine
Cloudflare R2'de dursun. R2'de **10 GB bedava**, dışarı trafik **ücretsiz**,
sonrası kullandığın kadar (yaklaşık **$0.015/GB/ay**).

Kod hazır: `src/lib/storage.ts` + `supabase/functions/r2` (köprü fonksiyonu).
Anahtarlar **tarayıcıya hiç inmez**; sunucuda (Supabase secret) durur.

---

## 1) Cloudflare'de R2 kovanı (bucket) aç

1. https://dash.cloudflare.com → sol menü **R2** (yoksa "R2 Object Storage" → Enable).
2. **Create bucket** → isim: `zapmesaj` → Location: **Automatic** → Create.
3. Kovanın içinde **Settings** sekmesi:
   - **Public access** → **R2.dev subdomain** → **Allow**.
   - Karşına `https://pub-xxxxxxxxxxxxxxxx.r2.dev` gibi bir adres çıkar.
     **Bunu not al** → `R2_PUBLIC_URL` olacak.

## 2) CORS ayarı (tarayıcıdan yükleme için şart)

Aynı **Settings** sayfasında **CORS Policy** → **Add CORS policy** → şunu yapıştır:

```json
[
  {
    "AllowedOrigins": ["https://zapmesaj.vercel.app", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## 3) API anahtarı oluştur (3 değer buradan çıkar)

R2 ana sayfası → sağ üst **Manage R2 API Tokens** → **Create API token**:

- Token name: `zapmesaj`
- Permissions: **Object Read & Write**
- Specify bucket: **Only specific bucket → zapmesaj**
- TTL: süresiz (No expiry)

**Create** dedikten sonra **bir kez** gösterilen değerler:

| Cloudflare'de gördüğün | Supabase'e girilecek isim |
| --- | --- |
| Access Key ID | `R2_ACCESS_KEY_ID` |
| Secret Access Key | `R2_SECRET_ACCESS_KEY` |
| (kovanın Overview sayfasındaki) Account ID | `R2_ACCOUNT_ID` |

> Account ID: Cloudflare panelinde sağ kolonda "Account ID" olarak durur
> (R2 → Overview sayfasında da görünür).

## 4) Supabase'e 5 değeri gir

Supabase → proje `zapmesaj` → **Edge Functions** → **Secrets** (veya Project Settings → Edge Functions → Secrets)
→ **Add new secret** ile tek tek ekle:

| İsim | Değer |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key |
| `R2_BUCKET` | `zapmesaj` |
| `R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` (sondaki `/` olmadan) |

## 5) Vercel'e tek değişken

Vercel → proje `zapmesaj` → Settings → Environment Variables:

| İsim | Değer |
| --- | --- |
| `VITE_R2_PUBLIC_URL` | `https://pub-xxxx.r2.dev` |

> Bu adres zaten herkese açık olduğu için tarayıcıda görünmesi sorun değil.
> Gizli anahtarlar **yalnızca** Supabase secrets'ta durur.

Sonra yeni bir production deploy gerekiyor (Vite değişkenleri derleme anında gömülür).

## 6) Kontrol

Edge Function'e `ping` isteği atıldığında `{ "ok": true, "bucket": "zapmesaj", ... }` döner.
Uygulamada bir fotoğraf gönder; yüklenen adres `https://pub-xxxx.r2.dev/...` ile başlıyorsa geçiş tamam.

---

## Nasıl çalışıyor?

```
tarayıcı ──(JWT)──► Supabase Edge Function "r2" ──► 15 dk'lık imzalı PUT adresi
   │                                                        │
   └──────────── dosyayı doğrudan R2'ye yükler ◄────────────┘
                          │
                https://pub-xxxx.r2.dev/chat/...  (kalıcı, hızlı)
```

- Yükleme tarayıcıdan doğrudan R2'ye gider (Supabase'ten geçmez) → hızlı.
- Silme de köprü fonksiyonu üzerinden yapılır; mesaj/durum silinince dosya R2'den kalkar.
- Anahtarlar tanımlı değilse uygulama otomatik olarak **eski Supabase deposunu** kullanmaya devam eder.

## Maliyet

| | Bedava | Sonrası |
| --- | --- | --- |
| Depolama | 10 GB | $0.015 / GB / ay |
| Dışarı trafik (video izleme) | sınırsız | **$0** |
| Yazma işlemi | 1M/ay | $4.50 / milyon |

Örnek: 30 GB medya → 20 GB ücretli → **~$0.30/ay** (yaklaşık 10–12 TL).
