import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";
import { parseAmazonExtensionSessionToCookieHeader } from "@/lib/amazon/amazon-session-cookie";
import {
  fetchAmazonSerpProducts,
  type AmazonSerpProduct,
} from "@/lib/amazon/amazon-serp-search";
import { ML_LISTA_CATEGORY_OPTIONS, isMlListaCategorySlug } from "@/lib/amazon/ml-lista-category-slugs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Mesmo formato que `/api/mercadolivre/product-search` → UI do gerador (clone ML). */
function mapToClientProduct(p: AmazonSerpProduct) {
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

async function runSearch(args: { keyword: string; categorySlug: string; limit: number; cookieHeader: string }) {
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

  try {
    const raw = await fetchAmazonSerpProducts({
      keyword: q,
      limit: args.limit,
      cookieHeader: args.cookieHeader,
    });
    const products = raw.map(mapToClientProduct);
    if (products.length === 0) {
      return NextResponse.json({
        products: [],
        message:
          "Nenhum resultado nesta busca. Tente outro termo ou cole a URL do produto (aba Converter).",
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

    return await runSearch({
      keyword,
      categorySlug: category,
      limit,
      cookieHeader: cookieRes.cookie,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

/**
 * POST JSON: { q?, keyword?, categoria?, limit?, amazonSessionToken? }
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

    return await runSearch({
      keyword,
      categorySlug: category,
      limit,
      cookieHeader: cookieRes.cookie,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
