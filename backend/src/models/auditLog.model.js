const mongoose = require('mongoose');
const { AUDIT_ACTOR_ROLES, AUDIT_ACTIONS } = require('./constants');

const auditLogSchema = new mongoose.Schema(
  {
    actor_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    actor_role: { type: String, enum: AUDIT_ACTOR_ROLES, required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    target_collection: { type: String, required: true, maxlength: 50 },
    target_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    before_value: { type: mongoose.Schema.Types.Mixed }, // 변경 전 값
    after_value: { type: mongoose.Schema.Types.Mixed },  // 변경 후 값
    logged_at: { type: Date, required: true, default: Date.now },
  },
  { collection: 'audit_logs', capped: false } // 임의 삭제 방지 (TTL 없음 — 법령상 보존)
);

auditLogSchema.index({ actor_id: 1, logged_at: -1 });
auditLogSchema.index({ target_collection: 1, target_id: 1, logged_at: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
