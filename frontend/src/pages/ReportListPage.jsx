import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { listReports } from '../api/report';
import { riskMeta, formatDate } from '../utils/risk';

export default function ReportListPage() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [riskFilter, setRiskFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = riskFilter ? { risk_level: riskFilter } : {};
      const { data } = await listReports(params);
      setReports(data.reports);
    } catch (err) {
      setError(err.response?.data?.message || '리포트를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [riskFilter]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'var(--color-primary)' }}>내 리포트</h1>
        <button onClick={() => navigate('/')} style={{ background: '#868e96' }}>대시보드</button>
      </header>

      {/* 위험도 필터 */}
      <div style={{ margin: '16px 0' }}>
        <label>위험도 필터</label>
        <select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)}>
          <option value="">전체</option>
          <option value="HIGH">상 (긴급)</option>
          <option value="MID">중 (주의)</option>
          <option value="LOW">하 (참고)</option>
        </select>
      </div>

      {loading && <p>불러오는 중...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!loading && !error && reports.length === 0 && (
        <p style={{ color: '#868e96' }}>아직 생성된 리포트가 없습니다. 측정을 업로드해 보세요.</p>
      )}

      {/* 리포트 카드 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {reports.map((r) => {
          const m = riskMeta(r.risk_level);
          return (
            <div
              key={r.id}
              onClick={() => navigate(`/reports/${r.id}`)}
              style={{
                padding: 16, borderRadius: 12, background: '#fff', cursor: 'pointer',
                borderLeft: `6px solid ${m.color}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, color: m.color }}>
                  {m.label} · {r.risk_score}점
                </span>
                <small style={{ color: '#868e96' }}>{formatDate(r.generated_at)}</small>
              </div>
              <p style={{ margin: '8px 0 0', fontSize: 16 }}>{r.summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
