import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const WipeReveal: React.FC<{
  children: [React.ReactNode, React.ReactNode];
}> = ({ children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const holdFirst = Math.round(fps * 1.2);
  const wipeFrames = Math.round(fps * 0.8);
  const progress = interpolate(frame, [holdFirst, holdFirst + wipeFrames], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill>
      <AbsoluteFill>{children[0]}</AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 0 0 ${progress}%)` }}>{children[1]}</AbsoluteFill>
      <div
        style={{
          position: "absolute",
          left: `${progress}%`,
          top: 0,
          bottom: 0,
          width: 6,
          backgroundColor: "#EE4D2D",
          boxShadow: "0 0 20px rgba(238,77,45,0.6)",
          transform: "translateX(-50%)",
          zIndex: 10,
          opacity: progress > 0 && progress < 100 ? 1 : 0,
        }}
      />
      {frame < holdFirst + 4 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#FFF", fontFamily: "Arial Black, sans-serif", textShadow: "0 2px 16px rgba(0,0,0,0.7)", opacity: interpolate(frame, [0, 10, holdFirst - 4, holdFirst], [0, 1, 1, 0], { extrapolateRight: "clamp" }) }}>
            ANTES
          </div>
        </AbsoluteFill>
      )}
      {progress > 50 && (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none" }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#EE4D2D", fontFamily: "Arial Black, sans-serif", textShadow: "0 2px 16px rgba(0,0,0,0.7)", opacity: interpolate(progress, [50, 80], [0, 1], { extrapolateRight: "clamp" }) }}>
            DEPOIS
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

export const BeforeAfterVideo: React.FC<VideoInputProps> = (props) => {
  const { media, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();

  const ordered = interleaveMedia(media);
  const ctaDuration = Math.round(fps * 3);
  const contentFrames = durationInFrames - ctaDuration;
  const pairs = Math.max(1, Math.floor(ordered.length / 2));
  const framesPerPair = Math.max(fps * 3, Math.floor(contentFrames / pairs));

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <TransitionSeries>
        {Array.from({ length: pairs }).map((_, i) => {
          const a = ordered[i * 2] ?? ordered[0];
          const b = ordered[i * 2 + 1] ?? ordered[Math.min(1, ordered.length - 1)];
          return (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={framesPerPair}>
                <WipeReveal>
                  <MediaScene asset={a} effect="none" />
                  <MediaScene asset={b} effect="none" />
                </WipeReveal>
              </TransitionSeries.Sequence>
              {i < pairs - 1 && (
                <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(fps * 0.5) })} />
              )}
            </React.Fragment>
          );
        })}
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(fps * 0.5) })} />
        <TransitionSeries.Sequence durationInFrames={ctaDuration}>
          <CTASlide text={ctaText || "Veja a diferença"} productName={productName} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio src={musicSrc} volume={(f) => {
          const vol = musicVolume ?? 0.15;
          return interpolate(f, [durationInFrames - fps * 2, durationInFrames], [vol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} loop />
      )}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
