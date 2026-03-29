# Cetak Biru Pembangunan Fitur PKL — vocational-service

**Dibuat:** 2026-03-29
**Role:** Senior Backend Architect
**Branch:** main (clean slate)
**Tujuan:** Membangun ulang `backend/vocational-service` dari boilerplate "todos" menjadi service PKL yang fungsional dengan PostgreSQL.

---

## Analisis Kondisi Aktual (READ-ONLY)

### Kondisi Saat Ini — Semua Masalah

| File | Kondisi | Masalah |
|---|---|---|
| `package.json` | ❌ Boilerplate | Nama masih "todos-service", **tidak ada `pg` dan `multer`** |
| `init.sql` | ❌ Salah skema | Berisi tabel Pramuka + tabel PKL primitif yang tidak sesuai |
| `src/index.js` | ❌ Crash | `app.use("/todos", todoRoutes)` — `todoRoutes` tidak pernah di-import |
| `src/controllers/vocationalController.js` | ❌ Salah total | Mengelola file JSON `todos.json`, sama sekali bukan PKL/PostgreSQL |
| `src/routes/vocationalRoutes.js` | ❌ Korup | Duplicate routes, referensi `controller` yang tidak ada |
| `src/config/db.js` | ✅ Benar | PostgreSQL Pool sudah dikonfigurasi dengan benar |
| `src/middleware/auth.js` | ✅ Benar | JWT Keycloak middleware sudah benar |
| `src/middleware/errorHandler.js` | ✅ Benar | Error handler sudah benar |
| `src/data/todos.json` | 🗑️ Hapus | File JSON sisa boilerplate, tidak diperlukan |

### Dependency yang Hilang
```json
// Saat ini ada (package.json):
"cors", "express", "helmet", "jsonwebtoken", "jwks-rsa", "morgan", "uuid"

// WAJIB ditambahkan:
"pg"      -- Driver PostgreSQL untuk Node.js
"multer"  -- Upload file (untuk laporan monitoring PKL)
```

---

## Blueprint Pembangunan

---

### LANGKAH 1 — Install Dependency yang Kurang

**File:** `backend/vocational-service/package.json`

Jalankan di dalam container atau setelah masuk ke direktori:
```bash
cd backend/vocational-service
npm install pg multer
```

Atau tambahkan manual ke `package.json`:
```json
{
  "name": "vocational-service",
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.2.1",
    "helmet": "^8.1.0",
    "jsonwebtoken": "^9.0.3",
    "jwks-rsa": "^4.0.1",
    "morgan": "^1.10.1",
    "pg": "^8.13.3",
    "multer": "^1.4.5-lts.2"
  }
}
```

> **Catatan:** Package `uuid` dan `fs` tidak lagi diperlukan setelah migrasi ke PostgreSQL.

---

### LANGKAH 2 — Rancangan `init.sql` (Skema Database PostgreSQL)

**File:** `backend/vocational-service/init.sql`

Desain skema yang wajib diterapkan (tanpa Pramuka, tanpa tabel lama):

```sql
-- ============================================================
-- TABEL REPLIKA: Disinkronkan dengan academic-service
-- Diperlukan agar query JOIN bisa dilakukan secara lokal
-- ============================================================

CREATE TABLE IF NOT EXISTS kelas (
    id          SERIAL PRIMARY KEY,
    nama_kelas  VARCHAR(50)  NOT NULL,
    tingkat     VARCHAR(10),
    wali_kelas_id UUID
);

CREATE TABLE IF NOT EXISTS siswa (
    id            SERIAL PRIMARY KEY,
    nisn          VARCHAR(20)  UNIQUE NOT NULL,
    nama_lengkap  VARCHAR(150) NOT NULL,
    kelas_id      INTEGER REFERENCES kelas(id) ON DELETE SET NULL
);

-- ============================================================
-- TABEL UTAMA PKL
-- ============================================================

-- Pengajuan / pendaftaran PKL oleh siswa
CREATE TABLE IF NOT EXISTS pkl_submissions (
    id                  SERIAL PRIMARY KEY,
    siswa_id            INTEGER NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    nama_perusahaan     VARCHAR(150),
    alamat              TEXT,
    status_validasi     VARCHAR(20)  DEFAULT 'pending',  -- pending | validated | rejected
    keterangan_layak    TEXT,
    status_persetujuan  VARCHAR(20)  DEFAULT 'pending',  -- pending | approved | rejected
    created_at          TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring kunjungan & progres siswa PKL
CREATE TABLE IF NOT EXISTS pkl_monitoring (
    id                  SERIAL PRIMARY KEY,
    submission_id       INTEGER NOT NULL REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    tanggal_kunjungan   DATE,
    catatan_monitoring  TEXT,
    progres_siswa       TEXT,
    file_laporan        TEXT,   -- Path file yang di-upload via multer
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Penilaian akhir PKL
CREATE TABLE IF NOT EXISTS pkl_penilaian (
    id                SERIAL PRIMARY KEY,
    submission_id     INTEGER NOT NULL UNIQUE REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    disiplin          NUMERIC(5,2) DEFAULT 0,
    teknis            NUMERIC(5,2) DEFAULT 0,
    komunikasi        NUMERIC(5,2) DEFAULT 0,
    laporan           NUMERIC(5,2) DEFAULT 0,
    presentasi        NUMERIC(5,2) DEFAULT 0,
    nilai_akhir       NUMERIC(5,2),
    grade             VARCHAR(2),   -- A / B / C / D / E
    catatan_guru      TEXT,
    status_penilaian  VARCHAR(20)  DEFAULT 'Draft',  -- Draft | Simpan
    created_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);
```

**Alasan desain:**
- `kelas` & `siswa` adalah replika lokal dari `academic-service` agar tidak ada cross-service DB call
- `pkl_submissions` → `pkl_monitoring` → `pkl_penilaian` membentuk chain yang logis
- `ON DELETE CASCADE` memastikan data bersih saat submission dihapus
- `UNIQUE` pada `submission_id` di `pkl_penilaian` memungkinkan pola UPSERT

---

### LANGKAH 3 — Pembuatan `src/middleware/upload.js`

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

**Catatan implementasi:**
- Folder `uploads/` harus dibuat di `backend/vocational-service/uploads/` (bisa dibuat manual atau via `mkdir -p` di `start.sh`)
- Tambahkan baris ini di `start.sh`: `mkdir -p /app/uploads`

---

### LANGKAH 4 — Penulisan `src/controllers/vocationalController.js`

**File:** `backend/vocational-service/src/controllers/vocationalController.js`
**Aksi:** Hapus semua kode todos, tulis ulang seluruhnya.

```javascript
const pool = require("../config/db");

// ----------------------------------------------------------------
// REKAPITULASI PKL — GET semua submissions (dengan filter nama)
// ----------------------------------------------------------------
exports.getAllPKL = async (req, res) => {
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
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------------------------------------------
// VALIDASI & PERSETUJUAN PKL
// Jika status_validasi = 'validated', otomatis status_persetujuan = 'approved'
// ----------------------------------------------------------------
exports.validateAndApprovePKL = async (req, res) => {
  const { id } = req.params;
  const { status_validasi, keterangan_layak } = req.body;
  try {
    const statusPersetujuan = status_validasi === "validated" ? "approved" : "pending";
    const result = await pool.query(
      `UPDATE pkl_submissions
       SET status_validasi = $1, keterangan_layak = $2, status_persetujuan = $3
       WHERE id = $4 RETURNING *`,
      [status_validasi, keterangan_layak, statusPersetujuan, id]
    );
    if (result.rowCount === 0)
      return res.status(404).json({ message: "Data PKL tidak ditemukan" });
    res.json({ success: true, message: "Validasi berhasil diperbarui", data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------------------------------------------
// MONITORING & PROGRES — Tambah laporan kunjungan
// ----------------------------------------------------------------
exports.createMonitoring = async (req, res) => {
  const { submission_id, catatan_monitoring, progres_siswa, tanggal_kunjungan } = req.body;
  const file_laporan = req.file ? req.file.path : null;
  try {
    const result = await pool.query(
      `INSERT INTO pkl_monitoring
         (submission_id, tanggal_kunjungan, catatan_monitoring, progres_siswa, file_laporan)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [submission_id, tanggal_kunjungan, catatan_monitoring, progres_siswa, file_laporan]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------------------------------------------
// STATISTIK PENILAIAN — Ringkasan angka untuk dashboard
// ----------------------------------------------------------------
exports.getPenilaianStats = async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_siswa,
        COUNT(CASE WHEN pp.status_penilaian = 'Simpan' THEN 1 END) as nilai_sudah_diisi,
        COUNT(CASE WHEN pp.status_penilaian IS NULL OR pp.status_penilaian = 'Draft' THEN 1 END) as nilai_belum_diisi,
        COALESCE(AVG(pp.nilai_akhir), 0)::NUMERIC(10,2) as rata_rata_nilai
      FROM pkl_submissions ps
      LEFT JOIN pkl_penilaian pp ON ps.id = pp.submission_id
    `);
    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ----------------------------------------------------------------
// INPUT / UPDATE NILAI PKL — UPSERT dengan kalkulasi otomatis
// ----------------------------------------------------------------
exports.upsertPenilaian = async (req, res) => {
  const { submission_id, disiplin, teknis, komunikasi, laporan, presentasi, catatan_guru, status_penilaian } = req.body;

  // Kalkulasi nilai akhir (rata-rata 5 komponen)
  const komponen = [disiplin, teknis, komunikasi, laporan, presentasi].map(Number);
  const nilai_akhir = (komponen.reduce((a, b) => a + b, 0) / komponen.length).toFixed(2);

  // Penentuan grade otomatis
  let grade = "E";
  if (nilai_akhir >= 85) grade = "A";
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
         disiplin = EXCLUDED.disiplin, teknis = EXCLUDED.teknis,
         komunikasi = EXCLUDED.komunikasi, laporan = EXCLUDED.laporan,
         presentasi = EXCLUDED.presentasi, nilai_akhir = EXCLUDED.nilai_akhir,
         grade = EXCLUDED.grade, catatan_guru = EXCLUDED.catatan_guru,
         status_penilaian = EXCLUDED.status_penilaian,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [submission_id, disiplin, teknis, komunikasi, laporan, presentasi, nilai_akhir, grade, catatan_guru, status_penilaian]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

---

### LANGKAH 5 — Penulisan `src/routes/vocationalRoutes.js`

**File:** `backend/vocational-service/src/routes/vocationalRoutes.js`
**Aksi:** Hapus semua route todos, tulis ulang.

```javascript
const express = require("express");
const router = express.Router();
const vocationalController = require("../controllers/vocationalController");
const verifyToken = require("../middleware/auth");
const upload = require("../middleware/upload");

// --- PKL Submissions ---
router.get("/pkl", verifyToken, vocationalController.getAllPKL);
router.put("/pkl/validate/:id", verifyToken, vocationalController.validateAndApprovePKL);

// --- Monitoring (dengan upload file laporan) ---
router.post("/pkl/monitoring", verifyToken, upload.single("dokumen"), vocationalController.createMonitoring);

// --- Penilaian PKL ---
router.get("/penilaian/stats", verifyToken, vocationalController.getPenilaianStats);
router.post("/penilaian/upsert", verifyToken, vocationalController.upsertPenilaian);

module.exports = router;
```

---

### LANGKAH 6 — Perbaikan `src/index.js`

**File:** `backend/vocational-service/src/index.js`
**Aksi:** Hapus referensi `todoRoutes`, mount `vocationalRoutes` dengan benar.

```javascript
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");
const vocationalRoutes = require("./routes/vocationalRoutes"); // ← TAMBAH INI

const app = express();
const PORT = process.env.PORT || 3007;

app.use(helmet());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", service: "vocational-service", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/api", vocationalRoutes); // ← GANTI dari /todos ke /api

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route '${req.originalUrl}' tidak ditemukan` });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Vocational Service berjalan di http://localhost:${PORT}`);
});
```

---

### LANGKAH 7 — Hapus File Sisa Boilerplate

File-file berikut harus **dihapus** karena merupakan sisa "todos-service":

```
backend/vocational-service/src/data/todos.json   ← HAPUS
```

---

## Urutan Eksekusi

```
1. Edit package.json       → tambahkan "pg" dan "multer", ganti nama ke "vocational-service"
2. Tulis ulang init.sql    → skema kelas, siswa, pkl_submissions, pkl_monitoring, pkl_penilaian
3. Buat upload.js          → middleware/upload.js (Multer disk storage)
4. Tulis ulang controller  → vocationalController.js (5 fungsi PKL)
5. Tulis ulang routes      → vocationalRoutes.js (5 endpoint PKL)
6. Perbaiki index.js       → mount vocationalRoutes, hapus todoRoutes
7. Hapus todos.json        → src/data/todos.json
8. Rebuild container       → docker-compose up --build -d vocational-service
```

---

## Endpoint API Setelah Selesai

| Method | Path | Fungsi |
|---|---|---|
| `GET` | `/health` | Health check |
| `GET` | `/api/pkl` | Daftar semua PKL (support `?nama=`) |
| `PUT` | `/api/pkl/validate/:id` | Validasi & setujui pengajuan PKL |
| `POST` | `/api/pkl/monitoring` | Tambah laporan monitoring (+ upload file) |
| `GET` | `/api/penilaian/stats` | Statistik penilaian untuk dashboard |
| `POST` | `/api/penilaian/upsert` | Input / update nilai PKL |

---

## Perintah Verifikasi Pasca-Implementasi

```bash
# 1. Rebuild dan jalankan ulang service
docker-compose up --build -d vocational-service

# 2. Cek status container
docker ps | grep vocational

# 3. Test health endpoint
curl http://localhost:3007/health

# 4. Cek log jika ada error
docker logs vocational-service --tail 30

# 5. Test endpoint PKL (perlu JWT token)
curl -H "Authorization: Bearer <TOKEN>" http://localhost:3007/api/pkl
```

---

*Cetak biru ini mencakup semua yang diperlukan untuk pembangunan ulang vocational-service secara penuh. Tidak ada fitur Pramuka yang dimasukkan.*
