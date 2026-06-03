import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './store/AuthContext.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import UploadPage from './pages/UploadPage.jsx';
import ReportListPage from './pages/ReportListPage.jsx';      // ★ 추가
import ReportDetailPage from './pages/ReportDetailPage.jsx';  // ★ 추가

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/upload" element={<Protected><UploadPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportListPage /></Protected>} />         {/* ★ */}
      <Route path="/reports/:id" element={<Protected><ReportDetailPage /></Protected>} />    {/* ★ */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
