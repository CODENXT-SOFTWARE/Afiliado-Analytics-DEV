import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";
import { parseAmazonExtensionSessionToCookieHeader } from "@/lib/amazon/amazon-session-cookie";
import {
  fetchAmazonSerpProducts,
  type AmazonSerpProduct,
} from "@/lib/amazon/amazon-serp-search";
import { ML_LISTA_CATEGORY_OPTIONS, isMlListaCategorySlug } from "@/lib/amazon/ml-lista-category-slugs";
import { amazonCommissionPctForCategory } from "@/lib/amazon/amazon-commission-rates";
import { fetchAmazonPdpDetails } from "@/lib/amazon/amazon-pdp-coupon";

/**
 * Quantos itens do topo da SERP a gente enriquece batendo na PDP pra pegar
 * cupom + preço original riscado + desconto Prime. Acima disso, o usuário
 * ainda vê o produto, só sem esses dados extras.
 *
 * Quando o filtro "Só ofertas" está ligado a gente sobe pra `_DEALS` pra
 * descobrir mais produtos com promoção (e compensar que muitos serão filtrados).
 */
const PDP_ENRICH_LIMIT_NORMAL = 12;
const PDP_ENRICH_LIMIT_DEALS = 30;
const PDP_TIMEOUT_MS = 4500;

async function enrichWithPdpDetails(
  products: AmazonSerpProduct[],
  cookieHeader: string,
  enrichLimit: number,
): Promise<void> {
  const targets = products
    .slice(0, enrichLimit)
    .filter((p) => /^[A-Z0-9]{10}$/.test(p.asin));
  if (targets.length === 0) return;
  await Promise.all(
    targets.map(async (p) => {
      const d = await fetchAmazonPdpDetails({
        asin: p.asin,
        cookieHeader,
        timeoutMs: PDP_TIMEOUT_MS,
      });
      // Cupom: só aplica se SERP não trouxe.
      if (p.couponPercent == null && d.couponPercent != null) p.couponPercent = d.couponPercent;
      if (p.couponAmount == null && d.couponAmount != null) p.couponAmount = d.couponAmount;
      // Prime discount: nunca vem da SERP, sempre da PDP.
      if (d.primeDiscountPercent != null) p.primeDiscountPercent = d.primeDiscountPercent;
      // Preço original riscado: aplica se SERP não trouxe E o valor PDP for
      // maior que o preço promo atual (sanity).
      if (
        p.priceOriginal == null &&
        d.priceOriginal != null &&
        p.pricePromo != null &&
        d.priceOriginal > p.pricePromo
      ) {
        p.priceOriginal = d.priceOriginal;
        const dr = Math.round((1 - p.pricePromo / d.priceOriginal) * 10000) / 100;
        // Mesma sanity check do parser principal: descontos absurdos quase
        // sempre indicam parsing errado, não promoção real.
        if (dr > 0 && dr < 92) p.discountRate = dr;
      }
    }),
  );
}

/** True se o produto tem cupom (% ou R$), desconto na SERP, ou Prime discount. */
function hasDeal(p: AmazonSerpProduct): boolean {
  if (p.couponPercent != null && p.couponPercent > 0) return true;
  if (p.couponAmount != null && p.couponAmount > 0) return true;
  if (p.discountRate != null && p.discountRate > 0) return true;
  if (p.primeDiscountPercent != null && p.primeDiscountPercent > 0) return true;
  return false;
}

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Mesmo formato que `/api/mercadolivre/product-search` → UI do gerador (clone ML). */
function mapToClientProduct(p: AmazonSerpProduct, commissionPct: number) {
  const promo = p.pricePromo ?? null;
  const orig = p.priceOriginal ?? null;
  let dr = p.discountRate;
  if (dr == null && orig != null && promo != null && orig > promo) {
    dr = Math.round((1 - promo / orig) * 10000) / 100;
  }
  return {
    itemId: p.asin,
    productName: p.productName.trim() || `Produto Amazon (${p.asin})`,
    productLink: p.productPageUrl,
    imageUrl: p.imageUrl,
    price: promo,
    priceOriginal: orig,
    discountRate: dr,
    currencyId: "BRL",
    affiliateCommissionPct: commissionPct,
    couponPercent: p.couponPercent ?? null,
    couponAmount: p.couponAmount ?? null,
    primeDiscountPercent: p.primeDiscountPercent ?? null,
  };
}

function sessionTokenFrom(req: Request, bodyToken: string | null | undefined): string | null {
  const h = req.headers.get("x-amazon-session-token")?.trim();
  if (h) return h;
  if (bodyToken != null) {
    const t = String(bodyToken).trim();
    if (t) return t;
  }
  return null;
}

function cookieFromToken(raw: string | null): { ok: true; cookie: string } | { ok: false; reason: "missing" | "invalid" } {
  if (!raw?.trim()) return { ok: false, reason: "missing" };
  const c = parseAmazonExtensionSessionToCookieHeader(raw);
  if (!c) return { ok: false, reason: "invalid" };
  return { ok: true, cookie: c };
}

function badTokenResponse(reason: "missing" | "invalid", forPost: boolean): NextResponse {
  const msg =
    reason === "missing"
      ? forPost
        ? "Envie o token da extensão: campo amazonSessionToken no JSON ou header x-amazon-session-token."
        : "Envie o token da extensão: header x-amazon-session-token ou amazonSessionToken no POST."
      : "Token de sessão Amazon inválido: use o valor copiado da extensão.";
  return NextResponse.json({ error: msg }, { status: 400 });
}

async function runSearch(args: {
  keyword: string;
  categorySlug: string;
  limit: number;
  cookieHeader: string;
  onlyDeals: boolean;
}) {
  let q = args.keyword.trim();
  const cat = args.categorySlug.trim().toLowerCase();
  if (!q && cat && isMlListaCategorySlug(cat)) {
    q = ML_LISTA_CATEGORY_OPTIONS.find((o) => o.slug === cat)?.label ?? "";
  }
  if (!q) {
    return NextResponse.json(
      { error: "Informe q (busca) ou categoria da lista.", products: [] },
      { status: 400 },
    );
  }

  // Em "só ofertas" buscamos mais resultados na SERP pra compensar a filtragem.
  const serpLimit = args.onlyDeals ? Math.min(60, args.limit * 2) : args.limit;
  const enrichLimit = args.onlyDeals ? PDP_ENRICH_LIMIT_DEALS : PDP_ENRICH_LIMIT_NORMAL;

  try {
    const raw = await fetchAmazonSerpProducts({
      keyword: q,
      limit: serpLimit,
      cookieHeader: args.cookieHeader,
    });
    await enrichWithPdpDetails(raw, args.cookieHeader, enrichLimit);

    const filtered = args.onlyDeals ? raw.filter(hasDeal) : raw;
    const trimmed = filtered.slice(0, args.limit);

    const commissionPct = amazonCommissionPctForCategory(cat);
    const products = trimmed.map((p) => mapToClientProduct(p, commissionPct));
    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        message: args.onlyDeals
          ? "Nenhum produto com cupom ou desconto nessa busca. Desative \"Só ofertas\" pra ver todos os produtos."
          : "Nenhum resultado nesta busca. Tente outro termo ou cole a URL do produto (aba Converter).",
      });
    }
    return NextResponse.json({ products });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Não foi possível buscar na Amazon. Tente novamente ou use a URL do produto.";
    return NextResponse.json({ error: msg, products: [] }, { status: 502 });
  }
}

/**
 * GET ?q=...&limit=20&category=slug
 * Header: x-amazon-session-token
 */
export async function GET(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;

    const url = new URL(req.url);
    const keyword = (url.searchParams.get("q") ?? url.searchParams.get("keyword") ?? "").trim();
    const category = (url.searchParams.get("categoria") ?? url.searchParams.get("category") ?? "").trim();
    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(60, Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam));

    const rawTok = sessionTokenFrom(req, undefined);
    const cookieRes = cookieFromToken(rawTok);
    if (!cookieRes.ok) return badTokenResponse(cookieRes.reason, false);

    const onlyDealsParam = url.searchParams.get("onlyDeals") ?? url.searchParams.get("only_deals");
    const onlyDeals = onlyDealsParam === "1" || onlyDealsParam === "true";

    return await runSearch({
      keyword,
      categorySlug: category,
      limit,
      cookieHeader: cookieRes.cookie,
      onlyDeals,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

/**
 * POST JSON: { q?, keyword?, categoria?, limit?, onlyDeals?, amazonSessionToken? }
 */
export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const keyword = String(body?.keyword ?? body?.q ?? "").trim();
    const category = String(body?.category ?? body?.categoria ?? "").trim();
    const limitParam = Number(body?.limit ?? 20);
    const limit = Math.min(60, Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam));

    const rawTok = sessionTokenFrom(req, body?.amazonSessionToken ?? body?.amazon_session_token);
    const cookieRes = cookieFromToken(rawTok);
    if (!cookieRes.ok) return badTokenResponse(cookieRes.reason, true);

    const onlyDeals =
      body?.onlyDeals === true || body?.only_deals === true || body?.onlyDeals === "1";

    return await runSearch({
      keyword,
      categorySlug: category,
      limit,
      cookieHeader: cookieRes.cookie,
      onlyDeals,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
