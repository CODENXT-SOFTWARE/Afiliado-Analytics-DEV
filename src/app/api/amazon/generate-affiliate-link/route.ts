import { NextResponse } from "next/server";
import { gateAmazon } from "@/lib/require-entitlements";
import { buildAmazonAffiliateShortLink } from "@/lib/amazon/build-affiliate-link";
import { looksLikeAmazonProductUrl } from "@/lib/amazon/extract-asin";
import { parseAmazonExtensionSessionToCookieHeader } from "@/lib/amazon/amazon-session-cookie";
import {
  fetchAmazonSitestripeShortUrl,
  getCachedSitestripeShortUrl,
  setCachedSitestripeShortUrl,
} from "@/lib/amazon/amazon-sitestripe";

export const dynamic = "force-dynamic";

/**
 * POST { productPageUrl, affiliateTag, amazonSessionToken? }
 *
 * Gera o link de afiliado Amazon canônico (`/dp/ASIN?tag=USERTAG-20`).
 *
 * Hoje a geração é feita 100% no servidor a partir do ASIN extraído da URL +
 * tag do Associate. Se no futuro for plugada uma chamada à API Amazon
 * (PA-API ou painel via cookie da extensão), basta substituir a chamada a
 * `buildAmazonAffiliateShortLink` por um helper análogo ao
 * `createMercadoLivreAffiliateShortLink`.
 */
function normalizeAffiliateTag(raw: unknown): string | undefined {
  const t = String(raw ?? "").trim().slice(0, 80);
  if (!t) return undefined;
  // Tags Amazon Associates seguem formato `xxxxxx-20` (Brasil) ou variações.
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return undefined;
  return t;
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const productPageUrl = String(body?.productPageUrl ?? body?.product_page_url ?? "").trim();
    const affiliateTag = normalizeAffiliateTag(
      body?.affiliateTag ?? body?.affiliate_tag ?? body?.tag ?? body?.etiqueta,
    );

    if (!affiliateTag) {
      return NextResponse.json(
        {
          error:
            "Informe a tag do Amazon Associates (ex.: meutag-20) — letras, números, _ e - apenas.",
        },
        { status: 400 },
      );
    }
    if (!productPageUrl || !looksLikeAmazonProductUrl(productPageUrl)) {
      return NextResponse.json(
        { error: "Informe a URL completa da página do produto na Amazon." },
        { status: 400 },
      );
    }

    const result = buildAmazonAffiliateShortLink({ productPageUrl, affiliateTag });
    if (!result) {
      return NextResponse.json(
        { error: "Não consegui extrair o ASIN da URL. Use o link canônico /dp/ASIN." },
        { status: 400 },
      );
    }

    /**
     * Tenta encurtar via Site Stripe (painel afiliados.amazon.com.br) usando
     * o cookie da extensão. Se falhar (timeout, sem token, http != 200,
     * sessão expirada) retornamos o link canônico — atribuição de comissão
     * funciona igual nos dois formatos.
     */
    let finalLink = result.shortLink;
    let shortened = false;
    let shortenDebug: Record<string, unknown> = {};

    const tokenRaw = body?.amazonSessionToken ?? body?.amazon_session_token;
    if (typeof tokenRaw !== "string" || !tokenRaw.trim()) {
      shortenDebug = { stage: "no-token" };
    } else {
      const cookie = parseAmazonExtensionSessionToCookieHeader(tokenRaw.trim());
      if (!cookie) {
        shortenDebug = { stage: "invalid-token" };
      } else {
        const cookieKeys = cookie
          .split(";")
          .map((c) => c.split("=")[0]?.trim())
          .filter(Boolean);
        const cached = getCachedSitestripeShortUrl(result.asin, affiliateTag);
        if (cached) {
          finalLink = cached;
          shortened = true;
          shortenDebug = { stage: "cache-hit", cookieKeys };
        } else {
          const r = await fetchAmazonSitestripeShortUrl({
            asin: result.asin,
            affiliateTag,
            cookieHeader: cookie,
          });
          if (r.shortUrl) {
            setCachedSitestripeShortUrl(result.asin, affiliateTag, r.shortUrl);
            finalLink = r.shortUrl;
            shortened = true;
            shortenDebug = { stage: "ok", cookieKeys };
          } else {
            shortenDebug = {
              stage: "amazon-fail",
              reason: r.reason,
              status: r.status,
              body: r.body,
              cookieKeys,
            };
          }
        }
      }
    }

    // Log no servidor pra diagnóstico em dev. Aparece no terminal do `npm run dev`.
    // eslint-disable-next-line no-console
    console.log("[amazon] sitestripe:", { asin: result.asin, shortened, ...shortenDebug });

    return NextResponse.json({
      shortLink: finalLink,
      asin: result.asin,
      shortened,
      canonicalLink: result.shortLink,
      sitestripeDebug: shortenDebug,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar link";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
