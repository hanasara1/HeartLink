const {
  User, GuardianRelation, AnalysisResult, Notification,
} = require('../models');
const { sendFCM } = require('../services/notification.service');

/**
 * 주간 요약 리포트 (FR-18)
 * 매주 일요일, 각 사용자의 지난 7일 측정/위험도 추이를 집계하여
 * 본인 및 보호자에게 요약 발송. LOW 단계 알림이 누적된 사용자 대상.
 */
const processWeeklySummary = async () => {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const users = await User.find({ role: 'user' });
    console.log(`[JOB:weekly] ${users.length}명 대상 주간 요약 생성`);

    for (const user of users) {
      const analyses = await AnalysisResult.find({
        user_id: user._id,
        analyzed_at: { $gte: since },
      }).sort({ analyzed_at: 1 });

      if (analyses.length === 0) continue; // 측정 없으면 건너뜀

      // 주간 통계 집계
      const total = analyses.length;
      const high = analyses.filter((a) => a.risk_level === 'HIGH').length;
      const mid = analyses.filter((a) => a.risk_level === 'MID').length;
      const avgRisk = Math.round(
        analyses.reduce((s, a) => s + a.risk_score, 0) / total
      );
      const avgRmssd = average(analyses.map((a) => a.hrv?.rmssd).filter(Boolean));

      const summary =
        `[주간 요약] ${user.name}님: 지난 주 ${total}회 측정, ` +
        `평균 위험도 ${avgRisk}점, 주의 ${mid}회/긴급 ${high}회. ` +
        (avgRmssd ? `평균 HRV(RMSSD) ${avgRmssd.toFixed(0)}ms.` : '');

      // 본인에게 발송
      if (user.fcm_token) {
        await safeSend(user, summary);
      }

      // 주간 요약 수신 권한(low)이 켜진 보호자에게 발송
      const relations = await GuardianRelation.find({
        user_id: user._id,
        status: 'ACTIVE',
        'alert_permission.low': true,
      }).populate('guardian_id');

      for (const rel of relations) {
        await safeSend(rel.guardian_id, summary);
      }
    }
    console.log('[JOB:weekly] 주간 요약 발송 완료');
  } catch (err) {
    console.error('[JOB:weekly] 오류:', err.message);
  }
};

const average = (arr) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);

const safeSend = async (recipient, message) => {
  if (!recipient || !recipient.fcm_token) return;
  try {
    await sendFCM(recipient.fcm_token, message.slice(0, 60));
  } catch (err) {
    console.error(`[JOB:weekly] 발송 실패(${recipient._id}):`, err.message);
  }
};

module.exports = { processWeeklySummary };
