// src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const TOKEN_KEY = 'token';
const AuthContext = createContext(null);

// 解析 JWT 的 payload 部分（不校验签名，签名由后端负责）。
// 这里只用来读取用户 id 和过期时间，用于界面展示与本地过期检查。
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    // base64url 可能省略了末尾的 =，补齐后再解码。
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  // 从 localStorage 初始化，刷新页面后登录状态不会丢失。
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  const user = useMemo(() => {
    if (!token) return null;
    const payload = decodeToken(token);
    if (!payload) return null;
    return {
      id: payload.user?.id ?? null,
      exp: payload.exp ?? null,
    };
  }, [token]);

  // token 变化时同步到 localStorage。
  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  // 本地检查 token 是否过期，过期自动退出登录。
  useEffect(() => {
    if (token) {
      const payload = decodeToken(token);
      if (payload?.exp) {
        const remaining = payload.exp * 1000 - Date.now();
        if (remaining <= 0) {
          setToken(null);
          return undefined;
        }
        const timer = setTimeout(() => setToken(null), remaining);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [token]);

  // apiClient 在收到 401 时会广播 auth:expired，这里监听并清理登录状态。
  useEffect(() => {
    const handleExpired = () => setToken(null);
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, []);

  const login = (newToken) => setToken(newToken);
  const logout = () => setToken(null);

  const value = useMemo(
    () => ({ token, user, isAuthenticated: Boolean(token), login, logout }),
    [token, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 自定义 Hook：其他组件通过 useAuth() 读取全局登录状态。
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 <AuthProvider> 内部使用');
  }
  return context;
}
