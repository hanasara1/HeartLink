const { fcm, twilioClient, TWILIO_FROM } = require('../config/notification');
const {
  User, GuardianRelation, Notification, Report, SystemLog,
} = require('../models');

const RETRY_DELAY_MS = 5 * 60 * 1000; // FR-12: 5분 후 재시도

/**
 * FCM 푸시 발송
 */
const sendFCM = async (fcmToken, message) => {
  return fcm.send({
    token: fcmToken,
    notification: { title: 'HeartLink 알림', body: message },
  });
};

/**
 * Twilio SMS 발송
 */
const sendSMS = async (phone, message) => {
  return twilioClient.messages.create({ from: TWILIO_FROM, to: phone, body: message });
};

/**
 * 단일 알림 발송 + 결과 기록 + 실패 시 재시도/백업 (UC-15, FR-11/12)
 */
const dispatchOne = async ({ reportId, userId, recipient, riskLevel, channel, message }) => {
  const noti = await Notification.create({
    report_id: reportId,
    user_id: userId,
    recipient_id: recipient._id,
    recipient_role: recipient.role,
    risk_level: riskLevel,
    channel,
    message: message.slice(0, 60), // 60자 제한
    delivery_status: 'PENDING',
  });

  try {
    if (channel === 'FCM') {
      if (!recipient.fcm_token) throw new Error('FCM 토큰 없음');
      await sendFCM(recipient.fcm_token, message);
    } else {
      await sendSMS(recipient.phone, message);
    }
    noti.delivery_status = 'SUCCESS';
    noti.sent_at = new Date();
    await noti.save();
    return { success: true, channel };
  } catch (err) {
    noti.delivery_status = 'FAILED';
    noti.error_msg = err.message;
    await noti.save();
    console.error(`[Notification] ${channel} 발송 실패:`, err.message);

    // 5분 후 1회 재시도 → 실패 시 SMS 백업 (FR-12, UC-15)
    scheduleRetry(noti._id, recipient, message);
    return { success: false, channel, error: err.message };
  }
};

/**
 * 재시도 스케줄 (PoC: setTimeout / 운영: 큐 권장)
 */
const scheduleRetry = (notiId, recipient, message) => {
  setTimeout(async () => {
    const noti = await Notification.findById(notiId);
    if (!noti || noti.delivery_status === 'SUCCESS') return;
    if (noti.retry_count >= 1) {
      // 재시도도 실패 → SMS 백업 채널 대체 발송
      if (noti.channel !== 'SMS' && recipient.phone) {
        try {
          await sendSMS(recipient.phone, message);
          noti.delivery_status = 'SUCCESS';
          noti.channel = 'SMS';
          noti.sent_at = new Date();
        } catch (e) {
          noti.error_msg = `백업 SMS 실패: ${e.message}`;
        }
      }
      await noti.save();
      return;
    }
    // 재시도
    noti.retry_count += 1;
    noti.delivery_status = 'RETRYING';
    await noti.save();
    try {
      if (noti.channel === 'FCM') await sendFCM(recipient.fcm_token, message);
      else await sendSMS(recipient.phone, message);
      noti.delivery_status = 'SUCCESS';
      noti.sent_at = new Date();
    } catch (e) {
      noti.delivery_status = 'FAILED';
      noti.error_msg = e.message;
    }
    await noti.save();
  }, RETRY_DELAY_MS);
};

/**
 * 위험도 단계별 알림 분기 발송 (UC-15, FR-11)
 * - 상(HIGH): 본인 + 보호자 전원 → FCM + SMS 즉시
 * - 중(MID): 보호자 → FCM 푸시
 * - 하(LOW): 발송 안 함 (주간 요약에 누적 — FR-18)
 */
const notifyByRisk = async (reportId) => {
  const report = await Report.findById(reportId);
  if (!report) throw new Error('report not found');

  const { user_id, risk_level } = report;
  const user = await User.findById(user_id);
  const message = report.guardian_report?.summary
    || `${user.name}님의 측정 결과 확인이 필요합니다.`;

  if (risk_level === 'LOW') {
    // 하 단계는 즉시 발송하지 않고 주간 요약에 누적 (FR-18)
    return { skipped: true, reason: 'LOW → 주간 요약 누적' };
  }

  // 권한이 ACTIVE인 보호자 중, 해당 위험도 수신을 허용한 사람만
  const permKey = risk_level === 'HIGH' ? 'high' : 'mid';
  const relations = await GuardianRelation.find({
    user_id,
    status: 'ACTIVE',
    [`alert_permission.${permKey}`]: true,
  }).populate('guardian_id');

  const results = [];

  if (risk_level === 'HIGH') {
    // 본인에게도 발송 (FCM + SMS)
    results.push(await dispatchOne({ reportId, userId: user_id, recipient: user, riskLevel: risk_level, channel: 'FCM', message }));
    results.push(await dispatchOne({ reportId, userId: user_id, recipient: user, riskLevel: risk_level, channel: 'SMS', message }));
    // 보호자 전원 FCM + SMS
    for (const rel of relations) {
      const g = rel.guardian_id;
      results.push(await dispatchOne({ reportId, userId: user_id, recipient: g, riskLevel: risk_level, channel: 'FCM', message }));
      results.push(await dispatchOne({ reportId, userId: user_id, recipient: g, riskLevel: risk_level, channel: 'SMS', message }));
    }
  } else {
    // MID: 보호자에게 FCM 푸시만
    const midMessage = `${message} (24시간 내 확인 권장)`;
    for (const rel of relations) {
      results.push(await dispatchOne({ reportId, userId: user_id, recipient: rel.guardian_id, riskLevel: risk_level, channel: 'FCM', message: midMessage }));
    }
  }

  return { risk_level, dispatched: results.length, results };
};

module.exports = { notifyByRisk, dispatchOne, sendFCM, sendSMS };
