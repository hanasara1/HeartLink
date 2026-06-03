import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function LiveEcgChart({ samples = [], signalType = 'ECG' }) {
  if (samples.length === 0) {
    return <p style={{ color: '#868e96' }}>파일을 선택하면 파형이 표시됩니다.</p>;
  }

  // recharts가 그릴 수 있는 {t, mV} 형태로 변환
  const data = samples.map((v, i) => ({ t: i, mV: v }));
  const color = signalType === 'PPG' ? '#1971c2' : 'var(--color-primary)';

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f3f5" />
        <XAxis dataKey="t" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="mV" />
        <Tooltip />
        <Line type="monotone" dataKey="mV" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
