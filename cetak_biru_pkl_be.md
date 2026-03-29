# Cetak Biru Backend PKL — vocational-service (Modular Architecture)

**Dibuat:** 2026-03-29
**Role:** Senior Backend Architect
**Fokus:** Fitur PKL saja — kode Pramuka tidak disentuh
**Prinsip:** Controller modular per domain (konsisten dengan standar tim)

---

## Kondisi Awal (Referensi Audit)

| Komponen | Status Saat Ini |
|---|---|
| `package.json` | `pg` ✅ ada, `multer` ❌ hilang |
| `init.sql` | Skema Pramuka ✅, tabel PKL ❌ tidak ada |
| `src/controllers/` | 3 controller Pramuka ada, 0 controller PKL |
| `src/routes/` | `vocationalRoutes.js` (Pramuka), 0 routes PKL |
| `src/middleware/upload.js` | ❌ tidak ada |
| `src/index.js` | Hanya mount `/api/pramuka`, tidak ada PKL |

---

## Peta File yang Akan Dibuat / Diubah

```
backend/vocational-service/
├── package.json                              ← EDIT: tambah multer
├── init.sql                                  ← EDIT: append tabel PKL di bagian bawah
├── src/
│   ├── index.js                              ← EDIT: mount pklRoutes
│   ├── middleware/
│   │   └── upload.js                         ← BUAT BARU
│   ├── controllers/
│   │   ├── kelasPramukaController.js         ← TIDAK DISENTUH
│   │   ├── absensiPramukaController.js       ← TIDAK DISENTUH
│   │   ├── laporanPramukaController.js       ← TIDAK DISENTUH
│   │   ├── pklSubmissionController.js        ← BUAT BARU
│   │   ├── pklMonitoringController.js        ← BUAT BARU
│   │   └── pklPenilaianController.js         ← BUAT BARU
│   └── routes/
│       ├── vocationalRoutes.js               ← TIDAK DISENTUH
│       └── pklRoutes.js                      ← BUAT BARU
```

---

## LANGKAH 1 — Tambah Dependency `multer`

**File:** `backend/vocational-service/package.json`

Tambahkan satu baris ke bagian `dependencies`:

```json
{
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.3",
    "jwks-rsa": "^4.0.1",
    "morgan": "^1.10.1",
    "pg": "^8.20.0",
    "multer": "^1.4.5-lts.2",
    "uuid": "^13.0.0"
  }
}
```

> `pg` sudah ada. Hanya `multer` yang perlu ditambahkan.

---

## LANGKAH 2 — Append Skema PKL ke `init.sql`

**File:** `backend/vocational-service/init.sql`

**PENTING:** Tambahkan HANYA di bagian BAWAH file. Jangan hapus atau ubah baris Pramuka yang sudah ada.

```sql
-- ============================================================
-- SKEMA PKL (Praktik Kerja Lapangan)
-- Ditambahkan di bawah skema Pramuka — jangan hapus yang atas
-- ============================================================

-- Replika kelas dari academic-service (untuk JOIN lokal)
CREATE TABLE IF NOT EXISTS kelas (
    id            SERIAL PRIMARY KEY,
    nama_kelas    VARCHAR(50)  NOT NULL,
    tingkat       VARCHAR(10),
    wali_kelas_id UUID
);

-- Replika siswa dari academic-service (untuk JOIN lokal)
CREATE TABLE IF NOT EXISTS siswa (
    id            SERIAL PRIMARY KEY,
    nisn          VARCHAR(20)  UNIQUE NOT NULL,
    nama_lengkap  VARCHAR(150) NOT NULL,
    kelas_id      INTEGER REFERENCES kelas(id) ON DELETE SET NULL
);

-- Pengajuan PKL oleh siswa
CREATE TABLE IF NOT EXISTS pkl_submissions (
    id                  SERIAL PRIMARY KEY,
    siswa_id            INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    nama_perusahaan     VARCHAR(150),
    alamat              TEXT,
    status_validasi     VARCHAR(20) DEFAULT 'pending',     -- pending | validated | rejected
    keterangan_layak    TEXT,
    status_persetujuan  VARCHAR(20) DEFAULT 'pending',     -- pending | approved | rejected
    created_at          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring kunjungan & progres siswa selama PKL
CREATE TABLE IF NOT EXISTS pkl_monitoring (
    id                  SERIAL PRIMARY KEY,
    submission_id       INTEGER NOT NULL REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    tanggal_kunjungan   DATE,
    catatan_monitoring  TEXT,
    progres_siswa       TEXT,
    file_laporan        TEXT,   -- path file yang di-upload via multer
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Penilaian akhir PKL per siswa
CREATE TABLE IF NOT EXISTS pkl_penilaian (
    id                SERIAL PRIMARY KEY,
    submission_id     INTEGER NOT NULL UNIQUE REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    disiplin          NUMERIC(5,2) DEFAULT 0,
    teknis            NUMERIC(5,2) DEFAULT 0,
    komunikasi        NUMERIC(5,2) DEFAULT 0,
    laporan           NUMERIC(5,2) DEFAULT 0,
    presentasi        NUMERIC(5,2) DEFAULT 0,
    nilai_akhir       NUMERIC(5,2),
    grade             VARCHAR(2),       -- A | B | C | D | E
    catatan_guru      TEXT,
    status_penilaian  VARCHAR(20) DEFAULT 'Draft',  -- Draft | Simpan
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## LANGKAH 3 — Buat `src/middleware/upload.js`

**File baru:** `backend/vocational-service/src/middleware/upload.js`

```javascript
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "../../uploads"));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

module.exports = multer({ storage });
```

> Pastikan folder `backend/vocational-service/uploads/` ada. Tambahkan `mkdir -p /app/uploads` ke `start.sh` jika belum ada.

---

## LANGKAH 4a — Buat `src/controllers/pklSubmissionController.js`

**File baru:** `backend/vocational-service/src/controllers/pklSubmissionController.js`

**Tanggung jawab:** Daftar PKL dan validasi/persetujuan pengajuan.

```javascript
const pool = require("../config/db");

/**
 * GET /api/pkl/submissions
 * Ambil semua pengajuan PKL, opsional filter nama siswa.
 * Query param: ?nama=<string>
 */
const getAllPKL = async (req, res, next) => {
  const { nama } = req.query;
  try {
    let query = `
      SELECT ps.*, s.nama_lengkap
      FROM pkl_submissions ps
      JOIN siswa s ON ps.siswa_id = s.id
    `;
    const params = [];
    if (nama) {
      query += ` WHERE s.nama_lengkap ILIKE $1`;
      params.push(`%${nama}%`);
    }
    query += ` ORDER BY ps.created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/pkl/submissions/:id/validate
 * Validasi pengajuan PKL.
 * Jika status_validasi = 'validated' → status_persetujuan otomatis = 'approved'.
 * Body: { status_validasi, keterangan_layak }
 */
const validateAndApprovePKL = async (req, res, next) => {
  const { id } = req.params;
  const { status_validasi, keterangan_layak } = req.body;
  try {
    const statusPersetujuan = status_validasi === "validated" ? "approved" : "pending";
    const result = await pool.query(
      `UPDATE pkl_submissions
       SET status_validasi = $1, keterangan_layak = $2, status_persetujuan = $3
       WHERE id = $4
       RETURNING *`,
      [status_validasi, keterangan_layak, statusPersetujuan, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data PKL tidak ditemukan" });
    }
    res.json({
      success: true,
      message: "Validasi berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAllPKL, validateAndApprovePKL };
```

---

## LANGKAH 4b — Buat `src/controllers/pklMonitoringController.js`

**File baru:** `backend/vocational-service/src/controllers/pklMonitoringController.js`

**Tanggung jawab:** Mencatat laporan kunjungan dan progres siswa PKL.

```javascript
const pool = require("../config/db");

/**
 * POST /api/pkl/monitoring
 * Tambah laporan monitoring kunjungan PKL.
 * Body: { submission_id, catatan_monitoring, progres_siswa, tanggal_kunjungan }
 * File (multipart): dokumen (opsional)
 */
const createMonitoring = async (req, res, next) => {
  const { submission_id, catatan_monitoring, progres_siswa, tanggal_kunjungan } = req.body;
  const file_laporan = req.file ? req.file.path : null;
  try {
    const result = await pool.query(
      `INSERT INTO pkl_monitoring
         (submission_id, tanggal_kunjungan, catatan_monitoring, progres_siswa, file_laporan)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [submission_id, tanggal_kunjungan, catatan_monitoring, progres_siswa, file_laporan]
    );
    res.status(201).json({
      success: true,
      message: "Laporan monitoring berhasil disimpan",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pkl/monitoring/:submission_id
 * Ambil semua monitoring untuk satu submission PKL.
 */
const getMonitoringBySubmission = async (req, res, next) => {
  const { submission_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM pkl_monitoring WHERE submission_id = $1 ORDER BY tanggal_kunjungan DESC`,
      [submission_id]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { createMonitoring, getMonitoringBySubmission };
```

---

## LANGKAH 4c — Buat `src/controllers/pklPenilaianController.js`

**File baru:** `backend/vocational-service/src/controllers/pklPenilaianController.js`

**Tanggung jawab:** Statistik dan input/update nilai PKL.

```javascript
const pool = require("../config/db");

/**
 * GET /api/pkl/penilaian/stats
 * Ringkasan statistik penilaian untuk dashboard.
 */
const getPenilaianStats = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                               AS total_siswa,
        COUNT(CASE WHEN pp.status_penilaian = 'Simpan' THEN 1 END)           AS nilai_sudah_diisi,
        COUNT(CASE WHEN pp.status_penilaian IS NULL
                     OR pp.status_penilaian = 'Draft'  THEN 1 END)           AS nilai_belum_diisi,
        COALESCE(AVG(pp.nilai_akhir), 0)::NUMERIC(10,2)                      AS rata_rata_nilai
      FROM pkl_submissions ps
      LEFT JOIN pkl_penilaian pp ON ps.id = pp.submission_id
    `);
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/pkl/penilaian/upsert
 * Input atau update nilai PKL (UPSERT berdasarkan submission_id).
 * Nilai akhir = rata-rata 5 komponen.
 * Grade ditentukan otomatis.
 * Body: { submission_id, disiplin, teknis, komunikasi, laporan, presentasi, catatan_guru, status_penilaian }
 */
const upsertPenilaian = async (req, res, next) => {
  const {
    submission_id, disiplin, teknis, komunikasi,
    laporan, presentasi, catatan_guru, status_penilaian,
  } = req.body;

  // Kalkulasi nilai akhir (rata-rata 5 komponen)
  const komponen = [disiplin, teknis, komunikasi, laporan, presentasi].map(Number);
  const nilai_akhir = (komponen.reduce((a, b) => a + b, 0) / komponen.length).toFixed(2);

  // Penentuan grade otomatis
  let grade = "E";
  if (nilai_akhir >= 85)      grade = "A";
  else if (nilai_akhir >= 75) grade = "B";
  else if (nilai_akhir >= 65) grade = "C";
  else if (nilai_akhir >= 50) grade = "D";

  try {
    const result = await pool.query(
      `INSERT INTO pkl_penilaian
         (submission_id, disiplin, teknis, komunikasi, laporan, presentasi,
          nilai_akhir, grade, catatan_guru, status_penilaian)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (submission_id) DO UPDATE SET
         disiplin         = EXCLUDED.disiplin,
         teknis           = EXCLUDED.teknis,
         komunikasi       = EXCLUDED.komunikasi,
         laporan          = EXCLUDED.laporan,
         presentasi       = EXCLUDED.presentasi,
         nilai_akhir      = EXCLUDED.nilai_akhir,
         grade            = EXCLUDED.grade,
         catatan_guru     = EXCLUDED.catatan_guru,
         status_penilaian = EXCLUDED.status_penilaian,
         updated_at       = CURRENT_TIMESTAMP
       RETURNING *`,
      [submission_id, disiplin, teknis, komunikasi, laporan,
       presentasi, nilai_akhir, grade, catatan_guru, status_penilaian]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPenilaianStats, upsertPenilaian };
```

---

## LANGKAH 5 — Buat `src/routes/pklRoutes.js`

**File baru:** `backend/vocational-service/src/routes/pklRoutes.js`

```javascript
const express = require("express");
const router = express.Router();

const verifyToken  = require("../middleware/auth");
const upload       = require("../middleware/upload");

const submissionCtrl = require("../controllers/pklSubmissionController");
const monitoringCtrl = require("../controllers/pklMonitoringController");
const penilaianCtrl  = require("../controllers/pklPenilaianController");

// Semua route PKL memerlukan autentikasi
router.use(verifyToken);

// --- Submissions ---
router.get("/submissions",              submissionCtrl.getAllPKL);
router.put("/submissions/:id/validate", submissionCtrl.validateAndApprovePKL);

// --- Monitoring ---
router.post("/monitoring",                       upload.single("dokumen"), monitoringCtrl.createMonitoring);
router.get("/monitoring/:submission_id",         monitoringCtrl.getMonitoringBySubmission);

// --- Penilaian ---
router.get("/penilaian/stats",   penilaianCtrl.getPenilaianStats);
router.post("/penilaian/upsert", penilaianCtrl.upsertPenilaian);

module.exports = router;
```

---

## LANGKAH 6 — Edit `src/index.js` (Mount PKL Routes)

**File:** `backend/vocational-service/src/index.js`

**Aksi:** Tambahkan 2 baris saja — import pklRoutes dan mount-nya. Jangan ubah baris lain.

Cari bagian ini di `index.js`:
```javascript
// Mount router dengan prefix
app.use("/api/pramuka", router);
```

Tambahkan tepat di bawahnya:
```javascript
// Mount PKL routes
const pklRoutes = require("./routes/pklRoutes");
app.use("/api/pkl", pklRoutes);
```

Hasil akhir bagian mount di `index.js`:
```javascript
// Mount router dengan prefix
app.use("/api/pramuka", router);

// Mount PKL routes
const pklRoutes = require("./routes/pklRoutes");
app.use("/api/pkl", pklRoutes);
```

---

## Ringkasan Endpoint PKL Setelah Implementasi

| Method | Path | Controller | Fungsi |
|---|---|---|---|
| `GET` | `/health` | — | Health check (sudah ada) |
| `GET` | `/api/pkl/submissions` | pklSubmissionController | Daftar semua PKL (filter `?nama=`) |
| `PUT` | `/api/pkl/submissions/:id/validate` | pklSubmissionController | Validasi & setujui pengajuan |
| `POST` | `/api/pkl/monitoring` | pklMonitoringController | Tambah laporan monitoring + upload |
| `GET` | `/api/pkl/monitoring/:submission_id` | pklMonitoringController | List monitoring per submission |
| `GET` | `/api/pkl/penilaian/stats` | pklPenilaianController | Statistik dashboard penilaian |
| `POST` | `/api/pkl/penilaian/upsert` | pklPenilaianController | Input / update nilai PKL |

---

## Urutan Eksekusi Implementasi

```
1. Edit package.json        → tambah "multer": "^1.4.5-lts.2"
2. Append init.sql          → tambah 5 tabel PKL di bagian bawah
3. Buat upload.js           → src/middleware/upload.js
4. Buat 3 controller PKL    → pklSubmissionController.js
                              pklMonitoringController.js
                              pklPenilaianController.js
5. Buat pklRoutes.js        → src/routes/pklRoutes.js
6. Edit index.js            → tambah 2 baris mount pklRoutes
7. Rebuild container        → docker-compose up --build -d vocational-service
```

---

## Verifikasi Pasca-Implementasi

```bash
# Rebuild
docker-compose up --build -d vocational-service

# Cek status
docker ps | grep vocational

# Health check
curl http://localhost:3007/health

# Log jika error
docker logs vocational-service --tail 30

# Test endpoint PKL (perlu JWT)
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3007/api/pkl/submissions
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3007/api/pkl/penilaian/stats
```

---

## Catatan Arsitektur

- **Tidak ada perubahan** pada `vocationalRoutes.js`, `kelasPramukaController.js`, `absensiPramukaController.js`, `laporanPramukaController.js`
- PKL dan Pramuka berjalan pada prefix route yang terpisah: `/api/pkl` vs `/api/pramuka`
- Setiap controller PKL memiliki satu tanggung jawab (Single Responsibility)
- `vocationalController.js` (boilerplate todos) dibiarkan dulu — bisa dihapus di sprint berikutnya setelah tidak ada referensinya

---

*Cetak biru ini 100% READ-ONLY — belum ada perubahan kode. Siap untuk dieksekusi langkah per langkah.*
