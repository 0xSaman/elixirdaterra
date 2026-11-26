/* Armazenamento de pedidos.
   Na Netlify usa o Netlify Blobs (já incluso, sem configuração).
   Fora da Netlify (testes locais) usa arquivos JSON numa pasta. */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

let storePromise = null;

async function fileStore() {
  const dir = process.env.LOCAL_ORDERS_DIR || path.join(process.cwd(), ".data", "orders");
  await fs.mkdir(dir, { recursive: true });
  const file = (k) => path.join(dir, k.replace(/[^\w-]/g, "_") + ".json");
  return {
    async get(key) { try { return JSON.parse(await fs.readFile(file(key), "utf8")); } catch { return null; } },
    async set(key, val) { await fs.writeFile(file(key), JSON.stringify(val, null, 1)); },
    async keys() { return (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)); }
  };
}

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: "orders", consistency: "strong" });
  return {
    async get(key) { return (await store.get(key, { type: "json" })) || null; },
    async set(key, val) { await store.setJSON(key, val); },
    async keys() {
      const out = [];
      for await (const page of store.list({ paginate: true })) out.push(...page.blobs.map((b) => b.key));
      return out;
    }
  };
}

async function getStoreImpl() {
  if (!storePromise) {
    storePromise = (async () => {
      if (process.env.ORDERS_STORE === "file") return fileStore();
      try {
        const s = await blobStore();
        await s.get("__ping__"); // falha rápido se não estiver na Netlify
        return s;
      } catch (e) {
        if (process.env.NETLIFY || process.env.CONTEXT) throw e;
        console.warn("[orders] Netlify Blobs indisponível — usando arquivos locais em .data/orders");
        return fileStore();
      }
    })();
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
  const keys = (await s.keys()).filter((k) => k.startsWith("EDT-"));
  const all = await Promise.all(keys.map((k) => s.get(k)));
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
  const keys = (await s.keys()).filter((k) => k.startsWith("LEAD-"));
  const all = await Promise.all(keys.map((k) => s.get(k)));
  return all.filter((l) => l && !l.done).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)).slice(0, limit);
}

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
