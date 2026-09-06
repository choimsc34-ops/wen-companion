import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

import { PERSONA, DIARY_INSTRUCTIONS } from "./src/persona.mjs";
import { demoReply, demoDiary } from "./src/demo.mjs";
import {
  addMessage,
  getMessages,
  clearMessages,
  setWenDiary,
  setMyDiary,
  getDiaries,
  getConfig,
  setConfig
} from "./src/store.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public"), { maxAge: 0 }));

const DEFAULT_MODEL = "gpt-5.6-terra";

/* ---------- OpenAI 客户端：env 优先，其次网页里设置的 Key ---------- */

async function resolveSettings() {
  const cfg = await getConfig();
  const apiKey = process.env.OPENAI_API_KEY || cfg.apiKey || "";
  const model = process.env.OPENAI_MODEL || cfg.model || DEFAULT_MODEL;
  const fromEnv = Boolean(process.env.OPENAI_API_KEY);
  return { apiKey, model, fromEnv };
}

async function getClient() {
  const { apiKey, model } = await resolveSettings();
  if (!apiKey) return null;
  return { client: new OpenAI({ apiKey }), model };
}

function friendlyError(e) {
  const status = e?.status || e?.response?.status;
  if (status === 401) return "API Key 不对，或者已经失效了。";
  if (status === 429) return "请求太频繁，或者账户额度用完了。";
  if (status === 404) return "这个模型你的账号可能没有权限，换一个试试。";
  return e?.message || "温这边出了点问题。";
}

const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); // YYYY-MM-DD

/* ---------- 状态 & 设置 ---------- */

app.get("/api/status", async (req, res) => {
  const { apiKey, model, fromEnv } = await resolveSettings();
  res.json({
    mode: apiKey ? "live" : "demo",
    model,
    keySource: fromEnv ? "env" : apiKey ? "app" : "none",
    canEditKey: !fromEnv
  });
});

app.post("/api/settings", async (req, res) => {
  try {
    const apiKey = String(req.body.apiKey || "").trim();
    const model = String(req.body.model || "").trim() || DEFAULT_MODEL;

    if (!apiKey) return res.status(400).json({ error: "请填写 API Key。" });

    // 先验证再保存，避免存一个坏 Key
    const probe = new OpenAI({ apiKey });
    await probe.models.list();

    await setConfig({ apiKey, model });
    res.json({ ok: true, mode: "live", model });
  } catch (e) {
    res.status(400).json({ error: friendlyError(e) });
  }
});

app.post("/api/settings/model", async (req, res) => {
  const model = String(req.body.model || "").trim() || DEFAULT_MODEL;
  await setConfig({ model });
  res.json({ ok: true, model });
});

app.delete("/api/settings", async (req, res) => {
  await setConfig({ apiKey: null });
  res.json({ ok: true, mode: "demo" });
});

app.get("/api/models", async (req, res) => {
  const conn = await getClient();
  if (!conn) return res.json({ models: [] });
  try {
    const list = await conn.client.models.list();
    const models = list.data
      .map((m) => m.id)
      .filter((id) => /^(gpt|o[134])/.test(id) && !/audio|image|realtime|tts|whisper|embed|moderation/.test(id))
      .sort();
    res.json({ models });
  } catch {
    res.json({ models: [] });
  }
});

/* ---------- 历史 ---------- */

app.get("/api/history", async (req, res) => {
  const [messages, diaries] = await Promise.all([getMessages(), getDiaries()]);
  res.json({ messages, ...diaries });
});

app.delete("/api/history", async (req, res) => {
  await clearMessages();
  res.json({ ok: true });
});

/* ---------- 聊天（流式） ---------- */

app.post("/api/chat", async (req, res) => {
  const text = String(req.body.text || "").trim();
  if (!text) return res.status(400).json({ error: "说点什么呀。" });

  await addMessage("user", text);
  const history = await getMessages();

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event, data) =>
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const conn = await getClient();
  let full = "";

  try {
    if (!conn) {
      // 体验模式：本地逐字输出，保持打字机手感
      const reply = demoReply(history);
      for (const ch of reply) {
        full += ch;
        send("delta", { text: ch });
        await new Promise((r) => setTimeout(r, 28));
      }
    } else {
      const input = history.slice(-40).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || "")
      }));

      const stream = await conn.client.responses.create({
        model: conn.model,
        instructions: PERSONA,
        input,
        stream: true,
        store: false
      });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta" && event.delta) {
          full += event.delta;
          send("delta", { text: event.delta });
        } else if (event.type === "response.failed" || event.type === "error") {
          throw new Error(event.error?.message || "生成失败");
        }
      }
    }

    if (!full.trim()) full = "嗯？过来。";
    const saved = await addMessage("assistant", full);
    send("done", { message: saved });
  } catch (e) {
    console.error("chat error:", e.message);
    if (full.trim()) {
      const saved = await addMessage("assistant", full);
      send("done", { message: saved });
    } else {
      send("fail", { error: friendlyError(e) });
    }
  } finally {
    res.end();
  }
});

/* ---------- 温的日记 ---------- */

app.post("/api/diary/wen", async (req, res) => {
  const date = String(req.body.date || today());
  const all = await getMessages();

  const dayMessages = all.filter(
    (m) =>
      new Date(m.ts).toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }) === date
  );

  try {
    const conn = await getClient();
    let text;

    if (!conn) {
      text = demoDiary(dayMessages);
    } else {
      const transcript =
        dayMessages.map((m) => `${m.role === "user" ? "她" : "我"}：${m.content}`).join("\n") ||
        "今天没有足够的聊天记录，就写一点想她的心情。";

      const response = await conn.client.responses.create({
        model: conn.model,
        instructions: DIARY_INSTRUCTIONS,
        input: transcript,
        store: false
      });
      text = response.output_text || "今天也没什么大事。只是想到她，心里还是软了一下。";
    }

    await setWenDiary(date, text);
    res.json({ date, text });
  } catch (e) {
    console.error("diary error:", e.message);
    res.status(500).json({ error: friendlyError(e) });
  }
});

/* ---------- 我的日记 ---------- */

app.put("/api/diary/my", async (req, res) => {
  const date = String(req.body.date || today());
  await setMyDiary(date, String(req.body.text || ""));
  res.json({ ok: true, date });
});

/* ---------- 启动 ---------- */

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", async () => {
  const { apiKey } = await resolveSettings();
  console.log(`温已经启动 → http://localhost:${PORT}`);
  console.log(apiKey ? "模式：真实 GPT" : "模式：体验模式（在网页右上角设置里填 API Key 可切换到真实 GPT）");
});
