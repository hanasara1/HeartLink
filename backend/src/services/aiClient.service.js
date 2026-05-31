const axios = require('axios');
const { Measurement, SystemLog } = require('../models');

const AI_SERVER_URL = process.env.AI_SERVER_URL || 'http://ai-server:8000';

/**
 * AI 서버에 분석 요청 (UC-12~14 트리거)
 * - 비동기 호출: 업로드 응답을 막지 않도록 백그라운드에서 실행
 * - AI 서버는 전처리 → 부정맥 분류 → AF → HRV → 위험도 → LLM 리포트까지 수행하고
 *   결과를 직접 MongoDB(analysis_results, reports 등)에 기록한다.
 * - 백엔드는 measurement.status 만 갱신/모니터링한다.
 */
const requestAnalysis = async (measurementId) => {
  try {
    // 분석 시작 표시
    await Measurement.findByIdAndUpdate(measurementId, { status: 'PREPROCESSING' });

    const res = await axios.post(
      `${AI_SERVER_URL}/api/analyze`,
      { measurement_id: measurementId.toString() },
      { timeout: 60000 } // AI 분석은 30초+α, 여유롭게 60초
    );

    await Measurement.findByIdAndUpdate(measurementId, { status: 'PROCESSED' });
    return res.data;
  } catch (err) {
    console.error('[AI] 분석 요청 실패:', err.message);
    await Measurement.findByIdAndUpdate(measurementId, { status: 'FAILED' });

    // 시스템 로그 기록 (UC-13: 추론 실패 기록)
    await SystemLog.create({
      event_type: 'ERROR',
      severity: 'HIGH',
      event_desc: `AI 분석 요청 실패 (measurement_id: ${measurementId}): ${err.message}`,
      service_name: 'AI_SERVER',
      stack_trace: err.stack,
      logged_at: new Date(),
    }).catch((e) => console.error('[SystemLog] 기록 실패:', e.message));

    throw err;
  }
};

module.exports = { requestAnalysis };
