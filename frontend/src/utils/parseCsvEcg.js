// CSV 텍스트를 ECG 샘플 배열로 변환
// 가정: 한 줄에 숫자 하나(mV) 또는 "시간,값" 형태
export function parseCsvEcg(text) {
  const lines = text.trim().split(/\r?\n/);
  const samples = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',');
    // 헤더 줄(숫자가 아님)은 건너뜀
    const lastVal = Number(cols[cols.length - 1]);
    if (Number.isNaN(lastVal)) continue;
    samples.push(lastVal);
  }
  return samples; // [0.01, 0.02, ...] 형태
}

// 화면 표시에 너무 많으면 다운샘플링 (예: 5000개 → 1000개)
export function downsample(samples, maxPoints = 1000) {
  if (samples.length <= maxPoints) return samples;
  const step = Math.ceil(samples.length / maxPoints);
  return samples.filter((_, i) => i % step === 0);
}
