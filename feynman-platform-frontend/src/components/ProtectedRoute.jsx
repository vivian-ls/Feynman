// src/components/ProtectedRoute.jsx
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// 路由守卫：没有 token 时重定向到登录页。
// replace 会替换当前历史记录，用户点“后退”不会回到受保护页面。
function ProtectedRoute() {
  const { token } = useAuth();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  // 有 token 时正常渲染嵌套路由。
  return <Outlet />;
}

export default ProtectedRoute;
