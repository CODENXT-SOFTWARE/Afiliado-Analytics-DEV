import { NextResponse } from "next/server";
import { fetchMlSiteCategoryWithSession, fetchMlSiteSearchWithSession } from "@/lib/mercadolivre/site-search";
import type { MlSiteSearchProduct } from "@/lib/mercadolivre/site-search";
import { parseMlExtensionSessionToCookieHeader } from "@/lib/mercadolivre/ml-session-cookie";
import { isMlListaCategorySlug } from "@/lib/mercadolivre/ml-lista-category-slugs";
import { gateMercadoLivre } from "@/lib/require-entitlements";
import { fetchMlPdpPromo } from "@/lib/mercadolivre/fetch-ml-pdp-promo";

export const dynamic = "force-dynamic";
/** Listagem + PDPs em lote podem passar do default em serverless. */
export const maxDuration = 120;

/**
 * Quantos itens do topo da listagem a gente enriquece batendo na PDP pra
 * pegar cupom + Pix + FULL + frete + parcelamento. Acima disso, o usuário
 * ainda vê o produto, só sem esses dados extras. Mantém o tempo total da
 * request controlado.
 */
const PDP_PROMO_ENRICH_LIMIT = 12;
const PDP_PROMO_TIMEOUT_MS = 5500;

async function enrichWithPdpPromo(
  products: MlSiteSearchProduct[],
  cookieHeader: string,
): Promise<void> {
  const targets = products
    .slice(0, PDP_PROMO_ENRICH_LIMIT)
    .filter((p) => Boolean(p.productLink && p.productLink.trim()));
  if (targets.length === 0) return;
  await Promise.all(
    targets.map(async (p) => {
      const promo = await fetchMlPdpPromo({
        productPageUrl: p.productLink,
        cookieHeader,
        timeoutMs: PDP_PROMO_TIMEOUT_MS,
      });
      // Cupom só sobrescreve quando a SERP não trouxe (raro, mas seguro).
      if (p.couponPercent == null && promo.couponPercent != null) {
        p.couponPercent = promo.couponPercent;
      }
      if (p.couponAmount == null && promo.couponAmount != null) {
        p.couponAmount = promo.couponAmount;
      }
      if (promo.pixDiscountPercent != null) p.pixDiscountPercent = promo.pixDiscountPercent;
      if (promo.isFull) p.isFull = true;
      if (promo.freeShipping) p.freeShipping = true;
      if (promo.installmentsCount != null) {
        p.installmentsCount = promo.installmentsCount;
        p.installmentAmount = promo.installmentAmount;
        p.installmentsFreeInterest = promo.installmentsFreeInterest;
      }
    }),
  );
}

function sessionTokenFrom(req: Request, bodyToken: string | null | undefined): string | null {
  const h = req.headers.get("x-ml-session-token")?.trim();
  if (h) return h;
  if (bodyToken != null) {
    const t = String(bodyToken).trim();
    if (t) return t;
  }
  return null;
}

function cookieFromToken(
  raw: string | null,
): { ok: true; cookie: string } | { ok: false; reason: "missing" | "invalid" } {
  if (!raw?.trim()) return { ok: false, reason: "missing" };
  const c = parseMlExtensionSessionToCookieHeader(raw);
  if (!c) return { ok: false, reason: "invalid" };
  return { ok: true, cookie: c };
}

type SearchPayload = {
  q?: string;
  keyword?: string;
  categoria?: string;
  category?: string;
  limit?: number;
  mlSessionToken?: string;
};

async function runSearch(args: {
  q: string;
  categoria: string;
  limit: number;
  cookieHeader: string;
}): Promise<NextResponse> {
  const { q, categoria, limit, cookieHeader } = args;
  const cat = categoria.trim().toLowerCase();
  const catOk = cat && isMlListaCategorySlug(cat);

  try {
    let products: MlSiteSearchProduct[];
    if (catOk) {
      products = await fetchMlSiteCategoryWithSession(cat, limit, cookieHeader);
    } else if (cat && !catOk && !q.trim()) {
      return NextResponse.json({ error: "Categoria inválida ou não permitida." }, { status: 400 });
    } else if (!q.trim()) {
      return NextResponse.json(
        { error: "Informe q (busca por nome) ou categoria (lista do app)." },
        { status: 400 },
      );
    } else {
      products = await fetchMlSiteSearchWithSession(q, limit, cookieHeader);
    }
    await enrichWithPdpPromo(products, cookieHeader);
    return NextResponse.json({ products });
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.message
        : "Não foi possível obter resultados do Mercado Livre (HTML bloqueado ou layout alterado).";
    return NextResponse.json({ error: msg, products: [] }, { status: 502 });
  }
}

function badTokenResponse(reason: "missing" | "invalid", forPost: boolean): NextResponse {
  const msg =
    reason === "missing"
      ? forPost
        ? "Envie o token da extensão: campo mlSessionToken no JSON ou header x-ml-session-token."
        : "Envie o token da extensão: header x-ml-session-token ou, no POST, mlSessionToken no JSON."
      : "Token de sessão inválido: use o valor copiado da extensão (base64) ou a string ssid=...";
  return NextResponse.json({ error: msg }, { status: 400 });
}

/**
 * GET ?q=...&limit=20 ou ?categoria=slug&limit=20
 * Header: x-ml-session-token (opcional se usar POST com corpo).
 */
export async function GET(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;

    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? url.searchParams.get("keyword") ?? "").trim();
    const categoria = (url.searchParams.get("categoria") ?? url.searchParams.get("category") ?? "").trim();
    if (!q && !categoria) {
      return NextResponse.json({ error: "Informe q, keyword ou categoria." }, { status: 400 });
    }

    const limitParam = parseInt(url.searchParams.get("limit") || "20", 10);
    const limit = Math.min(50, Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam));

    const rawTok = sessionTokenFrom(req, undefined);
    const cookieRes = cookieFromToken(rawTok);
    if (!cookieRes.ok) {
      return badTokenResponse(cookieRes.reason, false);
    }

    return await runSearch({ q, categoria, limit, cookieHeader: cookieRes.cookie });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

/**
 * POST JSON: { q?, categoria?, limit?, mlSessionToken? }
 * Preferível para enviar o token no corpo (evita perdas de header em alguns proxies).
 */
export async function POST(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;

    let body: SearchPayload = {};
    try {
      body = (await req.json()) as SearchPayload;
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }

    const q = String(body.q ?? body.keyword ?? "").trim();
    const categoria = String(body.categoria ?? body.category ?? "").trim();

    if (!q && !categoria) {
      return NextResponse.json({ error: "Informe q ou categoria no corpo." }, { status: 400 });
    }

    const limitRaw = body.limit;
    const limitParam =
      typeof limitRaw === "number" && Number.isFinite(limitRaw)
        ? Math.floor(limitRaw)
        : parseInt(String(limitRaw ?? "20"), 10);
    const limit = Math.min(50, Math.max(1, Number.isNaN(limitParam) ? 20 : limitParam));

    const rawTok = sessionTokenFrom(req, body.mlSessionToken);
    const cookieRes = cookieFromToken(rawTok);
    if (!cookieRes.ok) {
      return badTokenResponse(cookieRes.reason, true);
    }

    return await runSearch({ q, categoria, limit, cookieHeader: cookieRes.cookie });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
