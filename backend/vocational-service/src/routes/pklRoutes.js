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
router.get("/api/vocational/pkl/submissions",                submissionCtrl.getAllPKL);
router.put("/api/vocational/pkl/submissions/:id/validate",   submissionCtrl.validateAndApprovePKL);

// --- Monitoring ---
router.post("/api/vocational/pkl/monitoring",               upload.single("dokumen"), monitoringCtrl.createMonitoring);
router.get("/api/vocational/pkl/monitoring/:submission_id", monitoringCtrl.getMonitoringBySubmission);

// --- Penilaian ---
router.get("/api/vocational/pkl/penilaian/stats",   penilaianCtrl.getPenilaianStats);
router.post("/api/vocational/pkl/penilaian/upsert", penilaianCtrl.upsertPenilaian);

module.exports = router;
