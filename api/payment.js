/* POST /api/payment — cria o pagamento no Mercado Pago (Pix, cartão ou boleto) e registra o pedido.
   Segurança:
   - preço recalculado no servidor a partir de shared/catalog.js
   - cartão chega apenas como token (o número nunca passa por aqui)
   - X-Idempotency-Key evita cobrança duplicada em reenvio/duplo clique */
import crypto from "node:crypto";
import { json, readJson, siteUrl, methodNotAllowed } from "../server/http.mjs";
import { guard } from "../server/security.mjs";
import { currentUser, saveUser } from "../server/accounts.mjs";
import { computeOrderWithShipping, maxInstallments } from "../server/pricing.mjs";
import { mpFetch, isConfigured, orderStatusFromPayment } from "../server/mp.mjs";
import { saveOrder, setStatus, deleteLead, hasPaidPurchase } from "../server/orders.mjs";
import { sendPaidEmailsOnce } from "../server/email.mjs";

const UF = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const clean = (v, max = 120) => String(v ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
const digits = (v) => String(v ?? "").replace(/\D+/g, "");

function isCPF(v) {
  const c = digits(v);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  for (let t = 9; t < 11; t++) {
    let s = 0;
    for (let i = 0; i < t; i++) s += Number(c[i]) * (t + 1 - i);
    if (Number(c[t]) !== ((s * 10) % 11) % 10) return false;
  }
  return true;
}

// Datas no fuso de Brasília (UTC−3), no formato ISO 8601 aceito pelo Mercado Pago
const pad = (n) => String(n).padStart(2, "0");
function brIso(ms) {
  const d = new Date(ms - 3 * 3600e3);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.000-03:00`;
}
function brEndOfDayPlus(days) {
  const d = new Date(Date.now() - 3 * 3600e3 + days * 864e5);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T23:59:59.000-03:00`;
}

function validate(body) {
  const errors = [];
  const method = body.method;
  if (!["pix", "card", "boleto"].includes(method)) errors.push("Forma de pagamento inválida");
  const c = body.customer || {}, a = body.address || {};
  const customer = { email: clean(c.email).toLowerCase(), name: clean(c.name, 100), cpf: digits(c.cpf), phone: digits(c.phone) };
  const address = {
    cep: digits(a.cep), street: clean(a.street), number: clean(a.number, 20) || "S/N", complement: clean(a.complement, 80),
    district: clean(a.district, 80), city: clean(a.city, 80), uf: clean(a.uf, 2).toUpperCase()
  };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customer.email)) errors.push("E-mail inválido");
  if (customer.name.split(" ").length < 2) errors.push("Informe nome e sobrenome");
  if (!isCPF(customer.cpf)) errors.push("CPF inválido");
  if (!(customer.phone.length === 10 || customer.phone.length === 11)) errors.push("Celular inválido");
  if (address.cep.length !== 8) errors.push("CEP inválido");
  if (!address.street || !address.district || !address.city) errors.push("Endereço incompleto");
  if (!UF.has(address.uf)) errors.push("UF inválida");
  return { method, customer, address, errors };
}

const FRIENDLY = {
  2067: "CPF inválido para pagamento. Confira o número.",
  4037: "Valor do pedido inválido.",
  3034: "Os dados do cartão não conferem com a bandeira. Confira o número.",
  205: "Confira o número do cartão.",
  208: "Confira o mês de validade do cartão.",
  209: "Confira o ano de validade do cartão.",
  E301: "Confira o número do cartão.",
  E302: "Confira o código de segurança (CVV).",
  13253: "A loja ainda não tem uma chave Pix cadastrada no Mercado Pago."
};

async function handler(req) {
  const blocked = guard(req, "payment", 10, 60); if (blocked) return blocked;
  if (req.method !== "POST") return methodNotAllowed(["POST"]);
  if (!isConfigured()) return json(503, { message: "Os pagamentos ainda não foram ativados na loja." });

  let body;
  try { body = await readJson(req); } catch (e) { return json(e.status || 400, { message: e.message }); }

  const { method, customer, address, errors } = validate(body);
  if (errors.length) return json(400, { message: errors.join(". ") + "." });

  let calc;
  try { calc = await computeOrderWithShipping(body.items, body.coupon, method, address.cep, body.shippingId); }
  catch (e) { return json(e.status || 400, { message: e.message, quote: e.quote || undefined }); }

  // Cupom de primeira compra: recusa se o CPF, e-mail ou celular já tem compra paga
  if (calc.coupon && calc.coupon.firstPurchaseOnly && await hasPaidPurchase(customer).catch(() => false)) {
    return json(400, { message: `O cupom ${calc.coupon.code} é só para a primeira compra. Removemos o cupom; confira o novo total e finalize.`, couponRejected: true });
  }

  // O navegador mostrou outro valor? Pede para revisar em vez de cobrar algo inesperado.
  if (typeof body.expectedTotal === "number" && Math.abs(body.expectedTotal - calc.total) > 0.01) {
    return json(409, { message: "Os valores do pedido foram atualizados. Recarregue a página e confira o resumo.", total: calc.total });
  }

  const site = siteUrl(req);
  const sessionUser = await currentUser(req).catch(() => null);
  const orderId = "EDT-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
  const idem = /^[A-Za-z0-9-]{8,64}$/.test(body.idempotencyKey || "") ? body.idempotencyKey : crypto.randomUUID();
  const [firstName, ...rest] = customer.name.split(" ");
  const lastName = rest.join(" ");

  const payment = {
    transaction_amount: calc.total,
    description: calc.lines.map((l) => `${l.qty}x ${l.name}`).join(", ").slice(0, 250),
    external_reference: orderId,
    statement_descriptor: (process.env.STATEMENT_DESCRIPTOR || "ELIXIRDATERRA").slice(0, 13),
    // O Mercado Pago só aceita URL pública; em testes locais a notificação é omitida.
    // source_news=webhooks: só o formato novo (assinado), sem a cópia antiga "IPN" sem assinatura
    notification_url: /localhost|127\.0\.0\.1/.test(site) ? undefined : `${site}/api/webhook?source_news=webhooks`,
    payer: { email: customer.email, first_name: firstName, last_name: lastName, identification: { type: "CPF", number: customer.cpf } },
    additional_info: {
      items: calc.lines.map((l) => ({ id: l.id, title: l.name, description: `${l.units} frasco(s) de 30 ml`, category_id: "health", quantity: l.qty, unit_price: l.unitPrice })),
      payer: {
        first_name: firstName, last_name: lastName,
        phone: { area_code: customer.phone.slice(0, 2), number: customer.phone.slice(2) },
        address: { zip_code: address.cep, street_name: address.street, street_number: address.number }
      },
      shipments: { receiver_address: { zip_code: address.cep, state_name: address.uf, city_name: address.city, street_name: address.street, street_number: address.number, apartment: address.complement || undefined } }
    },
    metadata: { order_id: orderId }
  };

  if (method === "pix") {
    payment.payment_method_id = "pix";
    payment.date_of_expiration = brIso(Date.now() + 30 * 60 * 1000); // mínimo permitido: 30 min
  } else if (method === "boleto") {
    payment.payment_method_id = "bolbradesco";
    payment.date_of_expiration = brEndOfDayPlus(3);
    payment.payer.address = {
      zip_code: address.cep, street_name: address.street, street_number: address.number,
      neighborhood: address.district, city: address.city, federal_unit: address.uf
    };
  } else {
    const card = body.card || {};
    const installments = Number.parseInt(card.installments, 10);
    if (typeof card.token !== "string" || card.token.length < 8 || !card.paymentMethodId) {
      return json(400, { message: "Dados do cartão incompletos. Tente novamente." });
    }
    if (!Number.isInteger(installments) || installments < 1 || installments > maxInstallments()) {
      return json(400, { message: "Número de parcelas inválido." });
    }
    payment.token = card.token;
    payment.installments = installments;
    payment.payment_method_id = String(card.paymentMethodId).slice(0, 30);
    if (card.issuerId) payment.issuer_id = Number(card.issuerId) || undefined;
    payment.capture = true;
    payment.binary_mode = false; // permite "em análise" em vez de recusar direto
  }

  const headers = { "X-Idempotency-Key": idem };
  if (body.deviceId && /^[\w-]{6,100}$/.test(body.deviceId)) headers["X-meli-session-id"] = body.deviceId;

  let p;
  try {
    p = await mpFetch("/v1/payments", { method: "POST", body: payment, headers });
  } catch (e) {
    console.error("[mp] erro ao criar pagamento", e.status, JSON.stringify(e.mp || e.message));
    const cause = e.mp?.cause?.[0]?.code;
    return json(502, { message: FRIENDLY[cause] || "Não foi possível processar o pagamento agora. Tente novamente ou escolha outra forma de pagamento.", detail: cause || null });
  }

  const out = { id: p.id, orderId, method, status: p.status, statusDetail: p.status_detail, amount: calc.total };
  if (method === "pix") {
    const td = p.point_of_interaction?.transaction_data || {};
    out.pix = { qrCode: td.qr_code, qrCodeBase64: td.qr_code_base64, ticketUrl: td.ticket_url, expiresAt: p.date_of_expiration || payment.date_of_expiration };
  }
  if (method === "boleto") {
    const td = p.transaction_details || {};
    out.boleto = { url: td.external_resource_url, line: td.digitable_line || p.barcode?.content || "", expiresAt: p.date_of_expiration || payment.date_of_expiration };
  }

  // Cartão recusado não vira pedido (o cliente pode tentar de novo)
  if (!(method === "card" && p.status === "rejected")) {
    const now = new Date().toISOString();
    const order = {
      id: orderId,
      createdAt: now,
      status: "pending_payment",
      history: [{ status: "created", at: now }],
      method,
      installments: payment.installments || 1,
      paymentId: p.id,
      amount: calc.total,
      subtotal: calc.subtotal,
      discount: calc.couponDiscount + calc.pixDiscount,
      coupon: calc.coupon ? calc.coupon.code : null,
      items: calc.lines.map((l) => ({ id: l.id, name: l.name, short: l.short, qty: l.qty, total: l.total })),
      shipping: { id: calc.shippingOption.id, name: calc.shippingOption.name, price: calc.shipping, days: calc.shippingOption.days },
      customer,
      address,
      optin: !!body.optin,
      accountEmail: sessionUser ? sessionUser.email : null,
      tracking: null,
      emails: {}
    };
    if (orderStatusFromPayment(p) === "paid") setStatus(order, "paid");
    try {
      if (order.status === "paid") await sendPaidEmailsOnce(order, site);
      await saveOrder(order);
      await deleteLead(customer.email).catch(() => {});
      if (sessionUser) { // guarda dados para a próxima compra
        sessionUser.address = address; if (customer.phone) sessionUser.phone = customer.phone; if (!sessionUser.cpf) sessionUser.cpf = customer.cpf;
        await saveUser(sessionUser).catch(() => {});
      }
    } catch (e) {
      console.error("[orders] não foi possível salvar o pedido", orderId, e.message);
    }
  }

  console.log(`[pedido] ${orderId} ${method} ${calc.total} → ${p.status}/${p.status_detail} (mp ${p.id})`);
  return json(201, out);
}

export { handler as GET, handler as POST };
