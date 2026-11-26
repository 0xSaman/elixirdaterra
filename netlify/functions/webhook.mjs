/* POST /api/webhook — notificações do Mercado Pago (evento "Pagamentos").
   Atualiza o pedido e dispara os e-mails de pagamento aprovado (uma única vez). */
import { json, readJson, siteUrl } from "../lib/http.mjs";
import { mpFetch, isConfigured, verifySignature, orderStatusFromPayment } from "../lib/mp.mjs";
import { getOrder, saveOrder, setStatus } from "../lib/orders.mjs";
import { sendPaidEmailsOnce } from "../lib/email.mjs";
import { tooMany, rateLimit } from "../lib/security.mjs";

export default async (req) => {
  if (req.method !== "POST") return json(200, { ok: true });
  if (tooMany(req, "webhook", 120, 60)) return json(429, { message: "Muitas requisições" });
  if (!isConfigured()) return json(200, { ok: true, ignored: "not-configured" });

  const url = new URL(req.url);
  const q = Object.fromEntries(url.searchParams);
  const body = await readJson(req).catch(() => ({}));
  const type = q.type || q.topic || body.type || body.topic;
  const dataId = q["data.id"] || q.id || body?.data?.id;
  if (type !== "payment" || !dataId) return json(200, { ok: true, ignored: type || "unknown" });

  if (!verifySignature(req, dataId).ok) {
    console.warn("[webhook] assinatura inválida", dataId);
    return json(401, { message: "assinatura inválida" });
  }

  try {
    const p = await mpFetch(`/v1/payments/${encodeURIComponent(dataId)}`);
    const orderId = p.external_reference || p.metadata?.order_id;
    console.log(`[webhook] ${orderId} → ${p.status}/${p.status_detail}`);
    const order = orderId ? await getOrder(orderId) : null;
    if (!order) return json(200, { ok: true, missing: orderId || null });

    const next = orderStatusFromPayment(p);
    let changed = false;
    // Não "volta" um pedido já enviado/entregue por causa de notificações atrasadas
    if (next === "paid" && ["pending_payment", "cancelled"].includes(order.status)) changed = setStatus(order, "paid");
    if (next === "cancelled" && ["pending_payment", "paid"].includes(order.status)) changed = setStatus(order, "cancelled");
    if (order.status === "paid") await sendPaidEmailsOnce(order, siteUrl(req));
    if (changed || order.emails?.paid) await saveOrder(order);
    return json(200, { ok: true });
  } catch (e) {
    console.error("[webhook] erro", e.status, e.message);
    return json(500, { message: "erro ao processar" }); // o Mercado Pago tenta de novo depois
  }
};

export const config = { path: "/api/webhook", rateLimit: rateLimit(240) };
