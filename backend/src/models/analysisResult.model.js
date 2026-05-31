const mongoose = require('mongoose');
const { ARRHYTHMIA_CLASSES, RISK_LEVELS } = require('./constants');

const analysisResultSchema = new mongoose.Schema(
  {
    measurement_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Measurement',
      required: true,
      unique: true,
    },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    arrhythmia_class: { type: String, enum: ARRHYTHMIA_CLASSES, required: true }, // AAMI EC57 5종
    arrhythmia_prob: {
      N: { type: Number, min: 0, max: 1 },    // Normal
      SVEB: { type: Number, min: 0, max: 1 }, // 상심실성 이소성
      VEB: { type: Number, min: 0, max: 1 },  // 심실성 이소성
      F: { type: Number, min: 0, max: 1 },    // 융합
      Q: { type: Number, min: 0, max: 1 },    // 미분류
    },
    af_detected: { type: Boolean, required: true }, // 심방세동 여부
    af_prob: { type: Number, required: true, min: 0, max: 1 },
    hrv: {
      rmssd: { type: Number }, // ms
      sdnn: { type: Number },  // ms
      lf_hf: { type: Number }, // LF/HF ratio
    },
    anomaly_score: { type: Number }, // Isolation Forest score
    risk_score: { type: Number, required: true, min: 0, max: 100 },
    risk_level: { type: String, enum: RISK_LEVELS, required: true },
    model_version: { type: String, required: true, maxlength: 30 }, // 예: "v1.2.0"
    evidence: {
      top_features: [{ name: String, importance: Number }],
      notes: String,
    },
    analyzed_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'analysis_results' }
);

analysisResultSchema.index({ measurement_id: 1 }, { unique: true });
analysisResultSchema.index({ user_id: 1, analyzed_at: -1 });
analysisResultSchema.index({ risk_level: 1, analyzed_at: -1 });

module.exports = mongoose.model('AnalysisResult', analysisResultSchema);
