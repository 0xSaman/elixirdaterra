/* /api/admin — painel de pedidos (protegido pela senha ADMIN_PASSWORD).
   GET  → lista os pedidos
   POST → { id, status, trackingCode, trackingUrl, notify } atualiza status e rastreio */
import crypto from "node:crypto";
import { json, readJson, siteUrl, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { getOrder, listOrders, saveOrder, setStatus, listLeads, deleteLead, getKV, setKV, listForms, markFormDone } from "../server/orders.mjs";
import { clientIp } from "../server/security.mjs";
import { notifyCustomerShipped } from "../server/email.mjs";
import { getUser, saveUser, normEmail } from "../server/accounts.mjs";

const STATUSES = ["pending_payment", "paid", "preparing", "shipped", "delivered", "cancelled"];

const SESSION_HOURS = 8;
const sign = (exp) => crypto.createHmac("sha256", "edt-admin:" + process.env.ADMIN_PASSWORD).update(String(exp)).digest("base64url");
const issueToken = () => { const exp = Date.now() + SESSION_HOURS * 3600e3; return exp + "." + sign(exp); };
function safeEq(x, y) {
  const a = crypto.createHash("sha256").update(String(x)).digest();
  const b = crypto.createHash("sha256").update(String(y)).digest();
  return crypto.timingSafeEqual(a, b);
}
const passwordOk = (pw) => (process.env.ADMIN_PASSWORD || "").length >= 8 && !!pw && safeEq(pw, process.env.ADMIN_PASSWORD);
/** Sessão: o navegador guarda só um token assinado que expira em 8 h (nunca a senha). */
function authorized(req) {
  const given = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [exp, sig] = given.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  return safeEq(sig, sign(exp));
}

async function handler(req) {
  const blocked = guard(req, "admin", 30, 60); if (blocked) return blocked;
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(["GET", "POST"]);
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    return json(503, { message: "Defina a variável ADMIN_PASSWORD (mínimo de 8 caracteres) nas variáveis de ambiente do Vercel para usar o painel." });
  }
  // Bloqueio por força bruta: 5 senhas erradas em 15 min travam o IP por 15 min
  const ipKey = "login-" + clientIp(req).replace(/[^\w.:-]/g, "_");
  const rec = (await getKV(ipKey).catch(() => null)) || { n: 0, until: 0, first: Date.now() };
  if (rec.until && Date.now() < rec.until) {
    console.warn(`[seguranca] painel bloqueado para ${clientIp(req)}`);
    return json(429, { message: "Muitas tentativas. Tente de novo em alguns minutos." });
  }
  let loginBody = null;
  if (req.method === "POST" && !req.headers.get("authorization")) {
    loginBody = await readJson(req).catch(() => ({}));
    if (loginBody.action === "login" && passwordOk(String(loginBody.password || ""))) {
      if (rec.n) await setKV(ipKey, { n: 0, until: 0, first: Date.now() }).catch(() => {});
      console.log(`[seguranca] login no painel (ip ${clientIp(req)})`);
      return json(200, { token: issueToken(), expiresInHours: SESSION_HOURS });
    }
  }
  if (!authorized(req)) {
    await new Promise((r) => setTimeout(r, 600)); // dificulta tentativas em massa
    const fresh = Date.now() - rec.first > 15 * 60000 ? { n: 0, until: 0, first: Date.now() } : rec;
    fresh.n += 1;
    if (fresh.n >= 5) { fresh.until = Date.now() + 15 * 60000; console.warn(`[seguranca] ${fresh.n} senhas erradas no painel (ip ${clientIp(req)}) — bloqueado por 15 min`); }
    await setKV(ipKey, fresh).catch(() => {});
    return json(401, { message: "Senha incorreta" });
  }
  if (rec.n) await setKV(ipKey, { n: 0, until: 0, first: Date.now() }).catch(() => {});

  if (req.method === "GET") return json(200, { orders: await listOrders(), leads: await listLeads(), forms: await listForms() });

  const body = loginBody || await readJson(req).catch(() => ({}));
  // Ações rápidas: concluir um carrinho abandonado / marcar lembrete de recompra
  // Provisório (sem e-mail): gera um link de nova senha válido por 2 h para enviar ao cliente pelo WhatsApp
  if (body.action === "reset-link") {
    const u = await getUser(normEmail(body.email));
    if (!u) return json(404, { message: "Nenhuma conta com esse e-mail." });
    const tok = crypto.randomBytes(24).toString("base64url");
    u.resetLink = { hash: crypto.createHash("sha256").update(tok).digest("hex"), exp: Date.now() + 2 * 3600000 };
    await saveUser(u);
    console.log(`[seguranca] link de nova senha gerado no painel para ${u.email}`);
    return json(200, { url: `${siteUrl(req)}/conta/?reset=${tok}#${encodeURIComponent(u.email)}`, name: u.name, phone: u.phone || "", hours: 2 });
  }
  if (body.action === "form-done") { await markFormDone(String(body.key || "")); return json(200, { ok: true }); }
  if (body.action === "lead-done") { await deleteLead(String(body.key || "")); return json(200, { ok: true }); }
  if (body.action === "reminded") {
    const o = await getOrder(String(body.id || ""));
    if (!o) return json(404, { message: "Pedido não encontrado" });
    o.reminderAt = new Date().toISOString(); await saveOrder(o);
    return json(200, { order: o });
  }
  const order = await getOrder(String(body.id || ""));
  if (!order) return json(404, { message: "Pedido não encontrado" });
  if (!STATUSES.includes(body.status)) return json(400, { message: "Status inválido" });

  const code = String(body.trackingCode || "").trim().toUpperCase().slice(0, 40);
  const url = /^https?:\/\//.test(body.trackingUrl || "") ? String(body.trackingUrl).slice(0, 300) : "";
  if (body.status === "shipped" && !code) return json(400, { message: "Informe o código de rastreio." });
  if (code) order.tracking = { code, url: url || "https://rastreamento.correios.com.br/app/index.php", carrier: url ? "outra" : "correios" };

  const becameShipped = order.status !== "shipped" && body.status === "shipped";
  setStatus(order, body.status);

  let emailed = false;
  if (becameShipped && body.notify && order.tracking) {
    emailed = await notifyCustomerShipped(order, siteUrl(req)).catch(() => false);
    if (emailed) { order.emails = order.emails || {}; order.emails.shipped = new Date().toISOString(); }
  }
  await saveOrder(order);
  return json(200, { order, emailed });
}

export { handler as GET, handler as POST };
