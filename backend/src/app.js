// backend/src/app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.set('trust proxy', true);

app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:5173'],
  credentials: true,
}));

app.use(express.json({ limit: '2mb' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/guardians', require('./routes/guardian.routes'));
app.use('/api/measurements', require('./routes/measurement.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/internal', require('./routes/internal.routes'));

// 헬스체크 (docker-compose / 로드밸런서용)
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

module.exports = app;
