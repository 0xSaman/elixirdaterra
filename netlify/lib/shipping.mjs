/* Frete: Melhor Envio em tempo real (se configurado) com tabela de reserva. */
import { settings, ufRegion, cepRanges } from "../../shared/catalog.js";
import { tableQuote, ufFromCep, applyFreeShipping } from "../../shared/shipping.js";

const ME_TOKEN = () => (process.env.MELHOR_ENVIO_TOKEN || "").trim();
const ME_BASE = () => (process.env.MELHOR_ENVIO_SANDBOX === "true" ? "https://sandbox.melhorenvio.com.br" : "https://melhorenvio.com.br");

async function melhorEnvio(cep, lines) {
  const u = settings.shipping.unit;
  const insurance = lines.reduce((s, l) => s + l.total, 0);
  const units = lines.reduce((s, l) => s + l.units * l.qty, 0);
  const body = {
    from: { postal_code: (process.env.SHIPPING_ORIGIN_CEP || settings.shipping.originCep).replace(/\D/g, "") },
    to: { postal_code: cep },
    products: [{ id: "extrato-curcuma-30ml", width: u.width, height: u.height, length: u.length, weight: u.weight, insurance_value: Math.round((insurance / units) * 100) / 100, quantity: units }],
    options: { receipt: false, own_hand: false }
  };
  if (process.env.MELHOR_ENVIO_SERVICES) body.services = process.env.MELHOR_ENVIO_SERVICES;
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(`${ME_BASE()}/api/v2/me/shipment/calculate`, {
      method: "POST", signal: ctrl.signal,
      headers: { Authorization: `Bearer ${ME_TOKEN()}`, Accept: "application/json", "Content-Type": "application/json", "User-Agent": `Elixir da Terra (${process.env.ORDER_EMAIL_TO || "contato@elixirdaterra.com.br"})` },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`melhor envio ${r.status}`);
    const data = await r.json();
    const h = settings.shipping.handlingDays || 0;
    const options = (Array.isArray(data) ? data : []).filter((s) => !s.error && (s.custom_price || s.price))
      .map((s) => {
        const d = s.custom_delivery_range || s.delivery_range || {};
        const min = Number(d.min ?? s.custom_delivery_time ?? s.delivery_time) || 0;
        const max = Number(d.max ?? s.custom_delivery_time ?? s.delivery_time) || min;
        return { id: `me-${s.id}`, name: s.company?.name && !String(s.name).includes(s.company.name) ? `${s.company.name} ${s.name}` : String(s.name), price: Math.round(Number(s.custom_price || s.price) * 100) / 100, days: [min + h, max + h] };
      })
      .sort((a, b) => a.price - b.price).slice(0, 4);
    if (!options.length) throw new Error("sem opções");
    return { uf: ufFromCep(cep, cepRanges), source: "melhorenvio", options };
  } finally { clearTimeout(t); }
}

export async function quoteShipping(cepRaw, lines) {
  const cep = String(cepRaw || "").replace(/\D/g, "");
  if (cep.length !== 8) return null;
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const freeAbove = Number(process.env.FREE_SHIPPING_ABOVE ?? settings.shipping.freeAbove) || 0;
  const freeUnits = Number(process.env.FREE_SHIPPING_UNITS ?? settings.shipping.freeFromUnits) || 0;
  const units = lines.reduce((s, l) => s + l.units * l.qty, 0);
  let quote = null;
  if (ME_TOKEN()) {
    try { quote = await melhorEnvio(cep, lines); }
    catch (e) { console.warn("[frete] Melhor Envio indisponível, usando tabela:", e.message); }
  }
  if (!quote) quote = tableQuote({ cep, lines, settings, ufRegion, cepRanges });
  return applyFreeShipping(quote, subtotal, freeAbove, units, freeUnits);
}
