const {
  GuardianRelation, User, Measurement, AnalysisResult, Report, Notification,
} = require('../models');
const { writeAccessLog } = require('../services/accessLog.service');

// 위험도 → 카드 색상 매핑 (FR-15: 적색/황색/녹색)
const RISK_COLOR = { HIGH: 'red', MID: 'yellow', LOW: 'green' };

/**
 * 보호자 대시보드 - 연계 사용자 카드 목록 (UC-09, FR-15)
 * GET /api/dashboard/guardian
 * 인증: role=guardian
 *
 * 각 카드: 사용자명, 최근 측정 시각, 현재 위험도(+색상), 미확인 알림 수
 */
const getGuardianDashboard = async (req, res, next) => {
  try {
    const guardianId = req.user.id;

    // ACTIVE 연계 사용자만 조회 (해제/대기 제외)
    const relations = await GuardianRelation.find({
      guardian_id: guardianId,
      status: 'ACTIVE',
    }).populate('user_id', 'name email');

    if (relations.length === 0) {
      return res.status(200).json({ count: 0, cards: [] });
    }

    const cards = await Promise.all(
      relations.map(async (rel) => {
        const user = rel.user_id;
        if (!user) return null; // 연계 사용자 탈퇴 등

        // 최근 분석 결과 1건 (현재 위험도)
        const latest = await AnalysisResult.findOne({ user_id: user._id })
          .sort({ analyzed_at: -1 })
          .select('risk_level risk_score analyzed_at af_detected');

        // 이 보호자에게 온 미확인 알림 수 (read_at 없음)
        const unreadCount = await Notification.countDocuments({
          user_id: user._id,
          recipient_id: guardianId,
          read_at: { $exists: false },
        });

        const riskLevel = latest?.risk_level || null;

        return {
          relation_id: rel._id,
          user: { id: user._id, name: user.name },
          relation_type: rel.relation_type,
          latest_measured_at: latest?.analyzed_at || null,
          risk_level: riskLevel,
          risk_score: latest?.risk_score ?? null,
          card_color: riskLevel ? RISK_COLOR[riskLevel] : 'gray', // 측정 전이면 회색
          unread_notifications: unreadCount,
        };
      })
    );

    const validCards = cards.filter(Boolean);
    // 위험도 높은 순으로 정렬 (HIGH 카드가 위로)
    const order = { HIGH: 0, MID: 1, LOW: 2 };
    validCards.sort(
      (a, b) => (order[a.risk_level] ?? 3) - (order[b.risk_level] ?? 3)
    );

    return res.status(200).json({ count: validCards.length, cards: validCards });
  } catch (err) {
    return next(err);
  }
};

/**
 * 보호자 대시보드 - 특정 사용자 상세 (UC-09)
 * GET /api/dashboard/guardian/users/:userId
 * 인증: role=guardian + 연계 검증
 *
 * 상세: 프로필(권한 범위 내), 측정 이력, 위험도 추이, 리포트 목록
 */
const getLinkedUserDetail = async (req, res, next) => {
  try {
    const guardianId = req.user.id;
    const { userId } = req.params;

    // 연계(ACTIVE) 검증 — 권한 없는 사용자 접근 차단
    const linked = await GuardianRelation.findOne({
      user_id: userId,
      guardian_id: guardianId,
      status: 'ACTIVE',
    });
    if (!linked) {
      return res.status(403).json({ message: '해당 사용자의 정보 조회 권한이 없습니다.' });
    }

    const user = await User.findById(userId).select('name email profile');
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' });
    }

    // 측정 이력 (최근 20건)
    const measurements = await Measurement.find({ user_id: userId })
      .sort({ measured_at: -1 })
      .limit(20)
      .select('signal_type device_type measured_at status');

    // 위험도 추이 (최근 30일)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trend = await AnalysisResult.find({
      user_id: userId,
      analyzed_at: { $gte: since },
    })
      .sort({ analyzed_at: 1 })
      .select('risk_score risk_level af_detected analyzed_at');

    // 리포트 목록 (최근 10건)
    const reports = await Report.find({ user_id: userId })
      .populate({ path: 'analysis_id', select: 'risk_level risk_score' })
      .sort({ generated_at: -1 })
      .limit(10)
      .lean();

    // 권한 범위 내 프로필만 노출 (민감정보 마스킹 — UC-09 기타 요구사항)
    // 보호자에게는 기저질환/복용약 등 상세 의료정보는 마스킹하고 요약만 제공
    const maskedProfile = {
      age: user.profile?.age ?? null,
      gender: user.profile?.gender ?? null,
      has_chronic_disease: (user.profile?.diseases?.length || 0) > 0,
    };

    await writeAccessLog({
      userId: guardianId,
      actionType: 'VIEW_REPORT',
      req,
      targetResource: `dashboard:user:${userId}`,
    });

    return res.status(200).json({
      user: { id: user._id, name: user.name, profile: maskedProfile },
      relation_type: linked.relation_type,
      measurements,
      risk_trend: trend.map((t) => ({
        date: t.analyzed_at,
        risk_score: t.risk_score,
        risk_level: t.risk_level,
        af_detected: t.af_detected,
      })),
      reports: reports.map((r) => ({
        id: r._id,
        risk_level: r.analysis_id?.risk_level,
        risk_score: r.analysis_id?.risk_score,
        summary: r.guardian_report?.summary,
        generated_at: r.generated_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 사용자 본인 대시보드 (UC-06 보조 - 본인 상태 요약)
 * GET /api/dashboard/user
 * 인증: role=user
 */
const getUserDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const latest = await AnalysisResult.findOne({ user_id: userId })
      .sort({ analyzed_at: -1 })
      .select('risk_level risk_score af_detected hrv analyzed_at');

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const trend = await AnalysisResult.find({
      user_id: userId,
      analyzed_at: { $gte: since },
    })
      .sort({ analyzed_at: 1 })
      .select('risk_score analyzed_at hrv');

    const measurementCount = await Measurement.countDocuments({ user_id: userId });

    return res.status(200).json({
      latest: latest
        ? {
            risk_level: latest.risk_level,
            risk_score: latest.risk_score,
            card_color: RISK_COLOR[latest.risk_level],
            af_detected: latest.af_detected,
            hrv: latest.hrv,
            analyzed_at: latest.analyzed_at,
          }
        : null,
      total_measurements: measurementCount,
      risk_trend: trend.map((t) => ({
        date: t.analyzed_at,
        risk_score: t.risk_score,
        rmssd: t.hrv?.rmssd ?? null,
        sdnn: t.hrv?.sdnn ?? null,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = { getGuardianDashboard, getLinkedUserDetail, getUserDashboard };
