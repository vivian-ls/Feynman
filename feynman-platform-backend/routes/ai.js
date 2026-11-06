// routes/ai.js
const express = require('express');
const auth = require('../middleware/auth');
const { evaluateFeynmanAttempt } = require('../controllers/deepseekAiController');

const router = express.Router();

// @route   POST /api/ai/evaluate
// @desc    用 DeepSeek 润色复述文本，并给出评价、优缺点和分数
// @access  Private
router.post('/evaluate', auth, evaluateFeynmanAttempt);

module.exports = router;
