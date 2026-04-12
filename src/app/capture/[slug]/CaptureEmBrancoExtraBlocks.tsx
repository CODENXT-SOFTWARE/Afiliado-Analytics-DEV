"use client";

import { useEffect, useMemo } from "react";
import {
  type CaptureBlockPosition,
  DEFAULT_YOUTUBE_POSITION,
  normalizeCaptureBlockPosition,
} from "@/lib/capture-block-position";
import type { NotificationsPosition } from "@/lib/capture-notifications";
import { normalizeOfertCarouselPosition } from "@/lib/capture-ofert-carousel";
import { normalizeVipRosaCardsFromDb } from "@/lib/capture-promo-cards";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";
import { promoRosaGoogleFontHref, resolvePromoRosaUi } from "@/lib/capture-promo-rosa-ui";
import { CaptureRosaPromoLead } from "./CaptureRosaPromoLead";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import { OfertCarouselAtSlot } from "./CaptureOfertCarouselIf";

export type EmBrancoCardMediaBundle = {
  youtubeUrl?: string | null;
  youtubePosition?: CaptureBlockPosition;
  ofertCarouselEnabled?: boolean;
  ofertCarouselPosition?: CaptureBlockPosition;
  ofertCarouselImageUrls?: string[];
  promoSectionsEnabled?: boolean;
  promoTitles?: { benefits: string; testimonials: string; inGroup: string };
  promoCards?: unknown;
  accentColor: string;
  promoRosaUi?: unknown;
  promoRosaCardImageUrls?: (string | null)[];
};

export function emBrancoMediaVisibleForSlots(
  bundle: EmBrancoCardMediaBundle,
  allowedSlots: readonly CaptureBlockPosition[],
): boolean {
  const urls = bundle.ofertCarouselImageUrls ?? [];
  const carouselOn = bundle.ofertCarouselEnabled === true && urls.length > 0;
  const yt = (bundle.youtubeUrl ?? "").trim();
  const normYt = normalizeCaptureBlockPosition(bundle.youtubePosition, DEFAULT_YOUTUBE_POSITION);
  const normOc = normalizeOfertCarouselPosition(bundle.ofertCarouselPosition);
  for (const slot of allowedSlots) {
    if (carouselOn && normOc === slot) return true;
    if (yt && normYt === slot) return true;
  }
  return false;
}

export function emBrancoShowsPromoInCard(bundle: EmBrancoCardMediaBundle): boolean {
  if (bundle.promoSectionsEnabled === false) return false;
  return normalizeVipRosaCardsFromDb(bundle.promoCards).length > 0;
}

export function emBrancoShowsAfterCta(bundle: EmBrancoCardMediaBundle): boolean {
  return emBrancoMediaVisibleForSlots(bundle, ["below_cta", "card_end"]) || emBrancoShowsPromoInCard(bundle);
}

function accentDeepFrom(accent: string): string {
  const { r, g, b } = parseColorToRgb(accent);
  const d = (x: number) => Math.max(0, Math.min(255, Math.floor(x * 0.42)));
  return `rgb(${d(r)}, ${d(g)}, ${d(b)})`;
}

export function CaptureEmBrancoToastsOnly(props: {
  notificationsEnabled?: boolean;
  notificationsPosition?: NotificationsPosition;
}) {
  const notifOn = props.notificationsEnabled !== false;
  const notifPos = props.notificationsPosition ?? "top_right";
  return <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />;
}

/** Carrossel + YouTube só nos `allowedSlots` (ex.: zona «below_title» dentro do cartão). */
export function CaptureEmBrancoCardMedia(
  props: EmBrancoCardMediaBundle & {
    allowedSlots: readonly CaptureBlockPosition[];
  },
) {
  const {
    youtubeUrl,
    youtubePosition,
    ofertCarouselEnabled,
    ofertCarouselPosition,
    ofertCarouselImageUrls,
    allowedSlots,
  } = props;

  const urls = ofertCarouselImageUrls ?? [];
  const carouselOn = ofertCarouselEnabled === true && urls.length > 0;
  const yt = (youtubeUrl ?? "").trim();
  const normYt = normalizeCaptureBlockPosition(youtubePosition, DEFAULT_YOUTUBE_POSITION);
  const normOc = normalizeOfertCarouselPosition(ofertCarouselPosition);

  const nodes = allowedSlots.flatMap((slot) => {
    const hasC = carouselOn && normOc === slot;
    const hasY = !!yt && normYt === slot;
    if (!hasC && !hasY) return [];
    return [
      <div key={`em-card-media-${slot}`} className="w-full min-w-0 space-y-4">
        <OfertCarouselAtSlot
          enabled={carouselOn}
          imageUrls={urls}
          position={ofertCarouselPosition}
          slot={slot}
          variant="light"
          eyebrow="Destaques"
          className="w-full"
        />
        <CaptureYoutubeAtSlot
          url={youtubeUrl}
          position={youtubePosition}
          slot={slot}
          className="w-full"
          classNameEmbed="shadow-lg rounded-xl overflow-hidden"
        />
      </div>,
    ];
  });

  if (nodes.length === 0) return null;
  return <div className="w-full min-w-0 space-y-4">{nodes}</div>;
}

export function CaptureEmBrancoPromoInCard(props: EmBrancoCardMediaBundle) {
  const { promoSectionsEnabled, promoTitles, promoCards, accentColor, promoRosaUi, promoRosaCardImageUrls } = props;
  const promoOn = promoSectionsEnabled !== false;
  const benefitsHeading =
    (promoTitles?.benefits ?? "").trim() || "O que você vai encontrar:";
  const rosaRows = useMemo(() => normalizeVipRosaCardsFromDb(promoCards), [promoCards]);
  const accent = (accentColor || "").trim() || "#25D366";
  const accentDeep = accentDeepFrom(accent);

  const ui = useMemo(
    () => resolvePromoRosaUi("em_branco", promoRosaUi, accent, null),
    [promoRosaUi, accent],
  );

  useEffect(() => {
    const href = promoRosaGoogleFontHref(ui.fontPreset);
    if (!href || typeof document === "undefined") return;
    const id = "capture-promo-rosa-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [ui.fontPreset]);

  if (!promoOn || rosaRows.length === 0) return null;

  return (
    <div
      className="w-full min-w-0 rounded-2xl border p-4 shadow-inner backdrop-blur-sm"
      style={{
        backgroundColor: ui.sectionBg,
        borderColor: ui.sectionBorder,
        fontFamily: ui.fontFamilyCss,
      }}
    >
      <p
        className="mb-3 text-center font-black uppercase tracking-wide"
        style={{ color: ui.headingColor, fontSize: ui.headingFontPx }}
      >
        {benefitsHeading}
      </p>
      <div className="space-y-3.5">
        {rosaRows.map((row, i) => (
          <div
            key={`em-branco-benefit-${i}`}
            className="flex items-start gap-3 rounded-xl border p-3 shadow-sm"
            style={{
              borderColor: ui.cardBorder,
              backgroundColor: ui.cardBg,
              borderLeftWidth: 3,
              borderLeftStyle: "solid",
              borderLeftColor: ui.leftAccent,
            }}
          >
            <CaptureRosaPromoLead
              row={row}
              iconTint={accentDeep}
              imagePublicUrl={promoRosaCardImageUrls?.[i] ?? null}
            />
            <div className="min-w-0 text-left">
              <h3 className="mb-1 font-black uppercase" style={{ color: ui.titleColor, fontSize: ui.titleFontPx }}>
                {row.title}
              </h3>
              <p className="leading-snug" style={{ color: ui.bodyColor, fontSize: ui.bodyFontPx }}>
                {row.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
