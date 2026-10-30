// src/pages/LoginPage.jsx
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';
import { useAuth } from '../context/AuthContext';
import getErrorMessage from '../utils/getErrorMessage';

function LoginPage() {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { token, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // 被路由守卫拦下时，守卫会把原地址放进 state.from，登录后可以回到原页面。
  const redirectTo = location.state?.from || '/';
  const registeredHint = location.state?.registered;

  // 已登录用户无需再看登录页。
  if (token) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await apiClient.post('/users/login', {
        email: formData.email.trim(),
        password: formData.password,
      });
      login(response.data.token); // 写入全局状态，AuthContext 会同步到 localStorage
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, '登录失败，请检查邮箱和密码'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>登录</h1>
        <p className="subtitle">继续你的费曼学习之旅</p>

        {registeredHint && (
          <p className="form-notice">注册成功，请使用 {registeredHint} 登录。</p>
        )}

        <form onSubmit={handleSubmit} className="form">
          <label className="form-field">
            <span>邮箱</span>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label className="form-field">
            <span>密码</span>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="请输入密码"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>

        <p className="auth-switch">
          还没有账号？<Link to="/register">立即注册</Link>
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
