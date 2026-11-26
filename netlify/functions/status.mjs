/* GET /api/status?id=<id do pagamento> — usado pela tela do Pix para confirmar o pagamento.
   Também atualiza o pedido, então a confirmação funciona mesmo se o webhook atrasar. */
import { json, siteUrl, methodNotAllowed } from "../lib/http.mjs";
import { guard, rateLimit } from "../lib/security.mjs";
import { mpFetch, isConfigured, orderStatusFromPayment } from "../lib/mp.mjs";
import { getOrder, saveOrder, setStatus } from "../lib/orders.mjs";
import { sendPaidEmailsOnce } from "../lib/email.mjs";

export default async (req) => {
  const blocked = guard(req, "status", 60, 60); if (blocked) return blocked;
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  if (!isConfigured()) return json(503, { message: "Não configurado" });
  const q = new URL(req.url).searchParams;
  const id = q.get("id") || "", orderId = String(q.get("order") || "").toUpperCase();
  if (!/^\d{1,20}$/.test(id) || !/^EDT-[A-Z0-9]{6,20}$/.test(orderId)) return json(400, { message: "Consulta inválida" });
  try {
    const p = await mpFetch(`/v1/payments/${id}`);
    // Só responde se o pagamento pertence ao pedido informado (impede consultar pagamentos de terceiros)
    if (String(p.external_reference || "").toUpperCase() !== orderId) return json(404, { message: "Pagamento não encontrado." });
    const next = orderStatusFromPayment(p);
    if (p.external_reference && next !== "pending_payment") {
      const order = await getOrder(p.external_reference);
      if (order && order.status === "pending_payment" && setStatus(order, next)) {
        if (next === "paid") await sendPaidEmailsOnce(order, siteUrl(req));
        await saveOrder(order);
      }
    }
    return json(200, { status: p.status, statusDetail: p.status_detail });
  } catch (e) {
    return json(e.status === 404 ? 404 : 502, { message: "Não foi possível consultar o pagamento." });
  }
};

export const config = { path: "/api/status", rateLimit: rateLimit(120) };
