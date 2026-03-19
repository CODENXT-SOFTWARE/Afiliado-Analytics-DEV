import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { PriceTag } from "../components/PriceTag";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const ShakeWrapper: React.FC<{ children: React.ReactNode; intensity?: number }> = ({ children, intensity = 1 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shakeWindow = 4;
  const isShaking = frame < shakeWindow;
  const x = isShaking ? Math.sin(frame * 8) * 6 * intensity : 0;
  const y = isShaking ? Math.cos(frame * 6) * 4 * intensity : 0;

  return (
    <AbsoluteFill style={{ transform: `translate(${x}px, ${y}px)` }}>
      {children}
    </AbsoluteFill>
  );
};

const TimerBadge: React.FC<{ totalSeconds: number }> = ({ totalSeconds }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame / fps;
  const remaining = Math.max(0, totalSeconds - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = Math.floor(remaining % 60);

  const pulse = Math.sin(frame * 0.4) * 0.05 + 1;

  return (
    <div style={{
      position: "absolute", top: 30, right: 24,
      backgroundColor: "#dc2626", borderRadius: 14, padding: "8px 18px",
      display: "flex", alignItems: "center", gap: 8,
      boxShadow: "0 4px 20px rgba(220,38,38,0.5)",
      transform: `scale(${pulse})`, zIndex: 20, pointerEvents: "none",
    }}>
      <span style={{ fontSize: 16, fontWeight: 900, color: "#FFF", fontFamily: "Arial, sans-serif" }}>⏰</span>
      <span style={{ fontSize: 24, fontWeight: 900, color: "#FFF", fontFamily: "monospace", letterSpacing: 2 }}>
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </span>
    </div>
  );
};

const FlashOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, Math.round(fps * 0.12)], [0.8, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ backgroundColor: "#EE4D2D", opacity, pointerEvents: "none" }} />;
};

const UrgencyBanner: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame, config: { damping: 8, stiffness: 180 } });

  return (
    <div style={{
      position: "absolute", top: 30, left: 0, right: 0,
      display: "flex", justifyContent: "center", zIndex: 20, pointerEvents: "none",
    }}>
      <div style={{
        backgroundColor: "#EE4D2D", borderRadius: 12, padding: "6px 24px",
        transform: `scale(${scale})`, boxShadow: "0 4px 16px rgba(238,77,45,0.5)",
      }}>
        <span style={{ color: "#FFF", fontSize: 20, fontWeight: 900, fontFamily: "Arial Black, sans-serif", letterSpacing: 2 }}>
          🔥 OFERTA RELÂMPAGO 🔥
        </span>
      </div>
    </div>
  );
};

export const FlashSaleVideo: React.FC<VideoInputProps> = (props) => {
  const { media, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, price, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();

  const ordered = interleaveMedia(media);
  const ctaDuration = Math.round(fps * 2.5);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = ordered.length || 1;
  const framesPerScene = Math.max(Math.round(fps * 0.8), Math.floor(contentFrames / scenesCount));
  const totalSeconds = Math.ceil(durationInFrames / fps);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ordered.map((asset, i) => {
        const from = i * framesPerScene;
        return (
          <Sequence key={i} from={from} durationInFrames={framesPerScene}>
            <ShakeWrapper intensity={1.2}>
              <MediaScene asset={asset} effect={i % 2 === 0 ? "zoomIn" : "zoomOut"} />
            </ShakeWrapper>
            <FlashOverlay />
            {i === 0 && <UrgencyBanner />}
            {price && i === 0 && <PriceTag price={price} showAtFrame={Math.round(fps * 0.5)} />}
          </Sequence>
        );
      })}

      <TimerBadge totalSeconds={totalSeconds} />

      <Sequence from={contentFrames} durationInFrames={ctaDuration}>
        <CTASlide text={ctaText || "Compre agora!"} productName={productName} />
      </Sequence>

      {voiceoverSrc && <Audio src={voiceoverSrc} volume={1} />}
      {musicSrc && (
        <Audio src={musicSrc} volume={(f) => {
          const vol = musicVolume ?? 0.2;
          return interpolate(f, [durationInFrames - fps, durationInFrames], [vol, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
        }} loop />
      )}
      {captions.length > 0 && <AnimatedCaption captions={captions} theme={subtitleTheme} />}
    </AbsoluteFill>
  );
};
