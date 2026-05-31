const mongoose = require('mongoose');
const { USER_ROLES, GENDERS } = require('./constants');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true }, // bcrypt 해시
    name: { type: String, required: true, maxlength: 50 },
    phone: { type: String, required: true }, // CSFLE 대상 (민감정보)
    role: { type: String, enum: USER_ROLES, required: true },
    profile: {
      age: { type: Number, min: 0, max: 120 },
      gender: { type: String, enum: GENDERS },
      height: { type: Number }, // cm
      weight: { type: Number }, // kg
      diseases: [{ type: String }], // 기저질환 배열 (CSFLE 대상)
      medications: [{ type: String }], // 복용약 배열 (CSFLE 대상)
    },
    fcm_token: { type: String },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },

    // user.model.js 의 스키마 정의에 추가
    login_attempts: { type: Number, default: 0 }, // 연속 로그인 실패 횟수
    lock_until: { type: Date },                    // 계정 잠금 해제 시각

  },
  { collection: 'users' }
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });

module.exports = mongoose.model('User', userSchema);
