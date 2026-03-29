#!/bin/bash
# Menjalankan PostgreSQL di background
service postgresql start

# Tunggu sampai PostgreSQL benar-benar siap menerima koneksi
until sudo -u postgres pg_isready -q; do
  echo "Menunggu PostgreSQL siap..."
  sleep 1
done

# Izinkan koneksi lokal tanpa password (trust) agar Node.js bisa connect
PG_HBA=$(sudo -u postgres psql -At -c "SHOW hba_file;" 2>/dev/null)
if [ -n "$PG_HBA" ]; then
  sed -i 's/host\s\+all\s\+all\s\+127\.0\.0\.1\/32\s\+scram-sha-256/host all all 127.0.0.1\/32 trust/' "$PG_HBA"
  sed -i 's/host\s\+all\s\+all\s\+::1\/128\s\+scram-sha-256/host all all ::1\/128 trust/' "$PG_HBA"
  sudo -u postgres psql -c "SELECT pg_reload_conf();" || true
fi

# Membuat User dan Database sesuai variabel lingkungan
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;" || true

# Inisialisasi tabel dari file init.sql yang sudah disalin
sudo -u postgres psql -d $DB_NAME -f ./init.sql || true

# Menjalankan aplikasi Node.js
npm run dev