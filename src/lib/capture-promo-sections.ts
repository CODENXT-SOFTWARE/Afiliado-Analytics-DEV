import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

export const DEFAULT_PROMO_TITLE_BENEFITS_ROSA = "O que você vai encontrar:";
export const DEFAULT_PROMO_TITLE_TESTIMONIALS = "Quem já economizou no grupo";
export const DEFAULT_PROMO_TITLE_IN_GROUP = "No grupo você vai encontrar:";

/** Títulos sugeridos no assistente do modelo Market Master (cupons / confiança). */
export const DEFAULT_PROMO_TITLE_TESTIMONIALS_MARKET_MASTER = "Mas será que é confiável?";
export const DEFAULT_PROMO_TITLE_IN_GROUP_MARKET_MASTER =
  "Essas são algumas promoções que membros dos meus grupos já aproveitaram ↓";

/** Perfumaria luxuosa — faixa superior, secção de marcas, assinatura social. */
export const DEFAULT_PROMO_TITLE_BENEFITS_PERFUMARIA =
  "Economize em perfumes e cosméticos de marca todos os dias 💄✨";
export const DEFAULT_PROMO_TITLE_TESTIMONIALS_PERFUMARIA =
  "MARCAS E PRODUTOS QUE VOCÊ ENCONTRA SÓ AQUI 👇";
export const DEFAULT_PROMO_TITLE_IN_GROUP_PERFUMARIA = "👩‍🦰 @sua_loja";

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
    tpl === "vip_rosa" || tpl === "em_branco"
      ? DEFAULT_PROMO_TITLE_BENEFITS_ROSA
      : tpl === "perfumaria_luxuosa"
        ? DEFAULT_PROMO_TITLE_BENEFITS_PERFUMARIA
        : "";
  const testimonialsDefault =
    tpl === "market_master"
      ? DEFAULT_PROMO_TITLE_TESTIMONIALS_MARKET_MASTER
      : tpl === "perfumaria_luxuosa"
        ? DEFAULT_PROMO_TITLE_TESTIMONIALS_PERFUMARIA
        : DEFAULT_PROMO_TITLE_TESTIMONIALS;
  const inGroupDefault =
    tpl === "market_master"
      ? DEFAULT_PROMO_TITLE_IN_GROUP_MARKET_MASTER
      : tpl === "perfumaria_luxuosa"
        ? DEFAULT_PROMO_TITLE_IN_GROUP_PERFUMARIA
        : DEFAULT_PROMO_TITLE_IN_GROUP;
  const b = typeof o.benefits === "string" ? clip(o.benefits) : "";
  const t = typeof o.testimonials === "string" ? clip(o.testimonials) : "";
  const ig = typeof o.in_group === "string" ? clip(o.in_group) : "";
  return {
    benefits: b || benefitsDefault,
    testimonials: t || testimonialsDefault,
    inGroup: ig || inGroupDefault,
  };
}

/** Valores efetivos na página pública (por template). */
export function resolvePromoTitlesForPublicPage(
  pageTemplate: PageTemplate,
  raw: unknown,
): PromoSectionTitlesResolved {
  const form = promoTitlesForForm(pageTemplate, raw);
  if (pageTemplate === "vip_rosa" || pageTemplate === "em_branco") {
    return {
      benefits: form.benefits.trim() || DEFAULT_PROMO_TITLE_BENEFITS_ROSA,
      testimonials: form.testimonials.trim() || DEFAULT_PROMO_TITLE_TESTIMONIALS,
      inGroup: form.inGroup.trim() || DEFAULT_PROMO_TITLE_IN_GROUP,
    };
  }
  if (pageTemplate === "market_master") {
    return {
      benefits: clip(form.benefits),
      testimonials: form.testimonials.trim() || DEFAULT_PROMO_TITLE_TESTIMONIALS_MARKET_MASTER,
      inGroup: form.inGroup.trim() || DEFAULT_PROMO_TITLE_IN_GROUP_MARKET_MASTER,
    };
  }
  if (pageTemplate === "perfumaria_luxuosa") {
    return {
      benefits: form.benefits.trim() || DEFAULT_PROMO_TITLE_BENEFITS_PERFUMARIA,
      testimonials: form.testimonials.trim() || DEFAULT_PROMO_TITLE_TESTIMONIALS_PERFUMARIA,
      inGroup: form.inGroup.trim() || DEFAULT_PROMO_TITLE_IN_GROUP_PERFUMARIA,
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
  if (t === "vip_rosa" || t === "em_branco") return DEFAULT_PROMO_TITLE_BENEFITS_ROSA;
  if (t === "perfumaria_luxuosa") return DEFAULT_PROMO_TITLE_BENEFITS_PERFUMARIA;
  return "";
}
