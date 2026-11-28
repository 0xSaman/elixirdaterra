/* Configuração comum das páginas de produto em src/produtos/.
   Cada produto é um arquivo src/produtos/<slug>.njk com "produto: <slug>" e os textos de SEO.
   Daqui saem, pelo slug:
   - endereço: /<slug>/
   - conteúdo: src/_data/produtos/<slug>.js
   - cores: src/assets/css/produtos/<slug>.css (classe "tema-<slug>")
   - imagens: src/assets/img/produtos/<slug>/ (og.jpg é a imagem de compartilhamento)
   Por padrão a página fica isolada: fora do sitemap, com "noindex" e sem link no site.
   Para publicar de verdade, coloque "noindex: false" no arquivo do produto e adicione o link no menu. */
export default {
  layout: "layouts/produto-em-breve.njk",
  noindex: true,
  scripts: ["/assets/js/produto-em-breve.js"],
  eleventyComputed: {
    permalink: (data) => `/${data.produto}/`,
    bodyClass: (data) => `has-buybar tema-${data.produto}`,
    styles: (data) => ["/assets/css/produto-em-breve.css", `/assets/css/produtos/${data.produto}.css`],
    ogImage: (data) => `/assets/img/produtos/${data.produto}/og.jpg`,
    preload: (data) => {
      const first = data.produtos?.[data.produto]?.gallery?.[0]?.src;
      return first ? [first] : [];
    }
  }
};
