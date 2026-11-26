/* Helpers HTTP para as Netlify Functions (sintaxe moderna: Request → Response). */

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

export function siteUrl(req) {
  const env = process.env.SITE_URL || process.env.URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

export function methodNotAllowed(allowed) {
  return json(405, { message: "Método não permitido" }, { Allow: allowed.join(", ") });
}
