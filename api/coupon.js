import { json, readJson, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { computeOrder, findCoupon } from "../server/pricing.mjs";
import { hasPaidPurchase } from "../server/orders.mjs";

// POST /api/coupon { code, items } → valida o cupom para a sacola atual
async function handler(req) {
  const blocked = guard(req, "coupon", 20, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const { code, items, customer } = await readJson(req);
    if (!code || String(code).length > 40) return json(400, { valid: false, message: "Informe um cupom." });
    const { subtotal } = computeOrder(items, null, "card");
    const coupon = findCoupon(code, subtotal);
    if (!coupon) return json(404, { valid: false, message: "Cupom inválido ou expirado." });
    if (coupon.firstPurchaseOnly && customer && await hasPaidPurchase(customer).catch(() => false)) {
      return json(409, { valid: false, message: `O cupom ${coupon.code} é válido só na primeira compra.` });
    }
    return json(200, { valid: true, coupon });
  } catch (e) {
    return json(e.status || 500, { valid: false, message: e.status ? e.message : "Erro ao validar o cupom." });
  }
}

export { handler as GET, handler as POST };
