/**
 * Extrai dados de promoção/atratividade da PDP do Mercado Livre que NÃO
 * vêm na API/SERP de afiliado:
 *
 *   • Cupom (% ou R$) — "Aplicar 8% OFF. Você economiza R$ 32."
 *   • Desconto Pix — "no Pix" + percentage
 *   • Frete grátis — `free_shipping: true`
 *   • FULL (logística Mercado Livre) — `logistic_type: "fulfillment"`
 *   • Parcelamento — quantidade + valor sem juros
 *
 * Esses dados estão embutidos como JSON inline no HTML da PDP. Em vez de
 * parsear o blob inteiro (que pode pesar 200KB+ e mudar de schema), fazemos
 * regex direta nas chaves específicas — robusto a mudanças cosméticas e
 * rápido. Padrão idêntico ao que fazemos com a Amazon em `amazon-pdp-coupon.ts`.
 *
 * Cookie da extensão (`ssid`) é necessário pra não cair no challenge anti-bot
 * — sem ele o ML serve uma página intermediária de 5KB sem os dados.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36";

const DEFAULT_TIMEOUT_MS = 5500;

export type MlPdpPromo = {
  /** Cupom em % (1–99). null se ausente. */
  couponPercent: number | null;
  /** Cupom em valor R$. null se ausente. Mutuamente exclusivo com `couponPercent`. */
  couponAmount: number | null;
  /** Desconto exclusivo Pix em % (ex.: 4 → "no Pix 4% OFF"). null se ausente. */
  pixDiscountPercent: number | null;
  /** True quando `logistic_type: "fulfillment"` — entrega rápida via FULL. */
  isFull: boolean;
  /** True quando `free_shipping: true`. */
  freeShipping: boolean;
  /** Quantidade de parcelas (ex.: 4 → "4x sem juros"). null se ausente. */
  installmentsCount: number | null;
  /** Valor de cada parcela em R$ (ex.: 100). null se ausente. */
  installmentAmount: number | null;
  /** True se as parcelas são "sem juros". */
  installmentsFreeInterest: boolean;
};

const EMPTY_PROMO: MlPdpPromo = {
  couponPercent: null,
  couponAmount: null,
  pixDiscountPercent: null,
  isFull: false,
  freeShipping: false,
  installmentsCount: null,
  installmentAmount: null,
  installmentsFreeInterest: false,
};

/**
 * Encontra o objeto JSON com cupons (`"coupons":{"coupons":[{...}]`) e
 * extrai amount + amount_type. ML retorna sempre array; a gente pega o
 * primeiro cupom (que é o que aparece na UI).
 */
function extractCoupon(html: string): { percent: number | null; amount: number | null } {
  // Casa: "coupons":{"coupons":[{ ... "amount":N ... "amount_type":"..." ... }
  const re =
    /"coupons"\s*:\s*\{\s*"coupons"\s*:\s*\[\s*\{([^}]*?)\}/i;
  const block = html.match(re);
  if (!block?.[1]) return { percent: null, amount: null };
  const inner = block[1];

  const amountMatch = inner.match(/"amount"\s*:\s*(\d+(?:\.\d+)?)/);
  const typeMatch = inner.match(/"amount_type"\s*:\s*"([^"]+)"/);
  if (!amountMatch || !typeMatch) return { percent: null, amount: null };

  const amount = Number(amountMatch[1]);
  const type = typeMatch[1].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return { percent: null, amount: null };

  if (type === "percentage") {
    return { percent: amount, amount: null };
  }
  // "fixed_amount" ou variantes
  return { percent: null, amount };
}

/**
 * Pega o `discount_percentage` do bloco `price_decrement` quando
 * `wording_label` contém "Pix". O ML só usa `price_decrement` pra Pix em
 * produtos BR, mas guardamos o anchor pra evitar match acidental.
 */
function extractPixDiscount(html: string): number | null {
  // Casa: "price_decrement":{ ... "discount_percentage":N ... }
  // E confirma "wording_label":"...Pix..."
  const re =
    /"price_decrement"\s*:\s*\{([^}]*?)\}/i;
  const block = html.match(re);
  if (!block?.[1]) return null;
  const inner = block[1];

  const isPix = /"wording_label"\s*:\s*"[^"]*Pix[^"]*"/i.test(inner);
  if (!isPix) return null;

  const m = inner.match(/"discount_percentage"\s*:\s*(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v) || v <= 0 || v >= 100) return null;
  return v;
}

/**
 * `logistic_type` aparece DUAS vezes na PDP (no payload do produto e nas
 * shipping_options). Qualquer um sendo "fulfillment" significa FULL.
 */
function extractIsFull(html: string): boolean {
  return /"logistic_type"\s*:\s*"fulfillment"/i.test(html);
}

function extractFreeShipping(html: string): boolean {
  return /"free_shipping"\s*:\s*true/i.test(html);
}

/**
 * Procura o método de pagamento "recomendado" com mais parcelas sem juros.
 * Tipicamente: `"installments":4,"installment_amount":100,"is_free_installment":true`
 *
 * Estratégia: percorrer todos os blocos de `recommended_methods` e pegar o
 * de maior `installments` com `is_free_installment: true`. Se nenhum for
 * sem juros, pega o de mais parcelas (ainda informativo).
 */
function extractInstallments(html: string): {
  count: number | null;
  amount: number | null;
  freeInterest: boolean;
} {
  // Casa cada item de recommended_methods (objeto fechado em `}`).
  const itemRe =
    /"installments"\s*:\s*(\d+)\s*,\s*"installment_amount"\s*:\s*(\d+(?:\.\d+)?)[^}]*?"is_free_installment"\s*:\s*(true|false)/gi;

  let bestFree: { count: number; amount: number } | null = null;
  let bestAny: { count: number; amount: number } | null = null;

  for (const m of html.matchAll(itemRe)) {
    const count = Number(m[1]);
    const amount = Number(m[2]);
    const free = m[3] === "true";
    if (!Number.isFinite(count) || count < 1) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (free) {
      if (!bestFree || count > bestFree.count) bestFree = { count, amount };
    }
    if (!bestAny || count > bestAny.count) bestAny = { count, amount };
  }

  const chosen = bestFree ?? bestAny;
  if (!chosen) return { count: null, amount: null, freeInterest: false };
  return {
    count: chosen.count,
    amount: chosen.amount,
    freeInterest: bestFree != null && chosen === bestFree,
  };
}

export function extractMlPdpPromo(html: string): MlPdpPromo {
  const coupon = extractCoupon(html);
  const installments = extractInstallments(html);
  return {
    couponPercent: coupon.percent,
    couponAmount: coupon.amount,
    pixDiscountPercent: extractPixDiscount(html),
    isFull: extractIsFull(html),
    freeShipping: extractFreeShipping(html),
    installmentsCount: installments.count,
    installmentAmount: installments.amount,
    installmentsFreeInterest: installments.freeInterest,
  };
}

const ALLOWED_HOSTS = new Set([
  "produto.mercadolivre.com.br",
  "www.mercadolivre.com.br",
  "mercadolivre.com.br",
  "articulo.mercadolibre.com.br",
  "www.mercadolibre.com.br",
]);

function isAllowedPdpHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (ALLOWED_HOSTS.has(h)) return true;
  if (h === "mercadolivre.com.br" || h.endsWith(".mercadolivre.com.br")) return true;
  if (h.includes("mercadolibre.com")) return true;
  return false;
}

/**
 * Faz GET na PDP do produto e extrai promo. Falhas (timeout, http error,
 * captcha) retornam `EMPTY_PROMO` silenciosamente — o caller pode chamar
 * em paralelo sem se preocupar.
 */
export async function fetchMlPdpPromo(args: {
  productPageUrl: string;
  cookieHeader: string;
  timeoutMs?: number;
}): Promise<MlPdpPromo> {
  const url = args.productPageUrl.trim();
  if (!url) return EMPTY_PROMO;

  // Sanity check de host pra evitar SSRF caso URL venha mal formada.
  try {
    const parsed = new URL(url);
    if (!isAllowedPdpHost(parsed.hostname)) return EMPTY_PROMO;
  } catch {
    return EMPTY_PROMO;
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5",
        Referer: "https://www.mercadolivre.com.br/",
        Cookie: args.cookieHeader,
      },
      cache: "no-store",
    });
    if (!res.ok) return EMPTY_PROMO;
    const html = await res.text();
    // PDP completa do ML tem ~600KB. Se vier muito pequena, é página de
    // challenge anti-bot — nada útil pra extrair.
    if (html.length < 30_000) return EMPTY_PROMO;
    return extractMlPdpPromo(html);
  } catch {
    return EMPTY_PROMO;
  } finally {
    clearTimeout(timer);
  }
}
