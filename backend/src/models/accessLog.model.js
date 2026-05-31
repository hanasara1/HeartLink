const mongoose = require('mongoose');
const { ACCESS_ACTIONS } = require('./constants');

const ONE_YEAR_SEC = 31536000; // 1년 = 60*60*24*365

const accessLogSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action_type: { type: String, enum: ACCESS_ACTIONS, required: true },
    target_resource: { type: String, maxlength: 255 }, // 대상 리소스 ID/URL
    ip_address: { type: String, required: true, maxlength: 45 }, // IPv4/IPv6
    user_agent: { type: String, maxlength: 500 },
    accessed_at: { type: Date, required: true },
    // TTL: 1년 후 자동 삭제
    created_at: { type: Date, default: Date.now, expires: ONE_YEAR_SEC },
  },
  { collection: 'access_logs' }
);

accessLogSchema.index({ user_id: 1, accessed_at: -1 });
accessLogSchema.index({ action_type: 1, accessed_at: -1 });
accessLogSchema.index({ created_at: 1 }, { expireAfterSeconds: ONE_YEAR_SEC }); // TTL

module.exports = mongoose.model('AccessLog', accessLogSchema);
