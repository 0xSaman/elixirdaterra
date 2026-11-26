/* Cálculo do pedido no servidor — o preço nunca vem do navegador. */
import { variants, settings, defaultCoupons, round2 } from "../../shared/catalog.js";
import { quoteShipping } from "./shipping.mjs";

export const pixPercent = () => Number(process.env.PIX_DISCOUNT_PERCENT ?? settings.pixDiscountPercent);
export const maxInstallments = () => Number(process.env.MAX_INSTALLMENTS ?? settings.installments.max);

function coupons() {
  if (process.env.COUPONS) {
    try { return JSON.parse(process.env.COUPONS); } catch { console.error("COUPONS inválido (precisa ser JSON)"); }
  }
  return defaultCoupons;
}

export function findCoupon(code, subtotal) {
  if (!code) return null;
  const key = String(code).trim().toUpperCase();
  const c = coupons()[key];
  if (!c) return null;
  if (c.expiresAt && new Date(c.expiresAt).getTime() < Date.now()) return null;
  if (c.minSubtotal && subtotal < c.minSubtotal) return null;
  if (!["percent", "fixed"].includes(c.type) || !(c.value > 0)) return null;
  return { code: key, type: c.type, value: Number(c.value), firstPurchaseOnly: Boolean(c.firstPurchaseOnly) };
}

export function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

export function computeOrder(items, couponCode, method) {
  if (!Array.isArray(items) || !items.length || items.length > 10) throw badRequest("Seu carrinho está vazio.");
  const lines = items.map((i) => {
    const v = variants.find((x) => x.id === i?.id);
    const qty = Number.parseInt(i?.qty, 10);
    if (!v || !Number.isInteger(qty) || qty < 1 || qty > (settings.maxQtyPerItem || 20)) throw badRequest("Há um item inválido na sacola.");
    return { id: v.id, name: v.title, short: v.name, units: v.units, unitPrice: v.price, qty, total: round2(v.price * qty) };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  let coupon = null, couponDiscount = 0;
  if (couponCode) {
    coupon = findCoupon(couponCode, subtotal);
    if (!coupon) throw badRequest("Cupom inválido ou expirado.");
    couponDiscount = coupon.type === "percent" ? round2((subtotal * coupon.value) / 100) : Math.min(coupon.value, subtotal);
  }
  const afterCoupon = round2(subtotal - couponDiscount);
  const pixDiscount = method === "pix" ? round2((afterCoupon * pixPercent()) / 100) : 0;
  const total = round2(afterCoupon - pixDiscount);
  if (total < 1) throw badRequest("Valor do pedido inválido.");
  return { lines, subtotal, coupon, couponDiscount, pixDiscount, shipping: 0, total };
}

/** Pedido completo com frete recalculado no servidor para o CEP e a opção escolhida. */
export async function computeOrderWithShipping(items, couponCode, method, cep, shippingId) {
  const calc = computeOrder(items, couponCode, method);
  const quote = await quoteShipping(cep, calc.lines);
  if (!quote) throw badRequest("CEP inválido para calcular o frete.");
  const opt = quote.options.find((o) => o.id === shippingId);
  if (!opt) throw Object.assign(new Error("O valor do frete foi atualizado. Escolha novamente a forma de entrega."), { status: 409, quote });
  calc.shipping = opt.price;
  calc.shippingOption = opt;
  calc.total = round2(calc.total + opt.price);
  return calc;
}
