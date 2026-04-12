/**
 * Tema da página de captura **Em Branco** — tudo o que é UX visual num único JSON.
 */

export type BlankFontPreset = "system" | "inter" | "dm_sans" | "playfair" | "space_grotesk";

export type BlankAnimationPreset =
  | "none"
  | "fade_rise"
  | "float_card"
  | "pulse_cta"
  | "shimmer_bg"
  | "bounce_in";

export type BlankCtaPlacement = "below_description" | "bottom_sticky";

export type BlankDecorative = "none" | "dots" | "grid" | "gradient_orbs";

export type BlankBgImageFit = "cover" | "contain";

export type BlankBgImageRepeat = "no-repeat" | "repeat" | "repeat-x" | "repeat-y";

/** Valores seguros para `background-position` no canvas. */
export type BlankBgImagePosition = "center" | "top" | "bottom" | "left" | "right";

export type BlankCanvasConfig = {
  v: 1;
  useSolidBg: boolean;
  solidBg: string;
  bgAngle: number;
  bgFrom: string;
  bgTo: string;
  cardBg: string;
  cardBorder: string;
  cardRadiusPx: number;
  cardShadowOpacity: number;
  glassCard: boolean;
  maxContentWidthPx: number;
  titleColor: string;
  titleFontPx: number;
  titleAlign: "left" | "center" | "right";
  showSubtitle: boolean;
  subtitle: string;
  subtitleColor: string;
  subtitleFontPx: number;
  descColor: string;
  descFontPx: number;
  textAlign: "left" | "center" | "right";
  btnBg: string;
  btnText: string;
  btnRadiusPx: number;
  btnFullWidth: boolean;
  btnPulse: boolean;
  ctaPlacement: BlankCtaPlacement;
  showLogo: boolean;
  showHero: boolean;
  heroPath: string | null;
  heroRadiusPx: number;
  /** Imagem de fundo da página (camada por baixo do gradiente / cor). */
  bgImageEnabled: boolean;
  bgImagePath: string | null;
  bgImageFit: BlankBgImageFit;
  bgImageRepeat: BlankBgImageRepeat;
  bgImagePosition: BlankBgImagePosition;
  decorative: BlankDecorative;
  animation: BlankAnimationPreset;
  fontPreset: BlankFontPreset;
};

export const BLANK_CANVAS_VERSION = 1 as const;

function clip(s: string, max: number): string {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function createDefaultBlankCanvas(): BlankCanvasConfig {
  return {
    v: 1,
    useSolidBg: false,
    solidBg: "#0c0c0f",
    bgAngle: 135,
    bgFrom: "#0f0f14",
    bgTo: "#1a0f24",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.14)",
    cardRadiusPx: 28,
    cardShadowOpacity: 0.35,
    glassCard: false,
    maxContentWidthPx: 460,
    titleColor: "#fafafa",
    titleFontPx: 30,
    titleAlign: "center",
    showSubtitle: false,
    subtitle: "Sua oferta, do seu jeito",
    subtitleColor: "rgba(250,250,250,0.55)",
    subtitleFontPx: 14,
    descColor: "rgba(250,250,250,0.72)",
    descFontPx: 16,
    textAlign: "center",
    btnBg: "#ee4d2d",
    btnText: "#ffffff",
    btnRadiusPx: 999,
    btnFullWidth: false,
    btnPulse: false,
    ctaPlacement: "below_description",
    /** Único interruptor “ligado” por defeito no painel Em branco (media): zona da logo visível. */
    showLogo: true,
    showHero: false,
    heroPath: null,
    heroRadiusPx: 20,
    bgImageEnabled: false,
    bgImagePath: null,
    bgImageFit: "cover",
    bgImageRepeat: "no-repeat",
    bgImagePosition: "center",
    decorative: "gradient_orbs",
    animation: "fade_rise",
    fontPreset: "inter",
  };
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function mergeBlankCanvasFromDb(raw: unknown): BlankCanvasConfig {
  const d = createDefaultBlankCanvas();
  if (!isObj(raw)) return d;
  if (raw.v !== 1 && raw.v !== undefined && raw.v !== null) return d;

  const n = (k: keyof BlankCanvasConfig, fn: (v: unknown) => unknown) => {
    if (k in raw) (d as Record<string, unknown>)[k] = fn(raw[k]);
  };

  n("useSolidBg", (v) => v === true);
  n("solidBg", (v) => clip(String(v ?? d.solidBg), 32));
  n("bgAngle", (v) => clamp(Number(v) || d.bgAngle, 0, 360));
  n("bgFrom", (v) => clip(String(v ?? d.bgFrom), 32));
  n("bgTo", (v) => clip(String(v ?? d.bgTo), 32));
  n("cardBg", (v) => clip(String(v ?? d.cardBg), 80));
  n("cardBorder", (v) => clip(String(v ?? d.cardBorder), 80));
  n("cardRadiusPx", (v) => clamp(Math.round(Number(v) || d.cardRadiusPx), 0, 48));
  n("cardShadowOpacity", (v) => clamp(Number(v) || d.cardShadowOpacity, 0, 1));
  n("glassCard", (v) => v === true || v === false ? v : d.glassCard);
  n("maxContentWidthPx", (v) => clamp(Math.round(Number(v) || d.maxContentWidthPx), 320, 720));
  n("titleColor", (v) => clip(String(v ?? d.titleColor), 32));
  n("titleFontPx", (v) => clamp(Math.round(Number(v) || d.titleFontPx), 18, 48));
  const ta = String(raw.titleAlign ?? "").toLowerCase();
  if (ta === "left" || ta === "center" || ta === "right") d.titleAlign = ta;
  n("showSubtitle", (v) => v === true || v === false ? v : d.showSubtitle);
  n("subtitle", (v) => clip(String(v ?? d.subtitle), 120));
  n("subtitleColor", (v) => clip(String(v ?? d.subtitleColor), 80));
  n("subtitleFontPx", (v) => clamp(Math.round(Number(v) || d.subtitleFontPx), 11, 22));
  n("descColor", (v) => clip(String(v ?? d.descColor), 80));
  n("descFontPx", (v) => clamp(Math.round(Number(v) || d.descFontPx), 12, 22));
  const xa = String(raw.textAlign ?? "").toLowerCase();
  if (xa === "left" || xa === "center" || xa === "right") d.textAlign = xa;
  n("btnBg", (v) => clip(String(v ?? d.btnBg), 32));
  n("btnText", (v) => clip(String(v ?? d.btnText), 32));
  n("btnRadiusPx", (v) => clamp(Math.round(Number(v) || d.btnRadiusPx), 0, 999));
  n("btnFullWidth", (v) => v === true || v === false ? v : d.btnFullWidth);
  n("btnPulse", (v) => v === true || v === false ? v : d.btnPulse);
  const cp = String(raw.ctaPlacement ?? "").toLowerCase();
  if (cp === "below_description" || cp === "bottom_sticky") d.ctaPlacement = cp;
  n("showLogo", (v) => v === true || v === false ? v : d.showLogo);
  n("showHero", (v) => v === true || v === false ? v : d.showHero);
  {
    const hp = raw.heroPath;
    if (typeof hp === "string" && hp.trim()) {
      const p = hp.trim();
      d.heroPath = p.length <= 512 ? p : null;
    } else {
      d.heroPath = null;
    }
  }
  n("heroRadiusPx", (v) => clamp(Math.round(Number(v) || d.heroRadiusPx), 0, 40));
  n("bgImageEnabled", (v) => v === true || v === false ? v : d.bgImageEnabled);
  {
    const bp = raw.bgImagePath;
    if (typeof bp === "string" && bp.trim()) {
      const p = bp.trim();
      d.bgImagePath = p.length <= 512 ? p : null;
    } else {
      d.bgImagePath = null;
    }
  }
  const bf = String(raw.bgImageFit ?? "").toLowerCase();
  if (bf === "cover" || bf === "contain") d.bgImageFit = bf;
  const br = String(raw.bgImageRepeat ?? "").toLowerCase().replace(/ /g, "");
  if (br === "no-repeat" || br === "repeat" || br === "repeat-x" || br === "repeat-y") d.bgImageRepeat = br;
  const bpos = String(raw.bgImagePosition ?? "").toLowerCase();
  if (bpos === "center" || bpos === "top" || bpos === "bottom" || bpos === "left" || bpos === "right") {
    d.bgImagePosition = bpos;
  }
  const dec = String(raw.decorative ?? "").toLowerCase();
  if (dec === "none" || dec === "dots" || dec === "grid" || dec === "gradient_orbs") d.decorative = dec;
  const an = String(raw.animation ?? "")
    .toLowerCase()
    .replace(/-/g, "_");
  const animAllow = new Set<string>([
    "none",
    "fade_rise",
    "float_card",
    "pulse_cta",
    "shimmer_bg",
    "bounce_in",
  ]);
  if (animAllow.has(an)) d.animation = an as BlankAnimationPreset;
  const fp = String(raw.fontPreset ?? "").toLowerCase();
  const fonts: BlankFontPreset[] = ["system", "inter", "dm_sans", "playfair", "space_grotesk"];
  if (fonts.includes(fp as BlankFontPreset)) d.fontPreset = fp as BlankFontPreset;

  /** Gravações antigas sem esta chave seguem o comportamento anterior (logo oculta). */
  if (!("showLogo" in raw)) {
    d.showLogo = false;
  }

  return d;
}

export function blankCanvasToDbValue(c: BlankCanvasConfig): Record<string, unknown> {
  return {
    v: BLANK_CANVAS_VERSION,
    useSolidBg: !!c.useSolidBg,
    solidBg: clip(c.solidBg, 32),
    bgAngle: clamp(c.bgAngle, 0, 360),
    bgFrom: clip(c.bgFrom, 32),
    bgTo: clip(c.bgTo, 32),
    cardBg: clip(c.cardBg, 80),
    cardBorder: clip(c.cardBorder, 80),
    cardRadiusPx: clamp(Math.round(c.cardRadiusPx), 0, 48),
    cardShadowOpacity: clamp(c.cardShadowOpacity, 0, 1),
    glassCard: !!c.glassCard,
    maxContentWidthPx: clamp(Math.round(c.maxContentWidthPx), 320, 720),
    titleColor: clip(c.titleColor, 32),
    titleFontPx: clamp(Math.round(c.titleFontPx), 18, 48),
    titleAlign: c.titleAlign,
    showSubtitle: !!c.showSubtitle,
    subtitle: clip(c.subtitle, 120),
    subtitleColor: clip(c.subtitleColor, 80),
    subtitleFontPx: clamp(Math.round(c.subtitleFontPx), 11, 22),
    descColor: clip(c.descColor, 80),
    descFontPx: clamp(Math.round(c.descFontPx), 12, 22),
    textAlign: c.textAlign,
    btnBg: clip(c.btnBg, 32),
    btnText: clip(c.btnText, 32),
    btnRadiusPx: clamp(Math.round(c.btnRadiusPx), 0, 999),
    btnFullWidth: !!c.btnFullWidth,
    btnPulse: !!c.btnPulse,
    ctaPlacement: c.ctaPlacement,
    showLogo: !!c.showLogo,
    showHero: !!c.showHero,
    heroPath: c.heroPath && c.heroPath.trim() ? clip(c.heroPath.trim(), 512) : null,
    heroRadiusPx: clamp(Math.round(c.heroRadiusPx), 0, 40),
    bgImageEnabled: !!c.bgImageEnabled,
    bgImagePath: c.bgImagePath && c.bgImagePath.trim() ? clip(c.bgImagePath.trim(), 512) : null,
    bgImageFit: c.bgImageFit,
    bgImageRepeat: c.bgImageRepeat,
    bgImagePosition: c.bgImagePosition,
    decorative: c.decorative,
    animation: c.animation,
    fontPreset: c.fontPreset,
  };
}

export function fontCssStack(preset: BlankFontPreset): string {
  switch (preset) {
    case "inter":
      return '"Inter", system-ui, sans-serif';
    case "dm_sans":
      return '"DM Sans", system-ui, sans-serif';
    case "playfair":
      return '"Playfair Display", Georgia, serif';
    case "space_grotesk":
      return '"Space Grotesk", system-ui, sans-serif';
    default:
      return 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  }
}

export function googleFontHref(preset: BlankFontPreset): string | null {
  switch (preset) {
    case "inter":
      return "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    case "dm_sans":
      return "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap";
    case "playfair":
      return "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap";
    case "space_grotesk":
      return "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap";
    default:
      return null;
  }
}
