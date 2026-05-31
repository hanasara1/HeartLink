const cron = require('node-cron');
const { processWeeklySummary } = require('./weeklySummary.job');
const { processDeferredNotifications } = require('./deferredNotification.job');
const { processRetryQueue } = require('./retryQueue.job');

/**
 * 스케줄러 등록 (server.js 부팅 시 1회 호출)
 * 시간대는 Asia/Seoul 기준
 */
const startSchedulers = () => {
  const tz = 'Asia/Seoul';

  // 1) 야간 지연 알림 발송 — 매일 오전 8시 (UC-15)
  //    22:00~07:00 동안 미뤄둔 MID 알림을 익일 오전 8시에 발송
  cron.schedule('0 8 * * *', processDeferredNotifications, { timezone: tz });

  // 2) 주간 요약 리포트 — 매주 일요일 오전 9시 (FR-18)
  cron.schedule('0 9 * * 0', processWeeklySummary, { timezone: tz });

  // 3) 알림 재시도 큐 처리 — 5분마다 (FR-12)
  //    FAILED 상태이고 재시도 여지가 있는 알림을 재발송
  cron.schedule('*/5 * * * *', processRetryQueue, { timezone: tz });

  console.log('[SCHEDULER] 스케줄러 등록 완료 (야간발송/주간요약/재시도)');
};

module.exports = { startSchedulers };
