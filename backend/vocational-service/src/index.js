const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { errorHandler } = require("./middleware/errorHandler");
const verifyToken = require("./middleware/auth");

// Import semua controller
const kelasController = require("./controllers/kelasPramukaController");
const absensiController = require("./controllers/absensiPramukaController");
const laporanController = require("./controllers/laporanPramukaController");

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware global
app.use(helmet());
app.use(cors());
app.use(morgan("dev"));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "vocational-service",
    timestamp: new Date().toISOString(),
  });
});

// Buat router untuk prefix /api/pramuka
const router = express.Router();

// Terapkan middleware autentikasi untuk semua route di sini
router.use(verifyToken);

// ===== Kelas Pramuka =====
router.get("/kelas", kelasController.getAllKelas);
router.get("/kelas/:id", kelasController.getKelasById);
router.post("/kelas", kelasController.createKelas);
router.put("/kelas/:id", kelasController.updateKelas);
router.delete("/kelas/:id", kelasController.deleteKelas);

// ===== Absensi Pramuka =====
router.get("/absensi", absensiController.getAllAbsensi);
router.get("/absensi/:id", absensiController.getAbsensiById);
router.post("/absensi", absensiController.createAbsensi);
router.put("/absensi/:id", absensiController.updateAbsensi);
router.delete("/absensi/:id", absensiController.deleteAbsensi);

// ===== Laporan Pramuka =====
router.get("/laporan", laporanController.getAllLaporan);
router.get("/laporan/:id", laporanController.getLaporanById);
router.post("/laporan", laporanController.createLaporan);
router.put("/laporan/:id", laporanController.updateLaporan);
router.delete("/laporan/:id", laporanController.deleteLaporan);

// Mount router dengan prefix
app.use("/api/pramuka", router);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route '${req.originalUrl}' tidak ditemukan`,
  });
});

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Vocational Service berjalan di http://localhost:${PORT}`);
});
