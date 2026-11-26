/* /api/account — área do cliente.
   GET              → perfil + pedidos da sessão
   POST {action}    → register | login | logout | update | link-order | password | send-code | verify */
import crypto from "node:crypto";
import { json, readJson, methodNotAllowed } from "../server/http.mjs";
import { guard, clientIp } from "../server/security.mjs";
import { getOrder, getKV, setKV } from "../server/orders.mjs";
import { emailEnabled, sendAccountCode } from "../server/email.mjs";
import {
  normEmail, validEmail, getUser, saveUser, hashPassword, checkPassword,
  sessionCookie, clearCookie, currentUser, profileView, accountOrderView, ordersFor
} from "../server/accounts.mjs";

const clean = (v, n = 120) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
const digits = (v, n = 20) => String(v ?? "").replace(/\D/g, "").slice(0, n);
const UF = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
function isCPF(c) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false;
  for (const t of [9, 10]) { let s = 0; for (let i = 0; i < t; i++) s += +c[i] * (t + 1 - i); if (((s * 10) % 11) % 10 !== +c[t]) return false; }
  return true;
}
const withCookie = (res, cookie) => { res.headers.append("Set-Cookie", cookie); return res; };
const GENERIC_LOGIN = "E-mail ou senha incorretos.";

async function lockout(key) {
  const rec = (await getKV(key).catch(() => null)) || { n: 0, until: 0, first: Date.now() };
  return rec;
}

async function handler(req) {
  const blocked = guard(req, "account", 40, 60); if (blocked) return blocked;
  if (!["GET", "POST"].includes(req.method)) return methodNotAllowed(["GET", "POST"]);

  if (req.method === "GET") {
    const user = await currentUser(req);
    if (!user) return json(200, { user: null, emailEnabled: emailEnabled() });
    // Checkout: só os dados para preencher o formulário (a própria pessoa, via cookie HttpOnly)
    if (new URL(req.url).searchParams.get("checkout") === "1") {
      return json(200, { user: profileView(user), prefill: { name: user.name, email: user.email, phone: user.phone || "", cpf: user.cpf || "", address: user.address || null } });
    }
    const orders = (await ordersFor(user)).map(accountOrderView);
    return json(200, { user: profileView(user), orders, emailVerification: emailEnabled() });
  }

  const b = await readJson(req).catch(() => ({}));
  const action = String(b.action || "");

  if (action === "register") {
    const email = normEmail(b.email), name = clean(b.name, 100), pw = String(b.password || "");
    if (!validEmail(email)) return json(400, { message: "Informe um e-mail válido." });
    if (name.split(" ").length < 2) return json(400, { message: "Informe nome e sobrenome." });
    if (pw.length < 8 || pw.length > 128) return json(400, { message: "A senha precisa ter pelo menos 8 caracteres." });
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json(400, { message: "Use letras e números na senha." });
    if (await getUser(email)) return json(409, { message: "Já existe uma conta com este e-mail. Entre com sua senha." });
    const { salt, hash } = hashPassword(pw);
    const now = new Date().toISOString();
    const user = await saveUser({ email, name, phone: digits(b.phone, 11), salt, hash, createdAt: now, verified: false, sessionVersion: 1, linkedOrders: [] });
    console.log(`[conta] nova conta criada (ip ${clientIp(req)})`);
    return withCookie(json(201, { user: profileView(user) }), await sessionCookie(user));
  }

  if (action === "login") {
    const email = normEmail(b.email), pw = String(b.password || "");
    const lk = "acclogin-" + crypto.createHash("sha256").update(email).digest("hex").slice(0, 24);
    const rec = await lockout(lk);
    if (rec.until && Date.now() < rec.until) return json(429, { message: "Muitas tentativas. Aguarde 15 minutos ou fale com a gente no WhatsApp." });
    const user = validEmail(email) ? await getUser(email) : null;
    if (!user || !checkPassword(pw, user)) {
      await new Promise((r) => setTimeout(r, 500));
      const fresh = Date.now() - rec.first > 15 * 60000 ? { n: 0, until: 0, first: Date.now() } : rec;
      fresh.n += 1; if (fresh.n >= 6) { fresh.until = Date.now() + 15 * 60000; console.warn(`[seguranca] conta bloqueada por senhas erradas (ip ${clientIp(req)})`); }
      await setKV(lk, fresh).catch(() => {});
      return json(401, { message: GENERIC_LOGIN });
    }
    if (rec.n) await setKV(lk, { n: 0, until: 0, first: Date.now() }).catch(() => {});
    return withCookie(json(200, { user: profileView(user) }), await sessionCookie(user));
  }

  if (action === "logout") return withCookie(json(200, { ok: true }), clearCookie());

  // Esqueci a senha: envia um código por e-mail (resposta igual exista ou não a conta)
  if (action === "forgot") {
    if (!emailEnabled()) return json(503, { message: "Recuperação por e-mail indisponível. Fale com a gente no WhatsApp." });
    const email = normEmail(b.email); const u = validEmail(email) ? await getUser(email) : null;
    if (u && !(u.resetCode && u.resetCode.sentAt > Date.now() - 60000)) {
      const code = String(crypto.randomInt(100000, 999999));
      u.resetCode = { hash: crypto.createHash("sha256").update(code).digest("hex"), exp: Date.now() + 15 * 60000, tries: 0, sentAt: Date.now() };
      await saveUser(u); await sendAccountCode(u, code, "reset").catch(() => false);
    }
    return json(200, { ok: true });
  }
  if (action === "reset") {
    const email = normEmail(b.email); const u = validEmail(email) ? await getUser(email) : null;
    const r = u && u.resetCode;
    if (!r || r.exp < Date.now() || r.tries >= 5) return json(400, { message: "Código expirado ou inválido. Peça um novo." });
    r.tries += 1;
    if (crypto.createHash("sha256").update(digits(b.code, 6)).digest("hex") !== r.hash) { await saveUser(u); return json(400, { message: "Código incorreto." }); }
    const pw = String(b.password || "");
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json(400, { message: "A nova senha precisa ter 8 caracteres, com letras e números." });
    Object.assign(u, hashPassword(pw)); delete u.resetCode; u.verified = true; u.sessionVersion = (u.sessionVersion || 1) + 1;
    await saveUser(u);
    return withCookie(json(200, { user: profileView(u) }), await sessionCookie(u));
  }

  // Link de nova senha gerado no painel (provisório, enquanto não há e-mail)
  if (action === "reset-link") {
    const email = normEmail(b.email); const u = validEmail(email) ? await getUser(email) : null;
    const r = u && u.resetLink;
    const tok = String(b.token || "").slice(0, 100);
    if (!r || r.exp < Date.now() || !tok || crypto.createHash("sha256").update(tok).digest("hex") !== r.hash) return json(400, { message: "Este link expirou ou já foi usado. Peça um novo no WhatsApp." });
    const pw = String(b.password || "");
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json(400, { message: "A nova senha precisa ter 8 caracteres, com letras e números." });
    Object.assign(u, hashPassword(pw)); delete u.resetLink; delete u.resetCode; u.sessionVersion = (u.sessionVersion || 1) + 1;
    await saveUser(u);
    return withCookie(json(200, { user: profileView(u) }), await sessionCookie(u));
  }

  // Ações abaixo exigem sessão
  const user = await currentUser(req);
  if (!user) return withCookie(json(401, { message: "Sua sessão expirou. Entre novamente." }), clearCookie());

  if (action === "update") {
    if (b.name !== undefined) { const n = clean(b.name, 100); if (n.split(" ").length < 2) return json(400, { message: "Informe nome e sobrenome." }); user.name = n; }
    if (b.phone !== undefined) { const p = digits(b.phone, 11); if (p && !(p.length === 10 || p.length === 11)) return json(400, { message: "Celular inválido." }); user.phone = p; }
    if (b.cpf !== undefined && b.cpf !== "") { const c = digits(b.cpf, 11); if (!isCPF(c)) return json(400, { message: "CPF inválido." }); user.cpf = c; }
    if (b.address) {
      const a = b.address;
      const addr = { cep: digits(a.cep, 8), street: clean(a.street), number: clean(a.number, 20) || "S/N", complement: clean(a.complement, 80), district: clean(a.district, 80), city: clean(a.city, 80), uf: clean(a.uf, 2).toUpperCase() };
      if (addr.cep.length !== 8 || !addr.street || !addr.city || !UF.has(addr.uf)) return json(400, { message: "Confira o endereço." });
      user.address = addr;
    }
    await saveUser(user);
    return json(200, { user: profileView(user) });
  }

  if (action === "password") {
    if (!checkPassword(String(b.current || ""), user)) return json(400, { message: "Senha atual incorreta." });
    const pw = String(b.password || "");
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json(400, { message: "A nova senha precisa ter 8 caracteres, com letras e números." });
    Object.assign(user, hashPassword(pw));
    user.sessionVersion = (user.sessionVersion || 1) + 1; // derruba sessões em outros aparelhos
    await saveUser(user);
    return withCookie(json(200, { ok: true }), await sessionCookie(user));
  }

  if (action === "link-order") {
    const id = clean(b.order, 24).toUpperCase(), mail = normEmail(b.email || user.email);
    if (!/^EDT-[A-Z0-9]{6,20}$/.test(id)) return json(400, { message: "Número de pedido inválido." });
    const o = await getOrder(id).catch(() => null);
    if (!o || o.customer.email !== mail) return json(404, { message: "Não encontramos um pedido com esse número e e-mail." });
    user.linkedOrders = [...new Set([...(user.linkedOrders || []), id])].slice(-200);
    await saveUser(user);
    return json(200, { ok: true });
  }

  if (action === "send-code") {
    if (!emailEnabled()) return json(503, { message: "Confirmação por e-mail indisponível no momento." });
    const code = String(crypto.randomInt(100000, 999999));
    user.verifyCode = { hash: crypto.createHash("sha256").update(code).digest("hex"), exp: Date.now() + 15 * 60000, tries: 0 };
    await saveUser(user);
    await sendAccountCode(user, code).catch(() => false);
    return json(200, { ok: true });
  }

  if (action === "verify") {
    const v = user.verifyCode;
    if (!v || v.exp < Date.now() || v.tries >= 5) return json(400, { message: "Código expirado. Peça um novo." });
    v.tries += 1;
    const ok = crypto.createHash("sha256").update(digits(b.code, 6)).digest("hex") === v.hash;
    if (!ok) { await saveUser(user); return json(400, { message: "Código incorreto." }); }
    user.verified = true; delete user.verifyCode; await saveUser(user);
    return json(200, { user: profileView(user) });
  }

  return json(400, { message: "Ação inválida." });
}

export { handler as GET, handler as POST };
