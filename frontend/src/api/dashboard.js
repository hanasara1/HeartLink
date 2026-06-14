// frontend/src/api/dashboard.js
import api from './axios';

// 사용자 본인 대시보드 (최근 측정/리포트 요약, 위험도 추이 등)
export const getUserDashboard = () => api.get('/dashboard/user');

// 보호자 대시보드
export const getGuardianDashboard = () => api.get('/dashboard/guardian');

// 보호자가 연결된 사용자 상세 보기
export const getLinkedUserDetail = (userId) =>
  api.get(`/dashboard/guardian/users/${userId}`);
