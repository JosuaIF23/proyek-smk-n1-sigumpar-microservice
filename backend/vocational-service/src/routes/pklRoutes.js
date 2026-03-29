const express = require("express");
const router = express.Router();

const verifyToken    = require("../middleware/auth");
const upload         = require("../middleware/upload");
const submissionCtrl = require("../controllers/pklSubmissionController");
const monitoringCtrl = require("../controllers/pklMonitoringController");
const penilaianCtrl  = require("../controllers/pklPenilaianController");

// Semua route PKL memerlukan autentikasi
router.use(verifyToken);

// --- Submissions ---
router.get("/submissions",              submissionCtrl.getAllPKL);
router.post("/submissions",             submissionCtrl.createSubmission);
router.put("/submissions/:id/validate", submissionCtrl.validateAndApprovePKL);

// --- Monitoring ---
router.post("/monitoring",               upload.single("dokumen"), monitoringCtrl.createMonitoring);
router.get("/monitoring/:submission_id", monitoringCtrl.getMonitoringBySubmission);

// --- Penilaian ---
router.get("/penilaian/stats",   penilaianCtrl.getPenilaianStats);
router.post("/penilaian/upsert", penilaianCtrl.upsertPenilaian);

module.exports = router;
