const { User, GuardianRelation } = require('../models');
const { writeAccessLog } = require('../services/accessLog.service');
const { writeAuditLog } = require('../services/auditLog.service');
const { RELATION_TYPES, RELATION_STATUS } = require('../models/constants');

const MAX_GUARDIANS = 3; // FR-03: 사용자당 최대 3인

/**
 * 보호자 연계 요청 (UC-03)
 * 사용자(user)가 보호자의 이메일로 연계를 요청한다.
 * POST /api/guardians/request
 * body: { guardian_email, relation_type, alert_permission? }
 * 인증: role=user
 */
const requestGuardian = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { guardian_email, relation_type, alert_permission } = req.body;

    if (!guardian_email) {
      return res.status(400).json({ message: '보호자 이메일을 입력하세요.' });
    }
    if (!RELATION_TYPES.includes(relation_type)) {
      return res.status(400).json({
        message: `관계 유형은 다음 중 하나여야 합니다: ${RELATION_TYPES.join(', ')}`,
      });
    }

    // 보호자 계정 조회 (사전 가입 필요 - UC-03 선행조건)
    const guardian = await User.findOne({ email: guardian_email.toLowerCase() });
    if (!guardian) {
      return res.status(404).json({ message: '해당 이메일의 보호자 계정을 찾을 수 없습니다.' });
    }
    if (guardian.role !== 'guardian') {
      return res.status(400).json({ message: '보호자(guardian) 역할의 계정만 연계할 수 있습니다.' });
    }
    if (guardian._id.toString() === userId) {
      return res.status(400).json({ message: '본인을 보호자로 등록할 수 없습니다.' });
    }

    // 최대 3인 제한 검증 (FR-03) — PENDING/ACTIVE 상태만 카운트
    const activeCount = await GuardianRelation.countDocuments({
      user_id: userId,
      status: { $in: ['PENDING', 'ACTIVE'] },
    });
    if (activeCount >= MAX_GUARDIANS) {
      return res.status(409).json({
        message: `보호자는 최대 ${MAX_GUARDIANS}인까지 등록할 수 있습니다.`,
      });
    }

    // 중복 연계 검사
    const existing = await GuardianRelation.findOne({
      user_id: userId,
      guardian_id: guardian._id,
    });
    if (existing && ['PENDING', 'ACTIVE'].includes(existing.status)) {
      return res.status(409).json({ message: '이미 요청했거나 연계된 보호자입니다.' });
    }

    let relation;
    if (existing) {
      // 과거에 REJECTED/REVOKED 였던 관계 → 재요청
      existing.status = 'PENDING';
      existing.relation_type = relation_type;
      if (alert_permission) existing.alert_permission = alert_permission;
      existing.updated_at = new Date();
      relation = await existing.save();
    } else {
      relation = await GuardianRelation.create({
        user_id: userId,
        guardian_id: guardian._id,
        relation_type,
        alert_permission: alert_permission || { high: true, mid: true, low: false },
        status: 'PENDING',
      });
    }

    await writeAccessLog({
      userId, actionType: 'LINK_GUARDIAN', req, targetResource: relation._id.toString(),
    });

    // TODO: 보호자에게 연계 요청 알림 발송 (FCM/SMS) — notification 서비스 연동

    return res.status(201).json({
      message: '보호자 연계 요청이 전송되었습니다.',
      relation: {
        id: relation._id,
        guardian: { id: guardian._id, name: guardian.name, email: guardian.email },
        relation_type: relation.relation_type,
        status: relation.status,
      },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 연계 요청 수락/거절 (UC-03)
 * 보호자(guardian)가 자신에게 온 요청에 응답한다.
 * PATCH /api/guardians/:relationId/respond
 * body: { accept: true | false }
 * 인증: role=guardian
 */
const respondToRequest = async (req, res, next) => {
  try {
    const guardianId = req.user.id;
    const { relationId } = req.params;
    const { accept } = req.body;

    const relation = await GuardianRelation.findById(relationId);
    if (!relation) {
      return res.status(404).json({ message: '연계 요청을 찾을 수 없습니다.' });
    }
    // 본인에게 온 요청인지 확인
    if (relation.guardian_id.toString() !== guardianId) {
      return res.status(403).json({ message: '응답 권한이 없습니다.' });
    }
    if (relation.status !== 'PENDING') {
      return res.status(409).json({ message: '이미 처리된 요청입니다.' });
    }

    const before = { status: relation.status };
    relation.status = accept ? 'ACTIVE' : 'REJECTED';
    if (accept) relation.linked_at = new Date();
    relation.updated_at = new Date();
    await relation.save();

    await writeAuditLog({
      actorId: guardianId,
      actorRole: 'guardian',
      action: 'UPDATE',
      targetCollection: 'guardian_relations',
      targetId: relation._id,
      before,
      after: { status: relation.status },
    });

    return res.status(200).json({
      message: accept ? '연계가 완료되었습니다.' : '연계 요청을 거절했습니다.',
      relation: { id: relation._id, status: relation.status },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 알림 권한 변경 (UC-03, FR-03)
 * 사용자가 보호자별 상/중/하 알림 수신 여부를 차등 설정한다.
 * PATCH /api/guardians/:relationId/permission
 * body: { alert_permission: { high, mid, low } }
 * 인증: role=user
 */
const updatePermission = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { relationId } = req.params;
    const { alert_permission } = req.body;

    if (!alert_permission || typeof alert_permission !== 'object') {
      return res.status(400).json({ message: 'alert_permission 객체가 필요합니다.' });
    }

    const relation = await GuardianRelation.findById(relationId);
    if (!relation) {
      return res.status(404).json({ message: '연계 관계를 찾을 수 없습니다.' });
    }
    // 본인의 보호자 관계인지 확인
    if (relation.user_id.toString() !== userId) {
      return res.status(403).json({ message: '권한 변경 권한이 없습니다.' });
    }

    // 변경 전 값 보존 (FR-03: 권한 변경 이력 별도 로그 보존)
    const before = { ...relation.alert_permission.toObject() };

    if (typeof alert_permission.high === 'boolean') relation.alert_permission.high = alert_permission.high;
    if (typeof alert_permission.mid === 'boolean') relation.alert_permission.mid = alert_permission.mid;
    if (typeof alert_permission.low === 'boolean') relation.alert_permission.low = alert_permission.low;
    relation.updated_at = new Date();
    await relation.save();

    await writeAuditLog({
      actorId: userId,
      actorRole: 'user',
      action: 'UPDATE',
      targetCollection: 'guardian_relations',
      targetId: relation._id,
      before,
      after: { ...relation.alert_permission.toObject() },
    });

    return res.status(200).json({
      message: '알림 권한이 변경되었습니다.',
      alert_permission: relation.alert_permission,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 연계 해제 (UC-03 사후조건: 해제 시 이력 보존)
 * 실제 삭제가 아니라 status=REVOKED 로 변경하여 이력을 남긴다.
 * DELETE /api/guardians/:relationId
 * 인증: role=user
 */
const revokeGuardian = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { relationId } = req.params;

    const relation = await GuardianRelation.findById(relationId);
    if (!relation) {
      return res.status(404).json({ message: '연계 관계를 찾을 수 없습니다.' });
    }
    if (relation.user_id.toString() !== userId) {
      return res.status(403).json({ message: '해제 권한이 없습니다.' });
    }
    if (relation.status === 'REVOKED') {
      return res.status(409).json({ message: '이미 해제된 관계입니다.' });
    }

    const before = { status: relation.status };
    relation.status = 'REVOKED'; // 이력 보존 (물리 삭제 아님)
    relation.updated_at = new Date();
    await relation.save();

    await writeAccessLog({
      userId, actionType: 'REVOKE_GUARDIAN', req, targetResource: relation._id.toString(),
    });
    await writeAuditLog({
      actorId: userId,
      actorRole: 'user',
      action: 'UPDATE',
      targetCollection: 'guardian_relations',
      targetId: relation._id,
      before,
      after: { status: 'REVOKED' },
    });

    return res.status(200).json({ message: '보호자 연계가 해제되었습니다.' });
  } catch (err) {
    return next(err);
  }
};

/**
 * 내 보호자 목록 조회 (사용자 관점)
 * GET /api/guardians
 * 인증: role=user
 */
const listMyGuardians = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const relations = await GuardianRelation.find({
      user_id: userId,
      status: { $ne: 'REVOKED' }, // 해제된 관계는 기본 제외
    })
      .populate('guardian_id', 'name email phone')
      .sort({ created_at: -1 });

    return res.status(200).json({
      count: relations.length,
      max: MAX_GUARDIANS,
      guardians: relations.map((r) => ({
        relation_id: r._id,
        guardian: r.guardian_id,
        relation_type: r.relation_type,
        alert_permission: r.alert_permission,
        status: r.status,
        linked_at: r.linked_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 나에게 온 연계 요청 / 내가 연계된 사용자 목록 (보호자 관점)
 * GET /api/guardians/linked-users
 * 인증: role=guardian
 */
const listLinkedUsers = async (req, res, next) => {
  try {
    const guardianId = req.user.id;
    const relations = await GuardianRelation.find({
      guardian_id: guardianId,
      status: { $ne: 'REVOKED' },
    })
      .populate('user_id', 'name email')
      .sort({ created_at: -1 });

    return res.status(200).json({
      count: relations.length,
      users: relations.map((r) => ({
        relation_id: r._id,
        user: r.user_id,
        relation_type: r.relation_type,
        status: r.status,
        linked_at: r.linked_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  requestGuardian,
  respondToRequest,
  updatePermission,
  revokeGuardian,
  listMyGuardians,
  listLinkedUsers,
};
