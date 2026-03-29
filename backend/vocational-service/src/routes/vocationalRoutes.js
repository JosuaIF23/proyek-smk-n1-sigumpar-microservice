const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/auth");
const kelasPramukaController = require("../controllers/kelasPramukaController");
const absensiPramukaController = require("../controllers/absensiPramukaController");
const laporanPramukaController = require("../controllers/laporanPramukaController");

// Semua route di bawah memerlukan auth
router.use(verifyToken);

// Kelas Pramuka
router.get("/kelas", kelasPramukaController.getAllKelasPramuka);
router.get("/kelas/:id", kelasPramukaController.getKelasPramukaById);
router.post("/kelas", kelasPramukaController.createKelasPramuka);
router.put("/kelas/:id", kelasPramukaController.updateKelasPramuka);
router.delete("/kelas/:id", kelasPramukaController.deleteKelasPramuka);

// Absensi Pramuka
router.get("/absensi", absensiPramukaController.getAllAbsensiPramuka);
router.get("/absensi/:id", absensiPramukaController.getAbsensiPramukaById);
router.post("/absensi", absensiPramukaController.createAbsensiPramuka);
router.put("/absensi/:id", absensiPramukaController.updateAbsensiPramuka);
router.delete("/absensi/:id", absensiPramukaController.deleteAbsensiPramuka);

// Laporan Pramuka
router.get("/laporan", laporanPramukaController.getAllLaporanPramuka);
router.get("/laporan/:id", laporanPramukaController.getLaporanPramukaById);
router.post("/laporan", laporanPramukaController.createLaporanPramuka);
router.put("/laporan/:id", laporanPramukaController.updateLaporanPramuka);
router.delete("/laporan/:id", laporanPramukaController.deleteLaporanPramuka);

module.exports = router;
