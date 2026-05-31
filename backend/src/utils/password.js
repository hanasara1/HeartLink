const bcrypt = require('bcrypt');

const BCRYPT_COST = 10; // NFR-05: cost factor 10

const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_COST);
const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// FR-01: 비밀번호 8자 이상 / 이메일 형식 검증
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => typeof email === 'string' && EMAIL_REGEX.test(email);
const isValidPassword = (pw) => typeof pw === 'string' && pw.length >= 8;

module.exports = { hashPassword, comparePassword, isValidEmail, isValidPassword };
