# AUDIT_PKL_SERVICE.md

Dokumentasi perbaikan `vocational-service` — PKL Feature Fixes

---

## 1. Penanganan Module `axios` yang Hilang

**Masalah:**
- Container crash saat startup dengan error `Cannot find module 'axios'`
- `axios` digunakan di salah satu controller namun tidak terdaftar di `package.json`

**Solusi:**
- Menjalankan `npm install axios` di dalam service
- Rebuild container agar `node_modules` di dalam image ikut diperbarui

---

## 2. Perbaikan Konfigurasi `DB_PASSWORD` Kosong

**Masalah:**
- `docker-compose.yml` menggunakan YAML anchor (`<<: *service-template`) yang memuat `DB_PASSWORD=password` secara global
- Namun `vocational-service` mendefinisikan blok `environment:` tersendiri yang **menimpa** (bukan menggabungkan) template global
- Akibatnya `DB_PASSWORD` di container menjadi kosong (`""`)
- Library `pg` Node.js menolak koneksi dengan error `SASL: client password must be a string` ketika password `null` atau `undefined`

**Solusi:**
- Di `docker-compose.yml`: menambahkan `DB_PASSWORD=` secara eksplisit (string kosong) di blok `environment:` vocational-service
- Di `src/config/db.js`: mengubah fallback dari `null` menjadi `undefined`:
  ```js
  password: process.env.DB_PASSWORD || undefined,
  ```
- Di `start.sh`: menggunakan `pg_reload_conf()` via `psql` untuk me-reload `pg_hba.conf` secara sinkron setelah mengubah metode autentikasi dari `scram-sha-256` ke `trust`

---

## 3. Pembersihan Routing Ganda di `pklRoutes.js`

**Masalah:**
- Route `POST /submissions` ditambahkan dengan path penuh `/api/vocational/pkl/submissions`
- Sementara route lain menggunakan path pendek relatif
- Terjadi inkonsistensi: sebagian route menggunakan prefix panjang, sebagian tidak

**Solusi:**
- Mengubah mount di `index.js` dari `app.use("/", pklRoutes)` menjadi `app.use("/api/pkl", pklRoutes)`
- Membersihkan semua path di `pklRoutes.js` menjadi path pendek dan seragam:
  - `GET  /submissions`
  - `POST /submissions`
  - `PUT  /submissions/:id/validate`
  - `POST /monitoring`
  - `GET  /monitoring/:submission_id`
  - `GET  /penilaian/stats`
  - `POST /penilaian/upsert`

---

## 4. Perbaikan Isu CRLF ke LF pada `start.sh`

**Masalah:**
- File `start.sh` ditulis di Windows dengan line ending `CRLF` (`\r\n`)
- Saat dijalankan di container Linux, bash interpreter membaca karakter `\r` sebagai bagian dari perintah
- Menyebabkan error seperti `$'\r': command not found`

**Solusi:**
- Menambahkan normalisasi CRLF di `Dockerfile`:
  ```dockerfile
  RUN sed -i 's/\r$//' start.sh
  ```
- Memastikan `start.sh` disimpan dengan encoding LF saat diedit ulang

---

## 5. Pemecahan Masalah Constraint Database saat POST

**Masalah:**
- Request `POST /submissions` gagal dengan error constraint violation dari PostgreSQL
- Kolom `siswa_id` memiliki foreign key constraint ke tabel `siswa`
- Tabel `siswa` tidak ada di `vocational_db` (berbeda service/database)

**Solusi:**
- Menyesuaikan skema `init.sql`: menghapus foreign key constraint ke tabel `siswa` yang berada di service lain
- Kolom `siswa_id` tetap ada sebagai referensi ID, namun tanpa FK constraint lintas-service
- Validasi eksistensi siswa dilakukan di layer aplikasi (via API call ke `student-service`) jika diperlukan

---

## Ringkasan Status Akhir

| Komponen | Status |
|---|---|
| `axios` module | Terinstall |
| Koneksi PostgreSQL | Berhasil (trust auth) |
| Routing PKL | Bersih, seragam di `/api/pkl/*` |
| `start.sh` line endings | LF |
| POST `/submissions` | Berfungsi tanpa constraint error |
| Docker image | Rebuild dari nol (clean build) |
