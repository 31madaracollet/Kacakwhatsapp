#!/usr/bin/env bash
# Sucuk-Agent deposunda sızan API anahtarlarını temizler.
# KULLANIM (depoya yazma izni olan ortamda):
#   git clone https://github.com/31madaracollet/Sucuk-Agent.git
#   cp gizli-temizle.sh Sucuk-Agent/scripts/ && cd Sucuk-Agent && ./scripts/gizli-temizle.sh
#   git push --force-with-lease origin main
set -euo pipefail

cd "$(dirname "$0")/.."
DOSYA=".env.example"
ESKI_DOSYA=".env.example.eski"

if [ ! -f "$DOSYA" ]; then echo "✖ $DOSYA bulunamadı"; exit 1; fi

TEMIZ=$(git status --porcelain)
if [ -n "$TEMIZ" ]; then
  echo "✖ Çalışma dizini temiz değil. Önce commit/stash et:"; echo "$TEMIZ"; exit 1
fi

echo "• Gerçek anahtarlar yedekleniyor ($ESKI_DOSYA — commit edilmeyecek)"
cp "$DOSYA" "$ESKI_DOSYA"
printf '\n# gecici\n%s\n' "$ESKI_DOSYA" >> .git/info/exclude

echo "• Dosya TÜM geçmişten siliniyor (checkout'lar ve tüm dallar)…"
if command -v git-filter-repo >/dev/null 2>&1; then
  git filter-repo --invert-paths --path "$DOSYA" --force
else
  FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch '$DOSYA'" \
    --prune-empty --tag-name-filter cat -- --all
  rm -rf .git/refs/original
  git reflog expire --expire=now --all
  git gc --prune=now >/dev/null 2>&1 || true
fi

echo "• Placeholder dosya yeniden oluşturuluyor…"
python3 - <<'PY'
p = ".env.example"
eski = ".env.example.eski"
satirlar = []
for s in open(eski, encoding="utf-8").read().splitlines():
    if "=" in s and not s.lstrip().startswith("#"):
        k = s.split("=", 1)[0]
        if any(x in k.upper() for x in ("KEY", "TOKEN", "SECRET", "PASSWORD")):
            s = f"{k}=DEGISTIR"
    satirlar.append(s)
open(p, "w", encoding="utf-8").write("\n".join(satirlar) + "\n")
PY

git add "$DOSYA"
git commit -q -m "Guvenlik: .env.example icindeki gercek API anahtarlari kaldirildi

Anahtarlar public repo uzerinden aciga cikti. Yeni anahtarlar yalnizca
Vercel ortam degiskenlerinde tutulacak; repoda placeholder kalir."

rm -f "$ESKI_DOSYA"

echo
echo "✅ Bitti. Geçmişte anahtar kalmadı mı kontrol:"
git log --all -p -- "$DOSYA" 2>/dev/null | grep -cE "sk-proj-|gsk_[A-Za-z0-9]{20,}|AQ\.Ab8RN6" || echo "0 eşleşme"
echo
echo "Şimdi:  git push --force-with-lease origin main"
echo "Sonra panelden ESKİ anahtarları iptal et."
