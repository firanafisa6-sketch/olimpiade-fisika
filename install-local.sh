#!/usr/bin/env bash
set -e

echo "=== Olimpiade Fisika V.1.0 - Instalasi Lokal ==="

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "File .env dibuat dari .env.example"
  echo "Silakan isi DATABASE_URL dan AUTH_SECRET terlebih dahulu: nano .env"
  exit 0
fi

npm install
npm run setup:db

echo ""
echo "Instalasi selesai. Jalankan aplikasi dengan:"
echo "npm run dev"
echo ""
echo "Admin Panel : http://localhost:3000"
echo "Peserta     : http://localhost:3001
Pengawas    : http://localhost:3002"
