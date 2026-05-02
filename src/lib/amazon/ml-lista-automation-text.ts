import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";

/**
 * Espelho de `@/lib/mercadolivre/ml-lista-automation-text` pra Amazon.
 * Mantemos os nomes `mlEstCommissionFromPromoPrice` / `buildMlListaAutomationText`
 * porque o clone da página é textualmente 1:1 com a versão ML — renomear
 * em todos os call sites seria churn sem ganho.
 */

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
  /** Cupom em % aplicável ao produto (ex.: 15 → "Cupom de 15%"). Opcional. */
  couponPercent?: number | null;
  /** Cupom de valor fixo em R$ (ex.: 5 → "Cupom de R$ 5,00"). Opcional. */
  couponAmount?: number | null;
  formatCurrency: (v: number) => string;
};

/** Texto estilo grupos (Shopee / ML / Amazon) — emojis, preços e link de afiliado Amazon. */
export function buildMlListaAutomationText(p: MlListaAutomationInput): string {
  const promo =
    effectiveListaOfferPromoPrice(p.priceOriginal, p.pricePromo, p.discountRate) ?? p.pricePromo;
  const lines: string[] = [];
  lines.push(`✨ ${(p.productName || "Produto").trim()}`);
  const disc = p.discountRate != null && p.discountRate > 0 ? `-${Math.round(p.discountRate)}% ` : "";
  const orig = p.priceOriginal != null ? p.formatCurrency(p.priceOriginal) : "—";
  const por = promo != null ? p.formatCurrency(promo) : "—";
  lines.push(`💰 Preço: ${disc}🔴 ${orig} por ✅ ${por}`);

  if (p.couponPercent != null && p.couponPercent > 0) {
    lines.push(`🎟️ Cupom de ${Math.round(p.couponPercent)}% no checkout`);
  } else if (p.couponAmount != null && p.couponAmount > 0) {
    lines.push(`🎟️ Cupom de ${p.formatCurrency(p.couponAmount)} no checkout`);
  }

  lines.push("🏷️ PROMOÇÃO - CLIQUE NO LINK 👇");
  lines.push((p.converterLink || "").trim());
  return lines.join("\n");
}
