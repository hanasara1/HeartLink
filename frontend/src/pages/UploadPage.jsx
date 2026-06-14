// frontend/src/pages/UploadPage.jsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadMeasurement, getMeasurementStatus } from '../api/measurement';
import { parseCsvEcg, downsample } from '../utils/parseCsvEcg';
import LiveEcgChart from '../components/LiveEcgChart.jsx';

export default function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [deviceType, setDeviceType] = useState('WEARABLE');
  const [signalType, setSignalType] = useState('ECG');
  const [measuredAt, setMeasuredAt] = useState('');
  const [durationSec, setDurationSec] = useState('');
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('idle'); // idle | uploading | analyzing | done | error
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef(null);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => () => clearInterval(pollRef.current), []);

  const handleFileChange = (e) => {
    const f = e.target.files[0] || null;
    setFile(f);
    setPreview([]);
    if (f && f.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const samples = parseCsvEcg(ev.target.result);
        setPreview(downsample(samples, 1000));
      };
      reader.readAsText(f);
    }
  };

  // 분석 상태 폴링: PROCESSED면 리포트로, FAILED면 에러 표시
  const startPolling = (measurementId) => {
    setPhase('analyzing');
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getMeasurementStatus(measurementId);
        if (data.status === 'PROCESSED') {
          clearInterval(pollRef.current);
          setPhase('done');
          navigate('/reports');
        } else if (data.status === 'FAILED') {
          clearInterval(pollRef.current);
          setPhase('error');
          setErrorMsg('AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setPhase('error');
        setErrorMsg('분석 상태 확인 중 오류가 발생했습니다.');
      }
    }, 3000); // 3초 간격
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || !measuredAt || !durationSec) {
      setErrorMsg('파일, 측정 시각, 측정 시간을 모두 입력해 주세요.');
      return;
    }
    setErrorMsg('');
    setPhase('uploading');
    setProgress(0);
    try {
      const { data } = await uploadMeasurement({
        file,
        deviceType,
        signalType,
        measuredAt,
        durationSec,
        onProgress: setProgress,
      });
      // 백엔드는 202 + { measurement: { id, status } } 반환
      const measurementId = data.measurement.id;
      startPolling(measurementId);
    } catch (err) {
      setPhase('error');
      setErrorMsg(err.response?.data?.message || '업로드에 실패했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: 24 }}>
      <h1 style={{ color: 'var(--color-primary)' }}>측정 데이터 업로드</h1>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          ECG/PPG 파일 (WFDB / EDF / CSV)
          <input type="file" accept=".csv,.edf,.dat,.hea,.atr,.wfdb" onChange={handleFileChange} />
        </label>

        <label>
          디바이스 유형
          <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)}>
            <option value="WEARABLE">웨어러블</option>
            <option value="HOLTER">홀터</option>
            <option value="ECG_DEVICE">ECG 기기</option>
          </select>
        </label>

        <label>
          신호 유형
          <select value={signalType} onChange={(e) => setSignalType(e.target.value)}>
            <option value="ECG">ECG</option>
            <option value="PPG">PPG</option>
            <option value="BOTH">BOTH</option>
          </select>
        </label>

        <label>
          측정 시각
          <input type="datetime-local" value={measuredAt} onChange={(e) => setMeasuredAt(e.target.value)} />
        </label>

        <label>
          측정 시간(초)
          <input type="number" min="1" value={durationSec} onChange={(e) => setDurationSec(e.target.value)} />
        </label>

        {preview.length > 0 && (
          <div style={{ margin: '12px 0' }}>
            <label>측정 파형 미리보기</label>
            <LiveEcgChart samples={preview} signalType={signalType} />
          </div>
        )}

        {phase === 'uploading' && <p>업로드 중... {progress}%</p>}
        {phase === 'analyzing' && <p>AI가 분석 중입니다. 잠시만 기다려 주세요...</p>}
        {errorMsg && <p style={{ color: 'crimson' }}>{errorMsg}</p>}

        <button type="submit" disabled={phase === 'uploading' || phase === 'analyzing'}>
          {phase === 'uploading' || phase === 'analyzing' ? '처리 중...' : '업로드 및 분석 시작'}
        </button>
      </form>

      <p style={{ marginTop: 24, fontSize: 13, color: '#868e96' }}>
        본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다. 응급 시 119에 연락하세요.
      </p>
    </div>
  );
}
