const { Notification, User } = require('../models');
const { sendFCM, sendSMS } = require('../services/notification.service');

/**
 * 야간(22:00~07:00)에 미뤄둔 MID 알림을 익일 오전 8시에 발송 (UC-15)
 * delivery_status === 'DEFERRED' 인 알림 대상
 */
const processDeferredNotifications = async () => {
  try {
    const deferred = await Notification.find({ delivery_status: 'DEFERRED' });
    if (deferred.length === 0) {
      console.log('[JOB:deferred] 미뤄둔 알림 없음');
      return;
    }
    console.log(`[JOB:deferred] ${deferred.length}건 발송 시작`);

    for (const noti of deferred) {
      const recipient = await User.findById(noti.recipient_id);
      if (!recipient) {
        noti.delivery_status = 'FAILED';
        noti.error_msg = '수신자 없음';
        await noti.save();
        continue;
      }
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
        noti.delivery_status = 'FAILED';
        noti.error_msg = err.message;
      }
      await noti.save();
    }
    console.log('[JOB:deferred] 발송 완료');
  } catch (err) {
    console.error('[JOB:deferred] 오류:', err.message);
  }
};

module.exports = { processDeferredNotifications };
