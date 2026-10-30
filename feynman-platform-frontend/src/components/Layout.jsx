// src/components/Layout.jsx
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-layout">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">F</span>
          费曼学习平台
        </Link>

        <nav className="nav-links">
          {token ? (
            <>
              <NavLink to="/" end>
                我的知识点
              </NavLink>
              <NavLink to="/kp/new">新建知识点</NavLink>
              <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                退出登录
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">登录</NavLink>
              <NavLink to="/register" className="btn btn-primary btn-sm">
                注册
              </NavLink>
            </>
          )}
        </nav>
      </header>

      <main className="page">
        {/* 子路由匹配的页面会渲染在这里 */}
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
