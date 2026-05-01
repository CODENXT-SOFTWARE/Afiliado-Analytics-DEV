/**
 * Busca a PDP (página do produto) da Amazon BR para extrair o cupom
 * "Aplicar Cupom de X%" (ou de R$ X) que normalmente NÃO aparece na SERP.
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

function parseBrMoney(text: string): number | null {
  const t = text.replace(/ /g, " ").trim();
  const m = t.match(/R\$\s*([\d]{1,3}(?:\.\d{3})*,\d{2}|[\d]+,\d{2})/);
  if (!m) return null;
  const num = m[1].replace(/\./g, "").replace(",", ".");
  const n = parseFloat(num);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extrai cupom do HTML da PDP. Procura primeiro o widget oficial de cupom
 * (`vpcButton`/`couponBadge`), depois faz busca textual com âncora em
 * "cupom" / "coupon" pra evitar falsos positivos.
 */
export function extractAmazonPdpCoupon(html: string): AmazonPdpCoupon {
  // Bloco do widget de cupom da PDP da Amazon. Varia bastante, então
  // pegamos uma janela ampla ao redor de palavras-âncora.
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  // 1) Percentual com âncora "cupom"
  const pctRegex =
    /(?:aplicar\s+cupom\s+de\s+(\d{1,2})\s*%)|(?:cupom\s+de\s+(\d{1,2})\s*%)|(?:economize\s+(\d{1,2})\s*%\s+com\s+cupom)|(?:(\d{1,2})\s*%\s+(?:off|de\s*desconto)\s+com\s+cupom)/i;
  const pctMatch = text.match(pctRegex);
  if (pctMatch) {
    const v = pctMatch[1] ?? pctMatch[2] ?? pctMatch[3] ?? pctMatch[4];
    if (v) {
      const n = parseInt(v, 10);
      if (n > 0 && n < 100) return { percent: n, amount: null };
    }
  }

  // 2) Valor fixo com âncora "cupom"
  const amtRegex =
    /(?:aplicar\s+cupom\s+de\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?))|(?:cupom\s+de\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?))|(?:economize\s+R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s+com\s+cupom)|(?:R\$\s*(\d{1,4}(?:[.,]\d{2})?)\s+de\s+desconto\s+com\s+cupom)/i;
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
 * Faz GET na PDP do produto e tenta extrair cupom. Falhas (timeout, http
 * error, captcha) retornam `{percent: null, amount: null}` silenciosamente
 * — o chamador pode chamar isso em paralelo sem se preocupar.
 */
export async function fetchAmazonPdpCoupon(args: {
  asin: string;
  cookieHeader: string;
  timeoutMs?: number;
}): Promise<AmazonPdpCoupon> {
  const asin = args.asin.trim();
  if (!/^[A-Z0-9]{10}$/.test(asin)) return { percent: null, amount: null };

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
    if (!res.ok) return { percent: null, amount: null };
    const html = await res.text();
    return extractAmazonPdpCoupon(html);
  } catch {
    return { percent: null, amount: null };
  } finally {
    clearTimeout(timer);
  }
}
