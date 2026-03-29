# Dokumentasi Backend PKL — vocational-service

**Versi:** 1.0.0
**Tanggal:** 2026-03-29
**Service:** `vocational-service` | Port: `3007`
**Base URL (lokal):** `http://localhost:3007`

---

## Ringkasan Perubahan File

### File yang Diedit

| File | Perubahan |
|---|---|
| `package.json` | Menambahkan dependency `"multer": "^1.4.5-lts.2"` |
| `init.sql` | Menambahkan 5 tabel PKL di bagian bawah (skema Pramuka tidak diubah) |
| `src/index.js` | Menambahkan 2 baris: import `pklRoutes` dan mount di `/api/pkl` |

### File yang Dibuat Baru

| File | Keterangan |
|---|---|
| `src/middleware/upload.js` | Middleware Multer dengan auto-create folder `uploads/` |
| `src/controllers/pklSubmissionController.js` | Controller: daftar PKL & validasi pengajuan |
| `src/controllers/pklMonitoringController.js` | Controller: tambah & ambil laporan monitoring |
| `src/controllers/pklPenilaianController.js` | Controller: statistik & UPSERT nilai PKL |
| `src/routes/pklRoutes.js` | Router: memetakan semua endpoint PKL ke controller |

### File yang Tidak Disentuh (Pramuka)

```
src/controllers/kelasPramukaController.js   ← utuh
src/controllers/absensiPramukaController.js ← utuh
src/controllers/laporanPramukaController.js ← utuh
src/routes/vocationalRoutes.js              ← utuh
```

---

## Arsitektur File PKL

```
backend/vocational-service/
├── src/
│   ├── middleware/
│   │   └── upload.js                      ← Multer diskStorage + auto-mkdir
│   ├── controllers/
│   │   ├── pklSubmissionController.js     ← getAllPKL, validateAndApprovePKL
│   │   ├── pklMonitoringController.js     ← createMonitoring, getMonitoringBySubmission
│   │   └── pklPenilaianController.js      ← getPenilaianStats, upsertPenilaian
│   └── routes/
│       └── pklRoutes.js                   ← semua route /api/pkl/*
└── uploads/                               ← folder file laporan (auto-created)
```

---

## Tabel Endpoint API PKL

Semua endpoint di bawah memerlukan **header `Authorization: Bearer <TOKEN>`**.

| Method | Path | Controller | Fungsi |
|---|---|---|---|
| `GET` | `/health` | — | Health check service (tanpa auth) |
| `GET` | `/api/pkl/submissions` | `pklSubmissionController.getAllPKL` | Daftar semua pengajuan PKL. Opsional: `?nama=<string>` untuk filter nama siswa |
| `PUT` | `/api/pkl/submissions/:id/validate` | `pklSubmissionController.validateAndApprovePKL` | Validasi pengajuan PKL. Jika `status_validasi=validated` maka `status_persetujuan` otomatis `approved` |
| `POST` | `/api/pkl/monitoring` | `pklMonitoringController.createMonitoring` | Tambah laporan monitoring. Mendukung upload file (field: `dokumen`) |
| `GET` | `/api/pkl/monitoring/:submission_id` | `pklMonitoringController.getMonitoringBySubmission` | Ambil semua monitoring milik satu submission PKL |
| `GET` | `/api/pkl/penilaian/stats` | `pklPenilaianController.getPenilaianStats` | Statistik dashboard: total siswa, sudah/belum dinilai, rata-rata nilai |
| `POST` | `/api/pkl/penilaian/upsert` | `pklPenilaianController.upsertPenilaian` | Input atau update nilai PKL (UPSERT). Nilai akhir & grade dihitung otomatis |

### Logika Bisnis Penting

- **Grade otomatis** pada `upsertPenilaian`: nilai ≥ 85 → A, ≥ 75 → B, ≥ 65 → C, ≥ 50 → D, < 50 → E
- **Nilai akhir** = rata-rata dari `(disiplin + teknis + komunikasi + laporan + presentasi) / 5`
- **UPSERT**: jika `submission_id` sudah punya nilai, maka di-UPDATE; jika belum, di-INSERT

---

## Panduan Testing Backend

### 1. Rebuild Container Setelah Perubahan

```bash
# Rebuild image vocational-service (install multer baru)
docker-compose up --build -d vocational-service

# Cek status container
docker ps | grep vocational

# Pantau log startup
docker logs vocational-service --tail 40 -f
```

**Catatan:** Karena `multer` baru ditambahkan ke `package.json`, wajib rebuild agar `npm install` dijalankan ulang di dalam container.

---

### 2. SQL Seed Data (Jalankan di dalam Container)

Masuk ke PostgreSQL vocational-service:

```bash
docker exec -it vocational-service bash
psql -U vocational_user -d vocational_db
```

Jalankan seed data berikut secara berurutan:

```sql
-- Seed: Kelas
INSERT INTO kelas (nama_kelas, tingkat) VALUES
  ('XII RPL 1', 'XII'),
  ('XII TKJ 1', 'XII'),
  ('XI RPL 1', 'XI')
ON CONFLICT DO NOTHING;

-- Seed: Siswa (3 siswa contoh)
INSERT INTO siswa (nisn, nama_lengkap, kelas_id) VALUES
  ('0012345678', 'Budi Santoso',    1),
  ('0012345679', 'Siti Rahayu',     1),
  ('0012345680', 'Ahmad Fauzi',     2)
ON CONFLICT (nisn) DO NOTHING;

-- Seed: PKL Submissions
INSERT INTO pkl_submissions (siswa_id, nama_perusahaan, alamat, status_validasi, status_persetujuan) VALUES
  (1, 'PT. Teknologi Nusantara', 'Jl. Gatot Subroto No. 10, Medan', 'pending', 'pending'),
  (2, 'CV. Maju Bersama',        'Jl. Sudirman No. 5, Medan',        'validated', 'approved'),
  (3, 'PT. Digital Kreatif',     'Jl. Ahmad Yani No. 20, Medan',     'pending', 'pending');

-- Verifikasi
SELECT ps.id, s.nama_lengkap, ps.nama_perusahaan, ps.status_validasi
FROM pkl_submissions ps
JOIN siswa s ON ps.siswa_id = s.id;
```

---

### 3. Panduan Request cURL / Postman

> Ganti `<TOKEN>` dengan JWT Bearer token yang valid dari Keycloak.
> Base URL: `http://localhost:3007`

#### Health Check (tanpa token)
```bash
curl http://localhost:3007/health
```
**Response:**
```json
{ "status": "OK", "service": "vocational-service", "timestamp": "..." }
```

---

#### GET — Daftar Semua PKL
```bash
curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:3007/api/pkl/submissions
```

**Filter nama siswa:**
```bash
curl -H "Authorization: Bearer <TOKEN>" \
     "http://localhost:3007/api/pkl/submissions?nama=budi"
```

---

#### PUT — Validasi Pengajuan PKL
```bash
curl -X PUT \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"status_validasi": "validated", "keterangan_layak": "Perusahaan memenuhi syarat"}' \
     http://localhost:3007/api/pkl/submissions/1/validate
```

---

#### POST — Tambah Monitoring (tanpa file)
```bash
curl -X POST \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "submission_id": 1,
       "tanggal_kunjungan": "2026-04-01",
       "catatan_monitoring": "Siswa aktif dan disiplin",
       "progres_siswa": "Minggu ke-2: sudah menyelesaikan modul dasar"
     }' \
     http://localhost:3007/api/pkl/monitoring
```

**Dengan upload file (multipart/form-data):**
```bash
curl -X POST \
     -H "Authorization: Bearer <TOKEN>" \
     -F "submission_id=1" \
     -F "tanggal_kunjungan=2026-04-01" \
     -F "catatan_monitoring=Siswa aktif" \
     -F "progres_siswa=Minggu ke-2" \
     -F "dokumen=@/path/to/laporan.pdf" \
     http://localhost:3007/api/pkl/monitoring
```

---

#### GET — Monitoring per Submission
```bash
curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:3007/api/pkl/monitoring/1
```

---

#### GET — Statistik Penilaian (Dashboard)
```bash
curl -H "Authorization: Bearer <TOKEN>" \
     http://localhost:3007/api/pkl/penilaian/stats
```
**Response:**
```json
{
  "success": true,
  "data": {
    "total_siswa": "3",
    "nilai_sudah_diisi": "0",
    "nilai_belum_diisi": "3",
    "rata_rata_nilai": "0.00"
  }
}
```

---

#### POST — Input / Update Nilai PKL (UPSERT)
```bash
curl -X POST \
     -H "Authorization: Bearer <TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{
       "submission_id": 2,
       "disiplin": 88,
       "teknis": 82,
       "komunikasi": 79,
       "laporan": 85,
       "presentasi": 90,
       "catatan_guru": "Siswa menunjukkan progres yang sangat baik",
       "status_penilaian": "Simpan"
     }' \
     http://localhost:3007/api/pkl/penilaian/upsert
```
**Response (nilai_akhir = rata-rata, grade otomatis):**
```json
{
  "success": true,
  "data": {
    "submission_id": 2,
    "nilai_akhir": "84.80",
    "grade": "B",
    "status_penilaian": "Simpan"
  }
}
```

---

### 4. Postman Collection Setup

1. Buat **Environment** baru:
   - `base_url` = `http://localhost:3007`
   - `token` = *(paste JWT dari Keycloak)*

2. Set header global di Collection:
   - Key: `Authorization`
   - Value: `Bearer {{token}}`

3. Import endpoint sesuai tabel di atas.

---

## Catatan Keamanan

- Semua endpoint `/api/pkl/*` dilindungi `verifyToken` (JWT Keycloak RS256)
- File upload disimpan lokal di `backend/vocational-service/uploads/` — pertimbangkan migrasi ke object storage (S3/MinIO) untuk production
- Folder `uploads/` dibuat otomatis saat service pertama kali start
