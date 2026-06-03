import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || '로그인에 실패했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '80px auto', padding: 24 }}>
      <h1 style={{ color: 'var(--color-primary)' }}>HeartLink 로그인</h1>
      <form onSubmit={handleSubmit}>
        <label>이메일</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>비밀번호</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%' }}>로그인</button>
      </form>
      <p style={{ marginTop: 16 }}>
        계정이 없으신가요? <Link to="/register">회원가입</Link>
      </p>
    </div>
  );
}
