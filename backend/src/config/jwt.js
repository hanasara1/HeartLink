const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_EXPIRES = '24h'; // NFR-05: Access 토큰 24시간
const REFRESH_EXPIRES = '7d'; // NFR-05: Refresh 토큰 7일

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error('[CONFIG] JWT_SECRET / JWT_REFRESH_SECRET 환경변수가 필요합니다.');
}

const signAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });

const signRefreshToken = (payload) =>
  jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES });

const verifyAccessToken = (token) => jwt.verify(token, JWT_SECRET);
const verifyRefreshToken = (token) => jwt.verify(token, JWT_REFRESH_SECRET);

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  ACCESS_EXPIRES,
  REFRESH_EXPIRES,
};
