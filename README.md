# 温 · 陪伴 App

一个移动优先的陪伴聊天网页。**打开就能用，不需要配置任何东西。**

---

## 三种用法，挑一个

### 1️⃣ 最简单：下载单文件（推荐先试这个）

下载 **[`温.html`](温.html)** 这一个文件，双击用浏览器打开就行。

- 不需要装任何东西，不需要联网也能开
- 整个 App 就在这一个文件里，可以拷到 U 盘、发给自己、随便放
- 记录存在浏览器里，下次打开还在

### 2️⃣ 手机上天天用：开 GitHub Pages（点 4 下，永久免费）

1. 打开 <https://github.com/choimsc34-ops/wen-companion/settings/pages>
2. **Source** 选 `Deploy from a branch`
3. **Branch** 选 `arena/01a0786f-wen-companion`，右边文件夹选 **`/docs`**
4. 点 **Save**，等 1 分钟

然后手机浏览器打开 `https://choimsc34-ops.github.io/wen-companion/`
→ 菜单里选「添加到主屏幕」→ 桌面上就有一个「温」的图标，跟正经 App 一样。

### 3️⃣ 想让 Key 留在服务器上：跑 Node 版

```bash
npm install
npm start          # 打开 http://localhost:3000
```

这个版本 API Key 存在服务器的 `data/config.json`，聊天记录也存服务器，换设备打开还在。

---

## 关于 API Key

**不填也能用。** 没有 Key 时是「体验模式」，温会用内置的话回你，界面和流程完全一样。

想要真正的 GPT：点右上角 **⋮** → 粘贴 OpenAI API Key → 保存并连接。

- 单文件版 / Pages 版：Key 只存在**你自己这台设备的浏览器**里，不上传任何服务器，直接连 OpenAI
- Node 版：Key 存在**你自己的服务器**上，网页代码里看不到

> ⚠️ 单文件版和 Pages 版的 Key 存在浏览器 localStorage 里。自己一个人用没问题，别在公用电脑上填，也别把填过 Key 的文件发给别人。

---

## 功能

- 微信式聊天界面，回复**逐字流式输出**
- 「温」的人格：成熟、稳定、短句、真人感
- **温的日记**：根据当天聊天生成第一人称日记，可翻看往期
- **我的日记**：边写边自动保存，可翻看往期
- 按真实日期分隔聊天记录（今天／昨天／具体日期）
- 一键导出全部记录备份成 JSON
- PWA：可装到手机桌面，离线也能打开

---

## 目录结构

```
温.html             单文件版（自动生成，别手改）
build-single.mjs    生成单文件版：node build-single.mjs

docs/               纯前端版，GitHub Pages 就指这里
  index.html  app.js  styles.css  sw.js  manifest.json  icons/

server.mjs          Node 版服务
src/persona.mjs     温的人格提示词
src/store.mjs       服务端持久化
src/demo.mjs        体验模式回复引擎
public/             Node 版前端
data/               运行时生成，已 gitignore（含 Key，别提交）
```

改了 `docs/` 里的东西之后，跑一下 `node build-single.mjs` 重新生成 `温.html`。

---

## 还可以做

- 每天定时自动生成温的日记
- 主动消息 / 推送通知
- 语音输入和语音回复
- 聊天记录搜索
- 云端同步，换手机记录还在
