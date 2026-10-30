// src/utils/getErrorMessage.js

// 统一提取后端返回的错误信息，方便各个页面复用。
export default function getErrorMessage(error, fallback = '操作失败，请稍后再试') {
  if (!error) return fallback;
  const data = error.response?.data;
  if (typeof data === 'string' && data.trim()) return data;
  if (data?.msg) return data.msg;
  if (data?.message) return data.message;
  if (data?.error) return data.error;
  if (error.code === 'ERR_NETWORK') return '无法连接服务器，请确认后端已启动';
  return error.message || fallback;
}
