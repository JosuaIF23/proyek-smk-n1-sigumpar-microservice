---
active: true
iteration: 1
session_id: 
max_iterations: 10
completion_promise: "Berhasil menganalisis kondisi awal vocational-service dan menyusun cetak biru pembangunan fitur PKL di rencana_pembangunan_vokasi.md"
started_at: "2026-03-29T08:22:04Z"
---

Bertindaklah sebagai Senior Backend Architect. Kita baru saja membuat branch baru yang bersih dari 'main'. Semua container sekarang healthy, tapi fitur PKL di 'backend/vocational-service' kembali ke kondisi awal/boilerplate. Tugasmu saat ini adalah mode READ-ONLY (jangan ubah kode dulu). Lakukan hal berikut: 1. ANALISIS KONDISI AKTUAL: Cek isi direktori 'backend/vocational-service/'. Lihat file package.json, init.sql, index.js, dan folder src-nya. 2. BUAT MASTER PLAN: Buat file bernama 'rencana_pembangunan_vokasi.md'. File ini akan menjadi cetak biru (blueprint) kita untuk membangun ulang fitur PKL dengan standar PostgreSQL yang benar. 3. STRUKTUR MASTER PLAN: Di dalam file tersebut, jabarkan langkah-langkah yang harus dieksekusi nantinya: (a) Daftar modul yang perlu di-install (pg, multer), (b) Desain rancangan 'init.sql' yang wajib memuat tabel replika 'kelas', 'siswa', serta tabel utama 'pkl_submissions', 'pkl_monitoring', 'pkl_penilaian' (DILARANG menyebut/memasukkan Pramuka), (c) Rencana pembuatan middleware upload.js, dan (d) Rencana controller & routes API PKL serta pembersihan boilerplate 'todos'. Pastikan rencananya sangat detail dan terstruktur.
