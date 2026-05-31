const mongoose = require('mongoose');
const { DISCLAIMER_DEFAULT } = require('./constants');

const reportSchema = new mongoose.Schema(
  {
    analysis_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AnalysisResult',
      required: true,
      unique: true,
    },
    measurement_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Measurement', required: true },
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    user_report: {
      summary: { type: String, required: true },   // 친절체 요약
      guide: { type: String, required: true },      // 행동 가이드
      full_text: { type: String, required: true },  // 상세 본문
    },
    guardian_report: {
      summary: { type: String, required: true },            // 위험도 요약
      recommended_action: { type: String, required: true }, // 권장 조치
      urgency_note: { type: String },                       // 응급 시 안내
    },
    rag_sources: [
      {
        guideline_id: { type: mongoose.Schema.Types.ObjectId, ref: 'GuidelineDocument' },
        section: { type: String },
        relevance: { type: Number, min: 0, max: 1 },
      },
    ],
    llm_model: { type: String, required: true, default: 'gpt-4o-mini', maxlength: 50 },
    pdf_url: { type: String }, // S3 PDF 객체 URL
    disclaimer: { type: String, required: true, default: DISCLAIMER_DEFAULT, maxlength: 500 },
    generated_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'reports' }
);

reportSchema.index({ analysis_id: 1 }, { unique: true });
reportSchema.index({ user_id: 1, generated_at: -1 });

module.exports = mongoose.model('Report', reportSchema);
