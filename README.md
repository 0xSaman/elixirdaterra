# Elixir da Terra

Loja da Elixir da Terra: Eleventy (site estático) + Vercel Functions (`api/`) + Mercado Pago + Upstash Redis.

- `npm run build` gera o site em `_site/`
- `npm start` gera o site e sobe a loja local em http://localhost:8888 (sem chaves = modo demonstração)
- `npm run migrate:netlify` copia pedidos, contas e carrinhos da Netlify para o Redis do Vercel

Passo a passo completo (publicação, variáveis, Mercado Pago, migração): `GUIA-DE-INTEGRACAO.txt`.
