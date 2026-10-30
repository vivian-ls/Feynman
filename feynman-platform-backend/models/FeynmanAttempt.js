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
  },
  { timestamps: true },
);

module.exports = mongoose.model('FeynmanAttempt', FeynmanAttemptSchema);
