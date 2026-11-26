/* Migração dos dados da Netlify (Netlify Blobs) para o Redis do Vercel (Upstash).
   Copia TUDO do armazenamento "orders": pedidos (EDT-*), contas de clientes e chave das sessões (SEC-*)
   e carrinhos abandonados (LEAD-*). Não apaga nada na Netlify.

   Uso (no seu computador, na pasta do projeto, depois de "npm install"):
     NETLIFY_SITE_ID=...  NETLIFY_AUTH_TOKEN=...  KV_REST_API_URL=...  KV_REST_API_TOKEN=...  npm run migrate:netlify
   Para só conferir, sem gravar:  npm run migrate:netlify -- --dry-run

   - NETLIFY_SITE_ID: Netlify > Project configuration > General > Project ID
   - NETLIFY_AUTH_TOKEN: Netlify > User settings > Applications > Personal access tokens
   - KV_REST_API_URL / KV_REST_API_TOKEN: Vercel > Storage > (banco Upstash) > .env.local */
import { getStore } from "@netlify/blobs";
import { Redis } from "@upstash/redis";

const DRY = process.argv.includes("--dry-run");
const PREFIX = "edt:";
const need = (k) => { const v = process.env[k]; if (!v) { console.error(`Falta a variável ${k}.`); process.exit(1); } return v; };

const store = getStore({ name: "orders", siteID: need("NETLIFY_SITE_ID"), token: need("NETLIFY_AUTH_TOKEN") });
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
if (!DRY && (!url || !token)) { console.error("Falta KV_REST_API_URL / KV_REST_API_TOKEN do Vercel."); process.exit(1); }
const redis = DRY ? null : new Redis({ url, token });

const keys = [];
for await (const page of store.list({ paginate: true })) keys.push(...page.blobs.map((b) => b.key));
const count = (p) => keys.filter((k) => k.startsWith(p)).length;
console.log(`Encontrados ${keys.length} registros na Netlify: ${count("EDT-")} pedidos, ${count("SEC-user-")} contas, ${count("LEAD-")} carrinhos, ${count("SEC-") - count("SEC-user-")} de segurança.`);

let copied = 0, skipped = 0;
for (const key of keys) {
  if (key === "__ping__") { skipped++; continue; }
  const val = await store.get(key, { type: "json" }).catch(() => null);
  if (val == null) { skipped++; console.warn(`  ! ${key}: vazio ou ilegível, ignorado`); continue; }
  if (!DRY) await redis.set(PREFIX + key, val);
  copied++;
  if (copied % 50 === 0) console.log(`  ${copied}/${keys.length}…`);
}
console.log(`${DRY ? "[simulação] seriam copiados" : "Copiados"} ${copied} registros (${skipped} ignorados).`);

if (!DRY) {
  const sample = keys.find((k) => k.startsWith("EDT-"));
  if (sample) console.log(`Conferência: pedido ${sample} no Redis →`, (await redis.get(PREFIX + sample)) ? "OK" : "NÃO ENCONTRADO");
}
