import api from './axios';

// 본인용 리포트 목록 (필터: risk_level, from, to)
export const listReports = (params = {}) => api.get('/reports', { params });

// 본인용 리포트 상세
export const getReport = (id) => api.get(`/reports/${id}`);

// 보호자용 리포트 상세
export const getGuardianReport = (id) => api.get(`/reports/${id}/guardian`);

// PDF 다운로드 (바이너리)
export const downloadReportPDF = (id) =>
  api.get(`/reports/${id}/pdf`, { responseType: 'blob' });
