const pool = require("../config/db");

/**
 * GET /api/pkl/penilaian/stats
 * Ringkasan statistik penilaian untuk dashboard.
 */
const getPenilaianStats = async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)                                                                AS total_siswa,
        COUNT(CASE WHEN pp.status_penilaian = 'Simpan' THEN 1 END)            AS nilai_sudah_diisi,
        COUNT(CASE WHEN pp.status_penilaian IS NULL
                     OR pp.status_penilaian = 'Draft'  THEN 1 END)            AS nilai_belum_diisi,
        COALESCE(AVG(pp.nilai_akhir), 0)::NUMERIC(10,2)                       AS rata_rata_nilai
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
 * Body: { submission_id, nilai_akhir, catatan_guru, status_penilaian }
 */
const upsertPenilaian = async (req, res, next) => {
  const { submission_id, nilai_akhir, catatan_guru, status_penilaian } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO pkl_penilaian
         (submission_id, nilai_akhir, catatan_guru, status_penilaian)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (submission_id) DO UPDATE SET
         nilai_akhir      = EXCLUDED.nilai_akhir,
         catatan_guru     = EXCLUDED.catatan_guru,
         status_penilaian = EXCLUDED.status_penilaian,
         updated_at       = CURRENT_TIMESTAMP
       RETURNING *`,
      [submission_id, nilai_akhir, catatan_guru, status_penilaian]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = { getPenilaianStats, upsertPenilaian };
