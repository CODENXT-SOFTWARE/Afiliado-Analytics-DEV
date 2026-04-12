"use client";

import type { VipRosaIconKey } from "@/lib/capture-promo-icons";
import { vipRosaLucideIcon } from "@/lib/vip-rosa-lucide-map";
import type { RosaLeadMode, VipRosaCardRow } from "@/lib/capture-promo-cards";

type Props = {
  row: VipRosaCardRow;
  iconTint: string;
  imagePublicUrl: string | null;
};

export function rosaLeadEffectiveMode(row: VipRosaCardRow, hasImageUrl: boolean): RosaLeadMode {
  if (row.lead_mode === "image") return hasImageUrl ? "image" : "icon";
  return row.lead_mode;
}

/** Ícone Lucide, emoji ou imagem — conforme `lead_mode` e URL disponível. */
export function CaptureRosaPromoLead({ row, iconTint, imagePublicUrl }: Props) {
  const mode = rosaLeadEffectiveMode(row, !!imagePublicUrl?.trim());
  if (mode === "image" && imagePublicUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imagePublicUrl}
        alt=""
        className="mt-0.5 h-9 w-9 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
      />
    );
  }
  if (mode === "emoji") {
    const em = row.emoji.trim();
    if (em) {
      return (
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center text-xl leading-none"
          aria-hidden
        >
          {em}
        </span>
      );
    }
  }
  const Icon = vipRosaLucideIcon(row.iconKey);
  return <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: iconTint }} aria-hidden />;
}
