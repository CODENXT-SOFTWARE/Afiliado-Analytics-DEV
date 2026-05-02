/**
 * Busca a PDP (página do produto) da Amazon BR para extrair detalhes que
 * NÃO costumam aparecer na SERP:
 *
 *   • Cupom (% ou R$) — "Aplicar Cupom de 15%", "Cupom de R$ 5"
 *   • Preço original riscado — "De: R$ X,XX"
 *   • Desconto Prime — "Exclusivo Prime: 30% off"
 *
 * Usa o mesmo cookie de sessão da extensão e tem timeout curto pra não
 * travar a UI quando enriquecemos vários produtos em paralelo.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

export type AmazonPdpCoupon = {
  percent: number | null;
  amount: number | null;
};

export type AmazonPdpDetails = {
  couponPercent: number | null;
  couponAmount: number | null;
  /** Preço riscado da PDP, quando "De: R$ X,XX" aparece. */
  priceOriginal: number | null;
  /** % de desconto Prime na 1ª compra ou exclusivo Prime. */
  primeDiscountPercent: number | null;
};

function parseBrMoney(text: string): number | null {
  const t = text.replace(/ /g, " ").trim();
  const m = t.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|[\d]+,\d{2})/);
  if (!m) return null;
  const num = m[1].replace(/\./g, "").replace(",", ".");
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai cupom do HTML da PDP. Cobre:
 *   • "Aplicar Cupom de X%"
 *   • "Cupom de X%" / "Cupom de R$ Y"
 *   • "Cupom Amazon de X%" / "Cupom Amazon de R$ Y"
 *   • "Economize X% com cupom"
 *   • "X% off com cupom"
 *   • "Cupom: X% off"
 */
export function extractAmazonPdpCoupon(html: string): AmazonPdpCoupon {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const pctRegex =
    /(?:aplicar\s+cupom(?:\s+amazon)?\s+de\s+(\d{1,2})\s*%)|(?:cupom(?:\s+amazon)?\s+de\s+(\d{1,2})\s*%)|(?:economize\s+(\d{1,2})\s*%\s+com\s+cupom)|(?:(\d{1,2})\s*%\s+(?:off|de\s*desconto)\s+com\s+cupom)|(?:cupom(?:\s+amazon)?\s*:?\s*(\d{1,2})\s*%\s*(?:off|de\s*desconto)?)/i;
  const pctMatch = text.match(pctRegex);
  if (pctMatch) {
    const v = pctMatch[1] ?? pctMatch[2] ?? pctMatch[3] ?? pctMatch[4] ?? pctMatch[5];
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0 && n < 100) return { percent: n, amount: null };
    }
  }

  const amtRegex =
    /(?:aplicar\s+cupom(?:\s+amazon)?\s+de\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?))|(?:cupom(?:\s+amazon)?\s+de\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?))|(?:economize\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s+com\s+cupom)|(?:R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s+de\s+desconto\s+com\s+cupom)/i;
  const amtMatch = text.match(amtRegex);
  if (amtMatch) {
    const v = amtMatch[1] ?? amtMatch[2] ?? amtMatch[3] ?? amtMatch[4];
    if (v) {
      const norm = v.includes(",") ? v : `${v},00`;
      const n = parseBrMoney(`R$ ${norm}`);
      if (n != null && n > 0) return { percent: null, amount: n };
    }
  }

  return { percent: null, amount: null };
}

/**
 * Extrai preço riscado ("De: R$ X,XX") da PDP. A Amazon BR mostra esse preço
 * em produtos com promoção formal (Lightning Deal, Black Friday, "Por tempo
 * limitado"). É o "MSRP/preço sugerido" antes do desconto da Amazon.
 */
export function extractAmazonPdpPriceOriginal(html: string): number | null {
  // Amazon BR usa duas estruturas comuns pra preço riscado na PDP:
  //
  // (a) "De:" antes do span de preço
  //     <span class="a-text-strike">R$ 199,99</span>
  //
  // (b) <span class="a-price a-text-price"...><span class="a-offscreen">R$ 199,99</span></span>
  const candidates: number[] = [];

  // (a) <span class="a-text-strike">R$ X,XX</span>
  const strikeRe = /<span\b[^>]*class="[^"]*\ba-text-strike\b[^"]*"[^>]*>\s*([^<]+)<\/span>/gi;
  for (const m of html.matchAll(strikeRe)) {
    const v = parseBrMoney(m[1]);
    if (v != null && v > 0) candidates.push(v);
  }

  // (b) <span class="a-price a-text-price ..."><span class="a-offscreen">R$ X,XX</span></span>
  const textPriceRe =
    /<span\b[^>]*\ba-price\b[^>]*\ba-text-price\b[^>]*>\s*<span\b[^>]*class="a-offscreen"[^>]*>\s*([^<]+)<\/span>/gi;
  for (const m of html.matchAll(textPriceRe)) {
    const v = parseBrMoney(m[1]);
    if (v != null && v > 0) candidates.push(v);
  }

  // Variante (b'): ordem das classes invertida
  const textPriceRe2 =
    /<span\b[^>]*\ba-text-price\b[^>]*\ba-price\b[^>]*>\s*<span\b[^>]*class="a-offscreen"[^>]*>\s*([^<]+)<\/span>/gi;
  for (const m of html.matchAll(textPriceRe2)) {
    const v = parseBrMoney(m[1]);
    if (v != null && v > 0) candidates.push(v);
  }

  // (c) atributo data-a-strike="true" no span a-price
  const dataStrikeRe =
    /<span\b[^>]*\ba-price\b[^>]*data-a-strike="true"[^>]*>\s*<span\b[^>]*class="a-offscreen"[^>]*>\s*([^<]+)<\/span>/gi;
  for (const m of html.matchAll(dataStrikeRe)) {
    const v = parseBrMoney(m[1]);
    if (v != null && v > 0) candidates.push(v);
  }

  if (candidates.length === 0) return null;
  // Pega o maior — preço riscado de variante "premium" tende a ser o original.
  return Math.max(...candidates);
}

/**
 * Extrai desconto Prime ("Exclusivo Prime: 30% off") da PDP.
 * A Amazon BR usa Prime como pull marketing pra novos clientes — vale capturar
 * mas marcar separado pra usuário saber que é condicional ao Prime.
 */
export function extractAmazonPdpPrimeDiscount(html: string): number | null {
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const re =
    /(?:exclusivo\s+prime\s*:?\s*(\d{1,2})\s*%\s*off)|(?:(\d{1,2})\s*%\s*off\s+(?:com\s+|exclusivo\s+)?(?:amazon\s+)?prime)|(?:prime\s*:?\s*(\d{1,2})\s*%\s*(?:off|de\s*desconto))/i;
  const m = text.match(re);
  if (m) {
    const v = m[1] ?? m[2] ?? m[3];
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0 && n < 100) return n;
    }
  }
  return null;
}

/**
 * Faz GET na PDP do produto e extrai cupom + preço original + Prime numa
 * única request. Falhas (timeout, http error, captcha) retornam tudo `null`
 * silenciosamente — o chamador pode chamar isso em paralelo sem se preocupar.
 */
export async function fetchAmazonPdpDetails(args: {
  asin: string;
  cookieHeader: string;
  timeoutMs?: number;
}): Promise<AmazonPdpDetails> {
  const empty: AmazonPdpDetails = {
    couponPercent: null,
    couponAmount: null,
    priceOriginal: null,
    primeDiscountPercent: null,
  };

  const asin = args.asin.trim();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return empty;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? 4500);
  try {
    const res = await fetch(`https://www.amazon.com.br/dp/${asin}`, {
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://www.amazon.com.br/",
        Cookie: args.cookieHeader,
      },
      cache: "no-store",
    });
    if (!res.ok) return empty;
    const html = await res.text();
    const coupon = extractAmazonPdpCoupon(html);
    return {
      couponPercent: coupon.percent,
      couponAmount: coupon.amount,
      priceOriginal: extractAmazonPdpPriceOriginal(html),
      primeDiscountPercent: extractAmazonPdpPrimeDiscount(html),
    };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Wrapper backward-compat: caller antigo que só queria cupom continua
 * funcionando com o mesmo retorno. Internamente reusa o detalhe completo
 * (mesma latência) — descarta os campos extras.
 */
export async function fetchAmazonPdpCoupon(args: {
  asin: string;
  cookieHeader: string;
  timeoutMs?: number;
}): Promise<AmazonPdpCoupon> {
  const d = await fetchAmazonPdpDetails(args);
  return { percent: d.couponPercent, amount: d.couponAmount };
}
