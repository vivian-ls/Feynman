// controllers/deepseekAiController.js
// 调用 DeepSeek 开放平台的大模型接口，完成「费曼复述」的润色与评分。
const axios = require('axios');
const KnowledgePoint = require('../models/KnowledgePoint');

const API_KEY = process.env.DEEPSEEK_API_KEY;
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
// 低于该分数时，自动把知识点加入复习列表（默认 60 分）
const REVIEW_THRESHOLD = Number(process.env.AI_REVIEW_THRESHOLD) || 60;

if (!API_KEY) {
  console.warn(
    '[warn] .env 中缺少 DEEPSEEK_API_KEY，' +
      'POST /api/ai/evaluate 将返回 503',
  );
}

// 允许 DEEPSEEK_BASE_URL 填 https://api.deepseek.com、https://api.deepseek.com/v1
// 或完整地址，统一拼出 chat/completions 端点。
function getChatUrl() {
  return BASE_URL.endsWith('/chat/completions') ? BASE_URL : `${BASE_URL}/chat/completions`;
}

const SYSTEM_PROMPT = [
  '你是「费曼学习平台」的 AI 学习教练，负责批改学生对一个知识点的口头复述。',
  '你的反馈要严格、具体、友善，指出问题时给出可操作的建议。',
  '你必须只输出一个 JSON 对象，不要输出 Markdown 代码块、前后缀或任何额外说明。',
  'JSON 必须包含以下字段：',
  '- polishedText: 字符串。把学生的复述润色为通顺、专业、书面化的文字，修正语法错误和口语化表达，但不改变核心观点。',
  '- evaluation: 字符串。一段 80-200 字的综合评价。',
  '- strengths: 字符串数组。2-4 条具体的优点。',
  '- weaknesses: 字符串数组。2-4 条具体的可改进之处。',
  '- score: 整数。0-100 的综合得分。',
  '评分参考：准确性 40 分、完整性 30 分、逻辑性 15 分、表达流畅性 15 分。',
].join('\n');

function buildUserPrompt(originalContent, transcribedText) {
  return [
    '下面是一个知识点原文，以及学生对它的口头复述（语音转录结果，可能包含口语、错别字或不通顺的表达）。',
    '请对比两者，完成润色、评价和打分，并按要求返回 JSON。',
    '',
    '【原始知识点】',
    '```',
    originalContent,
    '```',
    '',
    '【学生的复述文本】',
    '```',
    transcribedText,
    '```',
  ].join('\n');
}

// DeepSeek 的 JSON 模式通常只返回纯 JSON，
// 但模型偶尔仍会包一层 ```json 代码块，这里做一次容错。
function parseJsonContent(content) {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('模型返回了空内容');
  }

  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  return JSON.parse(cleaned);
}

function toStringList(value, maxItems = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxItems);
}

function toScore(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.min(100, Math.max(0, Math.round(num)));
}

// 把上游错误翻译成学生看得懂的中文提示。
function describeApiError(error) {
  const status = error.response?.status;
  const upstreamMessage =
    error.response?.data?.error?.message || error.response?.data?.message || '';

  if (status === 401 || status === 403) {
    return 'DeepSeek API Key 无效或没有权限，请检查后端 .env 中的 DEEPSEEK_API_KEY';
  }
  if (status === 402) {
    return 'DeepSeek 账户余额不足，请前往开放平台充值后再试';
  }
  if (status === 429) {
    return 'DeepSeek 请求过于频繁或额度用尽，请稍后再试';
  }
  if (status >= 500) {
    return `DeepSeek 服务暂时不可用（HTTP ${status}），请稍后再试`;
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '调用 DeepSeek 超时，请稍后重试';
  }
  return upstreamMessage || '调用 DeepSeek 失败，请稍后再试';
}

// @route   POST /api/ai/evaluate
// @desc    用 DeepSeek 润色复述文本并给出多维度评价和分数
// @access  Private
exports.evaluateFeynmanAttempt = async (req, res) => {
  const { originalContent, transcribedText, knowledgePointId } = req.body || {};

  if (typeof originalContent !== 'string' || !originalContent.trim()) {
    return res.status(400).json({ msg: 'originalContent（原始知识点内容）不能为空' });
  }
  if (typeof transcribedText !== 'string' || !transcribedText.trim()) {
    return res.status(400).json({ msg: 'transcribedText（复述文本）不能为空' });
  }

  if (!API_KEY) {
    return res.status(503).json({
      msg: '服务器尚未配置 DeepSeek，请在后端 .env 中填写 DEEPSEEK_API_KEY',
    });
  }

  // 传入 knowledgePointId 时，先校验归属，避免越权修改别人的知识点。
  let knowledgePoint = null;
  if (knowledgePointId) {
    try {
      knowledgePoint = await KnowledgePoint.findById(knowledgePointId);
    } catch {
      return res.status(400).json({ msg: 'knowledgePointId 格式不正确' });
    }
    if (!knowledgePoint) return res.status(404).json({ msg: '知识点不存在' });
    if (knowledgePoint.user.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
  }

  let data;
  try {
    const response = await axios.post(
      getChatUrl(),
      {
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: buildUserPrompt(originalContent.trim(), transcribedText.trim()),
          },
        ],
        temperature: 0.2,
        // 约束模型输出合法 JSON，便于后端直接解析。
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120_000,
      },
    );
    data = response.data;
  } catch (error) {
    console.error('Error calling DeepSeek API:', error.response?.data || error.message);
    return res.status(502).json({ msg: describeApiError(error) });
  }

  const content = data?.choices?.[0]?.message?.content;
  let parsed;
  try {
    parsed = parseJsonContent(content);
  } catch (error) {
    console.error('Failed to parse DeepSeek JSON:', content, error.message);
    return res.status(502).json({ msg: 'AI 返回的内容不是合法 JSON，请重试' });
  }

  const score = toScore(parsed.score);
  if (score === null) {
    console.error('DeepSeek response missing valid score:', parsed);
    return res.status(502).json({ msg: 'AI 未返回有效的分数，请重试' });
  }

  const result = {
    polishedText:
      typeof parsed.polishedText === 'string' ? parsed.polishedText.trim() : '',
    evaluation: typeof parsed.evaluation === 'string' ? parsed.evaluation.trim() : '',
    strengths: toStringList(parsed.strengths),
    weaknesses: toStringList(parsed.weaknesses),
    score,
    reviewThreshold: REVIEW_THRESHOLD,
    reviewList: null,
    model: MODEL,
  };

  // 评分与学习流程联动：低分进入复习列表，达标则移出。
  if (knowledgePoint) {
    const reviewList = score < REVIEW_THRESHOLD;
    if (knowledgePoint.reviewList !== reviewList) {
      knowledgePoint.reviewList = reviewList;
      await knowledgePoint.save();
    }
    result.reviewList = reviewList;
    result.knowledgePointId = knowledgePoint._id;
  }

  return res.json(result);
};
