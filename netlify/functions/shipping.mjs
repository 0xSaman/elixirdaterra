import { json, readJson, methodNotAllowed } from "../lib/http.mjs";
import { guard, rateLimit } from "../lib/security.mjs";
import { computeOrder } from "../lib/pricing.mjs";
import { quoteShipping } from "../lib/shipping.mjs";

// POST /api/shipping { cep, items } → opções de entrega com preço e prazo
export default async (req) => {
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
};

export const config = { path: "/api/shipping", rateLimit: rateLimit(80) };
