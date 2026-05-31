const { verifyAccessToken } = require('../config/jwt');

/**
 * JWT 인증 미들웨어
 * - Authorization: Bearer <token> 헤더 검증
 * - 성공 시 req.user = { id, role } 주입
 */
const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ message: '인증 토큰이 필요합니다.' });
  }

  try {
    const decoded = verifyAccessToken(token);
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: '토큰이 만료되었습니다.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ message: '유효하지 않은 토큰입니다.' });
  }
};

/**
 * 역할 기반 접근 제어 (RBAC)
 * 예: router.get('/admin', authenticate, authorize('admin'))
 * 사용자/보호자: authorize('user'), authorize('guardian')
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: '인증이 필요합니다.' });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: '접근 권한이 없습니다.' });
  }
  return next();
};

module.exports = { authenticate, authorize };
