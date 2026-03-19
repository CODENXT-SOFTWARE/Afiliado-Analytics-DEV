import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const BlurReveal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealFrames = Math.round(fps * 1.2);
  const blur = interpolate(frame, [0, revealFrames], [20, 0], { extrapolateRight: "clamp" });
  const brightness = interpolate(frame, [0, revealFrames], [0.3, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, revealFrames], [1.2, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ filter: `blur(${blur}px) brightness(${brightness})`, transform: `scale(${scale})` }}>
      {children}
    </AbsoluteFill>
  );
};

const RevealFlash: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const flashStart = Math.round(fps * 1);
  const flashEnd = flashStart + Math.round(fps * 0.3);
  const opacity = interpolate(frame, [flashStart, flashStart + 4, flashEnd], [0, 0.9, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return <AbsoluteFill style={{ backgroundColor: "#FFF", opacity, pointerEvents: "none" }} />;
};

const MysteryText: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const revealFrames = Math.round(fps * 1);
  const opacity = interpolate(frame, [0, 10, revealFrames - 8, revealFrames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = spring({ fps, frame, config: { damping: 10, stiffness: 140 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", pointerEvents: "none", zIndex: 15 }}>
      <div style={{
        fontSize: 40, fontWeight: 900, color: "#FFF",
        fontFamily: "Arial Black, sans-serif",
        textShadow: "0 4px 24px rgba(0,0,0,0.8), 0 0 40px rgba(238,77,45,0.4)",
        opacity, transform: `scale(${scale})`, letterSpacing: 4,
      }}>
        REVELANDO...
      </div>
    </AbsoluteFill>
  );
};

export const UnboxingVideo: React.FC<VideoInputProps> = (props) => {
  const { media, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();

  const ordered = interleaveMedia(media);
  const ctaDuration = Math.round(fps * 3);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = ordered.length || 1;
  const framesPerScene = Math.max(fps * 2, Math.floor(contentFrames / scenesCount));
  const transitionFrames = Math.round(fps * 0.6);

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0a" }}>
      <TransitionSeries>
        {ordered.map((asset, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={framesPerScene}>
              <BlurReveal>
                <MediaScene asset={asset} effect="zoomIn" />
              </BlurReveal>
              {i === 0 && <MysteryText />}
              <RevealFlash />
              <AbsoluteFill style={{
                background: "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)",
                pointerEvents: "none",
              }} />
            </TransitionSeries.Sequence>
            {i < ordered.length - 1 && (
              <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionFrames })} />
            )}
          </React.Fragment>
        ))}
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(fps * 0.5) })} />
        <TransitionSeries.Sequence durationInFrames={ctaDuration}>
          <CTASlide text={ctaText || "Gostou? Link na bio"} productName={productName} />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio src={musicSrc} volume={(f) => {
          const vol = musicVolume ?? 0.15;
          const fadeIn = interpolate(f, [0, fps * 2], [0, vol], { extrapolateRight: "clamp" });
          const fadeOut = interpolate(f, [durationInFrames - fps * 2, durationInFrames], [vol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return Math.min(fadeIn, fadeOut);
        }} loop />
      )}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
