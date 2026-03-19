import React from "react";
import { AbsoluteFill, Sequence, Audio, interpolate, useCurrentFrame, useVideoConfig, spring } from "remotion";
import type { VideoInputProps } from "../types";
import { MediaScene } from "../components/MediaScene";
import { AnimatedCaption } from "../components/AnimatedCaption";
import { CTASlide } from "../components/CTASlide";
import { interleaveMedia } from "../utils";

const EFFECTS = ["zoomIn", "panRight", "zoomOut", "panLeft"] as const;

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div style={{ position: "absolute", top: 40, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 8, zIndex: 20, pointerEvents: "none" }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const delay = star * 3;
        const pop = spring({ fps, frame: Math.max(0, frame - delay), config: { damping: 8, stiffness: 200 } });
        const filled = star <= rating;
        return (
          <div key={star} style={{ transform: `scale(${pop})`, fontSize: 40, filter: filled ? "drop-shadow(0 2px 8px rgba(255,215,0,0.6))" : "none" }}>
            {filled ? "⭐" : "☆"}
          </div>
        );
      })}
    </div>
  );
};

const ReviewBadge: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ fps, frame: Math.max(0, frame - 15), config: { damping: 10, stiffness: 150 } });

  return (
    <div style={{
      position: "absolute", top: 100, right: 30,
      backgroundColor: "#22c55e", borderRadius: 16, padding: "8px 20px",
      transform: `scale(${scale})`, boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
      zIndex: 20, pointerEvents: "none",
    }}>
      <span style={{ color: "#FFF", fontSize: 22, fontWeight: 900, fontFamily: "Arial Black, sans-serif" }}>APROVADO ✓</span>
    </div>
  );
};

export const ReviewRapidoVideo: React.FC<VideoInputProps> = (props) => {
  const { media, voiceoverSrc, musicSrc, musicVolume, captions, subtitleTheme, ctaText, productName, durationInFrames } = props;
  const { fps } = useVideoConfig();

  const ordered = interleaveMedia(media);
  const ctaDuration = Math.round(fps * 2.5);
  const contentFrames = durationInFrames - ctaDuration;
  const scenesCount = ordered.length || 1;
  const framesPerScene = Math.max(fps, Math.floor(contentFrames / scenesCount));

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {ordered.map((asset, i) => {
        const from = i * framesPerScene;
        return (
          <Sequence key={i} from={from} durationInFrames={framesPerScene}>
            <MediaScene asset={asset} effect={EFFECTS[i % EFFECTS.length]} />
            {i === 0 && <StarRating rating={5} />}
            {i === Math.floor(ordered.length / 2) && <ReviewBadge />}
          </Sequence>
        );
      })}

      <Sequence from={contentFrames} durationInFrames={ctaDuration}>
        <CTASlide text={ctaText || "Recomendo!"} productName={productName} />
      </Sequence>

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
