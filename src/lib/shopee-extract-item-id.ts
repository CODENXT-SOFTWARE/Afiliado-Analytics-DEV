/** Primeiro segmento de path que não é página de produto (evita falso positivo em rotas da Shopee). */
const SHOPEE_PATH_SKIP = new Set(
  [
    "product",
    "search",
    "cart",
    "checkout",
    "user",
    "buyer",
    "seller",
    "mall",
    "web",
    "api",
    "help",
    "verify",
    "universal-link",
    "buy",
  ].map((s) => s.toLowerCase()),
);

/**
 * Extrai itemId de URLs da Shopee:
 * - slug -i.shop.item
 * - /product/shopId/itemId
 * - /slug-loja/shopId/itemId (ex.: mobile / afiliado: .../opaanlp/306423459/2923336344)
 * - query itemId / item_id
 */
export function extractShopeeItemIdFromInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(withProtocol);
    const host = parsed.hostname.toLowerCase();
    const isShopee =
      host === "shopee.com.br" ||
      host.endsWith(".shopee.com.br") ||
      host === "shopee.com" ||
      host.endsWith(".shopee.com");
    if (isShopee) {
      const byQuery = parsed.searchParams.get("itemId") || parsed.searchParams.get("item_id");
      if (byQuery && /^\d+$/.test(byQuery)) {
        const n = parseInt(byQuery, 10);
        return Number.isFinite(n) ? n : null;
      }
      const path = parsed.pathname.replace(/\/+$/, "") || "/";
      const bySlash = path.match(/\/product\/\d+\/(\d+)$/i);
      if (bySlash?.[1]) {
        const n = parseInt(bySlash[1], 10);
        return Number.isFinite(n) ? n : null;
      }
      // /nome-loja/shopId/itemId (sem "product" no path)
      const shopItem = path.match(/^\/([^/]+)\/(\d+)\/(\d+)$/);
      if (shopItem) {
        const seg = shopItem[1].toLowerCase();
        if (!SHOPEE_PATH_SKIP.has(seg)) {
          const n = parseInt(shopItem[3], 10);
          return Number.isFinite(n) ? n : null;
        }
      }
    }
  } catch {
    /* tentar padrões no texto bruto */
  }

  const legacy = trimmed.match(/[.-]i\.\d+\.(\d+)/i);
  if (legacy?.[1]) {
    const n = parseInt(legacy[1], 10);
    return Number.isFinite(n) ? n : null;
  }

  const productInText = trimmed.match(/shopee\.com(?:\.br)?\/product\/\d+\/(\d+)/i);
  if (productInText?.[1]) {
    const n = parseInt(productInText[1], 10);
    return Number.isFinite(n) ? n : null;
  }

  const slugShopItem = trimmed.match(
    /shopee\.com(?:\.br)?\/([^/?#]+)\/(\d+)\/(\d+)/i,
  );
  if (slugShopItem) {
    const seg = slugShopItem[1].toLowerCase();
    if (seg !== "product" && !SHOPEE_PATH_SKIP.has(seg)) {
      const n = parseInt(slugShopItem[3], 10);
      return Number.isFinite(n) ? n : null;
    }
  }

  return null;
}

/**
 * Link curto da Shopee — não dá pra obter itemId sem seguir o redirect.
 * Cobre dois formatos:
 *   1) `s.shopee.com.br/...` / `s.shopee.com/...` — link de afiliado curto
 *   2) `br.shp.ee/...` / `shp.ee/...` — link de compartilhamento padrão
 *      (botão "compartilhar" na PDP do app/site da Shopee)
 */
export function isShopeeShortLinkInput(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withProtocol);
    const h = u.hostname.toLowerCase();
    const isShortHost =
      h === "s.shopee.com.br" ||
      h.endsWith(".s.shopee.com.br") ||
      h === "s.shopee.com" ||
      h.endsWith(".s.shopee.com") ||
      h === "shp.ee" ||
      h.endsWith(".shp.ee");
    if (!isShortHost) return false;
    const seg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
    return seg.length > 0 && /^[a-z0-9_-]+$/i.test(seg);
  } catch {
    return /(?:s\.shopee\.com(?:\.br)?|(?:[a-z]+\.)?shp\.ee)\/[a-z0-9_-]+/i.test(trimmed);
  }
}
