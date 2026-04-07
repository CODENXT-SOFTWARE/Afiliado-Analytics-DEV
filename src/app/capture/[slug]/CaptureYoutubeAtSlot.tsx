"use client";

import CaptureYoutubeEmbed from "./CaptureYoutubeEmbed";
import {
  type CaptureBlockPosition,
  DEFAULT_YOUTUBE_POSITION,
  normalizeCaptureBlockPosition,
} from "@/lib/capture-block-position";

type Props = {
  url: string | null | undefined;
  position: CaptureBlockPosition | undefined;
  slot: CaptureBlockPosition;
  /** Classe no wrapper externo (margens). */
  className?: string;
  /** Classe extra no `CaptureYoutubeEmbed` (ex.: sombra do template). */
  classNameEmbed?: string;
  /** Texto acima do player; omitir ou null = sem rótulo. */
  eyebrow?: string | null;
  eyebrowClassName?: string;
};

export function CaptureYoutubeAtSlot({
  url,
  position,
  slot,
  className = "mt-6 w-full",
  classNameEmbed = "",
  eyebrow,
  eyebrowClassName,
}: Props) {
  const yt = (url ?? "").trim();
  if (!yt) return null;
  if (normalizeCaptureBlockPosition(position, DEFAULT_YOUTUBE_POSITION) !== slot) return null;

  const showEyebrow = typeof eyebrow === "string" && eyebrow.trim().length > 0;

  return (
    <div className={className}>
      {showEyebrow ? (
        <p
          className={
            eyebrowClassName ??
            "mb-2 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500"
          }
        >
          {eyebrow}
        </p>
      ) : null}
      <CaptureYoutubeEmbed url={yt} className={classNameEmbed} />
    </div>
  );
}
