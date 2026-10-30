// src/App.jsx
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardPage from './pages/DashboardPage';
import FeynmanRecordPage from './pages/FeynmanRecordPage';
import KnowledgePointFormPage from './pages/KnowledgePointFormPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

function App() {
  return (
    <Routes>
      {/* Layout 作为父路由，页面共享顶部导航 */}
      <Route path="/" element={<Layout />}>
        {/* 公共路由：无需登录 */}
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />

        {/* 受保护路由：没有 token 会被 ProtectedRoute 重定向到 /login */}
        <Route element={<ProtectedRoute />}>
          <Route index element={<DashboardPage />} />
          <Route path="kp/new" element={<KnowledgePointFormPage />} />
          <Route path="kp/edit/:id" element={<KnowledgePointFormPage />} />
          <Route path="feynman/:id" element={<FeynmanRecordPage />} />
        </Route>

        {/* 未知地址统一回到主页（未登录时会被守卫带到登录页） */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
