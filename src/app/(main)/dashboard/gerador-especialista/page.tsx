"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import Image, { type StaticImageData } from "next/image";
import type { LucideIcon } from "lucide-react";
import {
  Upload,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  Image as ImageIcon,
  Video,
  Film,
  Download,
  AlertCircle,
  Mic,
  CheckCircle2,
  X,
  Camera,
  Info,
} from "lucide-react";
import ProFeatureGate from "../ProFeatureGate";
import {
  FEMALE_PRESETS,
  MALE_PRESETS,
  SCENE_CHIPS,
  POSE_CHIPS,
  STYLE_CHIPS,
  IMPROVEMENT_CHIPS,
  VIDEO_MOTION_CHIPS,
} from "@/lib/expert-generator/constants";
import {
  DEFAULT_IMAGE_PROMPT,
  DEFAULT_VIDEO_PROMPT,
} from "@/lib/expert-generator/build-prompt";
import { compressImageFileToMaxBytes } from "@/lib/compress-image-client";
import { humanizeLargeRequestError } from "@/lib/humanize-fetch-error";
import camilleCardImg from "@/lib/expert-generator/expert/camille/card.png";
import evyCardImg from "@/lib/expert-generator/expert/evy/card.jpeg";
import luanaCardImg from "@/lib/expert-generator/expert/luana/card.jpeg";
import mariaCardImg from "@/lib/expert-generator/expert/maria/card.jpeg";
import milenaCardImg from "@/lib/expert-generator/expert/milena/card.png";
import mikoCardImg from "@/lib/expert-generator/expert/miko/card.png";
import rosaCardImg from "@/lib/expert-generator/expert/rosa/card.jpeg";
import sophiaCardImg from "@/lib/expert-generator/expert/sophia/card.png";

const PRESET_THUMB_BY_ID: Partial<Record<string, StaticImageData>> = {
  milena: milenaCardImg,
  miko: mikoCardImg,
  camille: camilleCardImg,
  maria: mariaCardImg,
  sophia: sophiaCardImg,
  rosa: rosaCardImg,
  luana: luanaCardImg,
  evy: evyCardImg,
};

/** Alinhado ao Gerador de Criativos (`video-editor/page.tsx`). */
const inputCls =
  "w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 px-3.5 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange/70 focus:ring-1 focus:ring-shopee-orange/20 transition-all";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-shopee-orange/90 active:scale-[0.98] disabled:opacity-40 transition-all shadow-[0_4px_16px_rgba(238,77,45,0.3)]";
const btnSecondary =
  "inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/5 hover:border-dark-border/80 active:scale-[0.98] transition-all";

const STEPS = [
  { id: 1, title: "Produto", icon: ImageIcon },
  { id: 2, title: "Cenário", icon: User },
  { id: 3, title: "Imagem IA", icon: Sparkles },
  { id: 4, title: "Vídeo", icon: Film },
] as const;

/** Tooltip estilo Gerador de Criativos / video-editor: portal, fundo #111, seta inferior. */
function HintTooltip({
  text,
  wide,
  extraWide,
}: {
  text: string;
  wide?: boolean;
  extraWide?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({
      top: rect.top + window.scrollY - 8,
      left: rect.left + rect.width / 2 + window.scrollX,
    });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const widthCls = extraWide
    ? "w-[min(22rem,calc(100vw-2rem))]"
    : wide
      ? "w-72"
      : "w-56";
  const tip = visible
    ? createPortal(
        <span
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            transform: "translate(-50%, -100%)",
            zIndex: 99999,
          }}
          className={`pointer-events-none ${widthCls} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#e5e5e5] leading-relaxed whitespace-normal block`}
        >
          {text}
          <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
        </span>,
        document.body
      )
    : null;
  return (
    <span
      ref={anchorRef}
      className="inline-flex items-center shrink-0 cursor-help"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors">
        <Info className="h-2.5 w-2.5" />
      </span>
      {tip}
    </span>
  );
}

function FieldLabel({
  children,
  hint,
  tooltip,
  tooltipWide,
  tooltipExtraWide,
  className,
}: {
  children: React.ReactNode;
  hint?: string;
  tooltip?: string;
  tooltipWide?: boolean;
  tooltipExtraWide?: boolean;
  className?: string;
}) {
  return (
    <div className={className ? `mb-1.5 ${className}` : "mb-1.5"}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-text-secondary/60 uppercase tracking-wide">
        <span>{children}</span>
        {tooltip ? (
          <HintTooltip
            text={tooltip}
            wide={tooltipWide}
            extraWide={tooltipExtraWide}
          />
        ) : null}
      </div>
      {hint && !tooltip ? (
        <p className="text-[10px] text-text-secondary/45 mt-0.5 leading-snug">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function PersonalizedFieldSwitch({
  checked,
  onCheckedChange,
  label,
  description,
  infoTooltip,
  infoTooltipWide,
  infoTooltipExtraWide,
  ariaLabel,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  label: string;
  description?: string;
  infoTooltip?: string;
  infoTooltipWide?: boolean;
  infoTooltipExtraWide?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="rounded-xl border border-dark-border bg-dark-bg/45 px-3.5 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text-primary flex items-center gap-1.5 flex-wrap">
          {label}
          {infoTooltip ? (
            <HintTooltip
              text={infoTooltip}
              wide={infoTooltipWide}
              extraWide={infoTooltipExtraWide}
            />
          ) : null}
        </p>
        {description && !infoTooltip ? (
          <p className="text-[11px] text-text-secondary/80 mt-0.5 leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        onClick={() => onCheckedChange(!checked)}
        className={`relative h-8 w-[3.25rem] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-shopee-orange/50 ${
          checked ? "bg-shopee-orange" : "bg-dark-border/90"
        }`}
      >
        <span
          className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            checked ? "translate-x-[1.35rem]" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function CardShell({
  icon: Icon,
  title,
  subtitle,
  headerTooltip,
  headerTooltipWide,
  headerTooltipExtraWide,
  children,
  bodyClassName = "p-5 flex flex-col gap-4",
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  /** Texto longo no ícone (i), estilo video-editor — sem ocupar o subtítulo. */
  headerTooltip?: string;
  headerTooltipWide?: boolean;
  headerTooltipExtraWide?: boolean;
  children: React.ReactNode;
  /** Sobrescreve o padding/layout do corpo (ex.: split 50/50 no desktop). */
  bodyClassName?: string;
}) {
  return (
    <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col overflow-hidden">
      <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-shopee-orange/15 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-shopee-orange" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold text-text-primary">{title}</p>
            {headerTooltip ? (
              <HintTooltip
                text={headerTooltip}
                wide={headerTooltipWide}
                extraWide={headerTooltipExtraWide}
              />
            ) : null}
          </div>
          {subtitle ? (
            <p className="text-[11px] text-text-secondary/50">{subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

const chipOff =
  "rounded-lg border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary hover:border-shopee-orange/35 transition-colors";
const chipOn =
  "rounded-lg border border-shopee-orange/80 bg-shopee-orange/15 px-3 py-1.5 text-xs font-semibold text-shopee-orange";

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

type SceneWizardTab = "model" | "scene" | "pose" | "style" | "improvements";

const SCENE_WIZARD_TABS: { id: SceneWizardTab; label: string }[] = [
  { id: "model", label: "Modelo" },
  { id: "scene", label: "Cena" },
  { id: "pose", label: "Pose" },
  { id: "style", label: "Estilo" },
  { id: "improvements", label: "Melhorias" },
];

type VideoWizardTab =
  | "motion"
  | "duration"
  | "format"
  | "resolution"
  | "audio"
  | "script";

type CustomFaceRefSlot = {
  id: string;
  mimeType: string;
  base64: string;
  previewUrl: string;
};

const VIDEO_WIZARD_TABS: {
  id: VideoWizardTab;
  label: string;
  onlyWithVoice?: true;
}[] = [
  { id: "motion", label: "Movimento" },
  { id: "duration", label: "Duração" },
  { id: "format", label: "Formato" },
  { id: "resolution", label: "Resolução" },
  { id: "audio", label: "Áudio" },
  { id: "script", label: "Roteiro", onlyWithVoice: true },
];

function labelsFromChipIds(
  ids: string[],
  defs: { id: string; label: string }[]
): string {
  return ids
    .map((id) => defs.find((d) => d.id === id)?.label)
    .filter(Boolean)
    .join(", ");
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(",");
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(dataUrlToBase64(r.result as string));
    r.onerror = () => reject(new Error("Falha ao ler imagem."));
    r.readAsDataURL(blob);
  });
}

function ExpertGeneratorInner() {
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productBase64, setProductBase64] = useState<string | null>(null);
  const [productMime, setProductMime] = useState("image/jpeg");
  const [productDescription, setProductDescription] = useState("");
  const [productDescriptionOpen, setProductDescriptionOpen] = useState(false);
  /** false = segurar nas mãos (padrão); true = vestir no corpo (ex.: camiseta). */
  const [productWearOnModel, setProductWearOnModel] = useState(false);
  const [compressing, setCompressing] = useState(false);

  const activeProductDescription = useMemo(
    () => (productDescriptionOpen ? productDescription.trim() : ""),
    [productDescriptionOpen, productDescription]
  );

  const [gender, setGender] = useState<"women" | "men">("women");
  const [modelMode, setModelMode] = useState<"preset" | "custom">("preset");
  const [presetId, setPresetId] = useState(FEMALE_PRESETS[0]!.id);
  const [customModel, setCustomModel] = useState("");
  const [customFaceRefs, setCustomFaceRefs] = useState<CustomFaceRefSlot[]>([]);
  const [faceRefErr, setFaceRefErr] = useState<string | null>(null);

  const [sceneIds, setSceneIds] = useState<string[]>(["casa"]);
  const [sceneCustom, setSceneCustom] = useState("");
  const [poseIds, setPoseIds] = useState<string[]>(["frente"]);
  const [poseCustom, setPoseCustom] = useState("");
  const [styleIds, setStyleIds] = useState<string[]>(["casual"]);
  const [improvementIds, setImprovementIds] = useState<string[]>([]);
  const [sceneWizardTab, setSceneWizardTab] =
    useState<SceneWizardTab>("model");

  const [advancedImageOpen, setAdvancedImageOpen] = useState(false);
  const [advancedImagePrompt, setAdvancedImagePrompt] =
    useState(DEFAULT_IMAGE_PROMPT);

  const [advancedVideoOpen, setAdvancedVideoOpen] = useState(false);
  const [advancedVideoPrompt, setAdvancedVideoPrompt] =
    useState(DEFAULT_VIDEO_PROMPT);

  const [motionIds, setMotionIds] = useState<string[]>(["micro", "uso"]);
  const [motionCustom, setMotionCustom] = useState("");
  const [sceneUseCustom, setSceneUseCustom] = useState(false);
  const [poseUseCustom, setPoseUseCustom] = useState(false);
  const [motionUseCustom, setMotionUseCustom] = useState(false);
  const [durationSec, setDurationSec] = useState<4 | 6 | 8>(6);
  const [videoAspect, setVideoAspect] = useState<"9:16" | "16:9">("9:16");
  const [videoRes, setVideoRes] = useState<"720p" | "1080p">("720p");
  const [generateAudio, setGenerateAudio] = useState(false);
  const [videoVoiceScript, setVideoVoiceScript] = useState("");
  const [videoVoiceGender, setVideoVoiceGender] = useState<"female" | "male">(
    "female"
  );
  const [videoWizardTab, setVideoWizardTab] = useState<VideoWizardTab>("motion");
  const [videoAudioMode, setVideoAudioMode] = useState<
    null | "silent" | "voice"
  >(null);
  const [scriptIaModalOpen, setScriptIaModalOpen] = useState(false);
  const [scriptIaBrief, setScriptIaBrief] = useState("");
  const [scriptIaLoading, setScriptIaLoading] = useState(false);
  const [scriptIaErr, setScriptIaErr] = useState<string | null>(null);

  const [imageAspect, setImageAspect] = useState("9:16");
  const [step, setStep] = useState(1);

  const [genImgLoading, setGenImgLoading] = useState(false);
  const [genImgErr, setGenImgErr] = useState<string | null>(null);
  const [imageResult, setImageResult] = useState<{
    base64: string;
    mime: string;
    /** Quantas imagens de rosto foram enviadas ao Nano Banana neste pedido (preset ou tuas fotos). */
    modelFaceReferenceCount?: number;
  } | null>(null);
  const [veoLoading, setVeoLoading] = useState(false);
  const [veoErr, setVeoErr] = useState<string | null>(null);
  const [veoProgress, setVeoProgress] = useState<string | null>(null);
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null);
  const [videoGcsUri, setVideoGcsUri] = useState<string | null>(null);
  const [imageLightboxOpen, setImageLightboxOpen] = useState(false);
  const customFaceInputRef = useRef<HTMLInputElement>(null);

  const presets = gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;

  React.useEffect(() => {
    const first = (gender === "women" ? FEMALE_PRESETS : MALE_PRESETS)[0]!.id;
    setPresetId((prev) => {
      const list = gender === "women" ? FEMALE_PRESETS : MALE_PRESETS;
      if (list.some((p) => p.id === prev)) return prev;
      return first;
    });
  }, [gender]);

  React.useEffect(() => {
    if (!imageResult) setImageLightboxOpen(false);
  }, [imageResult]);

  React.useEffect(() => {
    if (step !== 3) setImageLightboxOpen(false);
  }, [step]);

  React.useEffect(() => {
    if (!imageLightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageLightboxOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [imageLightboxOpen]);

  const canGenerateImage = useMemo(() => {
    if (compressing) return false;
    if (
      modelMode === "custom" &&
      customModel.trim().length < 8 &&
      customFaceRefs.length === 0
    ) {
      return false;
    }
    return (
      Boolean(productBase64) || activeProductDescription.length >= 15
    );
  }, [
    compressing,
    modelMode,
    customModel,
    customFaceRefs.length,
    productBase64,
    activeProductDescription,
  ]);

  const hasProductBasics = useMemo(
    () =>
      Boolean(productBase64) || activeProductDescription.length >= 15,
    [productBase64, activeProductDescription]
  );

  const videoMotionSummaryLine = useMemo(() => {
    if (motionUseCustom) {
      const c = motionCustom.trim();
      return c || "—";
    }
    const chips = labelsFromChipIds(motionIds, VIDEO_MOTION_CHIPS);
    return chips || "—";
  }, [motionUseCustom, motionIds, motionCustom]);

  const visibleVideoWizardTabs = useMemo(
    () =>
      VIDEO_WIZARD_TABS.filter(
        (t) => !t.onlyWithVoice || videoAudioMode === "voice"
      ),
    [videoAudioMode]
  );

  React.useEffect(() => {
    if (step !== 4) return;
    if (videoWizardTab === "script" && videoAudioMode !== "voice") {
      setVideoWizardTab("audio");
    }
  }, [step, videoWizardTab, videoAudioMode]);

  React.useEffect(() => {
    if (!scriptIaModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScriptIaModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [scriptIaModalOpen]);

  const submitScriptIa = useCallback(async () => {
    setScriptIaErr(null);
    const brief = scriptIaBrief.trim();
    if (brief.length < 8) {
      setScriptIaErr("Escreva pelo menos 8 caracteres sobre o produto.");
      return;
    }
    setScriptIaLoading(true);
    try {
      const res = await fetch("/api/expert-generator/generate-voice-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productBrief: brief,
          durationSeconds: durationSec,
          motionSummary:
            videoMotionSummaryLine === "—" ? "" : videoMotionSummaryLine,
          voiceGender: videoVoiceGender,
        }),
      });
      const data = (await res.json()) as {
        script?: string;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        const extra =
          typeof data.detail === "string" && data.detail.trim()
            ? ` ${data.detail.trim().slice(0, 400)}`
            : "";
        throw new Error((data.error || "Falha ao gerar roteiro.") + extra);
      }
      if (!data.script?.trim()) throw new Error("Resposta sem texto.");
      setVideoVoiceScript(data.script.trim());
      setScriptIaModalOpen(false);
      setScriptIaBrief("");
    } catch (e) {
      setScriptIaErr(e instanceof Error ? e.message : "Erro ao gerar.");
    } finally {
      setScriptIaLoading(false);
    }
  }, [
    scriptIaBrief,
    durationSec,
    videoMotionSummaryLine,
    videoVoiceGender,
  ]);

  const canOpenStep = useCallback(
    (sId: number) => {
      if (sId === 1) return true;
      if (sId === 2) return hasProductBasics;
      if (sId === 3) return canGenerateImage;
      if (sId === 4) return Boolean(imageResult);
      return false;
    },
    [hasProductBasics, canGenerateImage, imageResult]
  );

  const modelSummaryLine = useMemo(() => {
    const g = gender === "women" ? "Mulheres" : "Homens";
    if (modelMode === "preset") {
      const p = presets.find((x) => x.id === presetId);
      return `${g} · ${p?.name ?? presetId}`;
    }
    const c = customModel.trim();
    const n = customFaceRefs.length;
    const refBit =
      n > 0 ? ` · ${n} foto${n > 1 ? "s" : ""} referência (Nano Banana)` : "";
    return `${g} · Personalizado${c ? ` — ${c.slice(0, 120)}${c.length > 120 ? "…" : ""}` : ""}${refBit}`;
  }, [gender, modelMode, presetId, customModel, customFaceRefs.length, presets]);

  const ingestProductFile = useCallback(async (file: File | null) => {
    if (!file) {
      setProductPreview(null);
      setProductBase64(null);
      return;
    }
    const ok = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (!ok) {
      setGenImgErr("Use JPEG, PNG ou WEBP.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setGenImgErr("Arquivo acima de 100MB.");
      return;
    }
    setGenImgErr(null);
    setCompressing(true);
    let b64: string | null = null;
    try {
      const maxPayload = 3_400_000;
      const blob = await compressImageFileToMaxBytes(file, maxPayload);
      b64 = await blobToBase64(blob);
      setProductMime("image/jpeg");
      setProductBase64(b64);
      setProductPreview(URL.createObjectURL(blob));
    } catch (e) {
      setGenImgErr(e instanceof Error ? e.message : "Erro ao processar imagem.");
      setProductPreview(null);
      setProductBase64(null);
      setCompressing(false);
      return;
    } finally {
      setCompressing(false);
    }
  }, []);

  const MAX_CUSTOM_FACE_PAYLOAD = 2_500_000;

  const addCustomFaceFiles = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setFaceRefErr(null);
    const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
    const newSlots: CustomFaceRefSlot[] = [];
    for (const file of Array.from(files)) {
      if (!allowed.has(file.type)) {
        setFaceRefErr("Use JPEG, PNG ou WEBP nas fotos de rosto.");
        continue;
      }
      try {
        const blob = await compressImageFileToMaxBytes(
          file,
          MAX_CUSTOM_FACE_PAYLOAD
        );
        const b64 = await blobToBase64(blob);
        const previewUrl = URL.createObjectURL(blob);
        newSlots.push({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          mimeType: "image/jpeg",
          base64: b64,
          previewUrl,
        });
      } catch (e) {
        setFaceRefErr(
          e instanceof Error ? e.message : "Erro ao processar uma das fotos."
        );
      }
    }
    if (!newSlots.length) return;
    setCustomFaceRefs((prev) => {
      const room = Math.max(0, 6 - prev.length);
      if (room <= 0) {
        newSlots.forEach((s) => URL.revokeObjectURL(s.previewUrl));
        return prev;
      }
      const toAdd = newSlots.slice(0, room);
      newSlots.slice(room).forEach((s) => URL.revokeObjectURL(s.previewUrl));
      return [...prev, ...toAdd];
    });
  }, []);

  const removeCustomFaceRef = useCallback((id: string) => {
    setCustomFaceRefs((prev) => {
      const slot = prev.find((x) => x.id === id);
      if (slot) URL.revokeObjectURL(slot.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }, []);

  const buildOptionsPayload = useCallback(
    (opts?: { forImageApi?: boolean }) => {
      const forImage = opts?.forImageApi === true;
      const model =
        modelMode === "custom"
          ? { mode: "custom" as const, description: customModel, gender }
          : { mode: "preset" as const, presetId, gender };
      const base = {
        model,
        productWearOnModel,
        sceneIds: sceneUseCustom ? [] : sceneIds,
        sceneCustom: sceneUseCustom ? sceneCustom : "",
        poseIds: poseUseCustom ? [] : poseIds,
        poseCustom: poseUseCustom ? poseCustom : "",
        styleIds,
        improvementIds,
        motionIds: motionUseCustom ? [] : motionIds,
        motionCustom: motionUseCustom ? motionCustom : "",
      };
      if (
        forImage &&
        modelMode === "custom" &&
        customFaceRefs.length > 0
      ) {
        return {
          ...base,
          customFaceReferenceImages: customFaceRefs.map(
            ({ mimeType, base64 }) => ({ mimeType, base64 })
          ),
        };
      }
      return base;
    },
    [
    modelMode,
    customModel,
    customFaceRefs,
    gender,
    presetId,
    productWearOnModel,
    sceneIds,
    sceneCustom,
    sceneUseCustom,
    poseIds,
    poseCustom,
    poseUseCustom,
    styleIds,
    improvementIds,
    motionIds,
    motionCustom,
    motionUseCustom,
  ]);

  const onGenerateImage = async () => {
    setGenImgErr(null);
    setGenImgLoading(true);
    setImageResult(null);
    setVideoDataUrl(null);
    setVideoGcsUri(null);
    try {
      const res = await fetch("/api/expert-generator/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advancedImagePrompt,
          aspectRatio: imageAspect,
          productImageBase64: productBase64 ?? "",
          productMimeType: productMime,
          productDescription: activeProductDescription,
          options: buildOptionsPayload({ forImageApi: true }),
        }),
      });
      const raw = await res.text();
      let data: {
        error?: string;
        hint?: string;
        detail?: string;
        imageBase64?: string;
        mimeType?: string;
        modelFaceReferenceCount?: number;
      } = {};
      try {
        data = JSON.parse(raw) as typeof data;
      } catch {
        throw new Error(humanizeLargeRequestError(raw.slice(0, 200)));
      }
      if (!res.ok) {
        const detailSlice =
          typeof data.detail === "string" && data.detail.trim()
            ? data.detail.trim().slice(0, 1500)
            : "";
        const parts = [data.error, data.hint, detailSlice].filter(Boolean);
        throw new Error(
          parts.length > 0
            ? parts.join("\n\n")
            : humanizeLargeRequestError(raw.slice(0, 200))
        );
      }
      if (!data.imageBase64) {
        throw new Error("Resposta sem imagem.");
      }
      setImageResult({
        base64: data.imageBase64,
        mime: data.mimeType ?? "image/png",
        modelFaceReferenceCount:
          typeof data.modelFaceReferenceCount === "number"
            ? data.modelFaceReferenceCount
            : undefined,
      });
    } catch (e) {
      setGenImgErr(e instanceof Error ? e.message : "Erro ao gerar imagem.");
    } finally {
      setGenImgLoading(false);
    }
  };

  const pollVeo = async (operationName: string) => {
    for (let i = 0; i < 60; i++) {
      setVeoProgress(
        `A gerar vídeo no Vertex (Veo Fast)… ${i + 1}/60 (~3s entre tentativas)`
      );
      const res = await fetch("/api/expert-generator/veo-poll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName }),
      });
      const j = (await res.json()) as {
        done?: boolean;
        error?: string | { message?: string };
        videos?: {
          bytesBase64Encoded?: string;
          gcsUri?: string;
          mimeType?: string;
        }[];
      };
      if (!res.ok) {
        const msg =
          typeof j.error === "string"
            ? j.error
            : j.error?.message ?? "Falha no poll Veo.";
        throw new Error(msg);
      }
      const errObj = j.error;
      if (errObj && typeof errObj === "object" && errObj.message) {
        throw new Error(errObj.message);
      }
      if (j.done) {
        const v = j.videos?.[0];
        if (v?.bytesBase64Encoded && v.mimeType) {
          setVideoDataUrl(
            `data:${v.mimeType};base64,${v.bytesBase64Encoded}`
          );
          setVideoGcsUri(null);
        } else if (v?.gcsUri) {
          setVideoGcsUri(v.gcsUri);
          setVideoDataUrl(null);
        } else if ((j as { raiMediaFilteredCount?: number }).raiMediaFilteredCount) {
          throw new Error(
            "O Veo filtrou o vídeo por políticas de segurança. Tente ajustar o prompt ou a imagem."
          );
        } else {
          throw new Error(
            "Vídeo concluído mas sem bytes nem URI pública. Configure storageUri no GCP ou tente novamente."
          );
        }
        return;
      }
      await new Promise((r) => setTimeout(r, 3000));
    }
    throw new Error("Tempo esgotado ao aguardar o Veo.");
  };

  const onGenerateVideo = async () => {
    if (!imageResult) return;
    setVeoErr(null);
    setVeoLoading(true);
    setVideoDataUrl(null);
    setVideoGcsUri(null);
    setVeoProgress("A iniciar geração…");
    try {
      const res = await fetch("/api/expert-generator/veo-start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imageResult.base64,
          imageMimeType: imageResult.mime,
          aspectRatio: videoAspect,
          durationSeconds: durationSec,
          resolution: videoRes,
          generateAudio:
            videoVoiceScript.trim().length > 0 ? true : generateAudio,
          voiceScript: videoVoiceScript.trim() || undefined,
          voiceGender: videoVoiceGender,
          advancedVideoPrompt,
          advancedImagePrompt,
          productDescription: activeProductDescription,
          options: buildOptionsPayload(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        operationName?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || "Falha ao iniciar Veo.");
      }
      if (!data.operationName) {
        throw new Error("Sem operationName.");
      }
      await pollVeo(data.operationName);
    } catch (e) {
      setVeoErr(e instanceof Error ? e.message : "Erro no vídeo.");
    } finally {
      setVeoLoading(false);
      setVeoProgress(null);
    }
  };

  const downloadImage = () => {
    if (!imageResult) return;
    const a = document.createElement("a");
    a.href = `data:${imageResult.mime};base64,${imageResult.base64}`;
    a.download = `especialista-${Date.now()}.png`;
    a.click();
  };

  return (
    <div className="space-y-5 pb-16">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-shopee-orange/15 border border-shopee-orange/30 flex items-center justify-center shadow-[0_0_16px_rgba(238,77,45,0.15)]">
            <Sparkles className="h-[18px] w-[18px] text-shopee-orange" />
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary">
              Gerador de Especialista
            </h1>
           
          </div>
        </div>
        <div className="hidden md:flex items-center gap-1 text-[11px] text-text-secondary/50">
          <span className="font-semibold text-shopee-orange">{step}</span>
          <span>/4 etapas</span>
        </div>
      </div>

 

      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => {
          const done = s.id < step;
          const current = s.id === step;
          const future = s.id > step;
          const open = canOpenStep(s.id);
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => open && setStep(s.id)}
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all ${
                  future && !open
                    ? "cursor-default opacity-40"
                    : open
                      ? "cursor-pointer"
                      : "cursor-default opacity-40"
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                    current
                      ? "bg-shopee-orange text-white shadow-[0_0_12px_rgba(238,77,45,0.4)]"
                      : done
                        ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                        : "bg-dark-card border-2 border-dark-border text-text-secondary"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : (
                    s.id
                  )}
                </div>
                <span
                  className={`hidden sm:block text-xs font-medium whitespace-nowrap ${
                    current
                      ? "text-text-primary font-semibold"
                      : done
                        ? "text-emerald-400"
                        : "text-text-secondary"
                  }`}
                >
                  {s.title}
                </span>
              </button>
              {idx < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-px mx-2 transition-colors ${
                    done ? "bg-emerald-500/40" : "bg-dark-border"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="sm:hidden text-xs font-medium text-text-primary -mt-2">
        {STEPS[step - 1]?.title}
      </p>

      {step === 1 && (
        <CardShell
          icon={ImageIcon}
          title="Foto do produto"
          headerTooltip="JPEG, PNG ou WEBP — comprimimos no browser. Ative o interruptor se quiser descrever o produto por texto."
          headerTooltipWide
        >
          <label className="flex flex-col items-center justify-center min-h-[168px] border-2 border-dashed border-dark-border rounded-xl bg-dark-bg/50 cursor-pointer hover:border-shopee-orange/45 transition-colors">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => ingestProductFile(e.target.files?.[0] ?? null)}
            />
            {compressing ? (
              <div className="flex flex-col items-center gap-2 text-text-secondary text-sm">
                <Loader2 className="h-8 w-8 animate-spin text-shopee-orange" />
                <span>A comprimir…</span>
              </div>
            ) : productPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productPreview}
                alt="Produto"
                className="max-h-48 rounded-lg object-contain"
              />
            ) : (
              <>
                <Upload className="h-10 w-10 text-text-secondary mb-2" />
                <span className="text-sm text-text-secondary text-center px-4">
                  Toque ou arraste a foto do produto
                </span>
              </>
            )}
          </label>

          <div className="rounded-xl border border-dark-border bg-dark-bg/45 px-3.5 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex items-center gap-1.5">
              <p className="text-sm font-semibold text-text-primary">
                Descrição do produto
              </p>
              <HintTooltip
                wide
                text="Ative para escrever notas (rótulo, cor, materiais). Sem foto, o texto precisa de pelo menos 15 caracteres."
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={productDescriptionOpen}
              aria-label="Mostrar campo de descrição do produto"
              onClick={() => setProductDescriptionOpen((v) => !v)}
              className={`relative h-8 w-[3.25rem] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-shopee-orange/50 ${
                productDescriptionOpen
                  ? "bg-shopee-orange"
                  : "bg-dark-border/90"
              }`}
            >
              <span
                className={`absolute top-1 left-1 h-6 w-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  productDescriptionOpen ? "translate-x-[1.35rem]" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <PersonalizedFieldSwitch
            checked={productWearOnModel}
            onCheckedChange={setProductWearOnModel}
            label="Produto para vestir"
            infoTooltip="Ligado: a peça vai no corpo (camisa, boné, etc.). Desligado: segurar nas mãos, como frasco ou caixa."
            infoTooltipWide
            ariaLabel="Produto para vestir em vez de segurar"
          />

          {productDescriptionOpen ? (
            <>
              <FieldLabel tooltip="Opcional com foto. Sem foto, use pelo menos 15 caracteres para gerar só com texto.">
                Texto da descrição
              </FieldLabel>
              <textarea
                value={productDescription}
                onChange={(e) => setProductDescription(e.target.value)}
                placeholder="Ex.: Frasco cilíndrico preto mate, rótulo com marca visível…"
                rows={5}
                className={inputCls}
              />
            </>
          ) : null}

          <button
            type="button"
            disabled={!hasProductBasics}
            onClick={() => {
              setSceneWizardTab("model");
              setStep(2);
            }}
            className={`w-full ${btnPrimary} py-3`}
          >
            Continuar para cenário
            <ChevronRight className="h-4 w-4" />
          </button>
        </CardShell>
      )}

      {step === 2 && (
        <CardShell
          icon={User}
          title="Modelo, cena, pose e estilo"
          headerTooltip="Use as abas (Modelo, Cena, Pose…) para rever ou mudar. Só ao escolher um preset é que saltamos para Cena; no modelo personalizado ficas no separador até mudares tu."
          headerTooltipExtraWide
        >
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-5 lg:items-stretch min-h-[300px]">
            <div className="lg:col-span-7 flex flex-col gap-3 min-w-0">
              <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-app shrink-0 border-b border-dark-border/70">
                {SCENE_WIZARD_TABS.map((tab) => {
                  const active = sceneWizardTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSceneWizardTab(tab.id)}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                        active
                          ? "bg-shopee-orange text-white shadow-[0_0_12px_rgba(238,77,45,0.35)]"
                          : "bg-dark-bg text-text-secondary border border-dark-border hover:border-shopee-orange/45"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 space-y-4 min-h-[200px]">
                {sceneWizardTab === "model" && (
                  <>
                    <FieldLabel>Género e modelo</FieldLabel>
                    <div className="flex rounded-lg border border-dark-border p-0.5 w-fit">
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          gender === "women"
                            ? "bg-shopee-orange text-white"
                            : "text-text-secondary"
                        }`}
                        onClick={() => setGender("women")}
                      >
                        Mulheres
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                          gender === "men"
                            ? "bg-shopee-orange text-white"
                            : "text-text-secondary"
                        }`}
                        onClick={() => setGender("men")}
                      >
                        Homens
                      </button>
                    </div>

                    <PersonalizedFieldSwitch
                      checked={modelMode === "custom"}
                      onCheckedChange={(on) => {
                        if (!on) {
                          setFaceRefErr(null);
                          setCustomFaceRefs((prev) => {
                            prev.forEach((s) =>
                              URL.revokeObjectURL(s.previewUrl)
                            );
                            return [];
                          });
                        }
                        setModelMode(on ? "custom" : "preset");
                      }}
                      label="Modelo personalizado"
                      infoTooltip="Ative para descrever a pessoa por texto e/ou enviar fotos tuas para o Nano Banana. Desligado: só presets visuais."
                      infoTooltipWide
                      ariaLabel="Usar descrição de modelo personalizada"
                    />

                    {modelMode === "preset" ? (
                      <div className="flex flex-wrap gap-3">
                        {presets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setModelMode("preset");
                              setPresetId(p.id);
                              setSceneWizardTab("scene");
                            }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-colors ${
                              presetId === p.id && modelMode === "preset"
                                ? "border-shopee-orange/70 bg-shopee-orange/10 shadow-[0_0_12px_rgba(238,77,45,0.12)]"
                                : "border-dark-border hover:border-shopee-orange/30"
                            }`}
                          >
                            {PRESET_THUMB_BY_ID[p.id] ? (
                              <Image
                                src={PRESET_THUMB_BY_ID[p.id]!}
                                alt={p.name}
                                width={56}
                                height={56}
                                className="h-14 w-14 shrink-0 rounded-full border border-dark-border object-cover"
                              />
                            ) : (
                              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-dark-border bg-gradient-to-br from-shopee-orange/35 to-dark-bg text-sm font-bold text-shopee-orange">
                                {p.name.slice(0, 1)}
                              </span>
                            )}
                            <span className="text-[11px] text-text-secondary max-w-[72px] truncate">
                              {p.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-1.5 text-xs text-text-secondary/80">
                          <span className="font-medium text-text-primary/90">
                            Descrição ou fotos de rosto
                          </span>
                          <HintTooltip
                            extraWide
                            text="Escreve pelo menos 8 caracteres na descrição ou adiciona fotos de rosto abaixo. Podes mudar o género, o texto e as fotos à vontade — passa para Cena na aba quando estiveres pronto (não saltamos sozinhos)."
                          />
                        </div>
                        <textarea
                          value={customModel}
                          onChange={(e) => setCustomModel(e.target.value)}
                          placeholder="Ex.: Mulher brasileira, 25 anos, pele morena, cabelo cacheado…"
                          rows={4}
                          className={inputCls}
                        />
                        <div className="rounded-xl border border-dark-border/80 bg-dark-bg/50 p-3 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                              Minhas fotos (referência facial)
                            </p>
                            <HintTooltip
                              extraWide
                              text="Até 6 imagens (JPEG/PNG/WebP). No passo 3, ao gerar a imagem, elas vão no mesmo pedido ao Nano Banana (multimodal), antes do texto — como as fotos dos presets. O resumo à direita mostra quantas tens carregadas; depois de gerar, o passo 3 confirma quantas o servidor usou."
                            />
                          </div>
                          <input
                            ref={customFaceInputRef}
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              void addCustomFaceFiles(e.target.files);
                              e.target.value = "";
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={customFaceRefs.length >= 6}
                              onClick={() =>
                                customFaceInputRef.current?.click()
                              }
                              className={`${btnSecondary} py-2 px-3 text-xs`}
                            >
                              <Camera className="h-3.5 w-3.5" />
                              Adicionar fotos
                            </button>
                            <span className="text-[10px] text-text-secondary/60">
                              {customFaceRefs.length}/6
                            </span>
                          </div>
                          {faceRefErr ? (
                            <p className="text-[11px] text-amber-400/90">
                              {faceRefErr}
                            </p>
                          ) : null}
                          {customFaceRefs.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {customFaceRefs.map((slot) => (
                                <div
                                  key={slot.id}
                                  className="relative h-16 w-16 rounded-lg border border-dark-border overflow-hidden shrink-0 group"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={slot.previewUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Remover foto"
                                    onClick={() =>
                                      removeCustomFaceRef(slot.id)
                                    }
                                    className="absolute top-0.5 right-0.5 rounded-md bg-black/65 p-0.5 text-white opacity-90 hover:opacity-100"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {sceneWizardTab === "scene" && (
                  <>
                    <FieldLabel
                      tooltip={
                        sceneUseCustom
                          ? "Descreva o ambiente em texto livre. Desligue o interruptor para voltar aos cenários prontos."
                          : "Um chip de cada vez (ex.: Casa OU Academia). Ao tocar, seguimos para Pose."
                      }
                      tooltipWide
                    >
                      Cena / ambiente
                    </FieldLabel>
                    <PersonalizedFieldSwitch
                      checked={sceneUseCustom}
                      onCheckedChange={(on) => {
                        setSceneUseCustom(on);
                        if (on) setSceneIds([]);
                        else
                          setSceneIds((prev) =>
                            prev.length ? prev : ["casa"]
                          );
                      }}
                      label="Cenário personalizado"
                      infoTooltip="Ligado: só texto. Desligado: chips prontos."
                      ariaLabel="Usar cenário descrito por texto"
                    />
                    {sceneUseCustom ? (
                      <textarea
                        value={sceneCustom}
                        onChange={(e) => setSceneCustom(e.target.value)}
                        placeholder="Descreva o ambiente (ex.: varanda com plantas, luz natural…)"
                        rows={4}
                        className={inputCls}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {SCENE_CHIPS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={
                              sceneIds.length === 1 && sceneIds[0] === c.id
                                ? chipOn
                                : chipOff
                            }
                            onClick={() => {
                              setSceneIds([c.id]);
                              setSceneWizardTab("pose");
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {sceneWizardTab === "pose" && (
                  <>
                    <FieldLabel
                      tooltip={
                        poseUseCustom
                          ? "Descreva a pose em texto. Desligue para voltar aos chips."
                          : "Ao escolher ou alterar uma pose, passamos a Estilo — volte aqui pela aba se quiser várias poses."
                      }
                      tooltipWide
                    >
                      Pose
                    </FieldLabel>
                    <PersonalizedFieldSwitch
                      checked={poseUseCustom}
                      onCheckedChange={(on) => {
                        setPoseUseCustom(on);
                        if (on) setPoseIds([]);
                        else
                          setPoseIds((prev) =>
                            prev.length ? prev : ["frente"]
                          );
                      }}
                      label="Pose personalizada"
                      infoTooltip="Ligado: só texto. Desligado: poses prontas."
                      ariaLabel="Usar pose descrita por texto"
                    />
                    {poseUseCustom ? (
                      <textarea
                        value={poseCustom}
                        onChange={(e) => setPoseCustom(e.target.value)}
                        placeholder="Descreva a pose e o enquadramento…"
                        rows={4}
                        className={inputCls}
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {POSE_CHIPS.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={
                              poseIds.includes(c.id) ? chipOn : chipOff
                            }
                            onClick={() => {
                              setPoseIds(toggleId(poseIds, c.id));
                              setSceneWizardTab("style");
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {sceneWizardTab === "style" && (
                  <>
                    <FieldLabel
                      tooltip="Ao escolher estilo, passamos a Melhorias — use a aba Estilo para marcar mais de um."
                      tooltipWide
                    >
                      Estilo
                    </FieldLabel>
                    <div className="flex flex-wrap gap-2">
                      {STYLE_CHIPS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={
                            styleIds.includes(c.id) ? chipOn : chipOff
                          }
                          onClick={() => {
                            setStyleIds(toggleId(styleIds, c.id));
                            setSceneWizardTab("improvements");
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {sceneWizardTab === "improvements" && (
                  <ChipGroup
                    title="Melhorias"
                    items={IMPROVEMENT_CHIPS}
                    selected={improvementIds}
                    onToggle={(id) =>
                      setImprovementIds(toggleId(improvementIds, id))
                    }
                  />
                )}
              </div>
            </div>

            <aside className="lg:col-span-3 rounded-xl border border-dark-border/80 bg-dark-bg/40 p-4 lg:sticky lg:top-4 lg:self-start max-h-[min(70vh,520px)] overflow-y-auto min-w-0">
              <p className="text-[11px] font-bold text-text-secondary/55 uppercase tracking-wide mb-3">
                Resumo
              </p>
              <div className="space-y-3 text-xs">
                <div>
                  <p className="text-[10px] font-semibold text-shopee-orange uppercase">
                    Modelo
                  </p>
                  <p className="text-text-primary/90 leading-snug mt-1">
                    {modelSummaryLine}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-shopee-orange uppercase">
                    Cena
                  </p>
                  <p className="text-text-primary/90 mt-1 leading-snug">
                    {sceneUseCustom
                      ? sceneCustom.trim() || "—"
                      : SCENE_CHIPS.find((s) => s.id === sceneIds[0])?.label ??
                        sceneIds[0] ??
                        "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-shopee-orange uppercase">
                    Pose
                  </p>
                  <p className="text-text-primary/90 mt-1 leading-snug">
                    {poseUseCustom
                      ? poseCustom.trim() || "—"
                      : labelsFromChipIds(poseIds, POSE_CHIPS) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-shopee-orange uppercase">
                    Estilo
                  </p>
                  <p className="text-text-primary/90 mt-1 leading-snug">
                    {labelsFromChipIds(styleIds, STYLE_CHIPS) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-shopee-orange uppercase">
                    Melhorias
                  </p>
                  <p className="text-text-primary/90 mt-1 leading-snug">
                    {improvementIds.length
                      ? labelsFromChipIds(improvementIds, IMPROVEMENT_CHIPS)
                      : "Nenhuma"}
                  </p>
                </div>
              </div>
            </aside>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-4 mt-1 border-t border-dark-border/60">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`${btnSecondary} justify-center sm:flex-1 py-3`}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!canGenerateImage}
              onClick={() => setStep(3)}
              className={`${btnPrimary} flex-1 py-3`}
            >
              Continuar para imagem IA
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardShell>
      )}

      {step === 3 && (
        <CardShell
          icon={Sparkles}
          title="Gerar imagem"
          subtitle="A magia começa aqui!!"
          bodyClassName="flex flex-col p-0 gap-0"
        >
          <div className="flex flex-col lg:flex-row lg:items-stretch lg:min-h-0 lg:max-h-[min(88vh,860px)]">
            <div className="flex flex-col gap-4 p-5 lg:w-1/2 lg:flex-none lg:min-w-0 lg:min-h-0 lg:max-h-[min(88vh,860px)] lg:overflow-y-auto lg:border-r border-dark-border/60">
             
              <div>
                <FieldLabel>Proporção da imagem</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {["9:16", "1:1", "4:3", "16:9"].map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setImageAspect(ar)}
                      className={imageAspect === ar ? chipOn : chipOff}
                    >
                      {ar}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAdvancedImageOpen((o) => !o)}
                className="flex hidden items-center gap-2 text-sm text-text-secondary w-full justify-between py-2 border-t border-dark-border/80"
              >
                <span>Prompt avançado (imagem)</span>
                {advancedImageOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {advancedImageOpen ? (
                <textarea
                  value={advancedImagePrompt}
                  onChange={(e) => setAdvancedImagePrompt(e.target.value)}
                  rows={12}
                  className={`${inputCls} font-mono text-xs leading-relaxed min-h-[140px]`}
                />
              ) : null}

              {genImgErr ? (
                <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/8 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-red-400">{genImgErr}</span>
                </div>
              ) : null}

              <button
                type="button"
                disabled={!canGenerateImage || genImgLoading}
                className={`w-full ${btnPrimary} py-3`}
                onClick={onGenerateImage}
              >
                {genImgLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                Gerar imagem 
              </button>
              {!canGenerateImage ? (
                <p className="text-center text-xs text-text-secondary">
                  Complete o passo 1 (foto ou descrição ativada com 15+
                  caracteres) e o modelo no passo 2.
                </p>
              ) : null}
            </div>

            <aside className="flex flex-col p-5 lg:w-1/2 lg:flex-none lg:min-w-0 lg:min-h-0 lg:max-h-[min(88vh,860px)] border-t lg:border-t-0 border-dark-border/60 bg-dark-bg/30">
              <FieldLabel className="shrink-0">Pré-visualização</FieldLabel>
              <div className="mt-2 flex min-h-[220px] flex-1 flex-col rounded-xl border border-dashed border-dark-border/60 bg-dark-bg/50 p-3 overflow-hidden lg:min-h-0">
                {imageResult ? (
                  <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
                    <button
                      type="button"
                      className="flex min-h-0 flex-1 w-full flex-col items-center justify-center overflow-hidden rounded-lg border border-transparent hover:border-shopee-orange/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-shopee-orange/50 cursor-zoom-in group relative bg-transparent p-0"
                      onClick={() => setImageLightboxOpen(true)}
                      aria-label="Ampliar imagem em ecrã completo"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`data:${imageResult.mime};base64,${imageResult.base64}`}
                        alt="Imagem gerada"
                        className="block max-h-full max-w-full object-contain rounded-lg border border-dark-border shadow-lg shadow-black/20 pointer-events-none transition-opacity group-hover:opacity-95"
                      />
                      <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/95 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none max-w-[90%] truncate">
                        Clique para ampliar
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadImage}
                      className={`${btnSecondary} w-full justify-center shrink-0`}
                    >
                      <Download className="h-4 w-4" />
                      Descarregar PNG/JPEG
                    </button>
                    {typeof imageResult.modelFaceReferenceCount === "number" &&
                    imageResult.modelFaceReferenceCount > 0 ? (
                      <p className="text-center text-[10px] text-emerald-400/90 leading-snug px-1">
                        Neste pedido, foi enviado{" "}
                        <strong>
                          {imageResult.modelFaceReferenceCount} imagem(ns)
                        </strong>{" "}
                        de referência facial.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-1 flex-col items-center justify-center text-center text-text-secondary px-4 py-8">
                    <ImageIcon className="h-12 w-12 mx-auto mb-3 text-text-secondary/25" />
                    <p className="text-sm font-medium text-text-secondary/90">
                      A imagem gerada aparece aqui
                    </p>
                    <p className="text-xs mt-1.5 text-text-secondary/60 max-w-[220px]">
                      No desktop, esta coluna fica ao lado das opções. Toque em
                      «Gerar imagem» para começar.
                    </p>
                  </div>
                )}
              </div>
            </aside>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 p-5 pt-4 border-t border-dark-border/60 bg-dark-card">
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`${btnSecondary} justify-center sm:flex-1 py-3`}
            >
              Voltar
            </button>
            <button
              type="button"
              disabled={!imageResult}
              onClick={() => setStep(4)}
              className={`${btnPrimary} flex-1 py-3 disabled:opacity-40`}
            >
              Continuar para vídeo 
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </CardShell>
      )}

      {step === 4 && (
        <CardShell
          icon={Film}
          title="Vídeo com Veo 3.1 Fast"
        
          bodyClassName={
            imageResult
              ? "flex flex-col p-0 gap-0"
              : "p-5 flex flex-col gap-4"
          }
        >
          {!imageResult ? (
            <p className="text-sm text-text-secondary">
              Gere a imagem no passo 3 para desbloquear o vídeo.
            </p>
          ) : (
            <>
              <div className="flex flex-col lg:flex-row lg:items-stretch lg:min-h-0 lg:max-h-[min(88vh,860px)]">
                <div className="flex flex-col gap-4 p-5 lg:w-1/2 lg:flex-none lg:min-w-0 lg:min-h-0 lg:max-h-[min(88vh,860px)] lg:overflow-y-auto lg:border-r border-dark-border/60">
                  <div className="flex gap-1 overflow-x-auto pb-2 -mx-0.5 px-0.5 scrollbar-app shrink-0 border-b border-dark-border/70">
                    {visibleVideoWizardTabs.map((tab) => {
                      const active = videoWizardTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setVideoWizardTab(tab.id)}
                          className={`shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap ${
                            active
                              ? "bg-shopee-orange text-white shadow-[0_0_12px_rgba(238,77,45,0.35)]"
                              : "bg-dark-bg text-text-secondary border border-dark-border hover:border-shopee-orange/45"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 space-y-4 min-h-[160px]">
                    {videoWizardTab === "motion" && (
                      <>
                        <FieldLabel
                          tooltip={
                            motionUseCustom
                              ? "Descreva o movimento da câmara e da pessoa em texto livre."
                              : "Pode marcar vários. Depois avance para Duração."
                          }
                          tooltipWide
                        >
                          Movimento
                        </FieldLabel>
                        <PersonalizedFieldSwitch
                          checked={motionUseCustom}
                          onCheckedChange={(on) => {
                            setMotionUseCustom(on);
                            if (on) setMotionIds([]);
                            else
                              setMotionIds((prev) =>
                                prev.length ? prev : ["micro", "uso"]
                              );
                          }}
                          label="Movimento personalizado"
                          infoTooltip="Ligado: só texto. Desligado: opções prontas."
                          ariaLabel="Usar movimento descrito por texto"
                        />
                        {motionUseCustom ? (
                          <textarea
                            value={motionCustom}
                            onChange={(e) => setMotionCustom(e.target.value)}
                            placeholder="Descreva o movimento desejado no vídeo…"
                            rows={4}
                            className={inputCls}
                          />
                        ) : (
                          <ChipGroup
                            items={VIDEO_MOTION_CHIPS}
                            selected={motionIds}
                            onToggle={(id) =>
                              setMotionIds(toggleId(motionIds, id))
                            }
                          />
                        )}
                        <button
                          type="button"
                          className={`compress-media-sweep-btn isolate w-full ${btnPrimary} py-3`}
                          onClick={() => setVideoWizardTab("duration")}
                        >
                          <span className="relative z-[1] inline-flex items-center justify-center gap-2">
                            Continuar para duração
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      </>
                    )}

                    {videoWizardTab === "duration" && (
                      <>
                        <FieldLabel tooltip="O roteiro com IA respeita estes segundos.">
                          Duração do vídeo
                        </FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          {([ 6 ] as const).map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={durationSec === d ? chipOn : chipOff}
                              onClick={() => {
                                setDurationSec(d);
                                setVideoWizardTab("format");
                              }}
                            >
                              {d}s
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          className={`w-full ${btnSecondary} py-2.5 justify-center text-xs`}
                          onClick={() => setVideoWizardTab("motion")}
                        >
                          Voltar a movimento
                        </button>
                      </>
                    )}

                    {videoWizardTab === "format" && (
                      <>
                        <FieldLabel>Formato (aspecto)</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={
                              videoAspect === "9:16" ? chipOn : chipOff
                            }
                            onClick={() => {
                              setVideoAspect("9:16");
                              setVideoWizardTab("resolution");
                            }}
                          >
                            9:16
                          </button>
                          <button
                            type="button"
                            className={
                              videoAspect === "16:9" ? chipOn : chipOff
                            }
                            onClick={() => {
                              setVideoAspect("16:9");
                              setVideoWizardTab("resolution");
                            }}
                          >
                            16:9
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`w-full ${btnSecondary} py-2.5 justify-center text-xs`}
                          onClick={() => setVideoWizardTab("duration")}
                        >
                          Voltar a duração
                        </button>
                      </>
                    )}

                    {videoWizardTab === "resolution" && (
                      <>
                        <FieldLabel>Resolução de saída</FieldLabel>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={videoRes === "720p" ? chipOn : chipOff}
                            onClick={() => {
                              setVideoRes("720p");
                              setVideoWizardTab("audio");
                            }}
                          >
                            720p
                          </button>
                          <button
                            type="button"
                            className={
                              videoRes === "1080p" ? chipOn : chipOff
                            }
                            onClick={() => {
                              setVideoRes("1080p");
                              setVideoWizardTab("audio");
                            }}
                          >
                            1080p
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`w-full ${btnSecondary} py-2.5 justify-center text-xs`}
                          onClick={() => setVideoWizardTab("format")}
                        >
                          Voltar a formato
                        </button>
                      </>
                    )}

                    {videoWizardTab === "audio" && (
                      <>
                        <FieldLabel
                          tooltip="Sem som: vídeo mudas — pode gerar de seguida. Com voz: abrimos o roteiro."
                          tooltipWide
                        >
                          Áudio no vídeo
                        </FieldLabel>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <button
                            type="button"
                            className={`rounded-xl border-2 px-4 py-4 text-left transition-colors ${
                              videoAudioMode === "silent"
                                ? "border-shopee-orange bg-shopee-orange/12 shadow-[0_0_14px_rgba(238,77,45,0.15)]"
                                : "border-dark-border bg-dark-bg/50 hover:border-shopee-orange/35"
                            }`}
                            onClick={() => {
                              setVideoAudioMode("silent");
                              setVideoVoiceScript("");
                              setGenerateAudio(false);
                            }}
                          >
                            <span className="text-sm font-bold text-text-primary block">
                              Sem áudio
                            </span>
                            <span className="text-[11px] text-text-secondary mt-1 block leading-snug">
                              Apenas imagem em movimento. Use «Gerar vídeo»
                              abaixo quando quiser.
                            </span>
                          </button>
                          <button
                            type="button"
                            className={`rounded-xl border-2 px-4 py-4 text-left transition-colors ${
                              videoAudioMode === "voice"
                                ? "border-shopee-orange bg-shopee-orange/12 shadow-[0_0_14px_rgba(238,77,45,0.15)]"
                                : "border-dark-border bg-dark-bg/50 hover:border-shopee-orange/35"
                            }`}
                            onClick={() => {
                              setVideoAudioMode("voice");
                              setVideoWizardTab("script");
                            }}
                          >
                            <span className="text-sm font-bold text-text-primary block">
                              Com áudio
                            </span>
                            <span className="text-[11px] text-text-secondary mt-1 block leading-snug">
                              Roteiro falado e/ou áudio ambiente. Abre o passo
                              Roteiro.
                            </span>
                          </button>
                        </div>
                        <button
                          type="button"
                          className={`w-full ${btnSecondary} py-2.5 justify-center text-xs`}
                          onClick={() => setVideoWizardTab("resolution")}
                        >
                          Voltar a resolução
                        </button>
                      </>
                    )}

                    {videoWizardTab === "script" &&
                      videoAudioMode === "voice" && (
                        <>
                          <div className="rounded-xl border border-dark-border bg-dark-bg/40 p-3 space-y-3">
                            <p className="text-xs font-semibold text-shopee-orange flex items-center gap-2 flex-wrap">
                              <Mic className="h-3.5 w-3.5 shrink-0" />
                              <span>Roteiro falado</span>
                              <HintTooltip
                                wide
                                text="Com texto, gera áudio e tenta sincronizar a boca (qualidade variável). Voz em português do Brasil."
                              />
                            </p>
                            <div className="flex gap-2 flex-wrap">
                              <button
                                type="button"
                                className={
                                  videoVoiceGender === "female"
                                    ? chipOn
                                    : chipOff
                                }
                                onClick={() =>
                                  setVideoVoiceGender("female")
                                }
                              >
                                Voz feminina
                              </button>
                              <button
                                type="button"
                                className={
                                  videoVoiceGender === "male"
                                    ? chipOn
                                    : chipOff
                                }
                                onClick={() => setVideoVoiceGender("male")}
                              >
                                Voz masculina
                              </button>
                            </div>
                            <textarea
                              value={videoVoiceScript}
                              onChange={(e) =>
                                setVideoVoiceScript(e.target.value)
                              }
                              placeholder='Ex.: "Esse aqui é o Gluco Vital, eu uso todo dia depois do treino…"'
                              rows={4}
                              className={inputCls}
                            />
                            <button
                              type="button"
                              className={`w-full ${btnSecondary} py-2.5 justify-center gap-2 border-shopee-orange/40`}
                              onClick={() => {
                                setScriptIaErr(null);
                                setScriptIaBrief((b) =>
                                  b.trim()
                                    ? b
                                    : activeProductDescription ||
                                        productDescription.trim()
                                );
                                setScriptIaModalOpen(true);
                              }}
                            >
                              <Sparkles className="h-4 w-4 text-shopee-orange" />
                              Gerar roteiro com IA 
                            </button>
                          </div>
                          <label className="flex hidden items-center gap-2 text-sm text-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={generateAudio}
                              onChange={(e) =>
                                setGenerateAudio(e.target.checked)
                              }
                              disabled={videoVoiceScript.trim().length > 0}
                            />
                            Áudio ambiente sem roteiro (só se o campo acima
                            estiver vazio)
                          </label>
                          <button
                            type="button"
                            className={`w-full ${btnSecondary} py-2.5 justify-center text-xs`}
                            onClick={() => setVideoWizardTab("audio")}
                          >
                            Voltar a áudio no vídeo
                          </button>
                        </>
                      )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setAdvancedVideoOpen((o) => !o)}
                    className="flex hidden items-center gap-2 text-sm text-text-secondary w-full justify-between py-2 border-t border-dark-border/80"
                  >
                    <span>Prompt avançado (vídeo)</span>
                    {advancedVideoOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {advancedVideoOpen ? (
                    <textarea
                      value={advancedVideoPrompt}
                      onChange={(e) => setAdvancedVideoPrompt(e.target.value)}
                      rows={8}
                      className={`${inputCls} font-mono text-xs min-h-[120px]`}
                    />
                  ) : null}

                  {veoErr ? (
                    <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/8 flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-red-400">{veoErr}</span>
                    </div>
                  ) : null}
                  {veoProgress ? (
                    <p className="text-xs text-text-secondary flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-shopee-orange shrink-0" />
                      {veoProgress}
                    </p>
                  ) : null}

                  <button
                    type="button"
                    disabled={
                      veoLoading || videoAudioMode === null
                    }
                    className={`w-full ${btnPrimary} py-3`}
                    onClick={onGenerateVideo}
                  >
                    {veoLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Video className="h-4 w-4" />
                    )}
                    Gerar vídeo 
                  </button>
                  {videoAudioMode === null ? (
                    <p className="text-xs text-amber-400/90 text-center">
                      Escolha «Sem áudio» ou «Com áudio» no passo Áudio para
                      desbloquear a geração.
                    </p>
                  ) : null}
                 
                </div>

                <aside className="flex flex-col p-5 lg:w-1/2 lg:flex-none lg:min-w-0 lg:min-h-0 lg:max-h-[min(88vh,860px)] border-t lg:border-t-0 border-dark-border/60 bg-dark-bg/30 overflow-hidden">
                  <FieldLabel className="shrink-0">
                    Pré-visualização do vídeo
                  </FieldLabel>
                  <div className="mt-2 flex min-h-[200px] flex-1 flex-col rounded-xl border border-dashed border-dark-border/60 bg-dark-bg/50 p-2 sm:p-3 overflow-hidden lg:min-h-0">
                    {videoDataUrl ? (
                      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-black/25 p-1">
                        <video
                          src={videoDataUrl}
                          controls
                          className="max-h-full max-w-full object-contain rounded-lg border border-dark-border shadow-md"
                        />
                      </div>
                    ) : videoGcsUri ? (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 text-center">
                        <p className="text-xs text-amber-400 break-all">
                          O vídeo foi gravado no bucket: {videoGcsUri}.
                          Configure saída base64 ou um bucket acessível para
                          pré-visualizar aqui.
                        </p>
                      </div>
                    ) : (
                      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-8 text-center text-text-secondary">
                        <Video className="mb-2 h-10 w-10 text-text-secondary/25" />
                        <p className="text-sm font-medium text-text-primary/90">
                          O vídeo aparece aqui
                        </p>
                        <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-text-secondary/60">
                          Geração pode levar alguns minutos. O estado aparece à
                          esquerda.
                        </p>
                      </div>
                    )}
                  </div>
                </aside>
              </div>

              <div className="p-5 pt-4 border-t border-dark-border/60 bg-dark-card">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={`${btnSecondary} w-full justify-center py-3`}
                >
                  Voltar à imagem (passo 3)
                </button>
              </div>
            </>
          )}
        </CardShell>
      )}

      {imageLightboxOpen && imageResult ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/88 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Imagem ampliada"
          onClick={() => setImageLightboxOpen(false)}
        >
          <button
            type="button"
            className="absolute top-3 right-3 z-[101] rounded-full border border-white/20 bg-dark-card/95 p-2.5 text-text-primary shadow-lg hover:bg-white/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setImageLightboxOpen(false);
            }}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
          <p className="absolute top-3 left-4 text-xs text-white/60 hidden sm:block pointer-events-none">
            Clique fora ou Esc para fechar
          </p>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-white/55 sm:hidden pointer-events-none text-center px-4">
            Toque fora da imagem para fechar
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:${imageResult.mime};base64,${imageResult.base64}`}
            alt="Imagem gerada (ampliada)"
            className="max-h-[min(92vh,100%)] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : null}

      {scriptIaModalOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/82 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="script-ia-title"
          onClick={() => {
            if (!scriptIaLoading) setScriptIaModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-dark-border bg-dark-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="min-w-0">
                <h2
                  id="script-ia-title"
                  className="text-sm font-bold text-text-primary"
                >
                  Gerar roteiro com IA
                </h2>
                <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
                  Descreva brevemente o produto. 
                </p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-lg p-1.5 hover:bg-white/5 border border-transparent hover:border-dark-border text-text-secondary"
                onClick={() => {
                  if (!scriptIaLoading) setScriptIaModalOpen(false);
                }}
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="text-[11px] font-semibold text-text-secondary block mb-1.5">
              Descreva brevemente o seu produto
            </label>
            <textarea
              value={scriptIaBrief}
              onChange={(e) => setScriptIaBrief(e.target.value)}
              placeholder="Ex.: Suplemento em cápsulas, frasco preto, foco em disposição e rotina…"
              rows={5}
              className={inputCls}
              disabled={scriptIaLoading}
            />
            {scriptIaErr ? (
              <p className="text-xs text-red-400 mt-2">{scriptIaErr}</p>
            ) : null}
            <div className="flex flex-col-reverse sm:flex-row gap-2 mt-4">
              <button
                type="button"
                className={`${btnSecondary} flex-1 justify-center py-2.5`}
                disabled={scriptIaLoading}
                onClick={() => setScriptIaModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={`${btnPrimary} flex-1 justify-center py-2.5`}
                disabled={scriptIaLoading}
                onClick={() => void submitScriptIa()}
              >
                {scriptIaLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Gerar texto
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChipGroup(props: {
  title?: string;
  items: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div>
      {props.title?.trim() ? (
        <FieldLabel>{props.title}</FieldLabel>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {props.items.map((c) => (
          <button
            key={c.id}
            type="button"
            className={props.selected.includes(c.id) ? chipOn : chipOff}
            onClick={() => props.onToggle(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function GeradorEspecialistaPage() {
  return (
    <ProFeatureGate feature="geradorCriativos">
      <ExpertGeneratorInner />
    </ProFeatureGate>
  );
}
