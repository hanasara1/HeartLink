// backend/src/services/riskAlert.service.js
const { notifyByRisk } = require('./notification.service');

/** AI 서버가 리포트 생성 완료 후 호출하는 알림 트리거 (UC-15) */
const triggerRiskAlert = async (reportId) => {
  return notifyByRisk(reportId);
};

module.exports = { triggerRiskAlert };
