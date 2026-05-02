/**
 * Busca por texto no site do Mercado Livre usando apenas Cookie de sessão (ssid da extensão).
 * Não usa api.mercadolibre.com.
 */

import { extractMlbIdFromUrl } from "@/lib/mercadolivre/extract-mlb-id";
import type { MlPdpProductMeta } from "@/lib/mercadolivre/fetch-product-pdp-html";
import {
  buildProdutoMercadolivreShortUrl,
  fetchMlProductMetaFromPdpHtml,
} from "@/lib/mercadolivre/fetch-product-pdp-html";

export type MlSiteSearchProduct = {
  itemId: string;
  productName: string;
  productLink: string;
  imageUrl: string;
  price: number | null;
  priceOriginal: number | null;
  discountRate: number | null;
  currencyId: string;
  /** Do PDP com sessão afiliada: texto "GANHOS X%" na barra do ML. */
  affiliateCommissionPct?: number | null;
  /** Cupom em % (1–99) — vindo da PDP enriquecida. */
  couponPercent?: number | null;
  /** Cupom em valor R$ — alternativo ao percentual. */
  couponAmount?: number | null;
  /** Desconto exclusivo Pix em % (ex.: 4 → "no Pix 4% OFF"). */
  pixDiscountPercent?: number | null;
  /** True se a entrega é via FULL (logística ML — chega rápido). */
  isFull?: boolean | null;
  /** True se há frete grátis disponível. */
  freeShipping?: boolean | null;
  /** Quantidade de parcelas (ex.: 4 → "4x sem juros"). */
  installmentsCount?: number | null;
  /** Valor de cada parcela em R$. */
  installmentAmount?: number | null;
  /** True se as parcelas são sem juros. */
  installmentsFreeInterest?: boolean | null;
};

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
  Referer: "https://www.mercadolivre.com.br/",
};

function discountFromPrices(promo: number, original: number): number | null {
  if (original > promo && original > 0) {
    return Math.round((1 - promo / original) * 10000) / 100;
  }
  return null;
}

function slugFromQuery(q: string): string {
  const t = q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const slug = t.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug.length ? slug : "busca";
}

function listingSearchUrls(query: string): string[] {
  const q = query.trim();
  const slug = slugFromQuery(q);
  const enc = encodeURIComponent(q);
  return [
    `https://lista.mercadolivre.com.br/${slug}`,
    `https://www.mercadolivre.com.br/lq/${enc}`,
    `https://lista.mercadolivre.com.br/${enc}`,
  ];
}

function dedupeByLink(items: MlSiteSearchProduct[]): MlSiteSearchProduct[] {
  const seen = new Set<string>();
  const out: MlSiteSearchProduct[] = [];
  for (const it of items) {
    const k = it.productLink.split("#")[0].split("?")[0].toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

function pushProduct(sink: MlSiteSearchProduct[], limit: number, p: MlSiteSearchProduct): void {
  if (sink.length >= limit) return;
  if (!p.productLink || !p.productName) return;
  sink.push(p);
}

/** Prioriza cartões com título real, imagem e preço (evita ficar só em "permalink" solto). */
function scoreListingProduct(p: MlSiteSearchProduct): number {
  let s = 0;
  const name = p.productName.trim();
  if (name && !/^Anúncio\s+MLB/i.test(name) && !/^Produto\s+MLB/i.test(name)) s += 4;
  else if (name) s += 1;
  if (p.imageUrl?.trim()) s += 2;
  if (p.price != null) s += 2;
  if (p.discountRate != null && p.discountRate > 0) s += 1;
  return s;
}

function mergeListingSources(lists: MlSiteSearchProduct[][], limit: number): MlSiteSearchProduct[] {
  const map = new Map<string, MlSiteSearchProduct>();
  for (const list of lists) {
    for (const p of list) {
      const key = p.productLink.split("#")[0].split("?")[0].toLowerCase();
      if (!key) continue;
      const prev = map.get(key);
      if (!prev || scoreListingProduct(p) > scoreListingProduct(prev)) map.set(key, p);
    }
  }
  return [...map.values()].slice(0, limit);
}

/** Decodifica entidades que o ML usa em href/JSON; senão `/social/` pode não ser reconhecido pelo `URL`. */
function decodeMlUrlForParsing(s: string): string {
  let t = s.trim();
  for (let i = 0; i < 5; i++) {
    const next = t
      .replace(/&amp;#x2f;/gi, "/")
      .replace(/&amp;#47;/gi, "/")
      .replace(/&#x2f;/gi, "/")
      .replace(/&#47;/gi, "/")
      .replace(/&amp;/gi, "&");
    if (next === t) break;
    t = next;
  }
  return t;
}

/**
 * Qualquer rota /social/… no ML (perfil, “Minhas listas”, recomendações) — não é página de anúncio.
 * Antes só filtrávamos …/lists; o perfil /social/usuario ainda entrava no scrape de URLs.
 */
export function isMlSocialListsProfileUrl(url: string): boolean {
  const t = decodeMlUrlForParsing(url);
  if (!t) return false;
  if (!/mercadolivre\.|mercadolibre\./i.test(t)) return false;
  try {
    return /\/social\//i.test(new URL(t).pathname);
  } catch {
    return /mercadolivre\.com(?:\.br)?\/social\//i.test(t) || /mercadolibre\.com\/social\//i.test(t);
  }
}

function filterMlSearchNoiseProducts(items: MlSiteSearchProduct[]): MlSiteSearchProduct[] {
  const out: MlSiteSearchProduct[] = [];
  for (const p of items) {
    const rawLink = p.productLink.split("#")[0];
    const base = decodeMlUrlForParsing(rawLink);
    out.push(base !== rawLink ? { ...p, productLink: base } : p);
  }
  return out;
}

function collectFromItemList(obj: unknown, sink: MlSiteSearchProduct[], limit: number): void {
  if (sink.length >= limit || !obj || typeof obj !== "object") return;
  const o = obj as Record<string, unknown>;
  const typ = o["@type"];
  const types = Array.isArray(typ) ? typ : typ ? [typ] : [];
  const isItemList = types.some((t) => t === "ItemList" || t === "http://schema.org/ItemList");
  if (!isItemList || !Array.isArray(o.itemListElement)) return;

  for (const el of o.itemListElement) {
    if (sink.length >= limit) return;
    if (!el || typeof el !== "object") continue;
    const e = el as Record<string, unknown>;
    const item = (e.item && typeof e.item === "object" ? e.item : e) as Record<string, unknown>;
    const url = decodeMlUrlForParsing(String(e.url ?? item.url ?? "").trim().replace(/\\u002F/gi, "/"));
    const name = String(e.name ?? item.name ?? "").trim();
    if (!url.includes("mercadolivre") && !url.includes("mercadolibre")) continue;
    if (!name) continue;

    let imageUrl = "";
    const img = item.image;
    if (typeof img === "string") imageUrl = img;
    else if (Array.isArray(img) && img[0]) imageUrl = String(img[0]);
    imageUrl = imageUrl.replace(/^http:\/\//i, "https://");

    const offers = item.offers as Record<string, unknown> | undefined;
    let price: number | null = null;
    let priceOriginal: number | null = null;
    if (offers && typeof offers === "object" && typeof offers.price === "number") {
      price = offers.price;
      priceOriginal =
        typeof offers.priceSpecification === "object" &&
        offers.priceSpecification &&
        typeof (offers.priceSpecification as { value?: unknown }).value === "number"
          ? ((offers.priceSpecification as { value: number }).value as number)
          : price;
    }
    let discountRate: number | null = null;
    if (price != null && priceOriginal != null && priceOriginal > price) {
      discountRate = discountFromPrices(price, priceOriginal);
    } else if (price != null && (priceOriginal == null || priceOriginal <= price)) {
      priceOriginal = price;
    }

    const id = extractMlbIdFromUrl(url) ?? extractMlbIdFromUrl(String(item.sku ?? "")) ?? "";
    const itemId = id || "MLB";

    pushProduct(sink, limit, {
      itemId,
      productName: name,
      productLink: url.split("#")[0],
      imageUrl,
      price,
      priceOriginal,
      discountRate,
      currencyId: "BRL",
    });
  }
}

function walkForItemList(obj: unknown, sink: MlSiteSearchProduct[], limit: number): void {
  if (sink.length >= limit || obj == null) return;
  if (Array.isArray(obj)) {
    for (const x of obj) walkForItemList(x, sink, limit);
    return;
  }
  if (typeof obj !== "object") return;
  collectFromItemList(obj, sink, limit);
  const o = obj as Record<string, unknown>;
  for (const v of Object.values(o)) walkForItemList(v, sink, limit);
}

function parseLdJsonBlocks(html: string, limit: number): MlSiteSearchProduct[] {
  const out: MlSiteSearchProduct[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const block = m[1]?.trim();
    if (!block) continue;
    try {
      const data = JSON.parse(block) as unknown;
      const roots = Array.isArray(data) ? data : [data];
      for (const root of roots) walkForItemList(root, out, limit);
    } catch {
      /* ignore */
    }
  }
  return dedupeByLink(out);
}

/** JSON embutido no HTML da listagem costuma repetir permalink dos anúncios. */
function parseEmbeddedPermalinks(html: string, limit: number): MlSiteSearchProduct[] {
  const re = /"permalink"\s*:\s*"(https?:[^"\\]+)"/gi;
  const out: MlSiteSearchProduct[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const link = m[1].replace(/\\u002f/gi, "/").replace(/\\\//g, "/");
    if (!link.includes("mercadolivre") && !link.includes("mercadolibre")) continue;
    const key = link.split("#")[0].split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    const id = extractMlbIdFromUrl(link);
    if (!id || !/^MLB/i.test(id)) continue;
    seen.add(key);
    pushProduct(out, limit, {
      itemId: id,
      productName: `Anúncio ${id}`,
      productLink: link.split("#")[0],
      imageUrl: "",
      price: null,
      priceOriginal: null,
      discountRate: null,
      currencyId: "BRL",
    });
  }
  return dedupeByLink(out);
}

/** URLs de anúncio soltas no HTML (SPA / hidratação) — último fallback. */
function parseMercadoLivreUrlsWithMlb(html: string, limit: number): MlSiteSearchProduct[] {
  const out: MlSiteSearchProduct[] = [];
  const seen = new Set<string>();
  const re =
    /https:\/\/(?:www|lista|produto)\.mercadolivre\.com\.br\/[^"'\\\s<>]{12,900}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    let link = m[0].replace(/&amp;/gi, "&");
    link = link.replace(/[,;)\]}>'`]+$/, "");
    const id = extractMlbIdFromUrl(link);
    if (!id || !/^MLB/i.test(id)) continue;
    const key = link.split("#")[0].split("?")[0].toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pushProduct(out, limit, {
      itemId: id,
      productName: `Anúncio ${id}`,
      productLink: link.split("#")[0],
      imageUrl: "",
      price: null,
      priceOriginal: null,
      discountRate: null,
      currencyId: "BRL",
    });
  }
  return dedupeByLink(out);
}

/** Links de anúncio na grade (fallback). */
function parseListingAnchors(html: string, limit: number): MlSiteSearchProduct[] {
  const out: MlSiteSearchProduct[] = [];
  const seen = new Set<string>();
  const re =
    /<a[^>]+href="(https:\/\/(?:produto|www|lista)\.mercadolivre\.com\.br\/[^"?#\s]+)"[^>]*(?:aria-label="([^"]{2,400})"|title="([^"]{2,400})")/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && out.length < limit) {
    const href = m[1].split("#")[0];
    const key = href.toLowerCase();
    if (seen.has(key)) continue;
    const id = extractMlbIdFromUrl(href);
    if (!id || !/^MLB/i.test(id)) continue;
    seen.add(key);
    const title = (m[2] || m[3] || `Produto ${id}`).trim();
    pushProduct(out, limit, {
      itemId: id,
      productName: title,
      productLink: href,
      imageUrl: "",
      price: null,
      priceOriginal: null,
      discountRate: null,
      currencyId: "BRL",
    });
  }
  return dedupeByLink(out);
}

function mergeParseResults(html: string, limit: number): MlSiteSearchProduct[] {
  const gather = Math.min(120, Math.max(limit * 4, limit + 12));
  const merged = mergeListingSources(
    [
      parseLdJsonBlocks(html, gather),
      parseListingAnchors(html, gather),
      parseEmbeddedPermalinks(html, gather),
      parseMercadoLivreUrlsWithMlb(html, gather),
    ],
    gather,
  );
  return filterMlSearchNoiseProducts(merged).slice(0, limit);
}

function needsPdpEnrich(p: MlSiteSearchProduct): boolean {
  const name = p.productName.trim();
  if (/^Anúncio\s+MLB/i.test(name) || /^Produto\s+MLB/i.test(name)) return true;
  if (!p.imageUrl?.trim()) return true;
  if (p.price == null) return true;
  return false;
}

function mergeProductWithPdp(p: MlSiteSearchProduct, meta: MlPdpProductMeta | null): MlSiteSearchProduct {
  if (!meta) return p;
  const price = meta.pricePromo ?? p.price;
  const priceOriginal = meta.priceOriginal ?? p.priceOriginal ?? price;
  let discountRate = meta.discountRate ?? p.discountRate;
  if (discountRate == null && price != null && priceOriginal != null && priceOriginal > price) {
    discountRate = discountFromPrices(price, priceOriginal);
  }
  return {
    itemId: (meta.resolvedId || p.itemId).trim() || p.itemId,
    productName: meta.productName?.trim() ? meta.productName.trim() : p.productName,
    productLink: p.productLink,
    imageUrl: meta.imageUrl?.trim() ? meta.imageUrl.trim() : p.imageUrl,
    price,
    priceOriginal: priceOriginal ?? p.priceOriginal,
    discountRate,
    currencyId: (meta.currencyId && String(meta.currencyId).trim()) || p.currencyId,
    affiliateCommissionPct:
      meta.affiliateCommissionPct != null ? meta.affiliateCommissionPct : p.affiliateCommissionPct,
  };
}

/**
 * Completa nome, imagem e preços a partir do JSON-LD do PDP (mesmo cookie de sessão).
 * Executado em lotes para não estourar tempo nem o ML.
 */
export async function enrichMlSiteSearchProductsFromPdp(
  products: MlSiteSearchProduct[],
  cookieHeader: string,
): Promise<MlSiteSearchProduct[]> {
  const cookie = cookieHeader.trim();
  if (!cookie || products.length === 0) return products;

  const enriched = [...products];
  const CONCURRENCY = 5;
  const TIMEOUT_MS = 16_000;
  /** Evita dezenas de PDPs lentos num único request HTTP da API. */
  const MAX_ENRICH = 36;

  const runOne = async (idx: number) => {
    const p = enriched[idx];
    if (!needsPdpEnrich(p)) return;
    const short = buildProdutoMercadolivreShortUrl(p.itemId);
    const fetchUrl = short?.trim() || p.productLink.trim();
    if (!fetchUrl || !/mercadolivre|mercadolibre/i.test(fetchUrl)) return;

    let settled = false;
    const meta = await new Promise<MlPdpProductMeta | null>((resolve) => {
      const t = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve(null);
        }
      }, TIMEOUT_MS);
      void fetchMlProductMetaFromPdpHtml(fetchUrl, cookie)
        .then((m) => {
          if (!settled) {
            settled = true;
            clearTimeout(t);
            resolve(m);
          }
        })
        .catch(() => {
          if (!settled) {
            settled = true;
            clearTimeout(t);
            resolve(null);
          }
        });
    });
    enriched[idx] = mergeProductWithPdp(p, meta);
  };

  const indicesToEnrich = enriched
    .map((p, i) => (needsPdpEnrich(p) ? i : -1))
    .filter((i) => i >= 0)
    .slice(0, MAX_ENRICH);

  for (let k = 0; k < indicesToEnrich.length; k += CONCURRENCY) {
    const chunk = indicesToEnrich.slice(k, k + CONCURRENCY);
    await Promise.all(chunk.map((idx) => runOne(idx)));
  }

  return enriched;
}

/** Mantido para compatibilidade de import; a listagem não filtra resultados aqui. */
export function filterValidMlSiteSearchProducts(products: MlSiteSearchProduct[]): MlSiteSearchProduct[] {
  return products;
}

function categoryListingUrls(categorySlug: string): string[] {
  const s = categorySlug.trim().toLowerCase();
  if (!s) return [];
  return [`https://lista.mercadolivre.com.br/${s}`, `https://www.mercadolivre.com.br/${s}`];
}

/**
 * Listagem por categoria (URL fixa lista.mercadolivre.com.br/{slug}) com sessão.
 * O slug deve ser validado na API (whitelist).
 */
export async function fetchMlSiteCategoryWithSession(
  categorySlug: string,
  limit: number,
  cookieHeader: string,
): Promise<MlSiteSearchProduct[]> {
  const slug = categorySlug.trim().toLowerCase();
  if (!slug) return [];
  const cookie = cookieHeader.trim();
  if (!cookie) {
    throw new Error("Cole o token de sessão da extensão para listar esta categoria.");
  }

  const lim = Math.min(50, Math.max(1, limit));
  const headers = { ...BROWSER_HEADERS, Cookie: cookie };
  let lastMessage =
    "Não foi possível ler produtos nesta categoria. Confirme o token ou tente outra categoria.";

  for (const pageUrl of categoryListingUrls(slug)) {
    try {
      const res = await fetch(pageUrl, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) {
        lastMessage = `Página da categoria retornou ${res.status}. Confirme o token e tente de novo.`;
        continue;
      }
      const html = await res.text();
      if (html.length > 2_800_000) continue;

      const items = mergeParseResults(html, lim);
      if (items.length) {
        const enriched = await enrichMlSiteSearchProductsFromPdp(items, cookieHeader);
        return enriched.slice(0, lim);
      }
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastMessage);
}

/**
 * Busca por palavra-chave usando sessão (Cookie ssid) no domínio www/lista ML.
 */
export async function fetchMlSiteSearchWithSession(
  query: string,
  limit: number,
  cookieHeader: string,
): Promise<MlSiteSearchProduct[]> {
  const q = query.trim();
  if (!q) return [];
  const cookie = cookieHeader.trim();
  if (!cookie) {
    throw new Error("Cole o token de sessão da extensão para buscar por nome no Mercado Livre.");
  }

  const lim = Math.min(50, Math.max(1, limit));
  const headers = { ...BROWSER_HEADERS, Cookie: cookie };
  let lastMessage = "Não foi possível ler resultados na página de busca. Tente outro termo ou cole a URL do anúncio.";

  for (const pageUrl of listingSearchUrls(q)) {
    try {
      const res = await fetch(pageUrl, {
        headers,
        redirect: "follow",
        cache: "no-store",
        signal: AbortSignal.timeout(28000),
      });
      if (!res.ok) {
        lastMessage = `Página de busca retornou ${res.status}. Confirme o token e tente de novo.`;
        continue;
      }
      const html = await res.text();
      if (html.length > 2_800_000) continue;

      const items = mergeParseResults(html, lim);
      if (items.length) {
        const enriched = await enrichMlSiteSearchProductsFromPdp(items, cookieHeader);
        return enriched.slice(0, lim);
      }
    } catch (e) {
      lastMessage = e instanceof Error ? e.message : String(e);
    }
  }

  throw new Error(lastMessage);
}
