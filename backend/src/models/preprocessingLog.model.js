const mongoose = require('mongoose');
const { PREPROCESS_STATUS } = require('./constants');

const preprocessingLogSchema = new mongoose.Schema(
  {
    measurement_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Measurement',
      required: true,
      unique: true,
    },
    filter_params: {
      bandpass_low: { type: Number, default: 0.5 },   // Hz
      bandpass_high: { type: Number, default: 40 },   // Hz
      baseline_removed: { type: Boolean, default: true },
    },
    r_peak_count: { type: Number, required: true },
    epoch_count: { type: Number, required: true }, // 10초 epoch 개수
    sqi_score: { type: Number, required: true, min: 0, max: 1 },
    processing_time_ms: { type: Number, required: true },
    status: { type: String, enum: PREPROCESS_STATUS, required: true },
    error_msg: { type: String, maxlength: 1000 },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'preprocessing_logs' }
);

preprocessingLogSchema.index({ measurement_id: 1 }, { unique: true });
preprocessingLogSchema.index({ status: 1, created_at: -1 });

module.exports = mongoose.model('PreprocessingLog', preprocessingLogSchema);
