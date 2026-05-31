const mongoose = require('mongoose');
const {
  FILE_FORMATS, DEVICE_TYPES, SIGNAL_TYPES, MEASUREMENT_STATUS,
} = require('./constants');

const measurementSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    file_url: { type: String, required: true }, // S3 객체 URL
    file_format: { type: String, enum: FILE_FORMATS, required: true },
    file_size: { type: Number, required: true, max: 104857600 }, // 최대 100MB
    device_type: { type: String, enum: DEVICE_TYPES, required: true },
    signal_type: { type: String, enum: SIGNAL_TYPES, required: true },
    measured_at: { type: Date, required: true },
    duration_sec: { type: Number, required: true },
    signal_quality_index: { type: Number, min: 0, max: 1 }, // SQI
    file_hash: { type: String, required: true, unique: true }, // SHA-256, 중복 업로드 방지
    status: { type: String, enum: MEASUREMENT_STATUS, default: 'UPLOADED' },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'measurements' }
);

measurementSchema.index({ user_id: 1, measured_at: -1 }); // 시계열 조회
measurementSchema.index({ file_hash: 1 }, { unique: true });
measurementSchema.index({ status: 1 });

module.exports = mongoose.model('Measurement', measurementSchema);
