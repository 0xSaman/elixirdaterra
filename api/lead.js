/* POST /api/lead — guarda o contato de quem começou o checkout (para recuperar carrinhos abandonados).
   Só é mostrado no painel protegido por senha. Ao finalizar a compra, o contato sai da lista. */
import { json, readJson, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { computeOrder } from "../server/pricing.mjs";
import { saveLead } from "../server/orders.mjs";

const clean = (v, n = 120) => String(v || "").replace(/[<>]/g, "").trim().slice(0, n);

async function handler(req) {
  const blocked = guard(req, "lead", 10, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  try {
    const b = await readJson(req);
    const email = clean(b.email, 160).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(400, { ok: false });
    let items = [], subtotal = 0;
    try { const c = computeOrder(b.items, null, "card"); items = c.lines.map((l) => ({ id: l.id, short: l.short, qty: l.qty })); subtotal = c.subtotal; } catch {}
    await saveLead({ email, name: clean(b.name, 100), phone: String(b.phone || "").replace(/\D/g, "").slice(0, 13), items, subtotal, step: Number(b.step) || 1, source: clean(b.source, 30) || "checkout" });
    return json(200, { ok: true });
  } catch (e) {
    console.error("[lead]", e.message);
    return json(200, { ok: false });
  }
}

export { handler as GET, handler as POST };
