// index.js
const User = require('./models/User');
const bcrypt = require('bcryptjs');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors'); // 1. 引入cors
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000; // 优先使用环境变量中的端口

// --- 核心中间件 ---
// 2. 使用cors中间件 - 解决跨域问题
// 讲解：CORS (Cross-Origin Resource Sharing) 是一个必需的步骤。当我们的前端（比如运行在localhost:5173）
// 尝试请求后端（运行在localhost:3000）时，浏览器会出于安全策略阻止它。 
// `cors()` 中间件会自动添加必要的响应头，告诉浏览器“我允许那个地址的请求”，从而让前后端可以顺利通信。
app.use(cors());

// 3. 使用express.json()中间件 - 解析请求体
// 讲解：这个中间件让我们的Express应用能够识别并处理传入的JSON格式数据（比如用户注册时POST的用户名和密码）。
app.use(express.json());

// 使用路由文件
// 注意：文件名要与 require 的路径完全一致（这里统一用复数 users.js）
app.use('/api/users', require('./routes/users'));
app.use('/api/knowledge-points', require('./routes/knowledgePoints')); // 新增
app.use('/api/audio', require('./routes/audio')); // 录音上传与语音识别

// --- 数据库连接 ---
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

app.listen(port, () => {
  console.log(`Feynman Platform backend is running at http://localhost:${port}`);
});