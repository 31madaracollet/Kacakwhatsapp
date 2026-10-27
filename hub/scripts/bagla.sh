#!/usr/bin/env bash
# Eksik alt depolari baglar (Kacakwhatsapp = ZapChat, sucuk-agent).
set -euo pipefail
cd "$(dirname "$0")/.."
OWNER="${OWNER:-31madaracollet}"
REPOS=(Kacakwhatsapp sucuk-agent)
for repo in "${REPOS[@]}"; do
  if [ -d "apps/$repo/.git" ] || git config -f .gitmodules --get "submodule.apps/$repo.path" >/dev/null 2>&1; then
    echo "• apps/$repo zaten bagli"
    continue
  fi
  echo "• apps/$repo baglaniyor..."
  git submodule add -b main "https://github.com/$OWNER/$repo.git" "apps/$repo" \
    || echo "  ⚠️  $repo eklenemedi (depo erişimi yok olabilir)"
  git config -f .gitmodules "submodule.apps/$repo.branch" main || true
done
git add .gitmodules apps 2>/dev/null || true
echo "✅ Bitti"
