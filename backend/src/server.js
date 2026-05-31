require('dotenv').config();
const app = require('./app');
const { connectDB } = require('./config/db');
const { syncAllIndexes } = require('./config/syncIndexes');

const PORT = process.env.PORT || 4000;

const start = async () => {
  await connectDB();
  await syncAllIndexes(); // 스키마 인덱스를 실제 컬렉션에 반영
  await startSchedulers();

  app.listen(PORT, () => {
    console.log(`[SERVER] HeartLink backend running on port ${PORT}`);
  });

  app.use('/api/reports', require('./routes/report.routes'));
};

start();
