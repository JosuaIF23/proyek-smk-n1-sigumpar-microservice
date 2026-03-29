const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");

// CREATE
const createKelasPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { nama_kelas, tahun_ajaran, pembina } = req.body;
    if (!nama_kelas) {
      throw createError(400, "Nama kelas wajib diisi");
    }
    const result = await client.query(
      `INSERT INTO kelas_pramuka (nama_kelas, tahun_ajaran, pembina)
       VALUES ($1, $2, $3) RETURNING *`,
      [nama_kelas, tahun_ajaran || null, pembina || null],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ALL
const getAllKelasPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const result = await client.query(
      "SELECT * FROM kelas_pramuka ORDER BY created_at DESC",
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ONE
const getKelasPramukaById = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "SELECT * FROM kelas_pramuka WHERE id_kelas_pramuka = $1",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Kelas pramuka tidak ditemukan");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// UPDATE
const updateKelasPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nama_kelas, tahun_ajaran, pembina } = req.body;
    if (!nama_kelas && !tahun_ajaran && !pembina) {
      throw createError(400, "Tidak ada field yang akan diupdate");
    }
    let updateFields = [];
    let values = [];
    let idx = 1;
    if (nama_kelas) {
      updateFields.push(`nama_kelas = $${idx++}`);
      values.push(nama_kelas);
    }
    if (tahun_ajaran !== undefined) {
      updateFields.push(`tahun_ajaran = $${idx++}`);
      values.push(tahun_ajaran);
    }
    if (pembina !== undefined) {
      updateFields.push(`pembina = $${idx++}`);
      values.push(pembina);
    }
    values.push(id);
    const query = `
      UPDATE kelas_pramuka
      SET ${updateFields.join(", ")}, updated_at = NOW()
      WHERE id_kelas_pramuka = $${idx}
      RETURNING *
    `;
    const result = await client.query(query, values);
    if (result.rows.length === 0) {
      throw createError(404, "Kelas pramuka tidak ditemukan");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// DELETE
const deleteKelasPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "DELETE FROM kelas_pramuka WHERE id_kelas_pramuka = $1 RETURNING id_kelas_pramuka",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Kelas pramuka tidak ditemukan");
    }
    res.json({ success: true, message: "Kelas pramuka berhasil dihapus" });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  createKelasPramuka,
  getAllKelasPramuka,
  getKelasPramukaById,
  updateKelasPramuka,
  deleteKelasPramuka,
};
