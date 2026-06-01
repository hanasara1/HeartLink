// backend/src/server.js
require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { syncAllIndexes } = require('./config/syncIndexes');
const { startSchedulers } = require('./jobs/scheduler'); // ★ import 추가

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();
  await syncAllIndexes();
  startSchedulers(); // 주간 요약 / 지연 알림 / 재시도 큐 (FR-12, FR-18)

  app.listen(PORT, () => {
    console.log(`[SERVER] HeartLink backend running on port ${PORT}`);
  });
};

start();
