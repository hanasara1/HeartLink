const { Notification, User } = require('../models');
const { sendFCM, sendSMS } = require('../services/notification.service');

const MAX_RETRY = 1; // FR-12: 1회 재시도

/**
 * 실패 알림 재시도 + 백업 채널(SMS) 대체 (FR-12)
 * setTimeout 기반 재시도를 보강/대체하는 안정적 큐 처리.
 * 조건: delivery_status FAILED, retry_count < MAX_RETRY
 * (notifications 인덱스 { delivery_status:1, retry_count:1 } 활용)
 */
const processRetryQueue = async () => {
  try {
    const targets = await Notification.find({
      delivery_status: 'FAILED',
      retry_count: { $lt: MAX_RETRY },
    }).limit(100); // 한 번에 처리량 제한

    if (targets.length === 0) return;
    console.log(`[JOB:retry] ${targets.length}건 재시도`);

    for (const noti of targets) {
      const recipient = await User.findById(noti.recipient_id);
      if (!recipient) continue;

      noti.retry_count += 1;
      noti.delivery_status = 'RETRYING';
      await noti.save();

      try {
        if (noti.channel === 'FCM') {
          if (!recipient.fcm_token) throw new Error('FCM 토큰 없음');
          await sendFCM(recipient.fcm_token, noti.message);
        } else {
          await sendSMS(recipient.phone, noti.message);
        }
        noti.delivery_status = 'SUCCESS';
        noti.sent_at = new Date();
      } catch (err) {
        // 재시도 실패 → SMS 백업 채널 대체 발송
        if (noti.channel !== 'SMS' && recipient.phone) {
          try {
            await sendSMS(recipient.phone, noti.message);
            noti.delivery_status = 'SUCCESS';
            noti.channel = 'SMS';
            noti.sent_at = new Date();
          } catch (e) {
            noti.delivery_status = 'FAILED';
            noti.error_msg = `재시도+백업 실패: ${e.message}`;
          }
        } else {
          noti.delivery_status = 'FAILED';
          noti.error_msg = err.message;
        }
      }
      await noti.save();
    }
  } catch (err) {
    console.error('[JOB:retry] 오류:', err.message);
  }
};

module.exports = { processRetryQueue };
