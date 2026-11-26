/* POST /api/form — formulários do site (substitui o Netlify Forms).
   Formulários aceitos: "contato" (página Contato) e "primeira-compra" (janela do cupom).
   Guarda no banco (aparece no painel) e, se o Resend estiver configurado, envia por e-mail para ORDER_EMAIL_TO. */
import { json, readJson, siteUrl, methodNotAllowed } from "../server/http.mjs";
import { guard, clientIp } from "../server/security.mjs";
import { saveForm } from "../server/orders.mjs";
import { notifyMerchantForm } from "../server/email.mjs";

const FORMS = {
  contato: ["nome", "email", "pedido", "mensagem"],
  "primeira-compra": ["contato"]
};
const clean = (v, n) => String(v ?? "").replace(/[<>]/g, "").replace(/\r\n?/g, "\n").trim().slice(0, n);

async function readBody(req) {
  const type = req.headers.get("content-type") || "";
  if (type.includes("application/json")) return readJson(req, 20 * 1024);
  const text = await req.text();
  if (text.length > 20 * 1024) throw Object.assign(new Error("Payload muito grande"), { status: 413 });
  return Object.fromEntries(new URLSearchParams(text));
}

async function handler(req) {
  const blocked = guard(req, "form", 8, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  let b;
  try { b = await readBody(req); } catch (e) { return json(e.status || 400, { ok: false }); }
  const name = String(b["form-name"] || "");
  if (!FORMS[name]) return json(400, { ok: false, message: "Formulário inválido." });
  if (b.empresa) return json(200, { ok: true }); // honeypot: robô preencheu o campo escondido

  const fields = {};
  for (const k of FORMS[name]) fields[k] = clean(b[k], k === "mensagem" ? 2000 : 160);
  if (name === "contato") {
    if (!fields.nome || !fields.mensagem || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fields.email)) return json(400, { ok: false, message: "Preencha nome, e-mail e mensagem." });
  } else {
    const v = fields.contato;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.replace(/\D/g, "").length < 10) return json(400, { ok: false, message: "Digite um e-mail ou WhatsApp com DDD." });
  }
  try {
    const entry = await saveForm({ form: name, fields, ip: clientIp(req) });
    await notifyMerchantForm(entry, siteUrl(req)).catch(() => false);
    return json(200, { ok: true });
  } catch (e) {
    console.error("[form]", e.message);
    return json(500, { ok: false, message: "Não foi possível enviar agora." });
  }
}

export { handler as GET, handler as POST };
