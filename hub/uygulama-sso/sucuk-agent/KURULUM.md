# Sucuk-Agent — HappyProjects hesabıyla giriş (SSO köprüsü)

Sucuk-Agent kendi imzalı çerez oturumunu kullanıyor (`SESSION_SECRET` ile HMAC).
Bu iki dosya, HappyProjects oturumunu Sucuk-Agent oturumuna çeviren köprüyü ekler.

## Dosyalar

| Buradaki dosya | Sucuk-Agent'ta yeri |
|---|---|
| `route.ts` | `src/app/api/auth/sso/route.ts` |
| `sso-page.tsx` | `src/app/sso/page.tsx` |

## Vercel ortam değişkenleri (proje: sucuk-agent)

```
HUB_SUPABASE_URL=https://szhpjbuuiltkqhhgmphm.supabase.co
HUB_SUPABASE_ANON_KEY=<happyprojects anon key>
HUB_ADMIN_EMAILS=admin@happyprojects.app,akif97736@gmail.com
```

## Hub tarafı

Panodaki Sucuk Agent kartının adresini şu şekilde bırakmak yeterli:

```
https://sucuk-agent.vercel.app/sso
```

Hub, adrese `#sso_access_token=…&sso_refresh_token=…` ekleyerek açar; `/sso` sayfası
token'ı `/api/auth/sso`'ya gönderir, doğrulanır ve `sucuk_session` çerezi yazılır.

## Neden şu an uygulanmadı

`31madaracollet/Sucuk-Agent` bu oturumda **salt okunur** (public yapıldı, yazma izni yok):
`git push` → `Permission to 31madaracollet/Sucuk-Agent.git denied`.

Yazma izni açıldığında ya da depo yerelde açılıp bu iki dosya kopyalandığında çalışır.
