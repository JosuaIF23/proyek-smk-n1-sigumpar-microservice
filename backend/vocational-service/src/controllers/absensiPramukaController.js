const pool = require("../config/db");
const { createError } = require("../middleware/errorHandler");
const { getSiswaById } = require("../utils/httpClient");

const isValidDate = (dateString) => {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

// CREATE
const createAbsensiPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_siswa, id_kelas_pramuka, tanggal, status, keterangan } =
      req.body;
    if (!id_siswa || !id_kelas_pramuka || !tanggal || !status) {
      throw createError(
        400,
        "Field id_siswa, id_kelas_pramuka, tanggal, dan status wajib diisi",
      );
    }
    if (!isValidDate(tanggal)) {
      throw createError(400, "Format tanggal harus YYYY-MM-DD");
    }

    // Cek apakah siswa ada di academic-service (opsional, untuk validasi)
    const token = req.headers.authorization; // asumsi token dari request
    const siswa = await getSiswaById(id_siswa, token);
    if (!siswa) {
      throw createError(404, "Siswa tidak ditemukan di academic-service");
    }

    // Cek apakah kelas pramuka ada
    const kelasCheck = await client.query(
      "SELECT id_kelas_pramuka FROM kelas_pramuka WHERE id_kelas_pramuka = $1",
      [id_kelas_pramuka],
    );
    if (kelasCheck.rows.length === 0) {
      throw createError(404, "Kelas pramuka tidak ditemukan");
    }

    // Cek duplikasi absensi per siswa per hari
    const dupCheck = await client.query(
      "SELECT id_absensi_pramuka FROM absensi_pramuka WHERE id_siswa = $1 AND tanggal = $2",
      [id_siswa, tanggal],
    );
    if (dupCheck.rows.length > 0) {
      throw createError(409, "Absensi untuk siswa dan tanggal ini sudah ada");
    }

    const insertQuery = `
      INSERT INTO absensi_pramuka (id_siswa, id_kelas_pramuka, tanggal, status, keterangan)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await client.query(insertQuery, [
      id_siswa,
      id_kelas_pramuka,
      tanggal,
      status,
      keterangan || null,
    ]);
    res
      .status(201)
      .json({
        success: true,
        message: "Absensi pramuka berhasil dibuat",
        data: result.rows[0],
      });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ALL (dengan filter)
const getAllAbsensiPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id_siswa, id_kelas_pramuka, tanggal, status } = req.query;
    let query = `SELECT * FROM absensi_pramuka WHERE 1=1`;
    const values = [];
    let idx = 1;
    if (id_siswa) {
      query += ` AND id_siswa = $${idx++}`;
      values.push(id_siswa);
    }
    if (id_kelas_pramuka) {
      query += ` AND id_kelas_pramuka = $${idx++}`;
      values.push(id_kelas_pramuka);
    }
    if (tanggal) {
      query += ` AND tanggal = $${idx++}`;
      values.push(tanggal);
    }
    if (status) {
      query += ` AND status = $${idx++}`;
      values.push(status);
    }
    query += ` ORDER BY tanggal DESC`;
    const result = await client.query(query, values);
    res.json({ success: true, count: result.rows.length, data: result.rows });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// READ ONE
const getAbsensiPramukaById = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "SELECT * FROM absensi_pramuka WHERE id_absensi_pramuka = $1",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Absensi pramuka tidak ditemukan");
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// UPDATE
const updateAbsensiPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, keterangan } = req.body;
    if (!status && keterangan === undefined) {
      throw createError(400, "Tidak ada field yang akan diupdate");
    }
    const checkQuery =
      "SELECT id_absensi_pramuka FROM absensi_pramuka WHERE id_absensi_pramuka = $1";
    const checkResult = await client.query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      throw createError(404, "Absensi pramuka tidak ditemukan");
    }
    let updateFields = [];
    let values = [];
    let idx = 1;
    if (status) {
      updateFields.push(`status = $${idx++}`);
      values.push(status);
    }
    if (keterangan !== undefined) {
      updateFields.push(`keterangan = $${idx++}`);
      values.push(keterangan);
    }
    values.push(id);
    const updateQuery = `
      UPDATE absensi_pramuka
      SET ${updateFields.join(", ")}, updated_at = NOW()
      WHERE id_absensi_pramuka = $${idx}
      RETURNING *
    `;
    const result = await client.query(updateQuery, values);
    res.json({
      success: true,
      message: "Absensi pramuka berhasil diperbarui",
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

// DELETE
const deleteAbsensiPramuka = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query(
      "DELETE FROM absensi_pramuka WHERE id_absensi_pramuka = $1 RETURNING id_absensi_pramuka",
      [id],
    );
    if (result.rows.length === 0) {
      throw createError(404, "Absensi pramuka tidak ditemukan");
    }
    res.json({ success: true, message: "Absensi pramuka berhasil dihapus" });
  } catch (err) {
    next(err);
  } finally {
    client.release();
  }
};

module.exports = {
  createAbsensiPramuka,
  getAllAbsensiPramuka,
  getAbsensiPramukaById,
  updateAbsensiPramuka,
  deleteAbsensiPramuka,
};
