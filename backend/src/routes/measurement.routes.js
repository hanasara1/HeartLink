const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { upload, handleUploadError } = require('../middlewares/upload.middleware');
const ctrl = require('../controllers/measurement.controller');

// 업로드: Multer single → 에러 핸들링 → 컨트롤러
router.post(
  '/',
  authenticate,
  authorize('user'),
  upload.single('ecgFile'),
  handleUploadError,
  ctrl.uploadMeasurement
);

router.get('/', authenticate, authorize('user'), ctrl.listMeasurements);
router.get('/:id/status', authenticate, authorize('user'), ctrl.getStatus);

module.exports = router;
