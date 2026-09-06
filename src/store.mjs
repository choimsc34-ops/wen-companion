import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

const EMPTY_STORE = { messages: [], wenDiary: {}, myDiary: {} };

let cache = null;
let writeQueue = Promise.resolve();

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson(file, fallback) {
  try {
    const raw = await fs.readFile(file, "utf8");
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

async function writeJson(file, data) {
  await ensureDir();
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

/* ---------- 聊天与日记 ---------- */

export async function getStore() {
  if (!cache) cache = await readJson(STORE_FILE, EMPTY_STORE);
  return cache;
}

function persist() {
  writeQueue = writeQueue
    .then(() => writeJson(STORE_FILE, cache))
    .catch((e) => console.error("写入失败:", e.message));
  return writeQueue;
}

export async function addMessage(role, content) {
  const store = await getStore();
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    ts: Date.now()
  };
  store.messages.push(msg);
  if (store.messages.length > 2000) store.messages = store.messages.slice(-2000);
  await persist();
  return msg;
}

export async function getMessages() {
  return (await getStore()).messages;
}

export async function clearMessages() {
  const store = await getStore();
  store.messages = [];
  await persist();
}

export async function setWenDiary(date, text) {
  const store = await getStore();
  store.wenDiary[date] = { text, ts: Date.now() };
  await persist();
}

export async function setMyDiary(date, text) {
  const store = await getStore();
  if (text.trim()) store.myDiary[date] = { text, ts: Date.now() };
  else delete store.myDiary[date];
  await persist();
}

export async function getDiaries() {
  const store = await getStore();
  return { wen: store.wenDiary, my: store.myDiary };
}

/* ---------- 配置（API Key 只留在服务端） ---------- */

let configCache = null;

export async function getConfig() {
  if (!configCache) configCache = await readJson(CONFIG_FILE, {});
  return configCache;
}

export async function setConfig(patch) {
  const cfg = await getConfig();
  configCache = { ...cfg, ...patch };
  for (const k of Object.keys(configCache)) {
    if (configCache[k] === null) delete configCache[k];
  }
  await writeJson(CONFIG_FILE, configCache);
  return configCache;
}

export { DATA_DIR };
