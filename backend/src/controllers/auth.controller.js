const { User } = require('../models');
const {
  hashPassword, comparePassword, isValidEmail, isValidPassword,
} = require('../utils/password');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../config/jwt');
const { writeAccessLog } = require('../services/accessLog.service');
const { USER_ROLES } = require('../models/constants');

const MAX_LOGIN_ATTEMPTS = 5;        // FR-01: 5회 실패 시 잠금
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10분

/**
 * 회원가입 (UC-01 사용자 / UC-08 보호자)
 * POST /api/auth/register
 * body: { email, password, name, phone, role }
 */
const register = async (req, res, next) => {
  try {
    const { email, password, name, phone, role } = req.body;

    // 입력값 유효성 검증 (FR-01)
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: '유효한 이메일 형식이 아닙니다.' });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({ message: '비밀번호는 8자 이상이어야 합니다.' });
    }
    if (!name || !phone) {
      return res.status(400).json({ message: '이름과 연락처는 필수입니다.' });
    }
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: '역할은 user 또는 guardian 이어야 합니다.' });
    }

    // 이메일 중복 검사
    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) {
      return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
    }

    // 비밀번호 해시 후 저장
    const password_hash = await hashPassword(password);
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash,
      name,
      phone,
      role,
    });

    return res.status(201).json({
      message: '회원가입이 완료되었습니다.',
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 로그인 (UC-01, UC-08)
 * POST /api/auth/login
 * body: { email, password }
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: '이메일과 비밀번호를 입력하세요.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    // 사용자 존재 여부를 노출하지 않도록 동일 메시지 사용
    if (!user) {
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 계정 잠금 확인 (FR-01)
    if (user.lock_until && user.lock_until > new Date()) {
      const remainSec = Math.ceil((user.lock_until - new Date()) / 1000);
      return res.status(423).json({
        message: `로그인 시도가 너무 많습니다. 약 ${remainSec}초 후 다시 시도하세요.`,
        code: 'ACCOUNT_LOCKED',
      });
    }

    // 비밀번호 검증
    const match = await comparePassword(password, user.password_hash);
    if (!match) {
      user.login_attempts = (user.login_attempts || 0) + 1;
      if (user.login_attempts >= MAX_LOGIN_ATTEMPTS) {
        user.lock_until = new Date(Date.now() + LOCK_DURATION_MS);
        user.login_attempts = 0; // 잠금 후 카운트 초기화
      }
      await user.save();
      return res.status(401).json({ message: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 성공 → 실패 카운트/잠금 초기화
    user.login_attempts = 0;
    user.lock_until = undefined;
    await user.save();

    // JWT 발급 (sub=사용자ID, role 포함)
    const payload = { sub: user._id.toString(), role: user.role };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // 접근 이력 기록 (사후조건)
    await writeAccessLog({ userId: user._id, actionType: 'LOGIN', req });

    return res.status(200).json({
      message: '로그인 성공',
      accessToken,
      refreshToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Access 토큰 재발급
 * POST /api/auth/refresh
 * body: { refreshToken }
 */
const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ message: 'refreshToken 이 필요합니다.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const payload = { sub: decoded.sub, role: decoded.role };
    const accessToken = signAccessToken(payload);

    return res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: '유효하지 않은 refresh 토큰입니다.' });
  }
};

/**
 * 로그아웃 (접근 이력 기록)
 * POST /api/auth/logout  (인증 필요)
 */
const logout = async (req, res, next) => {
  try {
    await writeAccessLog({ userId: req.user.id, actionType: 'LOGOUT', req });
    // ※ 토큰 블랙리스트(NFR-05)는 Redis 등 별도 저장소에서 처리 권장
    return res.status(200).json({ message: '로그아웃 되었습니다.' });
  } catch (err) {
    return next(err);
  }
};

module.exports = { register, login, refresh, logout };
