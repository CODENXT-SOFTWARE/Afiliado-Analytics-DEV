/**
 * Encurtador oficial do painel Amazon Associates (Site Stripe).
 *
 * Replica a chamada interna que o painel afiliados.amazon.com.br faz quando
 * o usuário clica em "Obter link" → "Link curto":
 *
 *   GET https://www.amazon.com.br/associates/sitestripe/getShortUrl
 *     ?longUrl=<URL canônica com tag>&marketplaceId=526970
 *
 * Resposta:
 *   { ok: true, longUrl, shortUrl: "https://amzn.to/XXXX", isOk: true }
 *
 * Requer o cookie de sessão do afiliado (mesmo cookie já capturado pela
 * extensão para a busca SERP). Se a chamada falhar (timeout, http != 200,
 * resposta inesperada), retorna null e o caller cai pro link canônico.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

/** ID do marketplace Amazon Brasil (capturado da request real). */
const MARKETPLACE_ID_BR = "526970";

const DEFAULT_TIMEOUT_MS = 10000;

function generateLinkId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  let s = "";
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

/**
 * Monta a `longUrl` no formato exato que o Site Stripe envia. Os parâmetros
 * `linkCode=sl2` / `linkId` / `ref_=as_li_ss_tl` são os de "link de texto"
 * do painel; preservamos pra que a Amazon trate como uma geração legítima
 * vinda do Site Stripe (e o `amzn.to` saia idêntico ao do painel).
 */
function buildLongUrlForSitestripe(asin: string, affiliateTag: string): string {
  const tag = encodeURIComponent(affiliateTag);
  const linkId = generateLinkId();
  return `https://www.amazon.com.br/dp/${asin}?th=1&linkCode=sl2&tag=${tag}&linkId=${linkId}&ref_=as_li_ss_tl`;
}

export type SitestripeShortUrlResult = {
  shortUrl: string | null;
  /** Razão da falha quando shortUrl == null. Útil pra diagnóstico em log/UI. */
  reason?:
    | "invalid-asin"
    | "missing-tag"
    | "missing-cookie"
    | "timeout"
    | "http-error"
    | "non-json-response"
    | "amazon-not-ok"
    | "no-short-url";
  status?: number;
  body?: string;
};

export async function fetchAmazonSitestripeShortUrl(args: {
  asin: string;
  affiliateTag: string;
  cookieHeader: string;
  timeoutMs?: number;
}): Promise<SitestripeShortUrlResult> {
  const asin = args.asin.trim();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return { shortUrl: null, reason: "invalid-asin" };
  const tag = args.affiliateTag.trim();
  if (!tag) return { shortUrl: null, reason: "missing-tag" };
  if (!args.cookieHeader.trim()) return { shortUrl: null, reason: "missing-cookie" };

  const longUrl = buildLongUrlForSitestripe(asin, tag);
  const url = new URL("https://www.amazon.com.br/associates/sitestripe/getShortUrl");
  url.searchParams.set("longUrl", longUrl);
  url.searchParams.set("marketplaceId", MARKETPLACE_ID_BR);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        accept: "application/json, text/javascript, */*; q=0.01",
        "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "x-requested-with": "XMLHttpRequest",
        referer: `https://www.amazon.com.br/dp/${asin}`,
        cookie: args.cookieHeader,
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { shortUrl: null, reason: "http-error", status: res.status, body: body.slice(0, 400) };
    }
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return {
        shortUrl: null,
        reason: "non-json-response",
        status: res.status,
        body: text.slice(0, 400),
      };
    }
    if (!json || typeof json !== "object") {
      return { shortUrl: null, reason: "non-json-response", status: res.status, body: text.slice(0, 400) };
    }
    const j = json as { ok?: unknown; isOk?: unknown; shortUrl?: unknown };
    if (j.ok !== true && j.isOk !== true) {
      return { shortUrl: null, reason: "amazon-not-ok", status: res.status, body: text.slice(0, 400) };
    }
    const short = typeof j.shortUrl === "string" ? j.shortUrl.trim() : "";
    if (!/^https:\/\/amzn\.to\/[A-Za-z0-9]+/.test(short)) {
      return { shortUrl: null, reason: "no-short-url", status: res.status, body: text.slice(0, 400) };
    }
    return { shortUrl: short, status: res.status };
  } catch (e) {
    const isTimeout = e instanceof Error && (e.name === "AbortError" || /aborted/i.test(e.message));
    return { shortUrl: null, reason: isTimeout ? "timeout" : "http-error", body: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(timer);
  }
}

/* ─────────────────────────────────────────────────────────────────────────
 * Cache in-memory por (asin, tag). Evita rebater no sitestripe quando o
 * usuário gera o mesmo link várias vezes (ex.: refresh do histórico).
 * Pequeno e processo-local (em prod com várias instâncias cada uma tem o
 * seu — ok pra esse uso, não é caminho crítico).
 * ──────────────────────────────────────────────────────────────────────── */
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h
const CACHE_MAX_ENTRIES = 1000;
const cache = new Map<string, { value: string; ts: number }>();

function cacheKey(asin: string, tag: string): string {
  return `${asin}::${tag}`;
}

export function getCachedSitestripeShortUrl(asin: string, tag: string): string | null {
  const k = cacheKey(asin, tag);
  const e = cache.get(k);
  if (!e) return null;
  if (Date.now() - e.ts > CACHE_TTL_MS) {
    cache.delete(k);
    return null;
  }
  return e.value;
}

export function setCachedSitestripeShortUrl(asin: string, tag: string, value: string): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // descarta o mais antigo
    const firstKey = cache.keys().next().value;
    if (firstKey != null) cache.delete(firstKey);
  }
  cache.set(cacheKey(asin, tag), { value, ts: Date.now() });
}
