/* Cliente mínimo da API de Pagamentos do Mercado Pago (sem dependências). */
import crypto from "node:crypto";

// Aceita os nomes padrão (MP_*) e os nomes usados no painel da Netlify
export const env = {
  publicKey: () => (process.env.MP_PUBLIC_KEY || process.env.PublicKey || "").trim(),
  accessToken: () => (process.env.MP_ACCESS_TOKEN || process.env.AccessToken || "").trim(),
  webhookSecret: () => (process.env.MP_WEBHOOK_SECRET || process.env.AssinaturaSecreta || "").trim()
};
const API = () => (process.env.MP_API_BASE || "https://api.mercadopago.com").replace(/\/$/, "");

export const isConfigured = () => Boolean(env.accessToken() && env.publicKey());

export async function mpFetch(path, { method = "GET", body, headers = {} } = {}) {
  const res = await fetch(API() + path, {
    method,
    headers: { Authorization: `Bearer ${env.accessToken()}`, "Content-Type": "application/json", ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.message || `Mercado Pago HTTP ${res.status}`);
    err.status = res.status;
    err.mp = data;
    throw err;
  }
  return data;
}

/**
 * Valida a assinatura (x-signature) das notificações do Mercado Pago.
 * Template oficial: "id:[data.id];request-id:[x-request-id];ts:[ts];" com HMAC-SHA256
 * usando a assinatura secreta do painel. data.id alfanumérico vai em minúsculas.
 */
export function verifySignature(req, dataId) {
  const secret = env.webhookSecret();
  // Sem assinatura configurada, só aceitamos em testes locais
  if (!secret) return { ok: !(process.env.NETLIFY || process.env.CONTEXT), skipped: true };
  const sig = req.headers.get("x-signature") || "";
  const requestId = req.headers.get("x-request-id") || "";
  const parts = {};
  for (const piece of sig.split(",")) {
    const [k, v] = piece.split("=").map((s) => s && s.trim());
    if (k && v) parts[k] = v;
  }
  if (!parts.ts || !parts.v1) return { ok: false };
  const id = /^[a-z0-9]+$/i.test(String(dataId)) ? String(dataId).toLowerCase() : String(dataId);
  let manifest = "";
  if (id) manifest += `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return { ok: a.length === b.length && crypto.timingSafeEqual(a, b) };
}

/** Status do Mercado Pago → status do pedido na loja */
export function orderStatusFromPayment(p) {
  if (p.status === "approved") return "paid";
  if (["cancelled", "rejected", "refunded", "charged_back"].includes(p.status)) return "cancelled";
  return "pending_payment";
}
