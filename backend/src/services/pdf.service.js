const PDFDocument = require('pdfkit');

/**
 * 리포트 PDF 생성 (FR-16)
 * - 측정값, 분석 결과, 권장 조치, 면책 문구 포함
 * - 워터마크(사용자명, 발행일)
 * 반환: Buffer
 */
const generateReportPDF = ({ report, user, analysis }) =>
  new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const issuedAt = new Date().toLocaleString('ko-KR');

    // 제목
    doc.fontSize(20).text('HeartLink 건강 리포트', { align: 'center' });
    doc.moveDown();

    // 기본 정보
    doc.fontSize(11)
      .text(`이름: ${user.name}`)
      .text(`발행일: ${issuedAt}`)
      .text(`측정 시각: ${analysis?.analyzed_at?.toLocaleString('ko-KR') || '-'}`);
    doc.moveDown();

    // 위험도
    const riskLabel = { HIGH: '상(긴급)', MID: '중(주의)', LOW: '하(참고)' };
    doc.fontSize(14).text('■ 위험도 평가');
    doc.fontSize(11)
      .text(`위험도 점수: ${analysis?.risk_score ?? '-'} / 100`)
      .text(`위험도 단계: ${riskLabel[analysis?.risk_level] || '-'}`)
      .text(`심방세동(AF) 의심: ${analysis?.af_detected ? '예' : '아니오'}`);
    doc.moveDown();

    // 본인용 요약
    doc.fontSize(14).text('■ 요약');
    doc.fontSize(11).text(report.user_report?.full_text || report.user_report?.summary || '-', {
      align: 'left',
    });
    doc.moveDown();

    // 보호자용 권장 조치
    doc.fontSize(14).text('■ 권장 조치');
    doc.fontSize(11).text(report.guardian_report?.recommended_action || '-');
    doc.moveDown(2);

    // 면책 문구 (NFR-14)
    doc.fontSize(9).fillColor('gray')
      .text(report.disclaimer ||
        '본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다. 응급 상황 시 즉시 119에 연락하시기 바랍니다.',
        { align: 'center' });

    // 워터마크 (사용자명 + 발행일)
    doc.fontSize(40).fillColor('#eeeeee')
      .rotate(-30, { origin: [300, 400] })
      .text(`${user.name} ${issuedAt}`, 100, 400, { opacity: 0.1 });

    doc.end();
  });

module.exports = { generateReportPDF };
