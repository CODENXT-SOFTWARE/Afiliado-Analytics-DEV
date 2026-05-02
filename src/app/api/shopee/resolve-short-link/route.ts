/**
 * Resolve um link curto da Shopee para a URL completa do produto e, se
 * possível, extrai o `itemId` para usar diretamente na busca por itemId.
 *
 * Aceita dois formatos:
 *   1) Link de afiliado curto: `https://s.shopee.com.br/xxxx`
 *   2) Link de compartilhamento padrão: `https://br.shp.ee/xxxx` (gerado
 *      pelo botão "Compartilhar" na PDP do app/site da Shopee)
 *
 * A Shopee usa normalmente:
 *   1) 301/302 com header `Location`.
 *   2) HTML com `<meta http-equiv="refresh" content="0; url=...">`.
 *   3) HTML com `window.location.replace(...)` / `window.location.href = ...`.
 *   4) Páginas `universal-link?redir=<url-encoded>`.
 */

import { NextResponse } from "next/server";
import { extractShopeeItemIdFromInput } from "@/lib/shopee-extract-item-id";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";

const MAX_HOPS = 6;

function isShortShopeeHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "s.shopee.com.br" ||
    h.endsWith(".s.shopee.com.br") ||
    h === "s.shopee.com" ||
    h.endsWith(".s.shopee.com") ||
    // Link de compartilhamento padrão (botão "Compartilhar" da PDP).
    h === "shp.ee" ||
    h.endsWith(".shp.ee")
  );
}

function isShopeeHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "shopee.com.br" ||
    h.endsWith(".shopee.com.br") ||
    h === "shopee.com" ||
    h.endsWith(".shopee.com")
  );
}

/** Procura o próximo URL num HTML de redirecionamento (meta-refresh, JS, universal-link). */
function findNextRedirectUrl(html: string, baseUrl: string): string | null {
  const meta = html.match(
    /<meta\s+http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^"']*?url=([^"'>\s]+)/i,
  );
  if (meta?.[1]) return resolveUrl(meta[1], baseUrl);

  const windowLoc = html.match(
    /window\.location(?:\.(?:replace|assign|href))?\s*(?:\(|=)\s*["']([^"']+)["']/i,
  );
  if (windowLoc?.[1]) return resolveUrl(windowLoc[1], baseUrl);

  const locationLoc = html.match(/location\.href\s*=\s*["']([^"']+)["']/i);
  if (locationLoc?.[1]) return resolveUrl(locationLoc[1], baseUrl);

  const redirInline = html.match(/[?&]redir(?:ect)?=([^"'&\s]+)/i);
  if (redirInline?.[1]) {
    try {
      const decoded = decodeURIComponent(redirInline[1]);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    } catch {
      /* ignore */
    }
  }

  const productUrl = html.match(
    /https?:\/\/shopee\.com(?:\.br)?\/(?:product\/\d+\/\d+|[^\s"'<>]+?\/\d+\/\d+)/i,
  );
  if (productUrl?.[0]) return productUrl[0];

  return null;
}

function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

/** Dada uma URL, segue redirects HTTP e HTML até encontrar a URL do produto na Shopee. */
async function resolveShortShopeeUrl(startUrl: string): Promise<{
  finalUrl: string;
  hops: string[];
}> {
  let currentUrl = startUrl;
  const visited = new Set<string>();
  const hops: string[] = [];

  for (let i = 0; i < MAX_HOPS; i++) {
    if (visited.has(currentUrl)) break;
    visited.add(currentUrl);
    hops.push(currentUrl);

    const u = new URL(currentUrl);
    if (isShopeeHost(u.hostname) && /\/product\/\d+\/\d+/i.test(u.pathname)) {
      return { finalUrl: currentUrl, hops };
    }

    const res = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        "User-Agent": UA,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      currentUrl = resolveUrl(location, currentUrl);
      continue;
    }

    if (res.ok) {
      const html = await res.text();
      const next = findNextRedirectUrl(html, currentUrl);
      if (next && next !== currentUrl) {
        currentUrl = next;
        continue;
      }
    }
    break;
  }

  return { finalUrl: currentUrl, hops };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url")?.trim();
    if (!target) {
      return NextResponse.json({ error: "Parâmetro ?url= é obrigatório" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(/^https?:\/\//i.test(target) ? target : `https://${target}`);
    } catch {
      return NextResponse.json({ error: "URL inválida" }, { status: 400 });
    }

    if (!isShortShopeeHost(parsed.hostname) && !isShopeeHost(parsed.hostname)) {
      return NextResponse.json({ error: "URL não é da Shopee" }, { status: 400 });
    }

    const { finalUrl, hops } = await resolveShortShopeeUrl(parsed.toString());
    const itemId = extractShopeeItemIdFromInput(finalUrl);

    if (!itemId) {
      return NextResponse.json(
        {
          error: "Não foi possível identificar o produto a partir do link curto.",
          finalUrl,
          hops,
        },
        { status: 422 },
      );
    }

    return NextResponse.json({ itemId, finalUrl, hops });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao resolver link" },
      { status: 500 },
    );
  }
}
