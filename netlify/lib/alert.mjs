/* Aviso no WhatsApp da loja a cada venda paga (CallMeBot, gratuito).
   Precisa das variáveis na Netlify: WHATSAPP_ALERT_APIKEY (chave que o bot envia)
   e, opcional, WHATSAPP_ALERT_PHONE (padrão: 5548996142907). Sem a chave, não faz nada. */
const brl = (n) => "R$ " + Number(n || 0).toFixed(2).replace(".", ",");
const METHOD = { pix: "Pix", card: "Cartão", boleto: "Boleto" };

export const whatsappAlertEnabled = () => Boolean(process.env.WHATSAPP_ALERT_APIKEY);
export const pushAlertEnabled = () => /^[\w-]{12,64}$/.test(process.env.NTFY_TOPIC || "");

/* Notificação no celular pelo app gratuito ntfy (sem cadastro). Variável: NTFY_TOPIC */
async function pushNtfy(o, site, text) {
  try {
    const r = await fetch(`https://ntfy.sh/${process.env.NTFY_TOPIC}`, {
      method: "POST", body: text.replace(/\*/g, ""),
      headers: { Title: `Nova venda paga - ${brl(o.amount)}`.normalize("NFD").replace(/[^\x20-\x7e]/g, ""), Tags: "moneybag,herb", Priority: "high", Click: `${site}/painel/` },
      signal: AbortSignal.timeout(8000)
    });
    if (!r.ok) console.warn(`[alerta] ntfy respondeu ${r.status}`);
    return r.ok;
  } catch (e) { console.warn("[alerta] falha no ntfy:", e.message); return false; }
}

export async function alertOwnerPaid(o, site) {
  if (!whatsappAlertEnabled() && !pushAlertEnabled()) return false;
  const c = o.customer || {}, a = o.address || {};
  const itens = (o.items || []).map((i) => `• ${i.qty}× ${i.short || i.name}`).join("\n");
  const text = [
    `🌿 *Nova venda paga!* ${o.id}`,
    `*${brl(o.amount)}* · ${METHOD[o.method] || o.method}${o.installments > 1 ? ` ${o.installments}x` : ""}${o.coupon ? ` · cupom ${o.coupon}` : ""}`,
    itens,
    `👤 ${String(c.name || "").split(" ")[0]}`,
    `📦 ${a.city || ""}/${a.uf || ""} · ${o.shipping ? o.shipping.name : ""}`,
    `Painel: ${site}/painel/`
  ].join("\n");
  const results = [];
  if (pushAlertEnabled()) results.push(pushNtfy(o, site, text));
  if (whatsappAlertEnabled()) results.push(sendWhatsApp(text));
  return (await Promise.all(results)).some(Boolean);
}

async function sendWhatsApp(text) {
  const phone = (process.env.WHATSAPP_ALERT_PHONE || "5548996142907").replace(/\D/g, "");
  const url = `https://api.callmebot.com/whatsapp.php?phone=%2B${phone}&text=${encodeURIComponent(text)}&apikey=${encodeURIComponent(process.env.WHATSAPP_ALERT_APIKEY)}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) console.warn(`[alerta] WhatsApp respondeu ${r.status}`);
    return r.ok;
  } catch (e) { console.warn("[alerta] falha ao avisar no WhatsApp:", e.message); return false; }
}
