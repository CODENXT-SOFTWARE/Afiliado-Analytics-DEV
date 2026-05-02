import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";

export function mlEstCommissionFromPromoPrice(pricePromo: number | null, pct: number): number | null {
  if (pricePromo == null || !Number.isFinite(pricePromo) || pct <= 0) return null;
  return Math.round(pricePromo * (pct / 100) * 100) / 100;
}

export type MlListaAutomationInput = {
  productName: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
  converterLink: string;
  /** Percentual 0–100 vindo do PDP (GANHOS X%); se omitido, não inclui linha de comissão. */
  commissionPct?: number | null;
  /** Cupom em % (ex.: 8 → "Cupom 8% OFF"). */
  couponPercent?: number | null;
  /** Cupom em valor R$ (alternativo). */
  couponAmount?: number | null;
  /** Desconto Pix em % (ex.: 4 → "no Pix 4% OFF"). */
  pixDiscountPercent?: number | null;
  /** True se entrega via FULL. */
  isFull?: boolean | null;
  /** True se há frete grátis. */
  freeShipping?: boolean | null;
  /** Quantidade de parcelas (ex.: 4). */
  installmentsCount?: number | null;
  /** Valor de cada parcela em R$. */
  installmentAmount?: number | null;
  /** True se as parcelas são sem juros. */
  installmentsFreeInterest?: boolean | null;
  formatCurrency: (v: number) => string;
};

/**
 * Texto estilo grupos (Shopee / ML) — emojis, preços e link meli.la.
 *
 * Estrutura visual com linhas em branco entre os blocos pra dar respiro:
 *
 *   ✨ Nome
 *
 *   💰 Preço: -X% 🔴 R$ orig por ✅ R$ promo 😱💸
 *
 *   🎟️ Cupom de X% OFF
 *   💳 X% OFF no Pix
 *   ⚡ Chega rápido com FULL
 *   🚚 Frete grátis
 *   💳 Xx R$ Y sem juros
 *
 *   🏷️ PROMOÇÃO - CLIQUE NO LINK 👇
 *   {link}
 */
export function buildMlListaAutomationText(p: MlListaAutomationInput): string {
  const promo =
    effectiveListaOfferPromoPrice(p.priceOriginal, p.pricePromo, p.discountRate) ?? p.pricePromo;

  const hasCoupon =
    (p.couponPercent != null && p.couponPercent > 0) ||
    (p.couponAmount != null && p.couponAmount > 0);
  const hasPix = p.pixDiscountPercent != null && p.pixDiscountPercent > 0;
  const hasFull = p.isFull === true;
  const hasFreeShipping = p.freeShipping === true;
  const hasInstallments =
    p.installmentsCount != null && p.installmentsCount > 1 && p.installmentAmount != null;
  const hasAnyExtra = hasCoupon || hasPix || hasFull || hasFreeShipping || hasInstallments;

  const lines: string[] = [];

  // Bloco 1: nome
  lines.push(`✨ ${(p.productName || "Produto").trim()}`);
  lines.push("");

  // Bloco 2: preço
  const disc = p.discountRate != null && p.discountRate > 0 ? `-${Math.round(p.discountRate)}% ` : "";
  const orig = p.priceOriginal != null ? p.formatCurrency(p.priceOriginal) : "—";
  const por = promo != null ? p.formatCurrency(promo) : "—";
  lines.push(`💰 Preço: ${disc}🔴 ${orig} por ✅ ${por} 😱💸`);

  // Bloco 3: extras (cupom, Pix, FULL, frete, parcelado) — só se algum existir.
  if (hasAnyExtra) {
    lines.push("");
    if (p.couponPercent != null && p.couponPercent > 0) {
      lines.push(`🎟️ Cupom de ${Math.round(p.couponPercent)}% OFF`);
    } else if (p.couponAmount != null && p.couponAmount > 0) {
      lines.push(`🎟️ Cupom de ${p.formatCurrency(p.couponAmount)} OFF`);
    }
    if (hasPix) {
      lines.push(`💳 ${Math.round(p.pixDiscountPercent as number)}% OFF no Pix`);
    }
    if (hasFull) {
      lines.push(`⚡ Chega rápido com FULL`);
    }
    if (hasFreeShipping) {
      lines.push(`🚚 Frete grátis`);
    }
    if (hasInstallments) {
      const count = p.installmentsCount as number;
      const amount = p.formatCurrency(p.installmentAmount as number);
      const suffix = p.installmentsFreeInterest ? " sem juros" : "";
      lines.push(`💳 ${count}x ${amount}${suffix}`);
    }
  }

  // Bloco 4: comissão (afiliado) — antes da chamada pra ação.
  const pct = p.commissionPct;
  if (pct != null && pct > 0) {
    const comm = mlEstCommissionFromPromoPrice(promo, pct);
    if (comm != null) {
      lines.push("");
      lines.push(
        `💸 Ganhos ML: ${pct.toFixed(1).replace(/\.0$/, "")}% · ${p.formatCurrency(comm)}`,
      );
    }
  }

  // Bloco 5: chamada pra ação
  lines.push("");
  lines.push("🏷️ PROMOÇÃO - CLIQUE NO LINK 👇");
  lines.push((p.converterLink || "").trim());
  return lines.join("\n");
}
