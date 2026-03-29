const pool = require("../config/db");

/**
 * POST /api/pkl/monitoring
 * Tambah laporan monitoring kunjungan PKL.
 * Body: { submission_id, catatan_monitoring, progres_siswa, tanggal_kunjungan }
 * File (multipart/form-data): dokumen (opsional)
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
      `SELECT * FROM pkl_monitoring
       WHERE submission_id = $1
       ORDER BY tanggal_kunjungan DESC`,
      [submission_id]
    );
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  }
};

module.exports = { createMonitoring, getMonitoringBySubmission };
