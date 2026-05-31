const mongoose = require('mongoose');

/**
 * MongoDB 연결 설정
 * - MONGO_URI 환경변수를 사용 (docker-compose에서 주입)
 * - 연결 실패 시 재시도, 연결 이벤트 로깅 포함
 */

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

// Mongoose 7+ 부터는 strictQuery 기본값 명시 권장
mongoose.set('strictQuery', true);

const connectDB = async (retries = 5, delayMs = 5000) => {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 10000, // 서버 선택 타임아웃 10초
        maxPoolSize: 20,                 // 커넥션 풀 최대 20
        minPoolSize: 5,
      });
      console.log(`[DB] MongoDB 연결 성공 (시도 ${attempt}/${retries})`);
      return mongoose.connection;
    } catch (err) {
      console.error(`[DB] 연결 실패 (시도 ${attempt}/${retries}):`, err.message);
      if (attempt === retries) {
        console.error('[DB] 최대 재시도 횟수 초과. 프로세스를 종료합니다.');
        process.exit(1);
      }
      // 컨테이너 기동 순서로 인한 일시적 실패 대비 → 재시도
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return null;
};

// 연결 상태 이벤트 로깅
mongoose.connection.on('connected', () => {
  console.log('[DB] Mongoose connected');
});
mongoose.connection.on('error', (err) => {
  console.error('[DB] Mongoose connection error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('[DB] Mongoose disconnected');
});

// 프로세스 종료 시 graceful shutdown
const gracefulExit = async (signal) => {
  console.log(`[DB] ${signal} 수신 → 연결을 정리합니다.`);
  await mongoose.connection.close();
  process.exit(0);
};
process.on('SIGINT', () => gracefulExit('SIGINT'));
process.on('SIGTERM', () => gracefulExit('SIGTERM'));

module.exports = { connectDB, MONGO_URI };
