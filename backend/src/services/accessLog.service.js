const { AccessLog } = require('../models');

/**
 * 접근 이력 기록 (UC-01, UC-08 사후조건)
 * 로깅 실패가 본 요청을 막지 않도록 에러는 삼킨다.
 */
const writeAccessLog = async ({ userId, actionType, req, targetResource }) => {
  try {
    await AccessLog.create({
      user_id: userId,
      action_type: actionType,
      target_resource: targetResource,
      ip_address: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      user_agent: req.headers['user-agent'],
      accessed_at: new Date(),
    });
  } catch (err) {
    console.error('[AccessLog] 기록 실패:', err.message);
  }
};

module.exports = { writeAccessLog };
