// 위험도 단계별 색상·라벨 (FR-15: 적/황/녹)
export const RISK_META = {
  HIGH: { label: '상 (긴급)', color: '#e03131', bg: '#fff5f5' },
  MID:  { label: '중 (주의)', color: '#f08c00', bg: '#fff9db' },
  LOW:  { label: '하 (참고)', color: '#2f9e44', bg: '#ebfbee' },
};

export const riskMeta = (level) =>
  RISK_META[level] || { label: level || '-', color: '#868e96', bg: '#f1f3f5' };

export const formatDate = (iso) => {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
