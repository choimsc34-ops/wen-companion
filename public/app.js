const $ = (s) => document.querySelector(s);
const api = (url, opts) => fetch(url, opts).then(async (r) => {
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "请求失败");
  return d;
});

const state = {
  messages: [],
  wenDiary: {},
  myDiary: {},
  wenDate: todayStr(),
  myDate: todayStr(),
  sending: false,
  mode: "demo"
};

function todayStr() {
  return new Date().toLocaleDateString("sv-SE");
}
function dateOf(ts) {
  return new Date(ts).toLocaleDateString("sv-SE");
}
function shiftDate(d, n) {
  const dt = new Date(d + "T12:00:00");
  dt.setDate(dt.getDate() + n);
  return dt.toLocaleDateString("sv-SE");
}
function prettyDate(d) {
  if (d === todayStr()) return "今天";
  if (d === shiftDate(todayStr(), -1)) return "昨天";
  const dt = new Date(d + "T12:00:00");
  const sameYear = dt.getFullYear() === new Date().getFullYear();
  return dt.toLocaleDateString("zh-CN", {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric"
  });
}

function toast(text, ms = 1800) {
  const t = $("#toast");
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), ms);
}

/* ---------------- 聊天渲染 ---------------- */

function bubbleRow(role, text) {
  const row = document.createElement("div");
  row.className = "row " + (role === "user" ? "me" : "wen");
  const pic = document.createElement("div");
  pic.className = "pic";
  pic.textContent = role === "user" ? "我" : "温";
  const b = document.createElement("div");
  b.className = "bubble";
  b.textContent = text;
  row.append(pic, b);
  return { row, bubble: b };
}

function renderChat() {
  const c = $("#chat");
  c.innerHTML = "";

  if (!state.messages.length) {
    const d = document.createElement("div");
    d.className = "empty-chat";
    d.textContent = "还没有聊过天。\n跟他说句话吧。";
    d.style.whiteSpace = "pre-line";
    c.appendChild(d);
    return;
  }

  let lastDate = "";
  for (const m of state.messages) {
    const d = dateOf(m.ts);
    if (d !== lastDate) {
      const sep = document.createElement("div");
      sep.className = "day";
      sep.textContent = prettyDate(d);
      c.appendChild(sep);
      lastDate = d;
    }
    c.appendChild(bubbleRow(m.role, m.content).row);
  }
  scrollBottom();
}

function scrollBottom(smooth) {
  const v = $("#view-chat");
  v.scrollTo({ top: v.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

/* ---------------- 发送（SSE 流式） ---------------- */

async function send() {
  const el = $("#input");
  const text = el.value.trim();
  if (!text || state.sending) return;

  state.sending = true;
  $("#sendBtn").disabled = true;
  el.value = "";
  el.style.height = "auto";

  const now = Date.now();
  if (!state.messages.length || dateOf(now) !== dateOf(state.messages.at(-1).ts)) {
    // 需要新的日期分隔线，整体重绘更简单
    state.messages.push({ id: "tmp", role: "user", content: text, ts: now });
    renderChat();
  } else {
    if (state.messages.length === 0) $("#chat").innerHTML = "";
    $("#chat").querySelector(".empty-chat")?.remove();
    state.messages.push({ id: "tmp", role: "user", content: text, ts: now });
    $("#chat").appendChild(bubbleRow("user", text).row);
  }
  scrollBottom(true);

  const { row, bubble } = bubbleRow("assistant", "");
  bubble.classList.add("typing");
  bubble.textContent = "正在输入";
  $("#chat").appendChild(row);
  scrollBottom(true);

  let acc = "";
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    if (!res.ok || !res.body) throw new Error("连接失败");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const chunks = buf.split("\n\n");
      buf = chunks.pop() || "";

      for (const chunk of chunks) {
        const evLine = chunk.match(/^event: (.+)$/m);
        const dataLine = chunk.match(/^data: (.+)$/m);
        if (!evLine || !dataLine) continue;
        const ev = evLine[1];
        const data = JSON.parse(dataLine[1]);

        if (ev === "delta") {
          if (!acc) bubble.classList.remove("typing");
          acc += data.text;
          bubble.textContent = acc;
          bubble.insertAdjacentHTML("beforeend", '<i class="cursor"></i>');
          scrollBottom();
        } else if (ev === "done") {
          bubble.textContent = data.message.content;
          state.messages.pop();
          state.messages.push({ role: "user", content: text, ts: now });
          state.messages.push(data.message);
        } else if (ev === "fail") {
          throw new Error(data.error);
        }
      }
    }
    if (!acc) throw new Error("温没有回话，检查一下设置。");
  } catch (e) {
    bubble.classList.remove("typing");
    bubble.textContent = acc || `没接上。${e.message}`;
  } finally {
    state.sending = false;
    $("#sendBtn").disabled = false;
    scrollBottom(true);
  }
}

/* ---------------- 日记 ---------------- */

function renderWen() {
  $("#wenDate").textContent = prettyDate(state.wenDate);
  const entry = state.wenDiary[state.wenDate];
  const el = $("#wenEntry");
  el.textContent = entry?.text || "这一天还没写。";
  el.classList.toggle("empty", !entry);
  $("#writeWenBtn").textContent = entry ? "重新写一篇" : "让温写这天的日记";
  document.querySelector('[data-nav="wen"][data-dir="1"]').disabled =
    state.wenDate >= todayStr();
}

async function writeWenDiary() {
  const btn = $("#writeWenBtn");
  const el = $("#wenEntry");
  btn.disabled = true;
  el.classList.add("empty");
  el.textContent = "温正在写……";
  try {
    const d = await api("/api/diary/wen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: state.wenDate })
    });
    state.wenDiary[d.date] = { text: d.text, ts: Date.now() };
    renderWen();
  } catch (e) {
    el.textContent = e.message;
  } finally {
    btn.disabled = false;
  }
}

function renderMy() {
  $("#myDate").textContent = prettyDate(state.myDate);
  $("#myDiaryBox").value = state.myDiary[state.myDate]?.text || "";
  $("#saveHint").textContent = "";
  document.querySelector('[data-nav="my"][data-dir="1"]').disabled =
    state.myDate >= todayStr();
}

let saveTimer;
function autoSaveMy() {
  clearTimeout(saveTimer);
  $("#saveHint").textContent = "正在保存…";
  const date = state.myDate;
  const text = $("#myDiaryBox").value;
  saveTimer = setTimeout(async () => {
    try {
      await api("/api/diary/my", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text })
      });
      if (text.trim()) state.myDiary[date] = { text, ts: Date.now() };
      else delete state.myDiary[date];
      $("#saveHint").textContent = "已保存";
      setTimeout(() => ($("#saveHint").textContent = ""), 1600);
    } catch {
      $("#saveHint").textContent = "保存失败";
    }
  }, 700);
}

/* ---------------- 标签切换 ---------------- */

function switchTab(name) {
  for (const v of ["chat", "wen", "my"]) {
    $("#view-" + v).classList.toggle("active", v === name);
  }
  document.querySelectorAll(".tab").forEach((t) =>
    t.classList.toggle("on", t.dataset.tab === name)
  );
  $("#compose").style.display = name === "chat" ? "flex" : "none";
  if (name === "chat") scrollBottom();
  if (name === "wen") renderWen();
  if (name === "my") renderMy();
}

/* ---------------- 设置 ---------------- */

async function loadStatus() {
  try {
    const s = await api("/api/status");
    state.mode = s.mode;
    $("#status").textContent =
      s.mode === "live" ? `在线 · 正在等你` : "体验模式 · 未连接 GPT";
    const badge = $("#modeBadge");
    badge.className = "badge " + s.mode;
    badge.textContent = s.mode === "live" ? "已连接 GPT" : "体验模式";
    $("#modeDesc").textContent =
      s.mode === "live"
        ? `模型 ${s.model}`
        : "填入 API Key 后就是真实的温";
    $("#modelInput").placeholder = s.model;
    $("#keyBlock").style.display = s.canEditKey ? "" : "none";
    if (!s.canEditKey) $("#modeDesc").textContent += "（由服务器环境变量配置）";
    if (s.mode === "live") loadModels();
  } catch {
    $("#status").textContent = "连不上服务器";
  }
}

async function loadModels() {
  try {
    const { models } = await api("/api/models");
    $("#modelList").innerHTML = models
      .map((m) => `<option value="${m}">`)
      .join("");
  } catch {}
}

function openSheet() {
  $("#sheet").hidden = false;
  $("#sheetMask").hidden = false;
  $("#sheetMsg").textContent = "";
  loadStatus();
}
function closeSheet() {
  $("#sheet").hidden = true;
  $("#sheetMask").hidden = true;
}

async function saveKey() {
  const apiKey = $("#apiKey").value.trim();
  const model = $("#modelInput").value.trim();
  const msg = $("#sheetMsg");
  if (!apiKey) {
    msg.className = "msg err";
    msg.textContent = "先填 API Key。";
    return;
  }
  $("#saveKeyBtn").disabled = true;
  msg.className = "msg";
  msg.textContent = "正在验证…";
  try {
    await api("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, model })
    });
    $("#apiKey").value = "";
    msg.className = "msg ok";
    msg.textContent = "连上了。现在是真实的温。";
    await loadStatus();
    setTimeout(closeSheet, 900);
  } catch (e) {
    msg.className = "msg err";
    msg.textContent = e.message;
  } finally {
    $("#saveKeyBtn").disabled = false;
  }
}

/* ---------------- 初始化 ---------------- */

async function init() {
  try {
    const d = await api("/api/history");
    state.messages = d.messages || [];
    state.wenDiary = d.wen || {};
    state.myDiary = d.my || {};
  } catch {}
  renderChat();
  loadStatus();

  // 事件绑定
  $("#sendBtn").onclick = send;
  $("#input").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  $("#input").addEventListener("input", (e) => {
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  });

  document.querySelectorAll(".tab").forEach((t) => {
    t.onclick = () => switchTab(t.dataset.tab);
  });

  document.querySelectorAll("[data-nav]").forEach((b) => {
    b.onclick = () => {
      const dir = Number(b.dataset.dir);
      if (b.dataset.nav === "wen") {
        state.wenDate = shiftDate(state.wenDate, dir);
        renderWen();
      } else {
        state.myDate = shiftDate(state.myDate, dir);
        renderMy();
      }
    };
  });

  $("#writeWenBtn").onclick = writeWenDiary;
  $("#myDiaryBox").addEventListener("input", autoSaveMy);

  $("#settingsBtn").onclick = openSheet;
  $("#closeSheet").onclick = closeSheet;
  $("#sheetMask").onclick = closeSheet;
  $("#saveKeyBtn").onclick = saveKey;

  $("#clearKeyBtn").onclick = async () => {
    await api("/api/settings", { method: "DELETE" });
    toast("已断开，回到体验模式");
    loadStatus();
  };

  $("#clearChatBtn").onclick = async () => {
    if (!confirm("聊天记录会全部删掉，确定？")) return;
    await api("/api/history", { method: "DELETE" });
    state.messages = [];
    renderChat();
    closeSheet();
    toast("清空了");
  };

  // PWA
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }
  let deferred;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e;
    $("#installBtn").hidden = false;
  });
  $("#installBtn").onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    deferred = null;
    $("#installBtn").hidden = true;
  };
}

init();
