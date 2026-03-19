import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { PriceTag } from "../components/PriceTag";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const EFFECTS = ["zoomIn", "zoomOut", "panLeft", "panRight"] as const;

export const ShowcaseVideo: React.FC<VideoInputProps> = (props) => {
  const { media: rawMedia, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, price, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();
  const media = interleaveMedia(rawMedia);

  const ctaDuration = Math.round(fps * 2.5);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = media.length || 1;
  const framesPerScene = Math.max(fps, Math.floor(contentFrames / scenesCount));
  const transitionFrames = Math.min(Math.round(fps * 0.5), Math.floor(framesPerScene / 3));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {/* Media scenes with transitions */}
      <TransitionSeries>
        {media.map((asset, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={framesPerScene}>
              <MediaScene asset={asset} effect={EFFECTS[i % EFFECTS.length]} />
              {price && i === 0 && <PriceTag price={price} showAtFrame={Math.round(fps * 0.8)} />}
            </TransitionSeries.Sequence>
            {i < media.length - 1 && (
              <TransitionSeries.Transition
                presentation={i % 2 === 0 ? fade() : slide({ direction: "from-left" })}
                timing={linearTiming({ durationInFrames: transitionFrames })}
              />
            )}
          </React.Fragment>
        ))}
        {/* CTA final */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: Math.round(fps * 0.4) })}
        />
        <TransitionSeries.Sequence durationInFrames={ctaDuration}>
          <CTASlide text={ctaText || "Link na bio"} productName={productName} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Voiceover */}
      {voiceoverSrc && (
        <Audio src={voiceoverSrc} volume={1} />
      )}

      {/* Background music */}
      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(f) => {
            const vol = musicVolume ?? 0.15;
            const fadeOut = interpolate(f, [durationInFrames - fps * 2, durationInFrames], [vol, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return fadeOut;
          }}
          loop
        />
      )}

      {/* Captions overlay */}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
