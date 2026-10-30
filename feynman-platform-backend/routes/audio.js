// routes/audio.js
const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const { transcribeAudio } = require('../controllers/baiduAiController');

const router = express.Router();

// 使用内存存储：音频只是临时中转给百度，不需要写入磁盘。
// 限制 10MB，避免过大的录音占用内存。
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// @route   POST /api/audio/transcribe
// @desc    上传音频并调用百度语音识别
// @access  Private
// 用一层包装把 multer 的错误（如文件过大）转成统一的 JSON 响应。
router.post(
  '/transcribe',
  auth,
  (req, res, next) => {
    upload.single('audio')(req, res, (err) => {
      if (err) {
        const message =
          err.code === 'LIMIT_FILE_SIZE' ? '音频文件不能超过 10MB' : err.message || '音频上传失败';
        return res.status(400).json({ msg: message });
      }
      return next();
    });
  },
  transcribeAudio,
);

module.exports = router;
