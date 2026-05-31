const mongoose = require('mongoose');
const { ADMIN_ROLES } = require('./constants');

const adminSchema = new mongoose.Schema(
  {
    admin_email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password_hash: { type: String, required: true }, // bcrypt 해시
    name: { type: String, required: true, maxlength: 50 },
    role: { type: String, enum: ADMIN_ROLES, required: true }, // super / operator
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { collection: 'admins' }
);

adminSchema.index({ admin_email: 1 }, { unique: true });

module.exports = mongoose.model('Admin', adminSchema);
