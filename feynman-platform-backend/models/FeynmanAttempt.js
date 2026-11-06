// models/FeynmanAttempt.js
const mongoose = require('mongoose');

const FeynmanAttemptSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    knowledgePoint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgePoint',
      required: true,
    },
    transcript: {
      type: String,
      required: true,
      trim: true,
    },
    // 以下字段来自 DeepSeek 的评价结果，均为可选：
    // 学生也可以只保存转录文字，不做 AI 评价。
    polishedText: {
      type: String,
      trim: true,
    },
    evaluation: {
      type: String,
      trim: true,
    },
    strengths: {
      type: [String],
      default: undefined,
    },
    weaknesses: {
      type: [String],
      default: undefined,
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('FeynmanAttempt', FeynmanAttemptSchema);
