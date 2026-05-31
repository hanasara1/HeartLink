const { AuditLog } = require('../models');

/**
 * 감사 로그 기록 (NFR-15, 민감정보 변경 추적)
 * 회원 탈퇴 시에도 보존되는 로그. 기록 실패가 본 요청을 막지 않도록 에러는 삼킨다.
 */
const writeAuditLog = async ({
  actorId, actorRole, action, targetCollection, targetId, before, after,
}) => {
  try {
    await AuditLog.create({
      actor_id: actorId,
      actor_role: actorRole,
      action, // CREATE / READ / UPDATE / DELETE / EXPORT
      target_collection: targetCollection,
      target_id: targetId,
      before_value: before,
      after_value: after,
      logged_at: new Date(),
    });
  } catch (err) {
    console.error('[AuditLog] 기록 실패:', err.message);
  }
};

module.exports = { writeAuditLog };
