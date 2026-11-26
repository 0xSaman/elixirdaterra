export default function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy({ "src/assets/img": "assets/img" });
  eleventyConfig.addPassthroughCopy({ "src/assets/css": "assets/css" });
  eleventyConfig.addPassthroughCopy({ "src/assets/js": "assets/js" });
  eleventyConfig.addPassthroughCopy({ "src/assets/img/favicon.ico": "favicon.ico" });

  // Posts do blog (mais recentes primeiro)
  eleventyConfig.addCollection("posts", (api) =>
    api.getFilteredByGlob("src/blog/posts/*.md").sort((a, b) => b.date - a.date)
  );

  const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  eleventyConfig.addFilter("brl", (v) => BRL.format(v || 0).replace(/ /g, " "));
  eleventyConfig.addFilter("dateBR", (d) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
  );
  eleventyConfig.addFilter("isoDate", (d) => new Date(d).toISOString().slice(0, 10));
  eleventyConfig.addFilter("readingTime", (content) => {
    const words = String(content || "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
  });
  eleventyConfig.addFilter("faqFilter", (arr, group, limit) => {
    let out;
    if (group === "mix") {
      const seen = {};
      out = (arr || []).filter((i) => (seen[i.group] = (seen[i.group] || 0) + 1) <= 2);
    } else out = (arr || []).filter((i) => !group || i.group === group);
    return limit ? out.slice(0, limit) : out;
  });
  const BUILD = Date.now().toString(36);
  eleventyConfig.addFilter("v", (url) => `${url}${String(url).includes("?") ? "&" : "?"}v=${BUILD}`);
  eleventyConfig.addFilter("related", (posts, url, category, n = 3) => {
    const others = (posts || []).filter((p) => p.url !== url);
    const same = others.filter((p) => p.data.category === category);
    return [...same, ...others.filter((p) => p.data.category !== category)].slice(0, n);
  });
  eleventyConfig.addFilter("categories", (posts) => [...new Set((posts || []).map((p) => p.data.category))]);
  eleventyConfig.addFilter("byPriority", (posts) => [...(posts || [])].sort((a, b) => (a.data.featured || 99) - (b.data.featured || 99) || b.date - a.date));
  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));
  eleventyConfig.addFilter("exclude", (arr, url) => (arr || []).filter((p) => p.url !== url));
  eleventyConfig.addFilter("absUrl", (path, base) => new URL(path, base).href);
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("perUnit", (v) => BRL.format(v.price / v.units).replace(/ /g, " "));
  eleventyConfig.addFilter("pix", (price, pct) => BRL.format(Math.round(price * (100 - pct)) / 100).replace(/ /g, " "));

  // Minifica o CSS publicado (sem dependências)
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const fs = await import("node:fs/promises"); const path = await import("node:path");
    const cssDir = path.join(dir.output, "assets/css");
    for (const f of await fs.readdir(cssDir).catch(() => [])) {
      if (!f.endsWith(".css")) continue;
      const p = path.join(cssDir, f); let css = await fs.readFile(p, "utf8");
      css = css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{};,>])\s*/g, "$1").replace(/;}/g, "}").trim();
      await fs.writeFile(p, css);
    }
  });

  // Content-Security-Policy com hashes dos scripts inline (gerado a cada build em _site/_headers)
  eleventyConfig.on("eleventy.after", async ({ dir }) => {
    const fs = await import("node:fs/promises"); const path = await import("node:path"); const crypto = await import("node:crypto");
    const hashes = new Set();
    async function walk(d) {
      for (const e of await fs.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (p.endsWith(".html")) {
          const html = await fs.readFile(p, "utf8");
          for (const m of html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)) {
            hashes.add("'sha256-" + crypto.createHash("sha256").update(m[1]).digest("base64") + "'");
          }
        }
      }
    }
    await walk(dir.output);
    const mp = "https://*.mercadopago.com https://*.mercadopago.com.br https://*.mercadolibre.com https://*.mercadolivre.com https://*.mlstatic.com";
    const csp = [
      "default-src 'self'",
      `script-src 'self' ${[...hashes].join(" ")} https://sdk.mercadopago.com ${mp} https://www.googletagmanager.com https://connect.facebook.net`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      `connect-src 'self' https://viacep.com.br ${mp} https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net`,
      `frame-src ${mp} https://www.googletagmanager.com`,
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests"
    ].join("; ");
    await fs.writeFile(path.join(dir.output, "_headers"), `/*\n  Content-Security-Policy: ${csp}\n`);
  });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"]
  };
}
