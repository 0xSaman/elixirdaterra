# Elixir da Terra

Loja da Elixir da Terra: Eleventy (site estático) + Vercel Functions (`api/`) + Mercado Pago + Upstash Redis.

- `npm run build` gera o site em `_site/`
- `npm start` gera o site e sobe a loja local em http://localhost:8888 (sem chaves = modo demonstração)

Passo a passo completo (publicação, domínio, variáveis, Mercado Pago): `GUIA-DE-INTEGRACAO.txt`.

## Produtos novos (páginas "em breve")

Cada produto em pré-lançamento tem uma página com lista de espera, no mesmo molde da Carqueja (`/carqueja/`).
Para criar um produto, use o slug (ex.: `gengibre`) em todos os lugares:

| O quê | Onde |
|---|---|
| Página (só SEO e slug) | `src/produtos/<slug>.njk` (copie `carqueja.njk`) |
| Conteúdo (textos, kits, galeria, fontes) | `src/_data/produtos/<slug>.js` (copie `carqueja.js`) |
| Cores do produto | `src/assets/css/produtos/<slug>.css` (classe `.tema-<slug>`) |
| Imagens | `src/assets/img/produtos/<slug>/` (`og.jpg` = imagem de compartilhamento) |

- Endereço automático: `elixirdaterra.com.br/<slug>/` (configurado em `src/produtos/produtos.11tydata.js`).
- Por padrão a página fica **isolada**: sem link no site, fora do sitemap e com `noindex`. Acesso só pelo link.
- Os contatos da lista de espera aparecem no painel em "Mensagens e cupons", com o produto e o kit de interesse.
- Seções opcionais do conteúdo (`body`, `spirit`, `plant`, `faq`, `references`) só aparecem se existirem no arquivo.
- No lançamento: `noindex: false` no arquivo da página, link no menu (`src/_includes/partials/header.njk`) e preços no catálogo (`shared/catalog.js`, hoje com um produto só).
