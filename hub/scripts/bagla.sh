#!/usr/bin/env bash
# Tüm depoları hub'a alt depo (submodule) olarak bağlar.
# Kullanım: ./scripts/bagla.sh
set -uo pipefail
cd "$(dirname "$0")/.."          # hub kökü
REPO_KOK="$(git rev-parse --show-toplevel)"
OWNER="${OWNER:-31madaracollet}"

# klasor_adi:github_repo
BAGLAR=(
  "Kacakwhatsapp:Kacakwhatsapp"
  "Sucuk-Agent:Sucuk-Agent"
  "haber-hatti:haber-hatti"
  "IsikHolding:IsikHolding"
  "AliKeremYayinlari:AliKeremYayinlari"
  "TurkAI-app:TurkAI-app"
  "TurkAIV2:TurkAIV2"
)

# git submodule add yolu çalışma dizinine göre: hep "apps/X"
# .gitmodules anahtarı ise depo köküne göre: "hub/apps/X"
ON_EK="$(realpath --relative-to="$REPO_KOK" "$PWD")"
[ "$ON_EK" = "." ] && ON_EK=""
YOL_ONEK="${ON_EK:+$ON_EK/}apps"   # .gitmodules anahtarı için

mkdir -p apps
BASARILI=(); BASARISIZ=()

for bag in "${BAGLAR[@]}"; do
  yol="${bag%%:*}"
  repo="${bag##*:}"

  if git config -f "$REPO_KOK/.gitmodules" --get "submodule.$YOL_ONEK/$yol.path" >/dev/null 2>&1; then
    echo "• apps/$yol zaten bağlı"
    BASARILI+=("$yol")
    continue
  fi

  echo "• apps/$yol bağlanıyor → $OWNER/$repo"
  if git submodule add -b main "https://github.com/$OWNER/$repo.git" "apps/$yol" >/dev/null 2>&1; then
    git config -f "$REPO_KOK/.gitmodules" "submodule.$YOL_ONEK/$yol.branch" main || true
    BASARILI+=("$yol")
  else
    rm -rf "apps/$yol"
    BASARISIZ+=("$yol")
    echo "  ⚠️  $yol bağlanamadı"
  fi
done

git add "$REPO_KOK/.gitmodules" apps 2>/dev/null || true

echo
echo "✅ Bağlı (${#BASARILI[@]}): ${BASARILI[*]:-—}"
if [ "${#BASARISIZ[@]}" -gt 0 ]; then
  echo "⚠️  Bağlanamayan (${#BASARISIZ[@]}): ${BASARISIZ[*]}"
  echo "   Sebep: bu oturumun git erişimi bu depolara açık değil (ya da depo boş)."
  echo "   Yerelde çalıştır:"
  for y in "${BASARISIZ[@]}"; do
    echo "     git submodule add -b main https://github.com/$OWNER/$y.git apps/$y"
  done
fi
