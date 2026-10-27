#!/usr/bin/env bash
# Hub'ı kendi deposuna (31madaracollet/HappyProjects) taşımak için hazırlık betiği.
# Kullanım: ./scripts/tasi.sh <hedef-klasor>
set -euo pipefail
cd "$(dirname "$0")/.."

HEDEF="${1:-}"
if [ -z "$HEDEF" ]; then
  echo "Kullanım: $0 /yol/happyprojects"
  exit 1
fi

mkdir -p "$HEDEF"
# dist/node_modules hariç her şeyi kopyala
tar -cf - --exclude=node_modules --exclude=dist . | (cd "$HEDEF" && tar -xf -)

cd "$HEDEF"
git init -b main >/dev/null 2>&1 || true
git add -A
git commit -m "HappyProjects hub: tek hesapla tüm uygulamalara giriş" >/dev/null 2>&1 || true
git remote add origin https://github.com/31madaracollet/HappyProjects.git 2>/dev/null || true
echo "✔ $HEDEF hazır. Göndermek için: cd $HEDEF && git push -u origin main"
