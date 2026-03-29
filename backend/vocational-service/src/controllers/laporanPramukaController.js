const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");

const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// CREATE
const createLaporanPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_kelas_pramuka, judul, deskripsi, file_url, tanggal_laporan } =
      req.body;
    if (!id_kelas_pramuka || !judul || !tanggal_laporan) {
      throw createError(
        400,
        "Field id_kelas_pramuka, judul, dan tanggal_laporan wajib diisi",
      );
    }
    if (!isValidDate(tanggal_laporan)) {
      throw createError(400, "Format tanggal harus YYYY-MM-DD");
    }
    // Cek kelas pramuka
    const kelasCheck = await client.query(
      "SELECT id_kelas_pramuka FROM kelas_pramuka WHERE id_kelas_pramuka = $1",
      [id_kelas_pramuka],
    );
    if (kelasCheck.rows.length === 0) {
      throw createError(404, "Kelas pramuka tidak ditemukan");
    }
    const insertQuery = `
      INSERT INTO laporan_pramuka (id_kelas_pramuka, judul, deskripsi, file_url, tanggal_laporan)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await client.query(insertQuery, [
      id_kelas_pramuka,
      judul,
      deskripsi || null,
      file_url || null,
      tanggal_laporan,
    ]);
    res
      .status(201)
      .json({
        success: true,
        message: "Laporan pramuka berhasil dibuat",
        data: result.rows[0],
      });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ALL (dengan filter)
const getAllLaporanPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_kelas_pramuka, tanggal_laporan } = req.query;
    let query = `SELECT * FROM laporan_pramuka WHERE 1=1`;
    const values = [];
    let idx = 1;
    if (id_kelas_pramuka) {
      query += ` AND id_kelas_pramuka = $${idx++}`;
      values.push(id_kelas_pramuka);
    }
    if (tanggal_laporan) {
      query += ` AND tanggal_laporan = $${idx++}`;
      values.push(tanggal_laporan);
    }
    query += ` ORDER BY tanggal_laporan DESC`;
    const result = await client.query(query, values);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ONE
const getLaporanPramukaById = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "SELECT * FROM laporan_pramuka WHERE id_laporan = $1",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Laporan pramuka tidak ditemukan");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// UPDATE
const updateLaporanPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { judul, deskripsi, file_url, tanggal_laporan } = req.body;
    if (!judul && !deskripsi && !file_url && !tanggal_laporan) {
      throw createError(400, "Tidak ada field yang akan diupdate");
    }
    const checkQuery =
      "SELECT id_laporan FROM laporan_pramuka WHERE id_laporan = $1";
    const checkResult = await client.query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      throw createError(404, "Laporan pramuka tidak ditemukan");
    }
    let updateFields = [];
    let values = [];
    let idx = 1;
    if (judul) {
      updateFields.push(`judul = $${idx++}`);
      values.push(judul);
    }
    if (deskripsi !== undefined) {
      updateFields.push(`deskripsi = $${idx++}`);
      values.push(deskripsi);
    }
    if (file_url !== undefined) {
      updateFields.push(`file_url = $${idx++}`);
      values.push(file_url);
    }
    if (tanggal_laporan) {
      if (!isValidDate(tanggal_laporan))
        throw createError(400, "Format tanggal harus YYYY-MM-DD");
      updateFields.push(`tanggal_laporan = $${idx++}`);
      values.push(tanggal_laporan);
    }
    values.push(id);
    const updateQuery = `
      UPDATE laporan_pramuka
      SET ${updateFields.join(", ")}, updated_at = NOW()
      WHERE id_laporan = $${idx}
      RETURNING *
    `;
    const result = await client.query(updateQuery, values);
    res.json({
      success: true,
      message: "Laporan pramuka berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// DELETE
const deleteLaporanPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "DELETE FROM laporan_pramuka WHERE id_laporan = $1 RETURNING id_laporan",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Laporan pramuka tidak ditemukan");
    }
    res.json({ success: true, message: "Laporan pramuka berhasil dihapus" });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  createLaporanPramuka,
  getAllLaporanPramuka,
  getLaporanPramukaById,
  updateLaporanPramuka,
  deleteLaporanPramuka,
};
