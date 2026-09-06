# 温 · 陪伴 Web App

一个移动优先的陪伴聊天网页。打开就能用，不需要先配置任何东西。

## 直接开始

```bash
npm install
npm start
```

浏览器打开 `http://localhost:3000` 就行。

第一次打开是**体验模式**：不需要 API Key，温也会回你话（本地脚本，保持人设）。
想要真正的 GPT，点右上角「⋮」→ 填入 OpenAI API Key → 保存并连接。
Key 只写在服务器上的 `data/config.json`，不会出现在网页代码里，也不会再传回浏览器。

也可以走环境变量（服务器部署时更合适）：复制 `.env.example` 为 `.env` 再填。

## 功能

- 微信式聊天界面，回复**逐字流式输出**
- 「温」的人格提示词，短句、真人感
- **温的日记**：根据当天聊天生成第一人称日记，可翻看往期
- **我的日记**：边写边自动保存，可翻看往期
- 聊天记录和日记存在服务器 `data/store.json`，换设备打开还在
- 按真实日期分隔聊天记录（今天／昨天／具体日期）
- 网页内切换 API Key 和模型，不用重启
- 完整 PWA：可装到手机桌面，离线也能打开界面

## 目录结构

```
server.mjs          Express 服务 + 全部接口
src/persona.mjs     温的人格提示词
src/store.mjs       JSON 持久化（聊天、日记、配置）
src/demo.mjs        体验模式的本地回复引擎
public/             前端（index.html / app.js / styles.css / sw.js / icons）
data/               运行时生成，已 gitignore（含 API Key，别提交）
```

## 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/status` | 当前模式、模型 |
| POST | `/api/settings` | 保存并验证 API Key、模型 |
| DELETE | `/api/settings` | 断开，回到体验模式 |
| GET | `/api/models` | 账号可用模型列表 |
| GET | `/api/history` | 聊天记录 + 两本日记 |
| DELETE | `/api/history` | 清空聊天记录 |
| POST | `/api/chat` | 发消息，SSE 流式返回 |
| POST | `/api/diary/wen` | 生成某天温的日记 |
| PUT | `/api/diary/my` | 保存某天我的日记 |

## 部署到手机随时能用

项目是标准的 Node 服务，任何支持 Node 18+ 的平台都能跑（Railway、Render、Fly.io、自己的 VPS 都行）。
部署后把域名在手机浏览器打开，「添加到主屏幕」，就是一个独立 App。

注意：`data/` 是本地文件存储。用容器化平台部署时要挂一个持久卷，否则重启会丢数据。

## 还可以做

- 每天定时自动生成温的日记
- 主动消息 / 推送通知
- 语音输入和语音回复
- 聊天记录搜索
- 多用户登录与私密数据保护
