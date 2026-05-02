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
  /** % de desconto exclusivo Prime (ex.: "Exclusivo Prime: 30% off"). null se ausente. */
  primeDiscountPercent: number | null;
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
 * Strings que claramente NÃO são título de produto e que aparecem em cards
 * de moda da Amazon BR como "marca" do produto. Quando o título extraído
 * cai num desses, descartamos e seguimos pro próximo candidato.
 */
const KNOWN_BRAND_FILLERS = new Set([
  "genérico",
  "generico",
  "sem marca",
  "amazon basics",
  "patrocinado",
  "anúncio patrocinado",
  "sponsored",
  "ver mais",
  "veja mais",
]);

function looksLikeBrandFiller(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (KNOWN_BRAND_FILLERS.has(t)) return true;
  if (/^visite\s+a\s+loja\b/i.test(t)) return true;
  if (/^visit\s+the\s+store\b/i.test(t)) return true;
  return false;
}

/**
 * Extrai o nome real do produto do chunk da SERP.
 *
 * Cards de moda da Amazon BR costumam ter DOIS `<h2>` no mesmo card: um com
 * o brand ("Genérico", "Pequenas empresas") e outro com o título de fato.
 * Carrosséis inline ("Veja também") podem injetar um terceiro. O parser
 * antigo pegava o primeiro `<h2>` que casava — e às vezes era o brand.
 *
 * Estratégia atual: coletar todos os candidatos plausíveis (h2 do chunk,
 * conteúdo de <a href="/dp/ASIN">, aria-label desses links), descartar os
 * que parecem brand-filler ("Genérico", "Visite a loja X", etc.) e devolver
 * o mais longo. Títulos reais de produto Amazon costumam ter ≥ 20 chars,
 * brands quase sempre < 15 — escolher o mais longo é heurística sólida.
 */
function extractTitle(chunk: string, asin: string): string {
  const candidates: string[] = [];

  // (a) Conteúdo de <a href=".../dp/ASIN/...">...</a> (texto interno)
  const dpContentRe = new RegExp(
    `<a\\b[^>]*href="[^"]*\\/dp\\/${asin}[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );
  for (const m of chunk.matchAll(dpContentRe)) {
    const t = cleanTitleText(m[1]);
    if (t) candidates.push(t);
  }

  // (b) aria-label de <a href=".../dp/ASIN/...">
  const dpAriaRe = new RegExp(
    `<a\\b[^>]*href="[^"]*\\/dp\\/${asin}[^"]*"[^>]*aria-label="([^"]{6,500})"`,
    "gi",
  );
  for (const m of chunk.matchAll(dpAriaRe)) {
    const t = cleanTitleText(m[1].replace(/\s+Pular para.*$/i, ""));
    if (t) candidates.push(t);
  }

  // (c) Conteúdo de qualquer <h2> do chunk
  const h2Re = /<h2\b[^>]*>([\s\S]*?)<\/h2>/gi;
  for (const m of chunk.matchAll(h2Re)) {
    const t = cleanTitleText(m[1]);
    if (t) candidates.push(t);
  }

  // (d) <h2 aria-label="...">
  const h2AriaRe = /<h2[^>]*aria-label="([^"]{6,500})"/gi;
  for (const m of chunk.matchAll(h2AriaRe)) {
    const t = cleanTitleText(m[1]);
    if (t) candidates.push(t);
  }

  // Filtra brand-fillers e candidatos muito curtos/duplicados; pega o mais longo.
  const seen = new Set<string>();
  const filtered = candidates.filter((c) => {
    const key = c.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    if (c.length < 4) return false;
    if (looksLikeBrandFiller(c)) return false;
    return true;
  });

  if (filtered.length > 0) {
    filtered.sort((a, b) => b.length - a.length);
    return filtered[0];
  }

  // Último recurso: spans com classes de título (provável brand, mas melhor
  // que string vazia).
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

  return "";
}

/**
 * Extrai info de cupom da SERP (quando aparece). A Amazon mostra cupons em
 * vários formatos:
 *
 *   • "Cupom de 15%" / "Cupom Amazon de 15%"
 *   • "R$ 5 de desconto com cupom"
 *   • "Aplicar cupom de 10%"
 *   • "Cupom: 15% off"
 *   • "Economize 15% com cupom"
 *
 * "Cupom Amazon" é cupom da própria Amazon (raro mas mais confiável que
 * cupom de vendedor). Ambos são tratados como cupom genérico no front.
 *
 * Tentamos primeiro percent depois valor fixo.
 */
function extractCoupon(chunk: string): { percent: number | null; amount: number | null } {
  const text = chunk.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const pctNear = text.match(
    /cupom(?:\s+amazon)?[^.]{0,40}?(\d{1,2})\s*%|(\d{1,2})\s*%\s*(?:off|de\s*desconto)?\s*(?:com\s*)?cupom(?:\s+amazon)?|aplicar\s*cupom(?:\s+amazon)?\s*de\s*(\d{1,2})\s*%|economize\s+(\d{1,2})\s*%\s+com\s+cupom/i,
  );
  if (pctNear) {
    const v = pctNear[1] ?? pctNear[2] ?? pctNear[3] ?? pctNear[4];
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0 && n < 100) return { percent: n, amount: null };
    }
  }

  const amtNear = text.match(
    /cupom(?:\s+amazon)?[^.]{0,40}?R\$\s*(\d{1,4}(?:[.,]\d{2})?)|R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s*(?:de\s*desconto\s*)?(?:com\s*)?cupom(?:\s+amazon)?|economize\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s+com\s+cupom/i,
  );
  if (amtNear) {
    const raw = amtNear[1] ?? amtNear[2] ?? amtNear[3];
    if (raw) {
      const n = parseBrMoney(`R$ ${raw.includes(",") ? raw : `${raw},00`}`);
      if (n != null && n > 0) return { percent: null, amount: n };
    }
  }

  return { percent: null, amount: null };
}

/**
 * Extrai a URL da imagem principal do produto.
 *
 * Cards da SERP da Amazon BR podem conter MÚLTIPLAS imagens (badges, ícones
 * promocionais, carrossel "patrocinado" inline, "Compre junto"). O regex
 * antigo simplesmente pegava o primeiro `src=` que casava com media-amazon
 * — frequentemente uma imagem secundária ou de um produto adjacente.
 *
 * Estratégia ancorada no ASIN:
 *   1) Procura um `<img>` que esteja dentro do `<a>` que aponta pra `/dp/{ASIN}`.
 *   2) Se não achar, procura `<img>` cujo atributo `data-image-asin` ou
 *      `data-asin` bata com o ASIN.
 *   3) Filtra imagens "lixo" (logos < 100x100, sprites, ícones promo) — heurística
 *      pelo path `/images/G/`/`/images/S/` que costumam ser ícones, vs
 *      `/images/I/` que é sempre foto de produto.
 *   4) Último recurso: primeiro `src` válido em media-amazon.
 */
function extractImage(chunk: string, asin: string): string {
  // 1) <a href=".../dp/{ASIN}/..."> ... <img src="..."> ... </a>
  const linkBlockRe = new RegExp(
    `<a\\b[^>]*href="[^"]*\\/dp\\/${asin}[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`,
    "gi",
  );
  for (const m of chunk.matchAll(linkBlockRe)) {
    const inner = m[1];
    const img = inner.match(
      /<img\b[^>]*\bsrc="(https:\/\/[^"]*media-amazon\.com\/images\/I\/[^"]+\.(?:jpg|png|webp)[^"]*)"/i,
    );
    if (img?.[1]) return img[1];
    // Alguns cards usam `srcset` ao invés de `src` no `<img>` lazy-loaded.
    const imgSrcset = inner.match(
      /<img\b[^>]*\bsrcset="([^"]*media-amazon\.com\/images\/I\/[^"\s]+\.(?:jpg|png|webp)[^"\s]*)/i,
    );
    if (imgSrcset?.[1]) return imgSrcset[1].split(/\s+/)[0];
  }

  // 2) <img data-image-asin="ASIN" src="..."> ou data-asin="ASIN"
  const dataImgRe = new RegExp(
    `<img\\b[^>]*\\bdata-(?:image-)?asin="${asin}"[^>]*\\bsrc="(https:\\/\\/[^"]+\\.(?:jpg|png|webp)[^"]*)"`,
    "i",
  );
  const dataMatch = chunk.match(dataImgRe);
  if (dataMatch?.[1]) return dataMatch[1];

  // 3) Imagem de produto da Amazon (path `/images/I/`) é sempre foto de produto.
  const prodImg = chunk.match(
    /src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.(?:jpg|png|webp)[^"]*)"/i,
  );
  if (prodImg?.[1]) return prodImg[1];

  // 4) Último recurso (qualquer imagem media-amazon).
  const any = chunk.match(/src="(https:\/\/[^"]*media-amazon\.com[^"]+\.(?:jpg|png|webp)[^"]*)"/i);
  return any?.[1] ?? "";
}

/**
 * Extrai preço final (promo) e preço riscado (original) do card.
 *
 * A Amazon BR usa a estrutura:
 *
 *   <span class="a-price">                     ← preço final
 *     <span class="a-offscreen">R$ 4.898,70</span>
 *   </span>
 *   <span class="a-price a-text-price">        ← preço riscado/original
 *     <span class="a-offscreen">R$ 6.799,00</span>
 *   </span>
 *
 * Antigamente pegávamos TODOS os `a-offscreen` do chunk e ordenávamos —
 * isso quebrava quando havia parcelas ("12x R$ 453,62"), oferta Prime,
 * preço de outro vendedor ou um sponsored ad infiltrado. Agora classificamos
 * pelo `class` do wrapper `a-price`, e só caímos pros `a-offscreen`
 * "soltos" como último recurso.
 */
function extractPrices(chunk: string): { promo: number | null; original: number | null } {
  // Casa <span ...a-price...> ... </span> (não-aninhado é OK pra esse uso).
  // Capturamos TODOS os atributos da tag de abertura em m[1] pra poder checar
  // tanto a classe `a-text-price` quanto o atributo `data-a-strike="true"`
  // (a Amazon BR usa um, o outro, ou ambos pra marcar o preço riscado).
  const priceBlockRe = /<span\b([^>]*\ba-price\b[^>]*)>([\s\S]*?)<\/span>/gi;
  const finals: number[] = [];
  const strikes: number[] = [];

  for (const m of chunk.matchAll(priceBlockRe)) {
    const attrs = m[1];
    const inner = m[2];
    // Só consideramos blocos que contenham o `a-offscreen` com o valor
    // legível em tela. Os "outros" `a-price` (parcelas, etc.) raramente
    // têm `a-offscreen`.
    const off = inner.match(/class="a-offscreen"[^>]*>\s*([^<]+)</i);
    if (!off) continue;
    const v = parseBrMoney(off[1]);
    if (v == null || v <= 0) continue;

    const isStrike =
      /\ba-text-price\b/i.test(attrs) ||
      /\ba-text-strike\b/i.test(attrs) ||
      /\bdata-a-strike="true"/i.test(attrs);
    if (isStrike) strikes.push(v);
    else finals.push(v);
  }

  if (finals.length > 0 || strikes.length > 0) {
    // Promo: o menor preço "final" (cobre Amazon "Em oferta" + a-text-price-secondary).
    // Original: o maior preço riscado (cobre múltiplas variantes na vitrine).
    const promo = finals.length > 0 ? Math.min(...finals) : null;
    const original = strikes.length > 0 ? Math.max(...strikes) : null;
    // Só retorna `original` se for de fato MAIOR que `promo` — evita case
    // em que `a-text-price` foi um preço auxiliar igual/menor ao final.
    const validOriginal = original != null && promo != null && original > promo ? original : null;
    return { promo, original: validOriginal };
  }

  // Fallback: a-price-whole + a-price-fraction (cards sem `a-offscreen`).
  const whole = chunk.match(/class="a-price-whole"[^>]*>([\d.,\s]+)/i);
  const frac = chunk.match(/class="a-price-fraction"[^>]*>(\d+)/i);
  if (whole) {
    const w = whole[1].replace(/\./g, "").replace(/[^\d]/g, "");
    const f = frac ? frac[1] : "00";
    const n = parseFloat(`${w}.${f}`);
    return { promo: Number.isFinite(n) ? n : null, original: null };
  }

  // Último recurso: pega o primeiro R$ que aparecer.
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

  /**
   * Limite máximo de caracteres por card. 40k cobre cards densos com
   * variantes/cupons sem vazar para o próximo. O CORTE REAL é feito no
   * início do próximo card — esse cap só é fallback quando o último card
   * da página não tem sucessor.
   */
  const MAX_CHUNK = 40000;

  /**
   * BUG histórico (corrigido aqui): a tag de abertura do card Amazon BR é tipo:
   *
   *   <div data-asin="B0GPYMGKDP" data-component-type="s-search-result" ...>
   *                  ↑ ASIN ANTES                       ↑ marker DEPOIS
   *
   * Antes a gente fazia `html.indexOf(marker)` e cortava o chunk daí pra
   * frente — só que o `data-asin` do produto atual ficava ANTES do ponto
   * de corte! O `chunk.match(/data-asin/)` então pegava o ASIN do PRÓXIMO
   * card, gerando um off-by-one: link de "Camisa Polo" levava pro "Flamengo",
   * link de "Flamengo" levava pra "Lakoss" etc.
   *
   * Solução: identificar a tag de abertura inteira (`<div ... data-component-
   * type="s-search-result" ...>`) e capturar `data-asin` direto dos atributos
   * dela. O chunk passa a começar EXATAMENTE no `<div>` raiz do card.
   */
  const cardOpenRe = /<div\b([^>]{0,2000}\bdata-component-type="s-search-result"[^>]{0,2000})>/gi;
  const cardStarts: { pos: number; asin: string }[] = [];
  for (const m of html.matchAll(cardOpenRe)) {
    if (m.index == null) continue;
    const attrs = m[1];
    const asinM = attrs.match(/\bdata-asin="([A-Z0-9]{10})"/);
    if (!asinM) continue;
    cardStarts.push({ pos: m.index, asin: asinM[1] });
  }

  for (let idx = 0; idx < cardStarts.length && out.length < limit; idx++) {
    const card = cardStarts[idx];
    const asin = card.asin;
    if (seen.has(asin)) continue;
    seen.add(asin);

    const nextStart = idx + 1 < cardStarts.length ? cardStarts[idx + 1].pos : html.length;
    const end = Math.min(nextStart, card.pos + MAX_CHUNK);
    const chunk = html.slice(card.pos, end);
    const title = extractTitle(chunk, asin);
    const imageUrl = extractImage(chunk, asin);
    let { promo, original } = extractPrices(chunk);
    let dr =
      original != null && promo != null && original > promo
        ? discountFromPrices(promo, original)
        : null;

    /**
     * Sanity check anti-mentira: descontos absurdos (≥ 92%) na SERP da
     * Amazon são quase sempre erro de parsing — preço de uma variante
     * irrelevante, parcela, oferta de outro vendedor, etc. Em vez de
     * exibir "-97% OFF R$ 324" pra um produto de R$ 4.898, descartamos
     * o priceOriginal e o discount, mantendo só o promo.
     *
     * Cupons fortes legítimos costumam ficar abaixo de 90% e ainda assim
     * podem ser conferidos via PDP enrichment.
     */
    if (dr != null && dr >= 92) {
      original = null;
      dr = null;
    }

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
      primeDiscountPercent: null, // enriquecido pela PDP
    });
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
