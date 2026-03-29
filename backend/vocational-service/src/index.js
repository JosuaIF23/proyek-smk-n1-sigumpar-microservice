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
router.get("/kelas", kelasController.getAllKelasPramuka);
router.get("/kelas/:id", kelasController.getKelasPramukaById);
router.post("/kelas", kelasController.createKelasPramuka);
router.put("/kelas/:id", kelasController.updateKelasPramuka);
router.delete("/kelas/:id", kelasController.deleteKelasPramuka);

// ===== Absensi Pramuka =====
router.get("/absensi", absensiController.getAllAbsensiPramuka);
router.get("/absensi/:id", absensiController.getAbsensiPramukaById);
router.post("/absensi", absensiController.createAbsensiPramuka);
router.put("/absensi/:id", absensiController.updateAbsensiPramuka);
router.delete("/absensi/:id", absensiController.deleteAbsensiPramuka);

// ===== Laporan Pramuka =====
router.get("/laporan", laporanController.getAllLaporanPramuka);
router.get("/laporan/:id", laporanController.getLaporanPramukaById);
router.post("/laporan", laporanController.createLaporanPramuka);
router.put("/laporan/:id", laporanController.updateLaporanPramuka);
router.delete("/laporan/:id", laporanController.deleteLaporanPramuka);

// Mount router dengan prefix
app.use("/api/pramuka", router);

// Mount PKL routes
const pklRoutes = require("./routes/pklRoutes");
app.use("/api/pkl", pklRoutes);

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
