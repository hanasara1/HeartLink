// backend/src/app.js
const express = require('express');
const app = express();

app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/guardians', require('./routes/guardian.routes'));
app.use('/api/measurements', require('./routes/measurement.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/notifications', require('./routes/notification.routes'));
app.use('/api/reports', require('./routes/report.routes'));     // ★ 추가
app.use('/api/internal', require('./routes/internal.routes'));  // ★ 추가

// 전역 에러 핸들러
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ message: '서버 오류가 발생했습니다.' });
});

module.exports = app;
