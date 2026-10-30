// src/pages/RegisterPage.jsx
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api/axios';
import getErrorMessage from '../utils/getErrorMessage';

function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const handleChange = (event) => {
    setFormData({ ...formData, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (formData.password.length < 6) {
      setError('密码至少需要 6 个字符');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/users/register', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
      });
      // 注册成功后回到登录页，并把邮箱带过去作为提示。
      navigate('/login', { replace: true, state: { registered: formData.email.trim() } });
    } catch (err) {
      setError(getErrorMessage(err, '注册失败，请稍后再试'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>注册</h1>
        <p className="subtitle">创建账号，开始用费曼学习法掌握知识</p>

        <form onSubmit={handleSubmit} className="form">
          <label className="form-field">
            <span>用户名</span>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="给自己起个名字"
              autoComplete="username"
              required
            />
          </label>

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
              placeholder="至少 6 位字符"
              autoComplete="new-password"
              required
            />
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
            {submitting ? '注册中…' : '注册'}
          </button>
        </form>

        <p className="auth-switch">
          已有账号？<Link to="/login">返回登录</Link>
        </p>
      </div>
    </div>
  );
}

export default RegisterPage;
