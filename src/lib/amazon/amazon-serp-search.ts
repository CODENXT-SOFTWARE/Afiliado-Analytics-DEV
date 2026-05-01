/**
 * Busca por keyword na página de resultados da Amazon BR (HTML).
 * Usa o cookie de sessão da extensão (mesmo padrão do ML).
 */

export type AmazonSerpProduct = {
  asin: string;
  productName: string;
  imageUrl: string;
  productPageUrl: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function decodeHtmlEntities(raw: string): string {
  let s = raw;
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  s = s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function parseBrMoney(text: string): number | null {
  const t = text.replace(/\u00a0/g, " ").trim();
  const m = t.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|[\d]+,\d{2})/);
  if (!m) return null;
  const num = m[1].replace(/\./g, "").replace(",", ".");
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

function discountFromPrices(promo: number, original: number): number | null {
  if (original > promo && original > 0) {
    return Math.round((1 - promo / original) * 10000) / 100;
  }
  return null;
}

function extractTitle(chunk: string): string {
  const spanMedium = chunk.match(
    /<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanMedium?.[1]) {
    const t = spanMedium[1].replace(/<[^>]+>/g, "").trim();
    if (t.length > 3) return decodeHtmlEntities(t);
  }
  const spanBase = chunk.match(
    /<span[^>]*class="[^"]*a-size-base-plus[^"]*a-color-base[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanBase?.[1]) {
    const t = spanBase[1].replace(/<[^>]+>/g, "").trim();
    if (t.length > 3) return decodeHtmlEntities(t);
  }
  const aria = chunk.match(/aria-label="([^"]{12,500})"/i);
  if (aria) {
    return decodeHtmlEntities(aria[1].replace(/\s+Pular para.*$/i, "").trim());
  }
  return "";
}

function extractImage(chunk: string): string {
  const m =
    chunk.match(/src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.(?:jpg|png|webp)[^"]*)"/i) ||
    chunk.match(/src="(https:\/\/[^"]*media-amazon\.com[^"]+\.(?:jpg|png|webp)[^"]*)"/i);
  return m ? m[1] : "";
}

function extractPrices(chunk: string): { promo: number | null; original: number | null } {
  const offscreens = [...chunk.matchAll(/class="a-offscreen"[^>]*>\s*([^<]+)</gi)]
    .map((m) => parseBrMoney(m[1]))
    .filter((n): n is number => n != null);
  if (offscreens.length >= 2) {
    const sorted = [...offscreens].sort((a, b) => b - a);
    return { original: sorted[0], promo: sorted[sorted.length - 1] };
  }
  if (offscreens.length === 1) {
    return { promo: offscreens[0], original: null };
  }
  const whole = chunk.match(/class="a-price-whole"[^>]*>([\d.,\s]+)/i);
  const frac = chunk.match(/class="a-price-fraction"[^>]*>(\d+)/i);
  if (whole) {
    const w = whole[1].replace(/\./g, "").replace(/[^\d]/g, "");
    const f = frac ? frac[1] : "00";
    const n = parseFloat(`${w}.${f}`);
    return { promo: Number.isFinite(n) ? n : null, original: null };
  }
  const loose = parseBrMoney(chunk);
  return { promo: loose, original: null };
}

function isProbablyCaptcha(html: string): boolean {
  return (
    /api-services-support@amazon\.com/i.test(html) ||
    /Type the characters you see below/i.test(html) ||
    /Digite os caracteres/i.test(html) ||
    /robot check/i.test(html) ||
    /enter the characters you see/i.test(html)
  );
}

function parseAmazonSerpHtml(html: string, limit: number): AmazonSerpProduct[] {
  const out: AmazonSerpProduct[] = [];
  const seen = new Set<string>();
  const marker = 'data-component-type="s-search-result"';
  let pos = 0;
  while (out.length < limit) {
    const i = html.indexOf(marker, pos);
    if (i === -1) break;
    const chunk = html.slice(i, i + 40000);
    const asinM = chunk.match(/\bdata-asin="([A-Z0-9]{10})"/);
    if (!asinM) {
      pos = i + marker.length;
      continue;
    }
    const asin = asinM[1];
    if (!asin || seen.has(asin)) {
      pos = i + marker.length;
      continue;
    }
    seen.add(asin);
    const title = extractTitle(chunk);
    const imageUrl = extractImage(chunk);
    const { promo, original } = extractPrices(chunk);
    const dr =
      original != null && promo != null && original > promo
        ? discountFromPrices(promo, original)
        : null;
    out.push({
      asin,
      productName: title,
      imageUrl,
      productPageUrl: `https://www.amazon.com.br/dp/${asin}`,
      priceOriginal: original,
      pricePromo: promo,
      discountRate: dr,
    });
    pos = i + marker.length;
  }
  return out;
}

/**
 * Busca na SERP amazon.com.br por keyword (nome do produto).
 */
export async function fetchAmazonSerpProducts(args: {
  keyword: string;
  limit: number;
  cookieHeader: string;
}): Promise<AmazonSerpProduct[]> {
  const k = args.keyword.trim();
  if (!k) return [];
  const url = `https://www.amazon.com.br/s?k=${encodeURIComponent(k)}`;
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      Referer: "https://www.amazon.com.br/",
      Cookie: args.cookieHeader,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Amazon retornou HTTP ${res.status}. Tente novamente.`);
  }
  const html = await res.text();
  if (isProbablyCaptcha(html)) {
    throw new Error(
      "A Amazon bloqueou a busca automática. Aguarde alguns minutos, confira o token em Minha Conta ou tente colar a URL do produto.",
    );
  }
  return parseAmazonSerpHtml(html, args.limit);
}
