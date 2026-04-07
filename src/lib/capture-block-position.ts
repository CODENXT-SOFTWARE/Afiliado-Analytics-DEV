/** Posição partilhada: YouTube embed e carrossel de ofertas na página de captura. */
export type CaptureBlockPosition = "below_title" | "above_cta" | "below_cta" | "card_end";

export const CAPTURE_BLOCK_POSITION_OPTIONS: { value: CaptureBlockPosition; label: string }[] = [
  { value: "below_title", label: "Abaixo do título" },
  { value: "above_cta", label: "Acima do botão" },
  { value: "below_cta", label: "Abaixo do botão" },
  { value: "card_end", label: "No fim do card" },
];

/** Maioria dos templates tinha o vídeo antes do CTA principal. */
export const DEFAULT_YOUTUBE_POSITION: CaptureBlockPosition = "above_cta";

/** Default histórico do carrossel. */
export const DEFAULT_OFERT_CAROUSEL_POSITION: CaptureBlockPosition = "below_title";

export function normalizeCaptureBlockPosition(
  v: unknown,
  fallback: CaptureBlockPosition,
): CaptureBlockPosition {
  if (v === "below_title" || v === "above_cta" || v === "below_cta" || v === "card_end") return v;
  return fallback;
}

export function normalizeYoutubePosition(v: unknown): CaptureBlockPosition {
  return normalizeCaptureBlockPosition(v, DEFAULT_YOUTUBE_POSITION);
}
