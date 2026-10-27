# 🚨 Sızan API anahtarları — temizlik planı

`.env.example` dosyası **placeholder değil, gerçek anahtarlar** içeriyordu.
Depo bir süre **public** kaldı (Sucuk-Agent bağlanabilmesi için), bu yüzden 9 anahtar
açığa çıktı. Groq bunlardan birini tespit edip iptal ediyor.

## Açığa çıkan anahtarlar

| Değişken | Maskeli | Durum |
|---|---|---|
| `GROQ_API_KEY_1` | `gsk_3J…uuql` | ⛔ **Groq iptal ediyor** (30 Eki 2026) |
| `GROQ_API_KEY_2` | `gsk_3j…6xWK` | ⚠️ aynı depoda, aynı süre public → iptal et |
| `GROQ_API_KEY_3` | `gsk_c6…uU7d` | ⚠️ aynı depoda → iptal et |
| `OPENAI_API_KEY_1` | `sk-pro…sb4A` | ⚠️ aynı depoda → iptal et |
| `OPENAI_API_KEY_2` | `sk-pro…7coA` | ⚠️ aynı depoda → iptal et |
| `OPENAI_API_KEY_3` | `sk-pro…_y4A` | ⚠️ aynı depoda → iptal et |
| `GOOGLE_API_KEY_1` | `AQ.Ab8…5_9w` | ⚠️ aynı depoda → iptal et |
| `GOOGLE_API_KEY_2` | `AQ.Ab8…7iNw` | ⚠️ aynı depoda → iptal et |
| `GOOGLE_API_KEY_3` | `AQ.Ab8…qawA` | ⚠️ aynı depoda → iptal et |

**Kural:** Bir anahtar public repoda durduysa artık yanmış sayılır. Dosyayı silmek yetmez —
git geçmişinde kalır ve herkes görebilir. **Yeni anahtar üret, eskisini iptal et.**

## Sıra (önem sırasıyla)

1. **Yeni anahtarlar üret** — Groq, OpenAI (platform.openai.com/api-keys), Google AI Studio
2. **Vercel'e gir** → proje `sucuk-agent` → Settings → Environment Variables
   → eski değerleri **yeni** değerlerle değiştir (production + preview + development)
3. **Redeploy** et (env değişikliği yeni deployment ister)
4. Eski anahtarları panellerden **iptal/sil**
5. **Git geçmişini temizle** (aşağıdaki betik) — depo tekrar public olursa sızmasın
6. Depoyu private tut (şu an private ✅)

## Git geçmişini temizleme

Depoya **yazma izni** olan bir ortamda:

```bash
# Sucuk-Agent deposunda
cd Sucuk-Agent
./scripts/gizli-temizle.sh          # dosyayı placeholder ile değiştirir + geçmişi yeniden yazar
git push --force-with-lease origin main
```

`force-push` sonrası:
- Açık PR'lar varsa kapatılmalı (geçmişleri eski commit'lere bağlı)
- GitHub cache/çatal temizliği: GitHub Support'a "cached views / forks" talebi açılabilir
- Vercel'deki eski deployment'lar hâlâ eski commit'i taşır; gerekirse silinmeli

## Not bu depo için (HappyProjects hub)

`hub/.env.example` içinde Supabase **anon** anahtarı var — bu tasarım gereği public olabilir
(RLS ile korunuyor). Ama `service_role` anahtarı **asla** repoya girmemeli; Edge Function onu
Supabase'in kendi env'inden okur.
