import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

const ALLOWED = new Set<PageTemplate>(["classic", "vip_rosa", "vip_terroso"]);

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
  if (ALLOWED.has(s as PageTemplate)) return s as PageTemplate;
  return "classic";
}
