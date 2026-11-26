// Dados gerais da loja. A Netlify define process.env.URL automaticamente no deploy.
export default {
  name: "Elixir da Terra",
  url: (process.env.SITE_URL || process.env.URL || "https://elixirdaterra.com.br").replace(/\/$/, ""),
  lang: "pt-BR",
  description:
    "Extrato de cúrcuma agroecológico, produzido artesanalmente a partir de raízes cultivadas em agrofloresta. Enviamos para todo o Brasil com rastreio.",
  whatsapp: "5548996142907",
  whatsappDisplay: "(48) 99614-2907",
  email: "contato@elixirdaterra.com.br", // ← troque pelo seu e-mail
  instagram: "https://www.instagram.com/elixir.daterra/",
  instagramHandle: "@elixir.daterra",
  legal: {
    company: "Elixir da Terra", // ← razão social completa
    cnpj: "63.742.867/0001-32",
    address: "Estrada Geral Alto Rio Lessa, S/N - Alto Rio Lessa - Alfredo Wagner/SC - CEP 88450-000" // ← obrigatório (Decreto 7.962/2013)
  },
  // IDs de análise (opcional). Só carregam depois do consentimento de cookies.
  analytics: {
    ga4: "", // ex.: "G-XXXXXXX"
    metaPixel: "" // ex.: "123456789012345"
  },
  year: new Date().getFullYear()
};
