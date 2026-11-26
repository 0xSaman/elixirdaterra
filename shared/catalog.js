/* =============================================================
   CATÁLOGO — FONTE ÚNICA DE PREÇOS E CONFIGURAÇÕES DA LOJA
   Usado pelo site (páginas geradas), pelo navegador (carrinho)
   e pelas funções de pagamento. Altere aqui e publique.
   O servidor SEMPRE recalcula o total a partir deste arquivo.
   ============================================================= */

export const product = {
  id: "extrato-curcuma-30ml",
  slug: "extrato-de-curcuma",
  name: "Extrato de Cúrcuma Agroecológico",
  shortName: "Extrato de Cúrcuma",
  size: "30 ml",
  gtin13: "0074468279407",
  brand: "Elixir da Terra",
  tagline: "Tintura artesanal de cúrcuma, cultivada em agrofloresta.",
  composition: "Tintura de cúrcuma (açafrão-da-terra) em solução hidroalcoólica.",
  usage: "10 a 15 gotas, 2 vezes ao dia. Puro ou diluído na bebida de sua preferência. Agite antes de usar.",
  storage: "Conservar em local seco, arejado e protegido da luz.",
  shelfLife: "18 meses",
  regulatory: "Dispensado de registro conforme RDC 240 de 26/07/2018.",
  yieldNote: "Cada frasco de 30 ml rende de 20 a 30 dias no uso sugerido (10–15 gotas, 2x ao dia)."
};

export const variants = [
  {
    id: "individual",
    name: "Primeira Gota — 1 frasco",
    title: "Extrato de Cúrcuma 30 ml — Primeira Gota (1 frasco)",
    units: 1,
    price: 59.9,
    compareAt: null,
    duration: "Rende de 20 a 30 dias",
    image: "/assets/img/kit-1.webp"
  },
  {
    id: "ritual",
    name: "Ritual da Terra — 3 frascos",
    title: "Extrato de Cúrcuma 30 ml — Ritual da Terra (3 frascos)",
    units: 3,
    price: 159.9,   // R$ 53,30 por frasco
    compareAt: 179.7,
    badge: "Recomendado", // troque para "Mais vendido" quando for o kit mais vendido de fato
    duration: "Para 2 a 3 meses de uso",
    image: "/assets/img/kit-3.webp"
  },
  {
    id: "familia",
    name: "Elixir da Família — 6 frascos",
    title: "Extrato de Cúrcuma 30 ml — Elixir da Família (6 frascos)",
    units: 6,
    price: 299.4,   // R$ 49,90 por frasco
    compareAt: 359.4,
    badge: "Melhor preço por frasco",
    duration: "Para 4 a 6 meses ou a família toda",
    image: "/assets/img/kit-6.webp"
  }
];

export const settings = {
  currency: "BRL",
  pixDiscountPercent: 0, // desconto no Pix desativado (coloque 5 para voltar a dar 5%)
  installments: { max: 12, noInterest: 3, minInstallmentValue: 5 },
  /* FRETE — calculado pelo CEP.
     Com MELHOR_ENVIO_TOKEN no Vercel, as cotações vêm em tempo real (Correios e transportadoras).
     Sem o token (ou se o Melhor Envio falhar), usa a tabela de reserva abaixo, a partir de Alfredo Wagner/SC. */
  shipping: {
    originCep: "88450000",
    handlingDays: 1, // dias para postar após o pagamento
    // Embalagem de 1 frasco com caixa (cm / kg). Kits somam o peso e aumentam a altura.
    unit: { width: 11, height: 5, length: 16, weight: 0.12 },
    // Frete grátis acima deste valor (em R$) — estratégia das grandes lojas para vender mais kits.
    // null = desligado. Ex.: 150 deixa grátis o Ritual da Terra e o Elixir da Família (a opção mais barata fica R$ 0).
    // Frete grátis a partir desta quantidade de frascos no pedido (a opção mais barata fica R$ 0). null = desligado.
    freeFromUnits: 6,
    freeAbove: null, // alternativa por valor (R$); deixe null para usar só a regra de frascos
    // Tabela de reserva (R$), com preços médios de plataformas de frete (Melhor Envio/SuperFrete),
    // que dão desconto sobre o balcão dos Correios. Faixas de peso: [até 0,5 kg, até 1 kg, até 2 kg, por kg adicional]
    table: {
      mini:  { name: "Correios Mini Envios", maxWeight: 0.3, maxValue: 100,
               days: { SC: [4, 7], S: [5, 9], SE: [6, 11], CO: [7, 12], NE: [9, 15], N: [10, 18] },
               price: { SC: [11, 11, 11, 0], S: [12, 12, 12, 0], SE: [13, 13, 13, 0], CO: [14, 14, 14, 0], NE: [15, 15, 15, 0], N: [16, 16, 16, 0] } },
      pac:   { name: "PAC",   days: { SC: [3, 5], S: [4, 7], SE: [5, 9], CO: [6, 10], NE: [8, 13], N: [9, 16] },
               price: { SC: [15, 17, 21, 4], S: [17, 20, 24, 5], SE: [20, 23, 28, 6], CO: [23, 27, 33, 7], NE: [27, 32, 40, 8], N: [31, 37, 47, 9] } },
      sedex: { name: "SEDEX", days: { SC: [1, 2], S: [2, 3], SE: [2, 4], CO: [3, 5], NE: [4, 6], N: [5, 8] },
               price: { SC: [19, 22, 27, 5], S: [23, 27, 33, 7], SE: [28, 33, 41, 8], CO: [34, 40, 50, 10], NE: [42, 50, 63, 12], N: [49, 59, 75, 14] } }
    }
  },
  // Prazo estimado (dias úteis) após a postagem, por região — ajuste à sua realidade
  shippingEta: {
    S: [3, 6], SE: [4, 8], CO: [5, 9], NE: [6, 12], N: [7, 15]
  },
  maxQtyPerItem: 20
};

export const ufRegion = {
  PR: "S", SC: "S", RS: "S",
  SP: "SE", RJ: "SE", MG: "SE", ES: "SE",
  DF: "CO", GO: "CO", MT: "CO", MS: "CO",
  BA: "NE", SE: "NE", AL: "NE", PE: "NE", PB: "NE", RN: "NE", CE: "NE", PI: "NE", MA: "NE",
  PA: "N", AM: "N", AP: "N", RR: "N", RO: "N", AC: "N", TO: "N"
};

// Cupons padrão (podem ser substituídos pela variável de ambiente COUPONS no Vercel)
export const defaultCoupons = {
  BEMVINDO10: { type: "percent", value: 10, firstPurchaseOnly: true } // só na primeira compra (checado por CPF, e-mail e celular)
};

// Faixas de CEP por estado (Correios)
export const cepRanges = [
  [1000, 19999, "SP"], [20000, 28999, "RJ"], [29000, 29999, "ES"], [30000, 39999, "MG"],
  [40000, 48999, "BA"], [49000, 49999, "SE"], [50000, 56999, "PE"], [57000, 57999, "AL"],
  [58000, 58999, "PB"], [59000, 59999, "RN"], [60000, 63999, "CE"], [64000, 64999, "PI"],
  [65000, 65999, "MA"], [66000, 68899, "PA"], [68900, 68999, "AP"], [69000, 69299, "AM"],
  [69300, 69399, "RR"], [69400, 69899, "AM"], [69900, 69999, "AC"], [70000, 72799, "DF"],
  [72800, 72999, "GO"], [73000, 73699, "DF"], [73700, 76799, "GO"], [76800, 76999, "RO"],
  [77000, 77999, "TO"], [78000, 78899, "MT"], [79000, 79999, "MS"], [80000, 87999, "PR"],
  [88000, 89999, "SC"], [90000, 99999, "RS"]
];

export const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

/** Dados públicos que o navegador recebe. */
export function publicCatalog(overrides = {}) {
  return { product, variants, settings: { ...settings, ...overrides }, ufRegion, cepRanges };
}
