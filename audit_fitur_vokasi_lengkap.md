# Audit Fitur Vokasi — Laporan Lengkap

**Tanggal Audit:** 2026-03-29
**Role:** Senior Fullstack Auditor
**Scope:** `backend/vocational-service` + `frontend/src/pages/`
**Mode:** READ-ONLY — tidak ada perubahan kode

---

## Ringkasan Eksekutif

> **Klaim teman: "Fitur Pramuka sudah selesai."**
> **Verdict: SEBAGIAN BENAR, SEBAGIAN KRITIS ERROR.**

| Fitur | Status |
|---|---|
| Backend Pramuka (Controller) | ✅ Ada, tapi ada bug nama fungsi |
| Backend Pramuka (Database) | ⚠️ Ada tapi skema duplikat/konflik |
| Backend Pramuka (Routes) | ❌ File routes ada tapi TIDAK di-mount di index.js |
| Backend PKL (Controller) | ❌ Tidak ada sama sekali |
| Backend PKL (Database) | ❌ Tabel PKL modern tidak ada |
| Frontend Pramuka | ❌ Tidak ada halaman |
| Frontend PKL | ❌ Tidak ada halaman |

---

## 1. AUDIT DATABASE — `init.sql`

### Tabel yang Ada

**Tabel Pramuka (Skema Lengkap — UUID, baris 1–34):**
```sql
kelas_pramuka     (id_kelas_pramuka UUID PK, nama_kelas, tahun_ajaran, pembina, ...)
absensi_pramuka   (id_absensi_pramuka UUID PK, id_siswa, id_kelas_pramuka FK, tanggal, status CHECK, ...)
laporan_pramuka   (id_laporan UUID PK, id_kelas_pramuka FK, judul, file_url, tanggal_laporan, ...)
```
Plus 3 index untuk performa.

**Tabel Pramuka (Duplikat Primitif — SERIAL, baris 41–43):**
```sql
kelas_pramuka     (id SERIAL PK, nama_regu VARCHAR(100))        ← DUPLIKAT!
absensi_pramuka   (id SERIAL PK, siswa_id INTEGER, ...)         ← DUPLIKAT!
laporan_pramuka   (id SERIAL PK, deskripsi TEXT, file_url TEXT) ← DUPLIKAT!
```

**⚠️ Masalah Duplikat:** Karena `CREATE TABLE IF NOT EXISTS`, baris 41–43 akan dilewati saat tabel sudah ada. Artinya skema UUID yang menang. Ini tidak crash, tapi kode lama yang menggunakan kolom `id` (bukan `id_kelas_pramuka`) akan gagal saat query.

**Tabel PKL Lama (Primitif — baris 44–45):**
```sql
laporan_lokasi_pkl    (id SERIAL PK, siswa_id INTEGER, nama_perusahaan, alamat)
laporan_progres_pkl   (id SERIAL PK, siswa_id INTEGER, minggu_ke INTEGER, deskripsi)
```

### Tabel yang TIDAK ADA (KRITIS ❌)
```
pkl_submissions    ← TIDAK ADA
pkl_monitoring     ← TIDAK ADA
pkl_penilaian      ← TIDAK ADA
kelas              ← TIDAK ADA (replika dari academic-service)
siswa              ← TIDAK ADA (replika dari academic-service)
```

**Kesimpulan Database:**
- Pramuka: skema ada tapi ada duplikasi yang mengandung risiko
- PKL: tidak ada tabel yang relevan sama sekali

---

## 2. AUDIT CONTROLLER

### File yang Ada di `src/controllers/`
```
vocationalController.js      ← BOILERPLATE TODOS
kelasPramukaController.js    ← Pramuka, PostgreSQL
absensiPramukaController.js  ← Pramuka, PostgreSQL (+ dependency axios yang hilang)
laporanPramukaController.js  ← Pramuka, PostgreSQL
```

---

### `vocationalController.js` — ❌ MASIH BOILERPLATE PENUH

**Teknologi:** File JSON (`todos.json`), bukan PostgreSQL.

```javascript
const DATA_FILE = path.join(__dirname, "../data/todos.json");
const readTodos = () => JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
```

**Fungsi yang diekspor:** `getAllTodos`, `getTodoById`, `createTodo`, `updateTodo`, `deleteTodo`

**Tidak ada satu pun fungsi PKL.** File ini 100% sisa template todos-service.

---

### `kelasPramukaController.js` — ✅ PostgreSQL, CRUD Lengkap

Menggunakan `pool.connect()` dan `client.query()` dengan benar. Full CRUD (5 fungsi).

**Fungsi yang diekspor:** `createKelasPramuka`, `getAllKelasPramuka`, `getKelasPramukaById`, `updateKelasPramuka`, `deleteKelasPramuka`

---

### `absensiPramukaController.js` — ⚠️ PostgreSQL tapi DEPENDENCY HILANG

Menggunakan `pool.connect()` dengan benar. Full CRUD + validasi duplikasi + validasi tanggal.

**Masalah kritis:**
```javascript
const { getSiswaById } = require("../utils/httpClient");
// httpClient.js menggunakan axios:
const axios = require("axios");
```

**`axios` TIDAK ADA di `package.json`!** Saat runtime, `require("axios")` akan throw `MODULE_NOT_FOUND`, menyebabkan seluruh controller gagal di-load.

---

### `laporanPramukaController.js` — ✅ PostgreSQL, CRUD Lengkap

Menggunakan `pool.connect()` dengan benar. Full CRUD + validasi tanggal. Tidak ada dependency eksternal.

---

## 3. AUDIT ROUTES

### `vocationalRoutes.js` — ❌ FILE MATI (Tidak Di-mount)

File berisi 15 endpoint Pramuka yang lengkap:
```
GET/POST   /kelas
GET/PUT/DELETE /kelas/:id
GET/POST   /absensi
GET/PUT/DELETE /absensi/:id
GET/POST   /laporan
GET/PUT/DELETE /laporan/:id
```

**MASALAH FATAL:** File ini **tidak pernah di-import** di `index.js`. Artinya tidak ada satu pun endpoint ini yang aktif/reachable.

---

### `index.js` — ❌ Route Pramuka Inline dengan Nama Fungsi Salah

`index.js` mendefinisikan route Pramuka secara inline (bukan memakai `vocationalRoutes.js`), tapi menggunakan nama fungsi yang **tidak cocok** dengan yang diekspor controller:

| Di `index.js` | Diekspor controller | Status |
|---|---|---|
| `kelasController.getAllKelas` | `getAllKelasPramuka` | ❌ MISMATCH |
| `kelasController.getKelasById` | `getKelasPramukaById` | ❌ MISMATCH |
| `kelasController.createKelas` | `createKelasPramuka` | ❌ MISMATCH |
| `kelasController.updateKelas` | `updateKelasPramuka` | ❌ MISMATCH |
| `kelasController.deleteKelas` | `deleteKelasPramuka` | ❌ MISMATCH |
| `absensiController.getAllAbsensi` | `getAllAbsensiPramuka` | ❌ MISMATCH |
| *(dst...)* | *(dst...)* | ❌ MISMATCH |

**Akibat:** Saat endpoint dipanggil → `TypeError: kelasController.getAllKelas is not a function` → HTTP 500.

**Tidak ada satu pun endpoint PKL di `index.js`.**

---

## 4. AUDIT FRONTEND — `frontend/src/pages/`

### Halaman yang Ada
```
pages/Dashboard.jsx
pages/tata-usaha/kelas/
pages/tata-usaha/siswa/
pages/tata-usaha/arsip-surat/
pages/tata-usaha/pengumuman/
pages/tata-usaha/jadwal/
pages/tata-usaha/mapel/
pages/tata-usaha/piket/
pages/tata-usaha/upacara/
```

### Halaman Pramuka — ❌ TIDAK ADA

Tidak ada satupun file di `pages/` yang mengandung kata Pramuka, pramuka, atau vocational.

### Halaman PKL — ❌ TIDAK ADA

Tidak ada satupun file di `pages/` yang mengandung kata PKL, pkl, Vokasi, atau vocational.

---

## 5. AUDIT DEPENDENCY — `package.json`

| Package | Status | Keterangan |
|---|---|---|
| `pg` | ✅ Ada (`^8.20.0`) | Driver PostgreSQL tersedia |
| `axios` | ❌ TIDAK ADA | Dibutuhkan oleh `httpClient.js` → `absensiPramukaController.js` |
| `multer` | ❌ TIDAK ADA | Diperlukan untuk upload file laporan monitoring PKL |
| `uuid` | ✅ Ada | Hanya dipakai oleh boilerplate todos, tidak diperlukan untuk PKL/Pramuka |
| `cors` | ✅ Ada | Dipakai di index.js |

---

## 6. KESIMPULAN AKHIR

### Yang SUDAH ADA ✅
| Item | Keterangan |
|---|---|
| `config/db.js` | PostgreSQL Pool terkonfigurasi dengan benar |
| `middleware/auth.js` | JWT Keycloak middleware benar |
| `middleware/errorHandler.js` | Error handler benar |
| `utils/httpClient.js` | HTTP client untuk cross-service call (tapi axios hilang) |
| 3 controller Pramuka | `kelasPramukaController`, `absensiPramukaController`, `laporanPramukaController` — logika PostgreSQL benar |
| Skema Pramuka di init.sql | Tabel UUID dengan constraints lengkap |
| `package.json` nama | Sudah diubah dari "todos-service" ke "vocational-service" |

### Yang MASIH BOILERPLATE ❌
| Item | Keterangan |
|---|---|
| `vocationalController.js` | 100% kode todos JSON, belum ada kode PKL |
| Tidak ada file `upload.js` | Middleware multer belum dibuat |

### Yang ERROR / KRITIS ❌

| # | Error | File | Dampak |
|---|---|---|---|
| 1 | Route inline `index.js` memanggil fungsi yang tidak ada | `src/index.js` | Semua endpoint Pramuka → HTTP 500 |
| 2 | `vocationalRoutes.js` tidak di-mount | `src/index.js` | File routes mati sepenuhnya |
| 3 | `axios` tidak ada di package.json | `package.json` | absensiController crash saat load |
| 4 | `multer` tidak ada di package.json | `package.json` | Upload file monitoring tidak bisa |
| 5 | Tabel `pkl_submissions`, `pkl_monitoring`, `pkl_penilaian` tidak ada | `init.sql` | Tidak bisa menyimpan data PKL apapun |
| 6 | Tabel replika `kelas` & `siswa` tidak ada | `init.sql` | JOIN query PKL akan gagal |
| 7 | Duplikasi definisi tabel Pramuka | `init.sql` | Kode lama yang pakai kolom `id` akan gagal |
| 8 | Tidak ada halaman frontend Pramuka maupun PKL | `frontend/src/pages/` | Fitur tidak bisa digunakan user |

---

## 7. Prioritas Perbaikan yang Diperlukan

```
KRITIS (service crash):
  1. Tambah 'axios' ke package.json (atau hapus validasi siswa dari absensiController)
  2. Fix nama fungsi di index.js ATAU mount vocationalRoutes.js dengan benar
  3. Tambah tabel PKL ke init.sql (pkl_submissions, pkl_monitoring, pkl_penilaian)

TINGGI (fitur tidak berfungsi):
  4. Buat vocationalController.js dengan logika PKL PostgreSQL
  5. Buat vocationalRoutes.js untuk PKL dan mount di index.js
  6. Tambah 'multer' ke package.json
  7. Buat middleware upload.js

MENENGAH (fungsionalitas penuh):
  8. Buat halaman frontend Pramuka
  9. Buat halaman frontend PKL
  10. Tambah tabel replika kelas & siswa ke init.sql
```

---

*Audit ini dilakukan secara READ-ONLY. Tidak ada perubahan kode yang dilakukan.*
