import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getReport, downloadReportPDF } from '../api/report';
import { riskMeta, formatDate } from '../utils/risk';

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getReport(id);
        setReport(data);
      } catch (err) {
        setError(err.response?.data?.message || '리포트를 불러오지 못했습니다.');
      }
    })();
  }, [id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadReportPDF(id);
      // blob을 파일로 저장
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `heartlink_report_${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('PDF 다운로드에 실패했습니다.');
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <div style={wrap}><p style={{ color: 'red' }}>{error}</p></div>;
  if (!report) return <div style={wrap}><p>불러오는 중...</p></div>;

  const m = riskMeta(report.analysis?.risk_level);
  const ur = report.user_report || {};

  return (
    <div style={wrap}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'var(--color-primary)' }}>내 리포트</h1>
        <button onClick={() => navigate('/reports')} style={{ background: '#868e96' }}>목록</button>
      </header>

      {/* 위험도 요약 박스 */}
      <div style={{ padding: 20, borderRadius: 12, background: m.bg, borderLeft: `6px solid ${m.color}`, marginTop: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: m.color }}>
          {m.label} · {report.analysis?.risk_score}점
        </div>
        <small style={{ color: '#868e96' }}>측정 분석 시각: {formatDate(report.generated_at)}</small>
      </div>

      {/* 본인용 친절체 리포트 */}
      <section style={card}>
        <h2 style={h2}>요약</h2>
        <p style={{ fontSize: 18 }}>{ur.summary}</p>
      </section>

      <section style={card}>
        <h2 style={h2}>이렇게 해보세요</h2>
        <p style={{ fontSize: 18 }}>{ur.guide}</p>
      </section>

      {ur.full_text && (
        <details style={{ ...card, cursor: 'pointer' }}>
          <summary style={{ fontWeight: 600, fontSize: 16 }}>상세 내용 더보기</summary>
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{ur.full_text}</p>
        </details>
      )}

      {/* 분석 수치 (참고용) */}
      {report.analysis && (
        <section style={card}>
          <h2 style={h2}>분석 수치</h2>
          <ul style={{ paddingLeft: 20, fontSize: 16 }}>
            <li>심방세동(AF) 가능성: {(report.analysis.af_prob * 100).toFixed(1)}%</li>
            <li>부정맥 분류: {report.analysis.arrhythmia_class}</li>
          </ul>
        </section>
      )}

      <button onClick={handleDownload} disabled={downloading} style={{ width: '100%', marginTop: 16 }}>
        {downloading ? '생성 중...' : 'PDF로 저장 (진료 시 제출용)'}
      </button>

      <p style={{ marginTop: 24, fontSize: 14, color: '#868e96' }}>
        {report.disclaimer}
      </p>
    </div>
  );
}

const wrap = { maxWidth: 700, margin: '40px auto', padding: 24 };
const card = { marginTop: 16, padding: 20, background: '#fff', borderRadius: 12 };
const h2 = { fontSize: 18, color: 'var(--color-primary)', marginTop: 0 };
