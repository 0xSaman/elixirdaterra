/* Proteções comuns das APIs: origem permitida (CORS), limite de requisições e IP do cliente. */
import { json } from "./http.mjs";

const ALLOWED_HOSTS = () => {
  const hosts = new Set(["elixirdaterra.com.br", "www.elixirdaterra.com.br", "elixirdaterra.netlify.app", "localhost", "127.0.0.1"]);
  for (const v of [process.env.URL, process.env.SITE_URL, process.env.DEPLOY_PRIME_URL]) {
    try { if (v) hosts.add(new URL(v).hostname); } catch {}
  }
  for (const h of String(process.env.ALLOWED_ORIGINS || "").split(",")) if (h.trim()) hosts.add(h.trim());
  return hosts;
};

/** Bloqueia chamadas feitas por outros sites (o navegador sempre envia Origin em POST cross-site). */
export function originAllowed(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true; // chamadas do próprio servidor/ferramentas (ex.: webhook do Mercado Pago)
  try {
    const host = new URL(origin).hostname;
    if (ALLOWED_HOSTS().has(host)) return true;
    return /^deploy-preview-\d+--elixirdaterra\.netlify\.app$/.test(host);
  } catch { return false; }
}

export function clientIp(req) {
  return (req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
}

/* Limite simples por IP em memória (por instância). A Netlify também aplica o limite
   declarado em `config.rateLimit` de cada função, que vale para todas as instâncias. */
const buckets = new Map();
export function tooMany(req, name, limit, windowSec) {
  const key = name + ":" + clientIp(req);
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) { buckets.set(key, { n: 1, reset: now + windowSec * 1000 }); return false; }
  b.n += 1;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
  return b.n > limit;
}

/** Aplica origem + limite. Retorna uma Response de erro, ou null se pode seguir. */
export function guard(req, name, limit = 30, windowSec = 60) {
  if (!originAllowed(req)) {
    console.warn(`[seguranca] origem bloqueada em ${name}: ${req.headers.get("origin")}`);
    return json(403, { message: "Origem não permitida." });
  }
  if (tooMany(req, name, limit, windowSec)) {
    console.warn(`[seguranca] limite excedido em ${name} (ip ${clientIp(req)})`);
    return json(429, { message: "Muitas tentativas. Aguarde um minuto e tente de novo." }, { "Retry-After": String(windowSec) });
  }
  return null;
}

export const rateLimit = (windowLimit, windowSize = 60) => ({ windowLimit, windowSize, aggregateBy: ["ip", "domain"] });
