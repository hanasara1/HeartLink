import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/AuthContext.jsx";

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 24 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h1 style={{ color: "var(--color-primary)" }}>HeartLink 대시보드</h1>
        <button onClick={logout} style={{ background: "#868e96" }}>
          로그아웃
        </button>
      </header>
      <p style={{ fontSize: 18 }}>
        <strong>{user?.name}</strong>님 (
        {user?.role === "guardian" ? "보호자" : "사용자"}), 환영합니다.
      </p>

      {user?.role === "user" && (
        <div
          style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}
        >
          <button onClick={() => navigate("/upload")}>+ 새 측정 업로드</button>
          <button
            onClick={() => navigate("/reports")}
            style={{ background: "#1971c2" }}
          >
            내 리포트 보기
          </button>
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          padding: 20,
          background: "#fff",
          borderRadius: 12,
        }}
      >
        <p>여기에 리포트 목록, ECG 시각화 화면이 추가됩니다.</p>
      </div>

      <p style={{ marginTop: 40, fontSize: 14, color: "#868e96" }}>
        본 서비스는 의료기기가 아니며 의학적 진단을 대체하지 않습니다.
      </p>
    </div>
  );
}
