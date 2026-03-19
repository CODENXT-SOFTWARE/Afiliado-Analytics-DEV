import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";

const BouncingArrow: React.FC<{ fps: number; frame: number }> = ({ fps, frame }) => {
  const cycleLength = fps * 0.8;
  const loopFrame = frame % cycleLength;
  const bounce = spring({
    fps,
    frame: loopFrame,
    config: { damping: 6, stiffness: 120, mass: 0.5 },
    durationInFrames: cycleLength,
  });
  const y = interpolate(bounce, [0, 1], [0, 28]);

  return (
    <div style={{ transform: `translateY(${y}px)`, display: "flex", flexDirection: "column", alignItems: "center", gap: 0 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        <path
          d="M60 10 L60 90 M30 65 L60 95 L90 65"
          stroke="#EE4D2D"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export const CTASlide: React.FC<{
  text: string;
  productName?: string;
}> = ({ text, productName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgScale = spring({ fps, frame, config: { damping: 20, stiffness: 100 } });
  const textOpacity = interpolate(frame, [4, 16], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrowDelay = 10;
  const arrowOpacity = interpolate(frame, [arrowDelay, arrowDelay + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [14, 26], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(135deg, #EE4D2D 0%, #D43B1A 60%, #1a1a2e 100%)",
        justifyContent: "center",
        alignItems: "center",
        transform: `scale(${bgScale})`,
      }}
    >
      <div style={{ textAlign: "center", padding: "0 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: "#FFF",
            fontFamily: "Arial Black, sans-serif",
            textShadow: "0 4px 24px rgba(0,0,0,0.4)",
            lineHeight: 1.2,
            opacity: textOpacity,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {text}
        </div>

        <div style={{ opacity: arrowOpacity, marginTop: 8 }}>
          <BouncingArrow fps={fps} frame={Math.max(0, frame - arrowDelay)} />
        </div>

        {productName && (
          <div
            style={{
              fontSize: 22,
              color: "rgba(255,255,255,0.7)",
              fontFamily: "Arial, sans-serif",
              opacity: subtitleOpacity,
              marginTop: 4,
            }}
          >
            {productName}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
