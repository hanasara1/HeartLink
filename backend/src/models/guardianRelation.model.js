const mongoose = require('mongoose');
const { RELATION_TYPES, RELATION_STATUS } = require('./constants');

const guardianRelationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    guardian_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    relation_type: { type: String, enum: RELATION_TYPES, required: true },
    alert_permission: {
      high: { type: Boolean, default: true },  // 상(긴급) 알림 수신
      mid: { type: Boolean, default: true },   // 중(주의) 알림 수신
      low: { type: Boolean, default: false },  // 하(참고) 알림 수신
    },
    status: { type: String, enum: RELATION_STATUS, default: 'PENDING' },
    linked_at: { type: Date },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: 'guardian_relations' }
);

// 동일 사용자-보호자 중복 연계 방지
guardianRelationSchema.index({ user_id: 1, guardian_id: 1 }, { unique: true });
guardianRelationSchema.index({ user_id: 1, status: 1 });
// ※ 사용자당 최대 3인 제한은 애플리케이션 레벨에서 검증

module.exports = mongoose.model('GuardianRelation', guardianRelationSchema);
