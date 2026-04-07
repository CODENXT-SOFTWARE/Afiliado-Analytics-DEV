import {
  type CaptureBlockPosition,
  CAPTURE_BLOCK_POSITION_OPTIONS,
  DEFAULT_OFERT_CAROUSEL_POSITION,
  normalizeCaptureBlockPosition,
} from "@/lib/capture-block-position";

export type OfertCarouselPosition = CaptureBlockPosition;

export const OFERT_CAROUSEL_POSITION_OPTIONS = CAPTURE_BLOCK_POSITION_OPTIONS;

export { DEFAULT_OFERT_CAROUSEL_POSITION };

export function normalizeOfertCarouselPosition(v: unknown): OfertCarouselPosition {
  return normalizeCaptureBlockPosition(v, DEFAULT_OFERT_CAROUSEL_POSITION);
}

/** Quatro slots (índices 0–3); null = vazio. */
export function normalizeOfertCarouselSlots(v: unknown): (string | null)[] {
  const empty: (string | null)[] = [null, null, null, null];
  if (!Array.isArray(v)) return empty;
  for (let i = 0; i < 4; i++) {
    const x = v[i];
    if (typeof x === "string" && x.trim()) empty[i] = x.trim();
    else empty[i] = null;
  }
  return empty;
}

/** URLs públicas só dos slots preenchidos (ordem preservada). */
export function carouselPublicUrls(
  slots: (string | null)[],
  getPublicUrl: (path: string) => string | null,
): string[] {
  const out: string[] = [];
  for (const p of slots) {
    if (!p) continue;
    const u = getPublicUrl(p);
    if (u) out.push(u);
  }
  return out;
}
