import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";

const MAX_HEX = 32;

function clip(s: string, max: number): string {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

/** Permite #RRGGBB, #RGB, rgba(...) curto. */
export function sanitizePromoColor(input: string | undefined | null, fallback: string): string {
  const s = clip(String(input ?? ""), MAX_HEX);
  if (!s) return fallback;
  if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(s)) return s;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+/.test(s)) return s.slice(0, 80);
  return fallback;
}

function clampPx(n: unknown, fallback: number, min: number, max: number): number {
  const v = typeof n === "number" ? n : Number.parseInt(String(n ?? ""), 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
}

export type PromoRosaFontPreset = "system" | "inter" | "dm_sans";

export type PromoRosaUiOverrides = {
  section_bg?: string;
  section_border?: string;
  heading_color?: string;
  heading_font_px?: number;
  card_bg?: string;
  card_border?: string;
  left_accent?: string;
  title_color?: string;
  body_color?: string;
  title_font_px?: number;
  body_font_px?: number;
  /** Ausente = sistema. */
  font_preset?: PromoRosaFontPreset;
};

export type PromoRosaUiResolved = {
  sectionBg: string;
  sectionBorder: string;
  headingColor: string;
  headingFontPx: number;
  cardBg: string;
  cardBorder: string;
  leftAccent: string;
  titleColor: string;
  bodyColor: string;
  titleFontPx: number;
  bodyFontPx: number;
  fontPreset: PromoRosaFontPreset;
  fontFamilyCss: string;
};

const PRESET_STACK: Record<PromoRosaFontPreset, string> = {
  system: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  inter: '"Inter", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  dm_sans: '"DM Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
};

export function promoRosaGoogleFontHref(preset: PromoRosaFontPreset): string | null {
  if (preset === "inter") return "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
  if (preset === "dm_sans") return "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";
  return null;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function normalizePromoRosaFontPreset(v: unknown): PromoRosaFontPreset {
  const s = String(v ?? "").toLowerCase();
  if (s === "inter") return "inter";
  if (s === "dm_sans" || s === "dmsans") return "dm_sans";
  return "system";
}

/** Lê overrides a partir da BD / formulário. */
export function promoRosaUiOverridesFromUnknown(raw: unknown): PromoRosaUiOverrides {
  if (!isObj(raw)) return {};
  const o = raw;
  return {
    section_bg: typeof o.section_bg === "string" ? o.section_bg : undefined,
    section_border: typeof o.section_border === "string" ? o.section_border : undefined,
    heading_color: typeof o.heading_color === "string" ? o.heading_color : undefined,
    heading_font_px: typeof o.heading_font_px === "number" ? o.heading_font_px : undefined,
    card_bg: typeof o.card_bg === "string" ? o.card_bg : undefined,
    card_border: typeof o.card_border === "string" ? o.card_border : undefined,
    left_accent: typeof o.left_accent === "string" ? o.left_accent : undefined,
    title_color: typeof o.title_color === "string" ? o.title_color : undefined,
    body_color: typeof o.body_color === "string" ? o.body_color : undefined,
    title_font_px: typeof o.title_font_px === "number" ? o.title_font_px : undefined,
    body_font_px: typeof o.body_font_px === "number" ? o.body_font_px : undefined,
    font_preset:
      typeof o.font_preset === "string" ? normalizePromoRosaFontPreset(o.font_preset) : undefined,
  };
}

export function promoRosaUiToJsonb(overrides: PromoRosaUiOverrides): Record<string, unknown> | null {
  const o = overrides;
  const out: Record<string, unknown> = {};
  if (o.section_bg?.trim()) out.section_bg = clip(o.section_bg, MAX_HEX);
  if (o.section_border?.trim()) out.section_border = clip(o.section_border, MAX_HEX);
  if (o.heading_color?.trim()) out.heading_color = clip(o.heading_color, MAX_HEX);
  if (typeof o.heading_font_px === "number" && Number.isFinite(o.heading_font_px)) {
    out.heading_font_px = clampPx(o.heading_font_px, 13, 10, 22);
  }
  if (o.card_bg?.trim()) out.card_bg = clip(o.card_bg, MAX_HEX);
  if (o.card_border?.trim()) out.card_border = clip(o.card_border, MAX_HEX);
  if (o.left_accent?.trim()) out.left_accent = clip(o.left_accent, MAX_HEX);
  if (o.title_color?.trim()) out.title_color = clip(o.title_color, MAX_HEX);
  if (o.body_color?.trim()) out.body_color = clip(o.body_color, MAX_HEX);
  if (typeof o.title_font_px === "number" && Number.isFinite(o.title_font_px)) {
    out.title_font_px = clampPx(o.title_font_px, 13, 10, 20);
  }
  if (typeof o.body_font_px === "number" && Number.isFinite(o.body_font_px)) {
    out.body_font_px = clampPx(o.body_font_px, 13, 10, 20);
  }
  if (o.font_preset && o.font_preset !== "system") out.font_preset = o.font_preset;
  return Object.keys(out).length ? out : null;
}

type VipRosaThemeLike = {
  primary: string;
  textMain: string;
  textSoft: string;
  benefitCardBg: string;
  bg: string;
};

export function resolvePromoRosaUi(
  pageTemplate: PageTemplate,
  raw: unknown,
  accentOrPrimary: string,
  vip?: VipRosaThemeLike | null,
): PromoRosaUiResolved {
  const ov = promoRosaUiOverridesFromUnknown(raw);
  const accent = sanitizePromoColor(accentOrPrimary, "#25D366");

  if (pageTemplate === "vip_rosa" && vip) {
    const sectionBg = sanitizePromoColor(ov.section_bg, vip.bg);
    const sectionBorder = sanitizePromoColor(ov.section_border, "rgba(0,0,0,0.08)");
    const headingColor = sanitizePromoColor(ov.heading_color, vip.textMain);
    const cardBg = sanitizePromoColor(ov.card_bg, vip.benefitCardBg);
    const cardBorder = sanitizePromoColor(ov.card_border, "rgba(0,0,0,0.05)");
    const leftAccent = sanitizePromoColor(ov.left_accent, vip.primary);
    const titleColor = sanitizePromoColor(ov.title_color, vip.textMain);
    const bodyColor = sanitizePromoColor(ov.body_color, vip.textSoft);
    const fp = ov.font_preset ?? "system";
    return {
      sectionBg,
      sectionBorder,
      headingColor,
      headingFontPx: clampPx(ov.heading_font_px, 13, 10, 22),
      cardBg,
      cardBorder,
      leftAccent,
      titleColor,
      bodyColor,
      titleFontPx: clampPx(ov.title_font_px, 13, 10, 20),
      bodyFontPx: clampPx(ov.body_font_px, 13, 10, 20),
      fontPreset: fp,
      fontFamilyCss: PRESET_STACK[fp],
    };
  }

  const fp = ov.font_preset ?? "system";
  return {
    sectionBg: sanitizePromoColor(ov.section_bg, "rgba(255,255,255,0.95)"),
    sectionBorder: sanitizePromoColor(ov.section_border, "rgba(0,0,0,0.1)"),
    headingColor: sanitizePromoColor(ov.heading_color, "#262626"),
    headingFontPx: clampPx(ov.heading_font_px, 13, 10, 22),
    cardBg: sanitizePromoColor(ov.card_bg, "#ffffff"),
    cardBorder: sanitizePromoColor(ov.card_border, "rgba(0,0,0,0.05)"),
    leftAccent: sanitizePromoColor(ov.left_accent, accent),
    titleColor: sanitizePromoColor(ov.title_color, "#171717"),
    bodyColor: sanitizePromoColor(ov.body_color, "#525252"),
    titleFontPx: clampPx(ov.title_font_px, 13, 10, 20),
    bodyFontPx: clampPx(ov.body_font_px, 13, 10, 20),
    fontPreset: fp,
    fontFamilyCss: PRESET_STACK[fp],
  };
}
