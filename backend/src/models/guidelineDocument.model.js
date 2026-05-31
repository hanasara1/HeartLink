const mongoose = require('mongoose');
const { GUIDELINE_SOURCES, LANGUAGES } = require('./constants');

const guidelineDocumentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 255 },
    source: { type: String, enum: GUIDELINE_SOURCES, required: true }, // KSC / ESC / OTHER
    version: { type: String, required: true, maxlength: 20 },
    section: { type: String, required: true, maxlength: 100 }, // 예: "AF Management 4.2"
    content: { type: String, required: true }, // 본문 텍스트
    embedding_vector_id: { type: String, required: true, unique: true, maxlength: 100 }, // FAISS 인덱스 ID
    language: { type: String, enum: LANGUAGES, required: true }, // KO / EN
    published_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { collection: 'guideline_documents' }
);

guidelineDocumentSchema.index({ source: 1, version: 1 });
guidelineDocumentSchema.index({ embedding_vector_id: 1 }, { unique: true });

module.exports = mongoose.model('GuidelineDocument', guidelineDocumentSchema);
