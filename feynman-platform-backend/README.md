# 费曼学习平台后端

《大前端与 AI 实战》课程的 Express + MongoDB 后端项目，为前端提供用户认证、知识点管理、录音上传与语音识别 API。

## 技术栈

- Node.js + Express 5
- MongoDB + Mongoose
- JWT（`jsonwebtoken`）认证
- bcryptjs 密码哈希
- CORS 跨域支持
- multer 音频上传
- 百度智能云语音识别（`baidu-aip-sdk`）

## 环境变量

在项目根目录把 `.env.example` 复制为 `.env` 并填写：

```bash
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>
JWT_SECRET=<your-secret>
PORT=3000

# 百度智能云语音识别（第七次课）
BAIDU_APP_ID=<app-id>
BAIDU_API_KEY=<api-key>
BAIDU_SECRET_KEY=<secret-key>
```

`PORT` 可省略，默认 `3000`。百度三件套缺失时服务仍可启动，但 `POST /api/audio/transcribe` 会返回 `503` 并提示配置凭证。

## 运行项目

```bash
npm install
npm run dev     # 文件变化自动重启
# 或
npm start
```

启动成功后终端会输出：

```text
MongoDB connected successfully!
Feynman Platform backend is running at http://localhost:3000
```

## API 一览

### 用户

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/users/register` | 注册（`username` / `email` / `password`），返回 JWT | 否 |
| POST | `/api/users/login` | 登录（`email` / `password`），返回 JWT | 否 |

### 知识点

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| GET | `/api/knowledge-points` | 当前用户的知识点列表 | 是 |
| POST | `/api/knowledge-points` | 新建知识点（`title` / `content` / `status`） | 是 |
| GET | `/api/knowledge-points/:id` | 单个知识点详情 | 是 |
| PUT | `/api/knowledge-points/:id` | 更新知识点 | 是 |
| DELETE | `/api/knowledge-points/:id` | 删除知识点 | 是 |

认证方式：请求头携带 `x-auth-token: <token>`，也兼容 `Authorization: Bearer <token>`。

`status` 可选值为 `not_started`、`in_progress`、`mastered`，默认 `not_started`。

### 录音与复述

| 方法 | 路径 | 说明 | 认证 |
| --- | --- | --- | --- |
| POST | `/api/audio/transcribe` | 上传音频（`multipart/form-data`，字段名 `audio`），返回百度语音识别文字 | 是 |
| POST | `/api/knowledge-points/:id/attempts` | 保存一次复述（`transcript`） | 是 |
| GET | `/api/knowledge-points/:id/attempts` | 获取该知识点最近 20 条复述记录 | 是 |

音频要求：WAV、16kHz、单声道。前端会把浏览器录制的音频重采样后再上传；文件大小上限 10MB。

## 目录结构

```text
├─ index.js                  # 应用入口、CORS、JSON 中间件、路由挂载
├─ middleware/auth.js        # JWT 校验中间件
├─ controllers/
│  └─ baiduAiController.js   # 调用百度短语音识别
├─ models/
│  ├─ User.js
│  ├─ KnowledgePoint.js
│  └─ FeynmanAttempt.js      # 复述记录
└─ routes/
   ├─ users.js
   ├─ knowledgePoints.js
   └─ audio.js
```
