const {
  Report, AnalysisResult, User, GuardianRelation,
} = require('../models');
const { generateReportPDF } = require('../services/pdf.service');
const { writeAccessLog } = require('../services/accessLog.service');

/**
 * 본인용 리포트 목록 (UC-05)
 * GET /api/reports
 * 인증: role=user
 */
const listMyReports = async (req, res, next) => {
  try {
    const { risk_level, from, to } = req.query; // FR-17: 필터링
    const filter = { user_id: req.user.id };

    const reports = await Report.find(filter)
      .populate({ path: 'analysis_id', select: 'risk_level risk_score analyzed_at' })
      .sort({ generated_at: -1 })
      .lean();

    // 위험도/기간 필터 (populate 이후 적용)
    let result = reports;
    if (risk_level) {
      result = result.filter((r) => r.analysis_id?.risk_level === risk_level);
    }
    if (from || to) {
      result = result.filter((r) => {
        const t = new Date(r.generated_at).getTime();
        if (from && t < new Date(from).getTime()) return false;
        if (to && t > new Date(to).getTime()) return false;
        return true;
      });
    }

    return res.status(200).json({
      count: result.length,
      reports: result.map((r) => ({
        id: r._id,
        risk_level: r.analysis_id?.risk_level,
        risk_score: r.analysis_id?.risk_score,
        summary: r.user_report?.summary,
        generated_at: r.generated_at,
      })),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 본인용 리포트 상세 조회 (UC-05)
 * GET /api/reports/:id
 */
const getMyReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, user_id: req.user.id })
      .populate('analysis_id');
    if (!report) {
      return res.status(404).json({ message: '리포트를 찾을 수 없습니다.' });
    }

    await writeAccessLog({
      userId: req.user.id, actionType: 'VIEW_REPORT', req, targetResource: report._id.toString(),
    });

    return res.status(200).json({
      id: report._id,
      user_report: report.user_report, // 본인용 (친절체)
      analysis: report.analysis_id,
      disclaimer: report.disclaimer,
      generated_at: report.generated_at,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 보호자용 리포트 상세 조회 (UC-11)
 * GET /api/reports/:id/guardian
 * 인증: role=guardian + 연계 검증
 */
const getGuardianReport = async (req, res, next) => {
  try {
    const guardianId = req.user.id;
    const report = await Report.findById(req.params.id).populate('analysis_id');
    if (!report) {
      return res.status(404).json({ message: '리포트를 찾을 수 없습니다.' });
    }

    // 연계(ACTIVE) 검증 — 권한 없는 사용자 정보 접근 차단
    const linked = await GuardianRelation.findOne({
      user_id: report.user_id,
      guardian_id: guardianId,
      status: 'ACTIVE',
    });
    if (!linked) {
      return res.status(403).json({ message: '해당 사용자의 리포트 조회 권한이 없습니다.' });
    }

    await writeAccessLog({
      userId: guardianId, actionType: 'VIEW_REPORT', req, targetResource: report._id.toString(),
    });

    return res.status(200).json({
      id: report._id,
      guardian_report: report.guardian_report, // 보호자용 (의사결정 중심)
      analysis: report.analysis_id,
      disclaimer: report.disclaimer,
      generated_at: report.generated_at,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * 리포트 PDF 다운로드 (UC-07, FR-16)
 * GET /api/reports/:id/pdf
 * 본인 또는 연계된 보호자만 가능
 */
const downloadPDF = async (req, res, next) => {
  try {
    const requesterId = req.user.id;
    const report = await Report.findById(req.params.id).populate('analysis_id');
    if (!report) {
      return res.status(404).json({ message: '리포트를 찾을 수 없습니다.' });
    }

    // 권한 검증: 본인이거나 ACTIVE 연계 보호자
    const isOwner = report.user_id.toString() === requesterId;
    let allowed = isOwner;
    if (!isOwner) {
      const linked = await GuardianRelation.findOne({
        user_id: report.user_id,
        guardian_id: requesterId,
        status: 'ACTIVE',
      });
      allowed = !!linked;
    }
    if (!allowed) {
      return res.status(403).json({ message: 'PDF 다운로드 권한이 없습니다.' });
    }

    const user = await User.findById(report.user_id);
    const pdfBuffer = await generateReportPDF({
      report, user, analysis: report.analysis_id,
    });

    await writeAccessLog({
      userId: requesterId, actionType: 'DOWNLOAD_PDF', req, targetResource: report._id.toString(),
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="heartlink_report_${report._id}.pdf"`
    );
    return res.send(pdfBuffer);
  } catch (err) {
    return next(err);
  }
};

module.exports = { listMyReports, getMyReport, getGuardianReport, downloadPDF };
