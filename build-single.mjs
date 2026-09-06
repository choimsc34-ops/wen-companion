/**
 * 把 docs/ 打包成一个自包含的单文件网页：温.html
 * CSS、JS、图标全部内联，双击就能用，可以随便拷到任何地方。
 *   node build-single.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const D = (f) => path.join(__dirname, "docs", f);
const read = (f) => fs.readFileSync(D(f), "utf8");
const b64 = (f) => fs.readFileSync(D(f)).toString("base64");

const icon192 = `data:image/png;base64,${b64("icons/icon-192.png")}`;
const icon512 = `data:image/png;base64,${b64("icons/icon-512.png")}`;
const iconMask = `data:image/png;base64,${b64("icons/icon-maskable-512.png")}`;

const manifest = {
  name: "温",
  short_name: "温",
  description: "一个安静的陪伴。",
  start_url: ".",
  scope: ".",
  display: "standalone",
  orientation: "portrait",
  background_color: "#ededed",
  theme_color: "#ededed",
  lang: "zh-CN",
  icons: [
    { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
    { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    { src: iconMask, sizes: "512x512", type: "image/png", purpose: "maskable" }
  ]
};

let html = read("index.html");

// 移除外链，改为内联
html = html
  .replace(/\s*<link rel="manifest"[^>]*>/, "")
  .replace(/\s*<link rel="stylesheet"[^>]*>/, "")
  .replace(/\s*<script src="\.\/app\.js"><\/script>/, "")
  .replace(/<link rel="apple-touch-icon"[^>]*>/, `<link rel="apple-touch-icon" href="${icon192}">`)
  .replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${icon192}">`);

const css = read("styles.css");
const js = read("app.js").replace(
  /if \("serviceWorker" in navigator\) \{[\s\S]*?\}\s*\n/,
  "// 单文件版不注册 Service Worker（本身就已经离线可用）\n  "
);

const bootstrap = `
// 单文件版：运行时生成 manifest，让「添加到主屏幕」也能用
(function () {
  try {
    const m = ${JSON.stringify(manifest)};
    const blob = new Blob([JSON.stringify(m)], { type: "application/manifest+json" });
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = URL.createObjectURL(blob);
    document.head.appendChild(link);
  } catch (e) {}
})();
`;

html = html.replace("</head>", `<style>\n${css}\n</style>\n</head>`);
html = html.replace("</body>", `<script>\n${bootstrap}\n${js}\n</script>\n</body>`);

const out = path.join(__dirname, "温.html");
fs.writeFileSync(out, html, "utf8");
console.log(`已生成 ${out}  (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
