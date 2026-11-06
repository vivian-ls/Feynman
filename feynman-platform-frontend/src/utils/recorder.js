// src/utils/recorder.js
// 录音相关的共享文案与格式化函数，供复述页和语音输入组件复用。

export const RECORDER_STATUS_TEXT = {
  idle: '等待开始',
  acquiring_media: '正在请求麦克风…',
  recording: '录音中',
  paused: '已暂停',
  stopping: '正在停止…',
  stopped: '录音完成',
};

export const RECORDER_ERROR_TEXT = {
  permission_denied: '麦克风权限被拒绝。请允许浏览器使用麦克风后重试。',
  no_specified_media_found: '没有检测到麦克风设备，请连接麦克风后重试。',
  media_in_use: '麦克风正被其他应用占用，请关闭占用麦克风的应用后重试。',
  media_aborted: '录音被中断，请重试。',
  invalid_media_constraints: '当前设备不支持所需的录音参数。',
  no_constraints: '当前浏览器不支持录音。',
  recorder_error: '录音器初始化失败，请刷新页面重试。',
};

export function getRecorderErrorText(error) {
  if (!error) return '';
  return RECORDER_ERROR_TEXT[error] || `录音出错：${error}`;
}

export function formatDuration(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}
