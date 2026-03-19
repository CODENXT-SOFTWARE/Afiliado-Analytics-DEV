export type MediaAsset = {
  type: "image" | "video";
  src: string;
  durationInSeconds?: number;
};

export type CaptionWord = {
  text: string;
  startMs: number;
  endMs: number;
};

export type VideoStyleId =
  | "showcase"
  | "storytelling"
  | "fastCuts"
  | "beforeAfter"
  | "reviewRapido"
  | "ugcStyle"
  | "flashSale"
  | "unboxing";

export type SubtitleTheme = {
  fontFamily: string;
  fontSize: number;
  color: string;
  strokeColor: string;
  strokeWidth: number;
  bgColor: string;
  position: "top" | "center" | "bottom";
};

export type VideoInputProps = {
  style: VideoStyleId;
  media: MediaAsset[];
  voiceoverSrc: string | null;
  musicSrc: string | null;
  musicVolume: number;
  captions: CaptionWord[];
  subtitleTheme: SubtitleTheme;
  productName: string;
  price: string;
  ctaText: string;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

export const SUBTITLE_THEMES: Record<string, SubtitleTheme> = {
  tiktokBold: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 52,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  capcut: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 48,
    color: "#FFFF00",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "rgba(0,0,0,0.5)",
    position: "bottom",
  },
  classico: {
    fontFamily: "Arial, sans-serif",
    fontSize: 40,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 2,
    bgColor: "rgba(0,0,0,0.7)",
    position: "bottom",
  },
  shopeeOrange: {
    fontFamily: "Arial, sans-serif",
    fontSize: 44,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "#EE4D2D",
    position: "bottom",
  },
  neon: {
    fontFamily: "Impact, sans-serif",
    fontSize: 50,
    color: "#00FF88",
    strokeColor: "#000000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  hormozi: {
    fontFamily: "Impact, sans-serif",
    fontSize: 64,
    color: "#FFFFFF",
    strokeColor: "#000000",
    strokeWidth: 6,
    bgColor: "transparent",
    position: "center",
  },
  karaoke: {
    fontFamily: "Arial Black, sans-serif",
    fontSize: 48,
    color: "#FFD700",
    strokeColor: "#000000",
    strokeWidth: 3,
    bgColor: "transparent",
    position: "bottom",
  },
  retro: {
    fontFamily: "Impact, sans-serif",
    fontSize: 50,
    color: "#FF69B4",
    strokeColor: "#4B0082",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
  editorial: {
    fontFamily: "Georgia, serif",
    fontSize: 36,
    color: "#F0F0F0",
    strokeColor: "#000000",
    strokeWidth: 1,
    bgColor: "rgba(0,0,0,0.65)",
    position: "bottom",
  },
  fire: {
    fontFamily: "Impact, sans-serif",
    fontSize: 54,
    color: "#FF4500",
    strokeColor: "#8B0000",
    strokeWidth: 4,
    bgColor: "transparent",
    position: "center",
  },
};

export const VIDEO_STYLES: Record<VideoStyleId, { label: string; description: string }> = {
  showcase: {
    label: "Showcase Produto",
    description: "Imagens com zoom suave, preço animado, CTA no final",
  },
  storytelling: {
    label: "Storytelling",
    description: "Cenas em sequência com narração, legendas word-by-word",
  },
  fastCuts: {
    label: "Cortes Rápidos",
    description: "Imagens alternando rápido com texto grande e impacto",
  },
  beforeAfter: {
    label: "Antes & Depois",
    description: "Comparação lado a lado com transição wipe horizontal",
  },
  reviewRapido: {
    label: "Review Rápido",
    description: "Mix de mídias com overlay de estrelas e avaliação",
  },
  ugcStyle: {
    label: "UGC Orgânico",
    description: "Estilo casual com tremor de câmera e bordas arredondadas",
  },
  flashSale: {
    label: "Flash Sale",
    description: "Urgência com timer animado, cores vibrantes e shake",
  },
  unboxing: {
    label: "Unboxing Reveal",
    description: "Revelação misteriosa com blur, zoom dramático e suspense",
  },
};
