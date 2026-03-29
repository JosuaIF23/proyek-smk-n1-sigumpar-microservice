-- 6.1 Tabel kelas_pramuka
CREATE TABLE IF NOT EXISTS kelas_pramuka (
    id_kelas_pramuka UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama_kelas VARCHAR(100) NOT NULL,
    tahun_ajaran VARCHAR(20),
    pembina VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 6.2 Tabel absensi_pramuka
CREATE TABLE IF NOT EXISTS absensi_pramuka (
    id_absensi_pramuka UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_siswa VARCHAR(255) NOT NULL,               -- ID siswa dari academic-service
    id_kelas_pramuka UUID NOT NULL REFERENCES kelas_pramuka(id_kelas_pramuka) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('hadir', 'sakit', 'izin', 'alpa', 'terlambat')),
    keterangan TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (id_siswa, tanggal)                     -- satu siswa satu absensi per hari
);

-- 6.3 Tabel laporan_pramuka
CREATE TABLE IF NOT EXISTS laporan_pramuka (
    id_laporan UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_kelas_pramuka UUID NOT NULL REFERENCES kelas_pramuka(id_kelas_pramuka) ON DELETE CASCADE,
    judul VARCHAR(255) NOT NULL,
    deskripsi TEXT,
    file_url TEXT,                                 -- link atau path file laporan (opsional)
    tanggal_laporan DATE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Indeks untuk performa
CREATE INDEX idx_absensi_pramuka_id_siswa ON absensi_pramuka(id_siswa);
CREATE INDEX idx_absensi_pramuka_tanggal ON absensi_pramuka(tanggal);
CREATE INDEX idx_laporan_pramuka_kelas ON laporan_pramuka(id_kelas_pramuka);

CREATE TABLE IF NOT EXISTS kelas_pramuka (id SERIAL PRIMARY KEY, nama_regu VARCHAR(100));
CREATE TABLE IF NOT EXISTS absensi_pramuka (id SERIAL PRIMARY KEY, siswa_id INTEGER, tanggal DATE, status VARCHAR(20));
CREATE TABLE IF NOT EXISTS laporan_pramuka (id SERIAL PRIMARY KEY, deskripsi TEXT, file_url TEXT);
CREATE TABLE IF NOT EXISTS laporan_lokasi_pkl (id SERIAL PRIMARY KEY, siswa_id INTEGER, nama_perusahaan VARCHAR(150), alamat TEXT);
CREATE TABLE IF NOT EXISTS laporan_progres_pkl (id SERIAL PRIMARY KEY, siswa_id INTEGER, minggu_ke INTEGER, deskripsi TEXT);

-- ============================================================
-- SKEMA PKL (Praktik Kerja Lapangan)
-- Ditambahkan di bawah skema Pramuka -- jangan hapus yang atas
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
    status_validasi     VARCHAR(20) DEFAULT 'pending',
    keterangan_layak    TEXT,
    status_persetujuan  VARCHAR(20) DEFAULT 'pending',
    created_at          TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

-- Monitoring kunjungan & progres siswa selama PKL
CREATE TABLE IF NOT EXISTS pkl_monitoring (
    id                  SERIAL PRIMARY KEY,
    submission_id       INTEGER NOT NULL REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    tanggal_kunjungan   DATE,
    catatan_monitoring  TEXT,
    progres_siswa       TEXT,
    file_laporan        TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Penilaian akhir PKL per siswa
CREATE TABLE IF NOT EXISTS pkl_penilaian (
    id                SERIAL PRIMARY KEY,
    submission_id     INTEGER NOT NULL UNIQUE REFERENCES pkl_submissions(id) ON DELETE CASCADE,
    nilai_akhir       NUMERIC(5,2),
    catatan_guru      TEXT,
    status_penilaian  VARCHAR(20) DEFAULT 'Draft',
    created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);