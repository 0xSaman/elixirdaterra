import { json, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { isConfigured, env } from "../server/mp.mjs";
import { publicCatalog } from "../shared/catalog.js";
import { pixPercent } from "../server/pricing.mjs";

// GET /api/config → dados públicos do checkout (nunca expõe o Access Token)
async function handler(req) {
  const blocked = guard(req, "config", 60, 60); if (blocked) return blocked;
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  const live = isConfigured();
  return json(200, {
    demo: !live,
    publicKey: live ? env.publicKey() : null,
    catalog: publicCatalog({ pixDiscountPercent: pixPercent() })
  });
}

export { handler as GET, handler as POST };
