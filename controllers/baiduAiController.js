// controllers/baiduAiController.js
const AipSpeechClient = require('baidu-aip-sdk').speech;

const APP_ID = process.env.BAIDU_APP_ID;
const API_KEY = process.env.BAIDU_API_KEY;
const SECRET_KEY = process.env.BAIDU_SECRET_KEY;
const hasCredentials = Boolean(APP_ID && API_KEY && SECRET_KEY);

if (!hasCredentials) {
  console.warn(
    '[warn] .env 中缺少百度语音识别凭证（BAIDU_APP_ID / BAIDU_API_KEY / BAIDU_SECRET_KEY），' +
      'POST /api/audio/transcribe 将返回 503',
  );
}

// 只有三件套齐全时才创建客户端，避免服务启动即崩溃。
const client = hasCredentials ? new AipSpeechClient(APP_ID, API_KEY, SECRET_KEY) : null;

// 简单校验 WAV 文件头，避免把 WebM 等格式误传给百度。
function isWav(buffer) {
  return (
    Buffer.isBuffer(buffer) &&
    buffer.length > 44 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WAVE'
  );
}

exports.transcribeAudio = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ msg: '未收到音频文件（字段名应为 audio）' });
  }

  if (!isWav(req.file.buffer)) {
    return res.status(400).json({ msg: '音频格式不正确，请上传 16kHz 单声道 WAV 文件' });
  }

  if (!client) {
    return res.status(503).json({
      msg: '服务器尚未配置百度语音识别凭证，请在后端 .env 中填写 BAIDU_APP_ID、BAIDU_API_KEY、BAIDU_SECRET_KEY',
    });
  }

  try {
    // 短语音识别：wav 格式、16000 采样率、1537 为普通话模型
    const result = await client.recognize(req.file.buffer, 'wav', 16000, {
      dev_pid: 1537,
    });

    console.log('Baidu ASR result:', result);

    if (result.err_no !== 0) {
      return res.status(502).json({
        msg: `百度语音识别失败（错误码 ${result.err_no}）`,
        error: result.err_msg || result.err_no,
      });
    }

    const text = Array.isArray(result.result) ? result.result.join('') : result.result || '';
    return res.json({ result: text });
  } catch (error) {
    console.error('Error calling Baidu ASR API:', error);
    return res.status(502).json({ msg: '调用百度语音识别服务失败，请稍后再试' });
  }
};
