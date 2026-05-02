/**
 * Formatadores de mensagem pro Telegram.
 *
 * Diferente do WhatsApp (que usa *bold* e _italic_ markdown), aqui geramos
 * **texto puro** sem parse_mode pra MVP — evita problemas de escape com nomes
 * de produtos contendo caracteres especiais. Próxima iteração pode oferecer
 * HTML opcional via flag no banco.
 */

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(n);

// ── Modo keywords (Shopee API ao vivo) ──────────────────────────────────────────

export type ShopeeKeywordMessageInput = {
  nomeProduto: string;
  precoPor: number;
  precoRiscado: number;
  discountRate: number;
  linkAfiliado: string;
  /** Amazon: cupom em % (ex.: 14). Opcional. */
  couponPercent?: number | null;
  /** Amazon: cupom em valor R$. Opcional. */
  couponAmount?: number | null;
  /** Amazon: desconto exclusivo Prime em %. Opcional. */
  primeDiscountPercent?: number | null;
};

export function buildShopeeKeywordMessage(input: ShopeeKeywordMessageInput): string {
  const { nomeProduto, precoPor, precoRiscado, discountRate, linkAfiliado, couponPercent, couponAmount, primeDiscountPercent } = input;
  const rate = discountRate;
  const lines: string[] = [];
  lines.push(`✨ ${nomeProduto}`);
  lines.push("");
  lines.push(`💰 APROVEITE${rate > 0 ? ` ${Math.round(rate)}% DE DESCONTO` : ""}`);
  if (precoRiscado > 0 && precoRiscado !== precoPor) {
    lines.push(`🔴 De: ${formatBRL(precoRiscado)}`);
  }
  lines.push(`🔥 Por: ${formatBRL(precoPor)} 😱`);

  // Linhas extras Amazon — só renderizam quando os campos estão presentes.
  if (couponPercent != null && couponPercent > 0) {
    lines.push(`🎟️ Cupom de ${Math.round(couponPercent)}% OFF`);
  } else if (couponAmount != null && couponAmount > 0) {
    lines.push(`🎟️ Cupom de ${formatBRL(couponAmount)} OFF`);
  }
  if (primeDiscountPercent != null && primeDiscountPercent > 0) {
    lines.push(`💻 Prime: ${Math.round(primeDiscountPercent)}% OFF`);
  }

  lines.push("");
  lines.push(`🏷️ PROMOÇÃO - CLIQUE NO LINK 👇`);
  lines.push(linkAfiliado);
  return lines.join("\n");
}

// ── Modo lista de ofertas (Shopee/ML/Amazon pré-salvas) ─────────────────────────

export type ListaOfferMessageInput = {
  nomeProduto: string;
  precoPor: number;
  precoRiscado: number;
  discountRate: number;
  linkAfiliado: string;
  /** Amazon: cupom em %. Opcional. */
  couponPercent?: number | null;
  /** Amazon: cupom em R$. Opcional. */
  couponAmount?: number | null;
  /** Amazon: % desconto Prime. Opcional. */
  primeDiscountPercent?: number | null;
};

export function buildListaOfferMessage(input: ListaOfferMessageInput): string {
  // Mesmo formato do modo keywords — produto Shopee/ML/Amazon estruturado igual
  return buildShopeeKeywordMessage(input);
}

// ── Modo Infoprodutor ───────────────────────────────────────────────────────────

export type InfoprodutorMessageInput = {
  nomeProduto: string;
  descricaoLivre: string;
  link: string;
  preco: number | null;
  precoAntigo?: number | null;
};

export function buildInfoprodutorMessage(input: InfoprodutorMessageInput): string {
  const { nomeProduto, descricaoLivre, preco, precoAntigo, link } = input;
  const parts: string[] = [];
  parts.push(`✨ ${nomeProduto}`);
  if (descricaoLivre && descricaoLivre.trim()) {
    parts.push("");
    parts.push(descricaoLivre.trim());
  }
  const old = precoAntigo != null && precoAntigo > 0 ? precoAntigo : null;
  const cur = preco != null && preco > 0 ? preco : null;
  if (old != null || cur != null) {
    parts.push("");
    if (old != null) parts.push(`💰 De: ${formatBRL(old)}`);
    if (cur != null) parts.push(`🔥 Por apenas: ${formatBRL(cur)}`);
  }
  parts.push("");
  parts.push("🛒 GARANTA O SEU - CLIQUE NO LINK 👇");
  parts.push(link);
  return parts.join("\n");
}
