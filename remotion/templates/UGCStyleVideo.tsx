import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const EFFECTS = ["zoomIn", "panRight", "zoomOut", "panLeft"] as const;

const HandheldShake: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const x = Math.sin(frame * 0.3) * 2.5 + Math.cos(frame * 0.7) * 1.5;
  const y = Math.cos(frame * 0.4) * 2 + Math.sin(frame * 0.6) * 1;
  const rotate = Math.sin(frame * 0.2) * 0.4;

  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px) rotate(${rotate}deg)` }}>
      {children}
    </AbsoluteFill>
  );
};

const UGCFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    {children}
    <AbsoluteFill style={{ border: "8px solid rgba(255,255,255,0.15)", borderRadius: 28, pointerEvents: "none", boxSizing: "border-box" }} />
    <div style={{ position: "absolute", top: 16, left: 20, display: "flex", alignItems: "center", gap: 8, zIndex: 10, pointerEvents: "none" }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.6)" }} />
      <span style={{ color: "#FFF", fontSize: 14, fontWeight: 700, fontFamily: "Arial, sans-serif", opacity: 0.8 }}>REC</span>
    </div>
  </AbsoluteFill>
);

export const UGCStyleVideo: React.FC<VideoInputProps> = (props) => {
  const { media, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();

  const ordered = interleaveMedia(media);
  const ctaDuration = Math.round(fps * 2.5);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = ordered.length || 1;
  const framesPerScene = Math.max(fps * 1.5, Math.floor(contentFrames / scenesCount));
  const transitionFrames = Math.round(fps * 0.6);

  return (
    <AbsoluteFill style={{ backgroundColor: "#111" }}>
      <HandheldShake>
        <TransitionSeries>
          {ordered.map((asset, i) => (
            <React.Fragment key={i}>
              <TransitionSeries.Sequence durationInFrames={framesPerScene}>
                <UGCFrame>
                  <MediaScene asset={asset} effect={EFFECTS[i % EFFECTS.length]} />
                </UGCFrame>
              </TransitionSeries.Sequence>
              {i < ordered.length - 1 && (
                <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: transitionFrames })} />
              )}
            </React.Fragment>
          ))}
          <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: Math.round(fps * 0.4) })} />
          <TransitionSeries.Sequence durationInFrames={ctaDuration}>
            <CTASlide text={ctaText || "Link na bio"} productName={productName} />
          </TransitionSeries.Sequence>
        </TransitionSeries>
      </HandheldShake>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio src={musicSrc} volume={(f) => {
          const vol = musicVolume ?? 0.12;
          return interpolate(f, [durationInFrames - fps * 2, durationInFrames], [vol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} loop />
      )}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
