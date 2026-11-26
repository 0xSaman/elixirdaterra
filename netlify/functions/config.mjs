import { json, methodNotAllowed } from "../lib/http.mjs";
import { guard, rateLimit } from "../lib/security.mjs";
import { isConfigured, env } from "../lib/mp.mjs";
import { publicCatalog } from "../../shared/catalog.js";
import { pixPercent } from "../lib/pricing.mjs";

// GET /api/config → dados públicos do checkout (nunca expõe o Access Token)
export default async (req) => {
  const blocked = guard(req, "config", 60, 60); if (blocked) return blocked;
  if (req.method !== "GET") return methodNotAllowed(["GET"]);
  const live = isConfigured();
  return json(200, {
    demo: !live,
    publicKey: live ? env.publicKey() : null,
    catalog: publicCatalog({ pixDiscountPercent: pixPercent() })
  });
};

export const config = { path: "/api/config", rateLimit: rateLimit(120) };
