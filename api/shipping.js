import { json, readJson, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { computeOrder } from "../server/pricing.mjs";
import { quoteShipping } from "../server/shipping.mjs";

// POST /api/shipping { cep, items } → opções de entrega com preço e prazo
async function handler(req) {
  const blocked = guard(req, "shipping", 40, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const { cep, items } = await readJson(req);
    const { lines } = computeOrder(items, null, "card");
    const quote = await quoteShipping(cep, lines);
    if (!quote) return json(400, { message: "CEP inválido." });
    return json(200, quote);
  } catch (e) {
    return json(e.status || 500, { message: e.status ? e.message : "Não foi possível calcular o frete agora." });
  }
}

export { handler as GET, handler as POST };
