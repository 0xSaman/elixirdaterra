/* Cálculo de frete — tabela de reserva (funciona no servidor e no navegador). */
export function ufFromCep(cep, ranges) {
  const n = Math.floor(Number(String(cep).replace(/\D/g, "")) / 1000);
  const r = ranges.find(([a, b]) => n >= a && n <= b);
  return r ? r[2] : null;
}

export function packageFor(lines, unit) {
  const units = lines.reduce((s, l) => s + l.units * l.qty, 0);
  const weight = Math.round((units * unit.weight + 0.08) * 1000) / 1000; // + embalagem externa
  const height = Math.min(100, unit.height * Math.ceil(units / 3));
  return { units, weight, width: unit.width * (units > 1 ? 2 : 1), height, length: unit.length };
}

/** Frete grátis acima de um valor: zera a opção mais barata. */
export function applyFreeShipping(quote, subtotal, freeAbove, units = 0, freeFromUnits = 0) {
  const byValue = freeAbove && subtotal >= freeAbove, byUnits = freeFromUnits && units >= freeFromUnits;
  if (!quote || !quote.options.length || !(byValue || byUnits)) return quote;
  const options = quote.options.map((o) => ({ ...o }));
  options[0].price = 0; options[0].free = true;
  return { ...quote, options };
}

export function tableQuote({ cep, lines, settings, ufRegion, cepRanges }) {
  const uf = ufFromCep(cep, cepRanges);
  if (!uf) return null;
  const zone = uf === "SC" ? "SC" : ufRegion[uf];
  const pkg = packageFor(lines, settings.shipping.unit);
  const value = lines.reduce((s, l) => s + l.total, 0);
  const h = settings.shipping.handlingDays || 0;
  return {
    uf,
    source: "table",
    options: Object.entries(settings.shipping.table).filter(([, t]) => (!t.maxWeight || pkg.weight <= t.maxWeight) && (!t.maxValue || value <= t.maxValue)).map(([id, t]) => {
      const [p05, p1, p2, extra] = t.price[zone];
      const price = pkg.weight <= 0.5 ? p05 : pkg.weight <= 1 ? p1 : pkg.weight <= 2 ? p2 : p2 + Math.ceil(pkg.weight - 2) * extra;
      const [d0, d1] = t.days[zone];
      return { id, name: t.name, price, days: [d0 + h, d1 + h] };
    }).sort((a, b) => a.price - b.price)
  };
}
