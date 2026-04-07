import type { CaptureVipLandingProps } from "./capture-vip-types";
import CaptureOfertCarousel, {
  type CaptureOfertCarouselVariant,
} from "./CaptureOfertCarousel";
import {
  type OfertCarouselPosition,
  normalizeOfertCarouselPosition,
} from "@/lib/capture-ofert-carousel";

export function OfertCarouselAtSlot(props: {
  enabled: boolean;
  imageUrls: string[];
  position: OfertCarouselPosition | undefined;
  slot: OfertCarouselPosition;
  variant: CaptureOfertCarouselVariant;
  eyebrow?: string;
  bleed?: boolean;
  className?: string;
}) {
  const urls = props.imageUrls ?? [];
  if (!props.enabled || urls.length === 0) return null;
  if (normalizeOfertCarouselPosition(props.position) !== props.slot) return null;
  return (
    <CaptureOfertCarousel
      slides={urls.map((src, i) => ({ src, alt: `Destaque ${i + 1}` }))}
      variant={props.variant}
      eyebrow={props.eyebrow}
      bleed={props.bleed}
      className={props.className}
    />
  );
}

type Props = CaptureVipLandingProps & {
  slot: OfertCarouselPosition;
  variant: CaptureOfertCarouselVariant;
  eyebrow?: string;
  bleed?: boolean;
  className?: string;
};

export function CaptureOfertCarouselIf(p: Props) {
  const urls = p.ofertCarouselImageUrls ?? [];
  const enabled = p.ofertCarouselEnabled === true && urls.length > 0;
  return (
    <OfertCarouselAtSlot
      enabled={enabled}
      imageUrls={urls}
      position={p.ofertCarouselPosition}
      slot={p.slot}
      variant={p.variant}
      eyebrow={p.eyebrow}
      bleed={p.bleed}
      className={p.className}
    />
  );
}
