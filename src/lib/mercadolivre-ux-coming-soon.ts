/**
 * Quando `true`, a UI de Mercado Livre / crossover mostra apenas o splash "Em Breve"
 * (nav, listas, grupos, config). Reative definindo como `false`.
 */
export const MERCADOLIVRE_UX_COMING_SOON = true;

export function isGruposVendaMlOfferBlocked(
  source: "shopee" | "ml" | "crossover" | "infoprodutor",
): boolean {
  if (!MERCADOLIVRE_UX_COMING_SOON) return false;
  return source === "ml" || source === "crossover";
}
