import { parseCsvEcg, downsample } from '../utils/parseCsvEcg';
import LiveEcgChart from '../components/LiveEcgChart.jsx';

// ... 컴포넌트 안에 상태 추가
const [preview, setPreview] = useState([]); // 미리보기 파형 데이터

// 파일 선택 핸들러를 이렇게 교체
const handleFileChange = (e) => {
  const f = e.target.files[0] || null;
  setFile(f);
  setPreview([]);

  // CSV면 브라우저에서 바로 읽어 파형 미리보기
  if (f && f.name.toLowerCase().endsWith('.csv')) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const samples = parseCsvEcg(ev.target.result);
      setPreview(downsample(samples, 1000));
    };
    reader.readAsText(f);
  }
};

// JSX에서 input의 onChange를 handleFileChange로 바꾸고, 아래에 미리보기 추가
// <input type="file" ... onChange={handleFileChange} />
// {preview.length > 0 && (
//   <div style={{ margin: '12px 0' }}>
//     <label>측정 파형 미리보기</label>
//     <LiveEcgChart samples={preview} signalType={signalType} />
//   </div>
// )}
