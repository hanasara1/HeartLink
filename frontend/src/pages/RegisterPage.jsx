import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '', password: '', name: '', phone: '', role: 'user',
  });
  const [error, setError] = useState('');

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', form);
      alert('회원가입이 완료되었습니다. 로그인해 주세요.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || '회원가입에 실패했습니다.');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: 24 }}>
      <h1 style={{ color: 'var(--color-primary)' }}>회원가입</h1>
      <form onSubmit={handleSubmit}>
        <label>이메일</label>
        <input name="email" type="email" value={form.email} onChange={onChange} required />
        <label>비밀번호 (8자 이상)</label>
        <input name="password" type="password" value={form.password} onChange={onChange} required />
        <label>이름</label>
        <input name="name" value={form.name} onChange={onChange} required />
        <label>연락처</label>
        <input name="phone" value={form.phone} onChange={onChange} required />
        <label>가입 유형</label>
        <select name="role" value={form.role} onChange={onChange}>
          <option value="user">사용자 (본인)</option>
          <option value="guardian">보호자</option>
        </select>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        <button type="submit" style={{ width: '100%' }}>가입하기</button>
      </form>
      <p style={{ marginTop: 16 }}>
        이미 계정이 있으신가요? <Link to="/login">로그인</Link>
      </p>
    </div>
  );
}
