#!/usr/bin/env bash
# Tüm alt depoları bağlar (gerekiyorsa) ve son hallerine getirir.
set -uo pipefail
cd "$(dirname "$0")/.."

git submodule sync --recursive >/dev/null 2>&1 || true
git submodule update --init --recursive

echo "• Alt depolar güncelleniyor..."
git submodule foreach --recursive 'echo "  → $name"; git pull --ff-only || true'

echo
echo "Durum:"
git submodule status
