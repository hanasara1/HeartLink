const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/report.controller');

router.get('/', authenticate, authorize('user'), ctrl.listMyReports);
router.get('/:id', authenticate, authorize('user'), ctrl.getMyReport);
router.get('/:id/guardian', authenticate, authorize('guardian'), ctrl.getGuardianReport);
router.get('/:id/pdf', authenticate, ctrl.downloadPDF); // 본인/보호자 모두

module.exports = router;
