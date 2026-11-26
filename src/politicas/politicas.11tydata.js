export default {
  layout: "layouts/page.njk",
  eyebrow: "Políticas da loja",
  updated: "2026-10-24",
  eleventyComputed: {
    permalink: (data) => `/politicas/${data.page.fileSlug}/`
  }
};
