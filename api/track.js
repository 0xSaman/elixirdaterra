/* POST /api/track { order, email } — página "Rastrear pedido".
   Exige o número do pedido E o e-mail da compra, e devolve só dados não sensíveis. */
import { json, readJson, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { getOrder, publicView } from "../server/orders.mjs";

async function handler(req) {
  const blocked = guard(req, "track", 15, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  const { order, email } = await readJson(req).catch(() => ({}));
  const id = String(order || "").trim().toUpperCase();
  const mail = String(email || "").trim().toLowerCase();
  if (!/^EDT-[A-Z0-9]{6,20}$/.test(id) || !mail.includes("@")) return json(400, { message: "Informe o número do pedido e o e-mail da compra." });
  try {
    const o = await getOrder(id);
    if (!o || o.customer.email !== mail) return json(404, { message: "Não encontramos um pedido com esse número e e-mail. Confira os dados." });
    return json(200, publicView(o));
  } catch (e) {
    console.error("[track]", e.message);
    return json(500, { message: "Não foi possível consultar agora. Tente de novo em instantes." });
  }
}

export { handler as GET, handler as POST };
