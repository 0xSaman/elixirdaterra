/* Contas de clientes: cadastro, senha (scrypt), sessão por cookie assinado e pedidos da conta. */
import crypto from "node:crypto";
import { getKV, setKV, listOrders } from "./orders.mjs";

const COOKIE = "edt_sess";
const SESSION_DAYS = 30;

/* Chave das sessões: SESSION_SECRET (se existir) ou uma chave aleatória criada
   automaticamente no primeiro uso e guardada no armazenamento do site. */
let cachedSecret = null;
async function secret() {
  const env = process.env.SESSION_SECRET || "";
  if (env.length >= 16) return env;
  if (cachedSecret) return cachedSecret;
  const saved = await getKV("session-secret").catch(() => null);
  if (saved && saved.v) return (cachedSecret = saved.v);
  const v = crypto.randomBytes(48).toString("base64url");
  await setKV("session-secret", { v, createdAt: new Date().toISOString() });
  return (cachedSecret = v);
}

export const normEmail = (e) => String(e || "").trim().toLowerCase().slice(0, 160);
export const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
const userKey = (email) => "user-" + crypto.createHash("sha256").update(normEmail(email)).digest("hex").slice(0, 32);

export async function getUser(email) { return getKV(userKey(email)); }
export async function saveUser(u) { u.updatedAt = new Date().toISOString(); await setKV(userKey(u.email), u); return u; }

export function hashPassword(pw, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  return { salt, hash };
}
export function checkPassword(pw, user) {
  if (!user || !user.salt || !user.hash) return false;
  const { hash } = hashPassword(pw, user.salt);
  const a = Buffer.from(hash, "hex"), b = Buffer.from(user.hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ---------- sessão (cookie HttpOnly assinado) ---------- */
const sign = async (v) => crypto.createHmac("sha256", await secret()).update(v).digest("base64url");
export async function sessionCookie(user) {
  const exp = Date.now() + SESSION_DAYS * 864e5;
  const payload = Buffer.from(JSON.stringify({ e: user.email, v: user.sessionVersion || 1, x: exp })).toString("base64url");
  const val = payload + "." + (await sign(payload));
  return `${COOKIE}=${val}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export const clearCookie = () => `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function readCookie(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  return m ? m.slice(COOKIE.length + 1) : "";
}
/** Usuário da sessão, ou null. Confere assinatura, validade e versão (sair de todos os aparelhos). */
export async function currentUser(req) {
  const val = readCookie(req);
  const [payload, sig] = val.split(".");
  if (!payload || !sig) return null;
  const good = await sign(payload);
  if (good.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(good), Buffer.from(sig))) return null;
  let data; try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { return null; }
  if (!data.x || data.x < Date.now()) return null;
  const user = await getUser(data.e).catch(() => null);
  if (!user || (user.sessionVersion || 1) !== data.v) return null;
  return user;
}

/* ---------- visões seguras ---------- */
export const maskCpf = (c) => { const d = String(c || "").replace(/\D/g, ""); return d.length === 11 ? `***.***.${d.slice(6, 9)}-**` : ""; };
export function profileView(u) {
  return {
    name: u.name, email: u.email, phone: u.phone || "", cpfMasked: maskCpf(u.cpf), hasCpf: !!u.cpf,
    address: u.address || null, verified: !!u.verified, createdAt: u.createdAt
  };
}
export function accountOrderView(o) {
  return {
    id: o.id, createdAt: o.createdAt, status: o.status, history: o.history || [], method: o.method,
    installments: o.installments || 1, amount: o.amount, subtotal: o.subtotal, discount: o.discount || 0,
    items: (o.items || []).map((i) => ({ id: i.id, name: i.name, short: i.short, qty: i.qty, total: i.total })),
    shipping: o.shipping ? { name: o.shipping.name, price: o.shipping.price } : null,
    shipTo: o.address ? `${o.address.street}, ${o.address.number} · ${o.address.city}/${o.address.uf}` : "",
    tracking: o.tracking && o.tracking.code ? o.tracking : null
  };
}

/** Pedidos da conta: feitos logado, vinculados pelo cliente, ou do e-mail verificado. */
export async function ordersFor(user) {
  const linked = new Set(user.linkedOrders || []);
  const all = await listOrders(1000);
  return all.filter((o) => o.accountEmail === user.email || linked.has(o.id) || (user.verified && o.customer && o.customer.email === user.email));
}
