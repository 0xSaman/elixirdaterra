import { alertOwnerPaid } from "./alert.mjs";
import { configuredSiteUrl } from "./http.mjs";
/* E-mails transacionais via Resend (opcional: só envia se RESEND_API_KEY estiver definida). */

const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const METHOD = { pix: "Pix", card: "Cartão de crédito", boleto: "Boleto" };

export const emailEnabled = () => Boolean(process.env.RESEND_API_KEY);

async function send({ to, subject, html, replyTo }) {
  if (!emailEnabled() || !to) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ORDER_EMAIL_FROM || "Elixir da Terra <onboarding@resend.dev>",
      to: Array.isArray(to) ? to : String(to).split(",").map((s) => s.trim()),
      reply_to: replyTo || undefined,
      subject,
      html
    })
  });
  if (!r.ok) { console.error("[email] falha", r.status, await r.text()); return false; }
  return true;
}

function layout(title, body, site) {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f7f3ee;font-family:Arial,Helvetica,sans-serif;color:#1f1813">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f3ee;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
  <tr><td style="background:#800000;padding:22px 28px"><img src="${site}/assets/img/logo-horizontal-branco.png" alt="Elixir da Terra" height="40" style="display:block;height:40px"></td></tr>
  <tr><td style="padding:28px">
  <h1 style="font-family:Georgia,serif;font-size:24px;line-height:1.25;margin:0 0 14px;color:#1f1813">${title}</h1>
  ${body}
  </td></tr>
  <tr><td style="padding:18px 28px;background:#faf8f5;font-size:12px;color:#7a6e66">Elixir da Terra · Dúvidas? Responda este e-mail ou fale no WhatsApp.</td></tr>
  </table></td></tr></table></body></html>`;
}

function itemsTable(o) {
  const rows = o.items.map((i) => `<tr><td style="padding:6px 0;font-size:14px">${i.qty}× ${esc(i.name)}</td><td align="right" style="padding:6px 0;font-size:14px">${brl(i.total)}</td></tr>`).join("");
  return `<table role="presentation" width="100%" style="border-top:1px solid #e8e0d5;border-bottom:1px solid #e8e0d5;margin:16px 0">${rows}
  ${o.shipping ? `<tr><td style="padding:6px 0;font-size:14px">Frete (${esc(o.shipping.name)})</td><td align="right" style="padding:6px 0;font-size:14px">${brl(o.shipping.price)}</td></tr>` : ""}
  <tr><td style="padding:8px 0;font-weight:bold">Total</td><td align="right" style="padding:8px 0;font-weight:bold">${brl(o.amount)}</td></tr></table>`;
}

function button(href, label) {
  return `<p style="margin:22px 0"><a href="${href}" style="background:#800000;color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:bold;display:inline-block">${label}</a></p>`;
}

const trackUrl = (site, o) => `${site}/rastreio/?pedido=${encodeURIComponent(o.id)}&email=${encodeURIComponent(o.customer.email)}`;

/** Para a loja: novo pedido pago, com tudo que é preciso para enviar. */
export function notifyMerchantPaid(o, site) {
  const a = o.address, c = o.customer;
  const body = `<p style="font-size:15px">${brl(o.amount)} · ${METHOD[o.method] || o.method}${o.installments > 1 ? ` em ${o.installments}x` : ""}${o.coupon ? ` · cupom ${esc(o.coupon)}` : ""}</p>
  ${itemsTable(o)}
  <p style="font-size:14px;line-height:1.6"><b>Cliente</b><br>${esc(c.name)} · CPF ${esc(c.cpf)}<br>${esc(c.email)} · WhatsApp ${esc(c.phone)}</p>
  <p style="font-size:14px;line-height:1.6"><b>Enviar para</b><br>${esc(a.street)}, ${esc(a.number)}${a.complement ? " — " + esc(a.complement) : ""}<br>${esc(a.district)} · ${esc(a.city)}/${esc(a.uf)} · CEP ${esc(a.cep)}</p>
  ${button(site + "/painel/", "Abrir painel de pedidos")}`;
  return send({ to: process.env.ORDER_EMAIL_TO, replyTo: c.email, subject: `Novo pedido ${o.id} — ${brl(o.amount)}`, html: layout(`Novo pedido pago: ${esc(o.id)}`, body, site) });
}

/** Para o cliente: pagamento confirmado. */
export function notifyCustomerPaid(o, site) {
  const first = esc(o.customer.name.split(" ")[0]);
  const body = `<p style="font-size:15px;line-height:1.6">Oi, ${first}! Recebemos o pagamento do seu pedido <b>${esc(o.id)}</b>. Agora vamos preparar tudo com carinho e postar em até 1 dia útil.</p>
  ${itemsTable(o)}
  <p style="font-size:14px;line-height:1.6">Entrega em ${esc(o.address.city)}/${esc(o.address.uf)} · ${o.shipping ? esc(o.shipping.name) : "envio com rastreio"}. Você vai receber o código de rastreio por e-mail assim que o pedido for postado.</p>
  ${button(trackUrl(site, o), "Acompanhar pedido")}`;
  return send({ to: o.customer.email, replyTo: process.env.ORDER_EMAIL_TO, subject: `Pedido ${o.id} confirmado ✓`, html: layout("Pagamento confirmado!", body, site) });
}

/** Para o cliente: pedido enviado com código de rastreio. */
export function notifyCustomerShipped(o, site) {
  const first = esc(o.customer.name.split(" ")[0]);
  const code = esc(o.tracking.code);
  const body = `<p style="font-size:15px;line-height:1.6">Oi, ${first}! Seu pedido <b>${esc(o.id)}</b> foi postado e já está a caminho.</p>
  <p style="font-size:14px;margin:18px 0 6px;color:#7a6e66">Código de rastreio</p>
  <p style="font-size:22px;font-weight:bold;letter-spacing:1px;margin:0;font-family:monospace">${code}</p>
  ${button(trackUrl(site, o), "Acompanhar entrega")}
  <p style="font-size:13px;color:#7a6e66">Você também pode consultar no site dos Correios: rastreamento.correios.com.br</p>`;
  return send({ to: o.customer.email, replyTo: process.env.ORDER_EMAIL_TO, subject: `Seu pedido ${o.id} foi enviado 📦`, html: layout("Seu pedido está a caminho", body, site) });
}

/** Dispara os e-mails de pagamento aprovado uma única vez por pedido. */
export async function sendPaidEmailsOnce(o, site) {
  o.emails = o.emails || {};
  if (!o.emails.whatsapp) { o.emails.whatsapp = new Date().toISOString(); await alertOwnerPaid(o, site).catch(() => false); }
  if (o.emails.paid) return false;
  const results = await Promise.allSettled([notifyMerchantPaid(o, site), notifyCustomerPaid(o, site)]);
  o.emails.paid = new Date().toISOString();
  return results.some((r) => r.status === "fulfilled" && r.value);
}

/** Para a loja: mensagem do formulário de contato ou cadastro do cupom de primeira compra. */
export function notifyMerchantForm(f, site) {
  const rows = Object.entries(f.fields || {}).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-size:14px;color:#7a6e66;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;font-size:14px;white-space:pre-wrap">${esc(v)}</td></tr>`).join("");
  const title = f.form === "contato" ? "Nova mensagem pelo site" : "Novo cadastro: cupom de primeira compra";
  const email = f.fields && /@/.test(f.fields.email || f.fields.contato || "") ? (f.fields.email || f.fields.contato) : undefined;
  return send({ to: process.env.ORDER_EMAIL_TO, replyTo: email, subject: title, html: layout(title, `<table role="presentation">${rows}</table>${button(site + "/painel/", "Abrir painel")}`, site) });
}

/** Código de confirmação da conta do cliente. */
export async function sendAccountCode(user, code, kind = "verify") {
  const site = configuredSiteUrl() || "https://elixirdaterra.com.br";
  const body = `<p style="font-size:15px;line-height:1.6">Olá, ${esc(String(user.name || "").split(" ")[0])}! ${kind === "reset" ? "Use o código abaixo para criar uma nova senha na sua conta Elixir da Terra:" : "Use o código abaixo para confirmar seu e-mail na sua conta Elixir da Terra:"}</p>
  <p style="font-size:32px;font-weight:bold;letter-spacing:6px;color:#800000;margin:18px 0">${esc(code)}</p>
  <p style="font-size:13px;color:#7a6e66">O código vale por 15 minutos. Se não foi você, ignore este e-mail.</p>`;
  return send({ to: user.email, subject: `Seu código: ${code}`, html: layout(kind === "reset" ? "Redefinir senha" : "Confirme seu e-mail", body, site) });
}
