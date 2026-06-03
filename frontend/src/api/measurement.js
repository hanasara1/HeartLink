import api from './axios';

// ECG/PPG 파일 업로드 (multipart/form-data, 파일 필드명: ecgFile)
export const uploadMeasurement = ({ file, deviceType, signalType, measuredAt, durationSec, onProgress }) => {
  const formData = new FormData();
  formData.append('ecgFile', file);              // ★ 백엔드가 기대하는 필드명
  formData.append('device_type', deviceType);
  formData.append('signal_type', signalType);
  formData.append('measured_at', measuredAt);
  formData.append('duration_sec', durationSec);

  return api.post('/measurements', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
};

// 분석 진행 상태 폴링
export const getMeasurementStatus = (id) => api.get(`/measurements/${id}/status`);

// 내 측정 이력 목록
export const listMeasurements = () => api.get('/measurements');
