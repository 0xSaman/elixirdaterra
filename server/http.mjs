/* Helpers HTTP para as funções do Vercel (sintaxe Web: Request → Response). */

export function json(status, data, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers }
  });
}

export async function readJson(req, limit = 100 * 1024) {
  const text = await req.text();
  if (text.length > limit) throw Object.assign(new Error("Payload muito grande"), { status: 413 });
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

/** Endereço público da loja: SITE_URL (recomendado) → domínio de produção do Vercel → host da requisição. */
export function configuredSiteUrl() {
  const env = process.env.SITE_URL || process.env.URL;
  if (env) return env.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "";
}
export function siteUrl(req) {
  const env = configuredSiteUrl();
  if (env) return env;
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export function methodNotAllowed(allowed) {
  return json(405, { message: "Método não permitido" }, { Allow: allowed.join(", ") });
}
