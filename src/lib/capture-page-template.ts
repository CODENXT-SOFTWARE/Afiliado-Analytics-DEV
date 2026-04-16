import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

const ALLOWED = new Set<PageTemplate>([
  "classic",
  "vip_rosa",
  "vip_terroso",
  "vinho_rose",
  "the_new_chance",
  "aurora_ledger",
  "jardim_floral",
  "market_master",
  "perfumaria_luxuosa",
  "em_branco",
]);

/**
 * Normaliza o valor vindo do JSON (snake_case / camelCase / legado) para o CHECK do Postgres.
 */
export function normalizeCapturePageTemplate(raw: unknown): PageTemplate {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
  if (s === "elegante" || s === "elegante_rosa" || s === "viprosa") return "vip_rosa";
  if (s === "terroso" || s === "vip_terroso_minimal") return "vip_terroso";
  if (s === "vinhorose" || s === "vinho" || s === "rose" || s === "vip_vinho_rose") return "vinho_rose";
  if (
    s === "thenewchance" ||
    s === "new_chance" ||
    s === "newchance" ||
    s === "the_new_chance" ||
    s === "vip_the_new_chance"
  ) {
    return "the_new_chance";
  }
  if (s === "aurora_ledger" || s === "auroraledger" || s === "sala_aurora") {
    return "aurora_ledger";
  }
  if (s === "jardim_floral" || s === "jardimfloral" || s === "petala" || s === "jardim_rosa") {
    return "jardim_floral";
  }
  if (
    s === "market_master" ||
    s === "marketmaster" ||
    s === "mmaster" ||
    s === "market_master_promo" ||
    s === "tudo_na_promo"
  ) {
    return "market_master";
  }
  if (
    s === "perfumaria_luxuosa" ||
    s === "perfumarialuxuosa" ||
    s === "perfumaria" ||
    s === "luxuoso" ||
    s === "beleza_luxo" ||
    s === "grupo_beleza_luxo"
  ) {
    return "perfumaria_luxuosa";
  }
  if (s === "em_branco" || s === "embranco" || s === "blank" || s === "canvas_livre") {
    return "em_branco";
  }
  if (ALLOWED.has(s as PageTemplate)) return s as PageTemplate;
  return "classic";
}
