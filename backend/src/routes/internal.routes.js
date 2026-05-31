// backend/src/routes/internal.routes.js
const express = require('express');
const router = express.Router();
const { notifyByRisk } = require('../services/notification.service');

// AI 서버 → 백엔드 내부 호출 (실제로는 내부 인증/네트워크 격리 필요)
router.post('/notify', async (req, res, next) => {
  try {
    const result = await notifyByRisk(req.body.report_id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
