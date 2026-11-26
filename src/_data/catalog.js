import { product, variants, settings, ufRegion, cepRanges } from "../../shared/catalog.js";

const pct = Number(process.env.PIX_DISCOUNT_PERCENT ?? settings.pixDiscountPercent);

export default {
  product,
  variants,
  settings: { ...settings, pixDiscountPercent: pct },
  ufRegion,
  cepRanges,
  minPrice: Math.min(...variants.map((v) => v.price)),
  maxPrice: Math.max(...variants.map((v) => v.price))
};
