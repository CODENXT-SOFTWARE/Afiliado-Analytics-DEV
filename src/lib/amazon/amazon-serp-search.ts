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
  /** % do cupom (1–99) quando o cupom é em percentual; null se ausente. */
  couponPercent: number | null;
  /** Valor em R$ do cupom quando é cupom de valor fixo; null se ausente. */
  couponAmount: number | null;
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

/**
 * Remove prefixos de patrocínio que a Amazon adiciona no título de
 * resultados de Sponsored Ads. Exemplos vistos em produção:
 *   "Anúncio patrocinado – Apple iPhone 16 ..."
 *   "Anúncio Patrocinado - Camiseta ..."
 *   "Sponsored: Headphone ..."
 *   "Patrocinado: Notebook ..."
 *
 * Regra: se o nome inteiro for só o prefixo, devolve string vazia
 * (cai pra próximo fallback no chamador).
 */
function stripSponsoredPrefix(raw: string): string {
  let s = raw.trim();
  // Roda algumas vezes pra cobrir prefixos duplos (raro mas possível).
  for (let i = 0; i < 3; i++) {
    const m = s.match(
      /^(?:an[uú]ncio\s+patrocinado|sponsored|patrocinado)\s*[:\-–—]?\s*/i,
    );
    if (!m || m[0].length === 0) break;
    s = s.slice(m[0].length).trim();
  }
  return s;
}

function cleanTitleText(raw: string): string {
  const t = raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripSponsoredPrefix(decodeHtmlEntities(t));
}

/**
 * Tenta extrair o nome real do produto do chunk da SERP.
 *
 * A Amazon BR mistura no mesmo card o brand (ex.: "Genérico", "Pequenas empresas")
 * e o título completo do produto. O brand costuma vir num span com classes
 * `a-size-medium a-color-base` ou `a-size-base-plus a-color-base` SOZINHO,
 * enquanto o título completo está dentro do `<h2>` do link `/dp/ASIN`.
 *
 * Estratégia (em ordem):
 *   1) `<h2 aria-label="...">` ou `<h2>` com `<span>` interno (preferido — é o título oficial).
 *   2) Texto cru do `<h2>` (fallback se não tiver span dentro).
 *   3) Atributo `aria-label` de um link `<a ... href=".../dp/ASIN...">`.
 *   4) Span com classes `a-size-medium`/`a-size-base-plus` `a-color-base` (último recurso —
 *      pode ser o brand, mas melhor que string vazia).
 */
function extractTitle(chunk: string, asin: string): string {
  const h2Aria = chunk.match(/<h2[^>]*aria-label="([^"]{6,500})"/i);
  if (h2Aria?.[1]) {
    const t = cleanTitleText(h2Aria[1]);
    if (t.length > 3) return t;
  }

  const h2Span = chunk.match(/<h2\b[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<\/h2>/i);
  if (h2Span?.[1]) {
    const t = cleanTitleText(h2Span[1]);
    if (t.length > 3) return t;
  }

  const h2Bare = chunk.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Bare?.[1]) {
    const t = cleanTitleText(h2Bare[1]);
    if (t.length > 3) return t;
  }

  const dpAria = chunk.match(
    new RegExp(`<a[^>]*href="[^"]*\\/dp\\/${asin}[^"]*"[^>]*aria-label="([^"]{6,500})"`, "i"),
  );
  if (dpAria?.[1]) {
    const t = cleanTitleText(dpAria[1].replace(/\s+Pular para.*$/i, ""));
    if (t.length > 3) return t;
  }

  const spanMedium = chunk.match(
    /<span[^>]*class="[^"]*a-size-medium[^"]*a-color-base[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanMedium?.[1]) {
    const t = cleanTitleText(spanMedium[1]);
    if (t.length > 3) return t;
  }
  const spanBase = chunk.match(
    /<span[^>]*class="[^"]*a-size-base-plus[^"]*a-color-base[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
  );
  if (spanBase?.[1]) {
    const t = cleanTitleText(spanBase[1]);
    if (t.length > 3) return t;
  }

  const aria = chunk.match(/aria-label="([^"]{12,500})"/i);
  if (aria) {
    return cleanTitleText(aria[1].replace(/\s+Pular para.*$/i, ""));
  }
  return "";
}

/**
 * Extrai info de cupom da SERP (quando aparece). A Amazon mostra cupons em
 * vários formatos: "Cupom de 15%", "R$ 5 de desconto com cupom", "Aplicar
 * cupom de 10%". Tentamos primeiro percent depois valor fixo.
 */
function extractCoupon(chunk: string): { percent: number | null; amount: number | null } {
  const text = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const pctNear = text.match(
    /cupom[^.]{0,40}?(\d{1,2})\s*%|(\d{1,2})\s*%\s*(?:off|de\s*desconto)?\s*(?:com\s*)?cupom|aplicar\s*cupom\s*de\s*(\d{1,2})\s*%/i,
  );
  if (pctNear) {
    const v = pctNear[1] ?? pctNear[2] ?? pctNear[3];
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0 && n < 100) return { percent: n, amount: null };
    }
  }

  const amtNear = text.match(
    /cupom[^.]{0,40}?R\$\s*(\d{1,4}(?:[.,]\d{2})?)|R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s*(?:de\s*desconto\s*)?(?:com\s*)?cupom/i,
  );
  if (amtNear) {
    const raw = amtNear[1] ?? amtNear[2];
    if (raw) {
      const n = parseBrMoney(`R$ ${raw.includes(",") ? raw : `${raw},00`}`);
      if (n != null && n > 0) return { percent: null, amount: n };
    }
  }

  return { percent: null, amount: null };
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
    const title = extractTitle(chunk, asin);
    const imageUrl = extractImage(chunk);
    const { promo, original } = extractPrices(chunk);
    const dr =
      original != null && promo != null && original > promo
        ? discountFromPrices(promo, original)
        : null;
    const coupon = extractCoupon(chunk);
    out.push({
      asin,
      productName: title,
      imageUrl,
      productPageUrl: `https://www.amazon.com.br/dp/${asin}`,
      priceOriginal: original,
      pricePromo: promo,
      discountRate: dr,
      couponPercent: coupon.percent,
      couponAmount: coupon.amount,
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
