import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

export const DEFAULT_PROMO_TITLE_BENEFITS_ROSA = "O que você vai encontrar:";
export const DEFAULT_PROMO_TITLE_TESTIMONIALS = "Quem já economizou no grupo";
export const DEFAULT_PROMO_TITLE_IN_GROUP = "No grupo você vai encontrar:";

const MAX_LEN = 120;

export type PromoSectionTitlesInput = {
  benefits: string;
  testimonials: string;
  inGroup: string;
};

export type PromoSectionTitlesResolved = PromoSectionTitlesInput;

function clip(s: string): string {
  return s.trim().slice(0, MAX_LEN);
}

export function normalizePromoSectionsEnabled(v: unknown): boolean {
  return v !== false;
}

function readTitlesObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as Record<string, unknown>;
}

/** Valores para o formulário (etapa 4) a partir da linha da BD. */
export function promoTitlesForForm(
  pageTemplate: PageTemplate | null | undefined,
  raw: unknown,
): PromoSectionTitlesInput {
  const o = readTitlesObject(raw);
  const tpl = pageTemplate ?? "classic";
  const benefitsDefault =
    tpl === "vip_rosa" ? DEFAULT_PROMO_TITLE_BENEFITS_ROSA : "";
  const b = typeof o.benefits === "string" ? clip(o.benefits) : "";
  const t = typeof o.testimonials === "string" ? clip(o.testimonials) : "";
  const ig = typeof o.in_group === "string" ? clip(o.in_group) : "";
  return {
    benefits: b || benefitsDefault,
    testimonials: t || DEFAULT_PROMO_TITLE_TESTIMONIALS,
    inGroup: ig || DEFAULT_PROMO_TITLE_IN_GROUP,
  };
}

/** Valores efetivos na página pública (por template). */
export function resolvePromoTitlesForPublicPage(
  pageTemplate: PageTemplate,
  raw: unknown,
): PromoSectionTitlesResolved {
  const form = promoTitlesForForm(pageTemplate, raw);
  if (pageTemplate === "vip_rosa") {
    return {
      benefits: form.benefits.trim() || DEFAULT_PROMO_TITLE_BENEFITS_ROSA,
      testimonials: form.testimonials.trim() || DEFAULT_PROMO_TITLE_TESTIMONIALS,
      inGroup: form.inGroup.trim() || DEFAULT_PROMO_TITLE_IN_GROUP,
    };
  }
  return {
    benefits: clip(form.benefits),
    testimonials: form.testimonials.trim() || DEFAULT_PROMO_TITLE_TESTIMONIALS,
    inGroup: form.inGroup.trim() || DEFAULT_PROMO_TITLE_IN_GROUP,
  };
}

/** Payload JSONB para gravar (sempre as três chaves, strings curtas). */
export function promoSectionTitlesToJsonb(titles: PromoSectionTitlesInput): Record<string, string> {
  return {
    benefits: clip(titles.benefits),
    testimonials: clip(titles.testimonials),
    in_group: clip(titles.inGroup),
  };
}

/** Valor inicial do campo «benefícios» no wizard conforme o modelo escolhido. */
export function defaultBenefitsTitleForTemplate(t: PageTemplate): string {
  return t === "vip_rosa" ? DEFAULT_PROMO_TITLE_BENEFITS_ROSA : "";
}
