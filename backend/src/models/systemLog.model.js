const mongoose = require('mongoose');
const { EVENT_TYPES, SEVERITIES, SERVICE_NAMES } = require('./constants');

const ONE_YEAR_SEC = 31536000;

const systemLogSchema = new mongoose.Schema(
  {
    event_type: { type: String, enum: EVENT_TYPES, required: true }, // ERROR/WARN/INFO/DEBUG
    severity: { type: String, enum: SEVERITIES, required: true },    // CRITICAL/HIGH/MID/LOW
    event_desc: { type: String, required: true, maxlength: 2000 },
    service_name: { type: String, enum: SERVICE_NAMES, required: true },
    stack_trace: { type: String }, // 예외 스택 트레이스
    logged_at: { type: Date, required: true, default: Date.now },
  },
  { collection: 'system_logs' }
);

systemLogSchema.index({ service_name: 1, severity: 1, logged_at: -1 });
systemLogSchema.index({ logged_at: -1 });
systemLogSchema.index({ logged_at: 1 }, { expireAfterSeconds: ONE_YEAR_SEC }); // TTL 1년

module.exports = mongoose.model('SystemLog', systemLogSchema);
