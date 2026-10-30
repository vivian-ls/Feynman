// src/api/axios.js
import axios from 'axios';

// 统一配置 API 根路径。开发环境默认指向本地后端，
// 也可以通过前端项目根目录的 .env 文件用 VITE_API_BASE_URL 覆盖。
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器：每次发请求前自动从 localStorage 取出 token 并附加到请求头。
// 这样业务代码里就不需要反复手写 Authorization。
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// 响应拦截器：token 失效（401）时清理本地登录状态，并通知 AuthContext。
// AuthContext 收到事件后会清空 token，ProtectedRoute 随即将用户送回登录页。
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.dispatchEvent(new Event('auth:expired'));
    }
    return Promise.reject(error);
  },
);

export default apiClient;
