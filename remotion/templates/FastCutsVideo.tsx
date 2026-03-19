import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

export const FastCutsVideo: React.FC<VideoInputProps> = (props) => {
  const { media: rawMedia, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const media = interleaveMedia(rawMedia);

  const ctaDuration = Math.round(fps * 2);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = media.length || 1;
  const framesPerScene = Math.max(Math.round(fps * 0.6), Math.floor(contentFrames / scenesCount));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {media.map((asset, i) => {
        const from = i * framesPerScene;
        return (
          <Sequence key={i} from={from} durationInFrames={framesPerScene}>
            <MediaScene asset={asset} effect={i % 2 === 0 ? "zoomIn" : "zoomOut"} />
            {/* Flash branco no cut */}
            <FlashOverlay />
          </Sequence>
        );
      })}

      <Sequence from={contentFrames} durationInFrames={ctaDuration}>
        <CTASlide text={ctaText || "Corre! Link na bio"} productName={productName} />
      </Sequence>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio
          src={musicSrc}
          volume={(f) => {
            const vol = musicVolume ?? 0.2;
            return interpolate(f, [durationInFrames - fps, durationInFrames], [vol, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
          }}
          loop
        />
      )}

      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};

const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(fps * 0.15)], [0.6, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#FFF",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};
