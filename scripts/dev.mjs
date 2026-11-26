/* Servidor local que imita o Vercel: serve o site gerado (_site) e as funções de api/ em /api/*.
   Uso:  npm run build && node scripts/dev.mjs     → http://localhost:8888
   (lê variáveis do arquivo .env, se existir). Alternativa oficial: "npx vercel dev". */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PORT = Number(process.env.PORT || 8888);
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// carrega as funções como o Vercel: api/<nome>.js → /api/<nome>, com um export por método (GET, POST…)
const routes = {};
for (const f of fs.readdirSync(path.join(ROOT, "api"))) {
  if (!f.endsWith(".js") || f.startsWith("_")) continue;
  const mod = await import(pathToFileURL(path.join(ROOT, "api", f)).href);
  routes[`/api/${f.replace(/\.js$/, "")}`] = (req) => (mod[req.method] ? mod[req.method](req) : new Response("Method Not Allowed", { status: 405 }));
}

const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".xml": "application/xml", ".txt": "text/plain", ".webmanifest": "application/manifest+json" };

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const fn = routes[url.pathname];
  if (fn) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    try {
      const r = await fn(request, {});
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) { console.error(e); res.writeHead(500); res.end("erro"); }
    return;
  }
  let file = path.join(ROOT, "_site", decodeURIComponent(url.pathname));
  if (!file.startsWith(path.join(ROOT, "_site"))) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) { res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" }); return res.end(fs.readFileSync(path.join(ROOT, "_site/404.html"))); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`Loja em http://localhost:${PORT} — ${process.env.MP_ACCESS_TOKEN ? "Mercado Pago configurado" : "modo demonstração"} — funções: ${Object.keys(routes).join(", ")}`));
