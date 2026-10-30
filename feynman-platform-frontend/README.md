# 费曼学习平台 · 前端

《大前端与 AI 实战》课程的 React 前端项目。配合 `feynman-platform-backend` 完成后端 API 联调，实现用户认证、知识点管理、网页录音与 AI 语音转文字。

## 已实现功能

- 用户注册 / 登录，JWT 通过 `localStorage` 持久化，刷新页面保持登录
- 全局认证状态（React Context API）与路由守卫（`ProtectedRoute`）
- 知识点 CRUD：列表、新建、编辑、删除，自动携带 `x-auth-token`
- Markdown 渲染：GFM 表格、删除线、代码块
- LaTeX 公式渲染（`remark-math` + `rehype-katex`）
- Mermaid 流程图渲染（`mermaid` + `DOMPurify` 净化 SVG）
- Markdown 编辑器：工具栏、实时分栏预览、编辑 / 分栏 / 预览三种模式
- 网页录音（`react-media-recorder`）：开始 / 停止、计时、本地回放
- 录音自动转换为 16kHz 单声道 WAV（Web Audio API 重采样），上传后端并调用百度语音识别
- 转录结果可编辑、保存为复述记录，并展示历史复述
- token 失效（HTTP 401）自动清理登录状态并回到登录页

## 运行方式

先启动后端（默认 `http://localhost:3000`）：

```bash
cd feynman-platform-backend
npm install
npm run dev
```

再启动前端：

```bash
cd feynman-platform-frontend
npm install
npm run dev
```

浏览器打开终端提示的地址（Vite 默认 `http://localhost:5173`）。

如果后端地址不是默认值，在 `feynman-platform-frontend` 下新建 `.env`：

```bash
VITE_API_BASE_URL=http://localhost:3000/api
```

录音功能需要浏览器授权麦克风，并且页面必须运行在 `localhost` 或 HTTPS 下。

## 常用脚本

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run lint     # oxlint 静态检查
npm run preview  # 预览构建产物
```

## 目录结构

```text
src/
├─ api/axios.js              # axios 实例、token 请求拦截器、401 响应拦截器
├─ components/
│  ├─ Layout.jsx             # 顶部导航 + Outlet
│  ├─ ProtectedRoute.jsx     # 路由守卫
│  ├─ MarkdownRenderer.jsx   # Markdown / GFM / KaTeX / Mermaid 渲染
│  ├─ MarkdownEditor.jsx     # Markdown 编辑器（工具栏 + 实时预览）
│  └─ MermaidBlock.jsx       # Mermaid 图渲染与安全净化
├─ context/AuthContext.jsx   # 全局登录状态（token / user / login / logout）
├─ pages/
│  ├─ LoginPage.jsx
│  ├─ RegisterPage.jsx
│  ├─ DashboardPage.jsx      # 知识点列表
│  ├─ KnowledgePointFormPage.jsx
│  └─ FeynmanRecordPage.jsx  # 录音、转录、保存复述
├─ utils/
│  ├─ audio.js               # 音频解码、重采样与 WAV 编码
│  └─ getErrorMessage.js     # 统一提取后端错误信息
├─ App.jsx                   # 路由配置
└─ main.jsx                  # BrowserRouter + AuthProvider
```

## 说明

- 知识点内容以 **Markdown** 存储，因此页面统一使用 `react-markdown` 渲染，KaTeX 与 Mermaid 才能正常工作。
- 编辑器采用 Markdown 工具栏 + 实时预览，而不是生成 HTML 的富文本编辑器（如 React-Quill）；如果需要切换为 HTML 富文本，渲染侧必须改用 `DOMPurify.sanitize()` 后再 `dangerouslySetInnerHTML`。
- `react-markdown` 默认不执行 Markdown 中的原始 HTML，`<script>`、`onerror` 等内容不会被执行；Mermaid 生成的 SVG 还会额外经过 `DOMPurify` 过滤。
- 浏览器录音通常是 48kHz 的 WAV/WebM，百度短语音识别要求 16kHz WAV，因此 `utils/audio.js` 会先解码音频，用 `OfflineAudioContext` 重采样为 16kHz 单声道，再编码成 16-bit PCM WAV 上传。
- 上传音频时必须显式设置 `Content-Type: multipart/form-data`（axios 实例默认是 JSON），否则后端 multer 收不到文件。
- 百度语音识别凭证配置在后端 `.env`。未配置时接口返回 `503`，页面会提示先完成配置。
