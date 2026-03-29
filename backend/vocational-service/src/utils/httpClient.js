const axios = require("axios");

// URL gateway (bisa diatur lewat env)
const GATEWAY_URL = process.env.GATEWAY_URL || "http://api-gateway:80";
// atau jika menggunakan port host, bisa di-set dari env

const httpClient = axios.create({
  baseURL: GATEWAY_URL,
  timeout: 10000,
});

// Fungsi untuk mengambil semua siswa dari academic-service
const getSiswaFromAcademic = async (token) => {
  try {
    const response = await httpClient.get("/api/siswa", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data; // asumsi response { success: true, data: [...] }
  } catch (error) {
    console.error("Gagal mengambil data siswa:", error.message);
    throw new Error("Gagal mengambil data siswa dari academic-service");
  }
};

// Fungsi untuk mengambil satu siswa berdasarkan ID
const getSiswaById = async (id, token) => {
  try {
    const response = await httpClient.get(`/api/siswa/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.data;
  } catch (error) {
    console.error(`Gagal mengambil siswa ID ${id}:`, error.message);
    return null;
  }
};

module.exports = { getSiswaFromAcademic, getSiswaById };
