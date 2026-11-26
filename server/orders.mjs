/* Armazenamento de pedidos, contas, carrinhos abandonados e formulários.
   No Vercel usa Redis (Upstash, pelo Marketplace do Vercel: Storage > Upstash for Redis).
   O Vercel cria sozinho as variáveis KV_REST_API_URL e KV_REST_API_TOKEN ao conectar o banco
   (também aceita UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
   Fora do Vercel (testes locais) usa arquivos JSON numa pasta. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

let storePromise = null;
const PREFIX = "edt:";
const isHosted = () => Boolean(process.env.VERCEL);

async function fileStore() {
  const dir = process.env.LOCAL_ORDERS_DIR || path.join(process.cwd(), ".data", "orders");
  await fs.mkdir(dir, { recursive: true });
  const file = (k) => path.join(dir, k.replace(/[^\w-]/g, "_") + ".json");
  return {
    async get(key) { try { return JSON.parse(await fs.readFile(file(key), "utf8")); } catch { return null; } },
    async set(key, val) { await fs.writeFile(file(key), JSON.stringify(val, null, 1)); },
    async keys(prefix = "") { return (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).filter((k) => k.startsWith(prefix)); },
    async getMany(keys) { return Promise.all(keys.map((k) => this.get(k))); }
  };
}

export function redisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "";
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
  return url && token ? { url, token } : null;
}

async function redisStore(cfg) {
  const { Redis } = await import("@upstash/redis");
  const redis = new Redis({ url: cfg.url, token: cfg.token });
  return {
    async get(key) { return (await redis.get(PREFIX + key)) ?? null; },
    async set(key, val) { await redis.set(PREFIX + key, val); },
    async keys(prefix = "") {
      const out = []; let cursor = "0";
      do {
        const [next, batch] = await redis.scan(cursor, { match: PREFIX + prefix + "*", count: 1000 });
        out.push(...batch.map((k) => k.slice(PREFIX.length)));
        cursor = String(next);
      } while (cursor !== "0");
      return [...new Set(out)];
    },
    async getMany(keys) {
      const res = [];
      for (let i = 0; i < keys.length; i += 500) {
        const part = keys.slice(i, i + 500);
        if (part.length) res.push(...(await redis.mget(...part.map((k) => PREFIX + k))));
      }
      return res.map((v) => v ?? null);
    }
  };
}

async function getStoreImpl() {
  if (!storePromise) {
    storePromise = (async () => {
      if (process.env.ORDERS_STORE === "file") return fileStore();
      const cfg = redisEnv();
      if (cfg) return redisStore(cfg);
      if (isHosted()) throw new Error("Banco de dados não configurado: conecte o Upstash for Redis em Vercel > Storage (variáveis KV_REST_API_URL e KV_REST_API_TOKEN).");
      console.warn("[orders] Redis não configurado — usando arquivos locais em .data/orders");
      return fileStore();
    })();
    storePromise.catch(() => { storePromise = null; });
  }
  return storePromise;
}

export async function getOrder(id) { return (await getStoreImpl()).get(id); }

export async function saveOrder(order) {
  order.updatedAt = new Date().toISOString();
  await (await getStoreImpl()).set(order.id, order);
  return order;
}

export async function listOrders(limit = 500) {
  const s = await getStoreImpl();
  const all = await s.getMany(await s.keys("EDT-"));
  return all.filter(Boolean).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}

/* ---------- Contadores de segurança (tentativas de login) ---------- */
export async function getKV(key) { return (await getStoreImpl()).get("SEC-" + key); }
export async function setKV(key, val) { await (await getStoreImpl()).set("SEC-" + key, val); }

/* ---------- Carrinhos abandonados (contatos do checkout que não finalizaram) ---------- */
export const leadKey = (email) => "LEAD-" + crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 24);
export async function saveLead(lead) {
  const s = await getStoreImpl();
  const key = leadKey(lead.email);
  const prev = await s.get(key);
  const now = new Date().toISOString();
  const val = { ...(prev || {}), ...lead, key, createdAt: prev?.createdAt || now, updatedAt: now };
  await s.set(key, val);
  return val;
}
export async function deleteLead(keyOrEmail) {
  const s = await getStoreImpl();
  const key = String(keyOrEmail).startsWith("LEAD-") ? keyOrEmail : leadKey(keyOrEmail);
  const cur = await s.get(key);
  if (cur) await s.set(key, { ...cur, done: true, updatedAt: new Date().toISOString() });
}
export async function listLeads(limit = 300) {
  const s = await getStoreImpl();
  const all = await s.getMany(await s.keys("LEAD-"));
  return all.filter((l) => l && !l.done).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, limit);
}

/* ---------- Formulários do site (contato e cupom de primeira compra) ---------- */
export async function saveForm(entry) {
  const now = new Date().toISOString();
  const key = "FORM-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(3).toString("hex").toUpperCase();
  const val = { ...entry, key, createdAt: now };
  await (await getStoreImpl()).set(key, val);
  return val;
}
export async function markFormDone(key) {
  if (!/^FORM-[A-Z0-9a-f]+$/i.test(String(key))) return;
  const s = await getStoreImpl();
  const cur = await s.get(key);
  if (cur) await s.set(key, { ...cur, done: true, doneAt: new Date().toISOString() });
}
export async function listForms(limit = 200) {
  const s = await getStoreImpl();
  const all = await s.getMany(await s.keys("FORM-"));
  return all.filter((f) => f && !f.done).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, limit);
}

/* Exportação/importação usada na migração Netlify → Vercel */
export async function rawStore() { return getStoreImpl(); }

/** Muda o status registrando no histórico. Retorna true se mudou. */
export function setStatus(order, status) {
  if (order.status === status) return false;
  order.status = status;
  order.history = order.history || [];
  order.history.push({ status, at: new Date().toISOString() });
  return true;
}

/** Visão pública (página de rastreio): sem CPF, telefone ou endereço completo. */
export function publicView(o) {
  return {
    id: o.id,
    createdAt: o.createdAt,
    status: o.status,
    history: o.history || [],
    method: o.method,
    installments: o.installments || 1,
    amount: o.amount,
    discount: o.discount || 0,
    items: o.items.map((i) => ({ name: i.name, qty: i.qty, total: i.total })),
    shipTo: `${o.address.city}/${o.address.uf}`,
    shipping: o.shipping ? { name: o.shipping.name, price: o.shipping.price } : null,
    tracking: o.tracking && o.tracking.code ? o.tracking : null
  };
}

/* ---------- Cupom de primeira compra ---------- */
// E-mail normalizado: minúsculas e sem "+apelido" (fulano+2@gmail.com = fulano@gmail.com; no Gmail os pontos também não contam)
export function normEmailKey(e) {
  let [u, d] = String(e || "").trim().toLowerCase().split("@");
  if (!u || !d) return "";
  u = u.split("+")[0];
  if (d === "gmail.com" || d === "googlemail.com") { u = u.replace(/\./g, ""); d = "gmail.com"; }
  return u + "@" + d;
}
const PAIDISH = ["paid", "preparing", "shipped", "delivered"];
/** true se esta pessoa (CPF, e-mail ou celular) já tem uma compra paga. */
export async function hasPaidPurchase({ email, cpf, phone } = {}) {
  const em = normEmailKey(email), c = String(cpf || "").replace(/\D/g, ""), ph = String(phone || "").replace(/\D/g, "").slice(-9);
  if (!em && c.length !== 11 && ph.length < 8) return false;
  const orders = await listOrders(5000);
  return orders.some((o) => {
    if (!PAIDISH.includes(o.status) || !o.customer) return false;
    const oc = o.customer;
    return (c.length === 11 && String(oc.cpf || "").replace(/\D/g, "") === c) ||
      (em && (normEmailKey(oc.email) === em || normEmailKey(o.accountEmail) === em)) ||
      (ph.length >= 8 && String(oc.phone || "").replace(/\D/g, "").slice(-9) === ph);
  });
}
