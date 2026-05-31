const mongoose = require('mongoose');
const {
  USER_ROLES, RISK_LEVELS, NOTI_CHANNELS, DELIVERY_STATUS,
} = require('./constants');

const notificationSchema = new mongoose.Schema(
  {
    report_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 측정 당사자
    recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 수신자
    recipient_role: { type: String, enum: USER_ROLES, required: true },
    risk_level: { type: String, enum: RISK_LEVELS, required: true },
    channel: { type: String, enum: NOTI_CHANNELS, required: true },
    message: { type: String, required: true, maxlength: 60 }, // 60자 이내
    sent_at: { type: Date },
    delivery_status: { type: String, enum: DELIVERY_STATUS, default: 'PENDING' },
    read_at: { type: Date }, // 수신자 확인 시각
    retry_count: { type: Number, default: 0, max: 3 },
    error_msg: { type: String, maxlength: 500 },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'notifications' }
);

notificationSchema.index({ recipient_id: 1, created_at: -1 });
notificationSchema.index({ user_id: 1, risk_level: 1, created_at: -1 });
notificationSchema.index({ delivery_status: 1, retry_count: 1 }); // 재시도 큐 조회용

module.exports = mongoose.model('Notification', notificationSchema);
