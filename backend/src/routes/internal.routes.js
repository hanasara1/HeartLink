// backend/src/routes/internal.routes.js
const express = require('express');
const router = express.Router();
const { notifyByRisk } = require('../services/notification.service');

// AI 서버 → 백엔드 내부 호출 검증 (공유 시크릿)
const verifyInternal = (req, res, next) => {
  const key = req.header('X-Internal-Key');
  if (!key || key !== process.env.INTERNAL_KEY) {
    return res.status(401).json({ message: '내부 인증 실패' });
  }
  return next();
};

// 위험도 단계별 알림 발송 트리거 (UC-15)
router.post('/notify', verifyInternal, async (req, res, next) => {
  try {
    const { report_id } = req.body;
    if (!report_id) {
      return res.status(400).json({ message: 'report_id가 필요합니다.' });
    }
    const result = await notifyByRisk(report_id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
