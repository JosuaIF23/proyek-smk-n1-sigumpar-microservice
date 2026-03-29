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
 * Jika status_validasi = 'validated' maka status_persetujuan otomatis = 'approved'.
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
