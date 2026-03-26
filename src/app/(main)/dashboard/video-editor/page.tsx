"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { Player } from "@remotion/player";
import {
  Film, Upload, Loader2, Wand2, Mic, Image as ImageIcon,
  Music, AlertCircle, ChevronLeft, ChevronRight, Sparkles, Download,
  Check, CheckCircle2, Volume2, Search, Trash2, Play, Zap, ShoppingBag, X,
  TrendingUp, Timer, Star, LayoutGrid, Maximize2, Video, Info,
} from "lucide-react";
import { VideoComposition } from "../../../../../remotion/VideoComposition";
import {
  VIDEO_STYLES, SUBTITLE_THEMES,
  type VideoInputProps, type VideoStyleId, type MediaAsset, type CaptionWord, type SubtitleTheme,
} from "../../../../../remotion/types";
import { useRemotionSandboxRender } from "../../../../hooks/use-remotion-sandbox-render";
import { resolveInputPropsForRender } from "../../../../lib/remotion/resolve-input-props-for-render";
import ProFeatureGate from "../ProFeatureGate";

type Voice = { voice_id: string; name: string; preview_url: string | null; labels: Record<string, string> };
type MusicTrack = { id: string; name: string; artist: string; duration: number; audioUrl: string; downloadUrl: string; coverUrl: string };

const MUSIC_GENRES = [
  { value: "energetic", label: "Energética" },
  { value: "calm", label: "Calma" },
  { value: "happy", label: "Feliz" },
  { value: "dramatic", label: "Dramática" },
  { value: "chill", label: "Chill" },
  { value: "lofi", label: "Lo-fi" },
  { value: "corporate", label: "Corporativa" },
  { value: "cinematic", label: "Cinematográfica" },
] as const;

const STEPS = [
  { id: 1, title: "Mídia", icon: ImageIcon },
  { id: 2, title: "Copy & Voz", icon: Mic },
  { id: 3, title: "Estilo", icon: Sparkles },
  { id: 4, title: "Preview & Exportar", icon: Film },
];

const inputCls = "w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 px-3.5 text-text-primary text-sm placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange/70 focus:ring-1 focus:ring-shopee-orange/20 transition-all";
const selectCls = inputCls;
const btnPrimary = "inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-5 py-2.5 text-sm font-semibold text-white hover:bg-shopee-orange/90 active:scale-[0.98] disabled:opacity-40 transition-all shadow-[0_4px_16px_rgba(238,77,45,0.3)]";
const btnSecondary = "inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/5 hover:border-dark-border/80 active:scale-[0.98] transition-all";

// ─── Tooltip (estilo do app: portal, bg #111, ícone Info) ─────────────────────
function Tooltip({ text, wide }: { text: string; wide?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const tip = visible ? createPortal(
    <span style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
    </span>, document.body
  ) : null;
  return (
    <span ref={anchorRef} className="inline-flex items-center cursor-help" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors">
        <Info className="h-2.5 w-2.5" />
      </span>
      {tip}
    </span>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="block text-[11px] font-semibold text-text-secondary/60 uppercase tracking-wide">{children}</label>
      {hint != null && hint !== "" && <Tooltip text={hint} wide />}
    </div>
  );
}

function PaginationControls({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-2 mt-2">
      <button type="button" onClick={onPrev} disabled={page === 0}
        className="w-7 h-7 rounded-lg border border-dark-border flex items-center justify-center text-text-secondary/60 hover:bg-white/5 disabled:opacity-30 transition-all">
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="text-[10px] font-semibold text-text-secondary/50 tabular-nums">
        {page + 1} / {totalPages}
      </span>
      <button type="button" onClick={onNext} disabled={page >= totalPages - 1}
        className="w-7 h-7 rounded-lg border border-dark-border flex items-center justify-center text-text-secondary/60 hover:bg-white/5 disabled:opacity-30 transition-all">
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const COPY_STYLES = [
  { value: "vendas", label: "Vendas Persuasiva", icon: TrendingUp, color: "emerald" },
  { value: "humor", label: "Humor Viral", icon: Zap, color: "yellow" },
  { value: "urgencia", label: "Urgência & Escassez", icon: Timer, color: "red" },
] as const;

const ASPECT_RATIOS = [
  { value: "9:16", label: "Stories", sub: "9:16", icon: "▯" },
  { value: "1:1", label: "Feed", sub: "1:1", icon: "□" },
  { value: "16:9", label: "Paisagem", sub: "16:9", icon: "▭" },
] as const;

export default function VideoEditorPageWrapper() {
  return (
    <ProFeatureGate feature="geradorCriativos">
      <VideoEditorPageInner />
    </ProFeatureGate>
  );
}

function VideoEditorPageInner() {
  const [step, setStep] = useState(1);

  // ── Step 1: Media ──
  const [shopeeUrl, setShopeeUrl] = useState("");
  const [searching, setSearching] = useState(false);
  const [productName, setProductName] = useState("");
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<Set<number>>(new Set());
  const [uploadedFiles, setUploadedFiles] = useState<MediaAsset[]>([]);

  // ── Step 2: Copy & Voz ──
  const [copyText, setCopyText] = useState("");
  const [copyStyle, setCopyStyle] = useState<"vendas" | "humor" | "urgencia">("vendas");
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [generatingVoice, setGeneratingVoice] = useState(false);
  const [voiceAudioUrl, setVoiceAudioUrl] = useState<string | null>(null);
  const [voiceAudioDuration, setVoiceAudioDuration] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [captions, setCaptions] = useState<CaptionWord[]>([]);

  // ── Step 3: Estilo ──
  const [videoStyle, setVideoStyle] = useState<VideoStyleId>("showcase");
  const [subtitleThemeKey, setSubtitleThemeKey] = useState("tiktokBold");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "1:1" | "16:9">("9:16");
  const [ctaText, setCtaText] = useState("Link na bio");
  const [price, setPrice] = useState("");
  const [musicUrl, setMusicUrl] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const [musicGenre, setMusicGenre] = useState("energetic");
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [musicLibraryError, setMusicLibraryError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<MusicTrack | null>(null);
  const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const musicPreviewRef = useRef<HTMLAudioElement | null>(null);

  // ── Pagination ──
  const [videoStylePage, setVideoStylePage] = useState(0);
  const [subtitlePage, setSubtitlePage] = useState(0);
  const [musicPage, setMusicPage] = useState(0);
  const [shopeeMediaPage, setShopeeMediaPage] = useState(0);
  const [selectedMediaPage, setSelectedMediaPage] = useState(0);

  // ── Step 4 ──
  const [error, setError] = useState<string | null>(null);
  const remotionExport = useRemotionSandboxRender();
  const [exportPrep, setExportPrep] = useState(false);

  const dimensions = useMemo(() => {
    switch (aspectRatio) {
      case "9:16": return { width: 1080, height: 1920 };
      case "1:1": return { width: 1080, height: 1080 };
      case "16:9": return { width: 1920, height: 1080 };
    }
  }, [aspectRatio]);

  const fps = 30;
  const selectedAssets = useMemo(() => {
    const picked = Array.from(selectedMedia).sort((a, b) => a - b).map((i) => mediaAssets[i]).filter(Boolean);
    return [...picked, ...uploadedFiles];
  }, [selectedMedia, mediaAssets, uploadedFiles]);

  const removeSelectedAssetAt = useCallback((globalIdx: number) => {
    const pickedIndices = Array.from(selectedMedia).sort((a, b) => a - b);
    const pickedCount = pickedIndices.length;
    if (globalIdx < pickedCount) {
      const mediaIndex = pickedIndices[globalIdx];
      setSelectedMedia((prev) => {
        const next = new Set(prev);
        next.delete(mediaIndex);
        return next;
      });
    } else {
      const uploadIdx = globalIdx - pickedCount;
      setUploadedFiles((prev) => {
        const victim = prev[uploadIdx];
        if (victim?.src?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(victim.src);
          } catch {
            /* ignore */
          }
        }
        return prev.filter((_, j) => j !== uploadIdx);
      });
    }
  }, [selectedMedia]);

  useEffect(() => {
    const perPage = 8;
    const totalPages = Math.max(1, Math.ceil(selectedAssets.length / perPage));
    setSelectedMediaPage((p) => Math.min(p, totalPages - 1));
  }, [selectedAssets.length]);

  const totalDurationSec = useMemo(() => {
    if (voiceAudioDuration > 0) return Math.ceil(voiceAudioDuration) + 3;
    return Math.max(10, selectedAssets.length * 4);
  }, [voiceAudioDuration, selectedAssets.length]);

  const durationInFrames = totalDurationSec * fps;
  const subtitleTheme: SubtitleTheme = SUBTITLE_THEMES[subtitleThemeKey] ?? SUBTITLE_THEMES.tiktokBold;

  const compositionProps: VideoInputProps = useMemo(() => ({
    style: videoStyle, media: selectedAssets, voiceoverSrc: voiceAudioUrl, musicSrc: musicUrl,
    musicVolume, captions, subtitleTheme, productName, price, ctaText, fps,
    width: dimensions.width, height: dimensions.height, durationInFrames,
  }), [videoStyle, selectedAssets, voiceAudioUrl, musicUrl, musicVolume, captions, subtitleTheme, productName, price, ctaText, dimensions, durationInFrames]);

  // ── Shopee search ──
  const handleShopeeSearch = useCallback(async () => {
    if (!shopeeUrl.trim()) return;
    setSearching(true); setError(null);
    try {
      const res = await fetch("/api/video-editor/download-shopee", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: shopeeUrl, mode: "scrape" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erro ao buscar produto");
      const media: MediaAsset[] = (json.media ?? []).map((m: { url: string; type: string }) => ({
        type: m.type === "video" ? "video" as const : "image" as const,
        src: m.url,
      }));
      setMediaAssets(media);
      setProductName(json.productName ?? "");
      setSelectedMedia(new Set(media.map((_, i) => i)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSearching(false);
    }
  }, [shopeeUrl]);

  const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
  const MAX_VIDEO_DURATION = 60;
  const MAX_AUDIO_SIZE = 10 * 1024 * 1024;
  const MAX_AUDIO_DURATION = 60;

  // ── File upload ──
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const processFile = async (f: File) => {
      const isVideo = f.type.startsWith("video/");

      if (isVideo) {
        if (f.size > MAX_VIDEO_SIZE) {
          setError(`"${f.name}" excede 50MB. Máximo permitido: 50MB.`);
          return null;
        }
        const dur = await new Promise<number>((resolve) => {
          const v = document.createElement("video");
          v.preload = "metadata";
          v.onloadedmetadata = () => { resolve(v.duration); URL.revokeObjectURL(v.src); };
          v.onerror = () => resolve(0);
          v.src = URL.createObjectURL(f);
        });
        if (dur > MAX_VIDEO_DURATION) {
          setError(`"${f.name}" tem ${Math.ceil(dur)}s. Máximo permitido: 1 minuto.`);
          return null;
        }
      }

      const url = URL.createObjectURL(f);
      return { type: isVideo ? "video" as const : "image" as const, src: url };
    };

    Promise.all(Array.from(files).map(processFile)).then((results) => {
      const valid = results.filter(Boolean) as MediaAsset[];
      if (valid.length > 0) setUploadedFiles((prev) => [...prev, ...valid]);
    });
  }, []);

  // ── Generate copy ──
  const handleGenerateCopy = useCallback(async () => {
    if (!productName.trim()) return;
    setGeneratingCopy(true); setError(null);
    try {
      const res = await fetch("/api/video-editor/generate-copy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName, style: copyStyle, videoDuration: totalDurationSec - 3 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erro ao gerar copy");
      setCopyText(json.copy ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setGeneratingCopy(false);
    }
  }, [productName, copyStyle, totalDurationSec]);

  // ── Load voices ──
  useEffect(() => {
    setLoadingVoices(true);
    fetch("/api/video-editor/elevenlabs-voices")
      .then((r) => r.json())
      .then((j) => { setVoices(j.voices ?? []); if (j.voices?.[0]) setVoiceId(j.voices[0].voice_id); })
      .catch(() => {})
      .finally(() => setLoadingVoices(false));
  }, []);

  // ── Generate voice ──
  const handleGenerateVoice = useCallback(async () => {
    if (!copyText.trim() || !voiceId) return;
    setGeneratingVoice(true); setError(null); setTranscribing(true);
    try {
      const res = await fetch("/api/video-editor/elevenlabs-tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: copyText, voiceId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erro ao gerar voz");

      const audioBase64: string = json.audioBase64 ?? "";
      const apiCaptions: CaptionWord[] = json.captions ?? [];
      const byteString = atob(audioBase64);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      setVoiceAudioUrl(url);

      const audio = new Audio(url);
      audio.onloadedmetadata = () => setVoiceAudioDuration(audio.duration);

      if (apiCaptions.length > 0) {
        setCaptions(apiCaptions);
      } else {
        const audioDur = await new Promise<number>((resolve) => {
          const a = new Audio(url);
          a.onloadedmetadata = () => resolve(a.duration * 1000);
          a.onerror = () => resolve(totalDurationSec * 1000);
        });
        const words = copyText.trim().split(/\s+/);
        const totalChars = words.reduce((s, w) => s + w.length, 0);
        let cursor = 0;
        const fallback: CaptionWord[] = words.map((w) => {
          const ratio = w.length / totalChars;
          const dur = audioDur * ratio;
          const cap: CaptionWord = { text: w, startMs: Math.round(cursor), endMs: Math.round(cursor + dur) };
          cursor += dur;
          return cap;
        });
        setCaptions(fallback);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setGeneratingVoice(false);
      setTranscribing(false);
    }
  }, [copyText, voiceId, totalDurationSec]);

  // ── Music upload ──
  const handleMusicUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AUDIO_SIZE) {
      setError(`"${file.name}" excede 10MB. Máximo permitido para áudio: 10MB.`);
      return;
    }

    const dur = await new Promise<number>((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      const objUrl = URL.createObjectURL(file);
      a.onloadedmetadata = () => { resolve(a.duration); URL.revokeObjectURL(objUrl); };
      a.onerror = () => resolve(0);
      a.src = objUrl;
    });
    if (dur > MAX_AUDIO_DURATION) {
      setError(`"${file.name}" tem ${Math.ceil(dur)}s. Máximo permitido: 1 minuto.`);
      return;
    }

    setMusicUrl(URL.createObjectURL(file));
    setSelectedTrack(null);
  }, []);

  // ── Music library ──
  const fetchMusicTracks = useCallback(async (genre: string) => {
    setLoadingMusic(true);
    setMusicLibraryError(null);
    try {
      const res = await fetch(`/api/video-editor/music-library?genre=${genre}&limit=12`);
      const json = await res.json();
      if (!res.ok) {
        setMusicTracks([]);
        setMusicLibraryError(
          json?.error ||
            "Biblioteca indisponível no momento. Você ainda pode enviar seu MP3."
        );
        return;
      }
      setMusicTracks(json.tracks ?? []);
      if ((json.tracks ?? []).length === 0) {
        setMusicLibraryError(
          "Nenhuma música encontrada para esse estilo. Tente outro gênero."
        );
      }
    } catch {
      setMusicTracks([]);
      setMusicLibraryError(
        "Não foi possível carregar a biblioteca agora. Você pode enviar seu MP3."
      );
    } finally { setLoadingMusic(false); }
  }, []);

  const handlePreviewTrack = useCallback((track: MusicTrack) => {
    if (previewingTrackId === track.id) {
      musicPreviewRef.current?.pause();
      setPreviewingTrackId(null);
      setLoadingTrackId(null);
      return;
    }
    if (musicPreviewRef.current) musicPreviewRef.current.pause();
    setLoadingTrackId(track.id);
    const audio = new Audio(track.audioUrl);
    audio.volume = 0.5;
    audio.oncanplay = () => { setLoadingTrackId(null); audio.play(); setPreviewingTrackId(track.id); };
    audio.onended = () => { setPreviewingTrackId(null); setLoadingTrackId(null); };
    audio.onerror = () => { setLoadingTrackId(null); setError("Não foi possível carregar o áudio."); };
    musicPreviewRef.current = audio;
  }, [previewingTrackId]);

  const handleSelectTrack = useCallback((track: MusicTrack) => {
    if (musicPreviewRef.current) { musicPreviewRef.current.pause(); setPreviewingTrackId(null); }
    setMusicUrl(track.audioUrl);
    setSelectedTrack(track);
  }, []);

  useEffect(() => {
    if (step === 2 && musicTracks.length === 0 && !loadingMusic) {
      fetchMusicTracks(musicGenre);
    }
  }, [step, musicTracks.length, loadingMusic, fetchMusicTracks, musicGenre]);

  const videoCount = mediaAssets.filter(a => a.type === "video").length;
  const imageCount = mediaAssets.filter(a => a.type === "image").length;
  const wordCount = copyText.trim() ? copyText.trim().split(/\s+/).length : 0;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-shopee-orange/15 border border-shopee-orange/30 flex items-center justify-center shadow-[0_0_16px_rgba(238,77,45,0.15)]">
            <Film className="h-4.5 w-4.5 text-shopee-orange" />
        </div>
          <div>
            <h1 className="text-base font-bold text-text-primary">Gerador de Criativos</h1>
            <p className="text-[11px] text-text-secondary/60">Shopee → IA Copy + Voz → Estilo → MP4</p>
            </div>
        </div>
        {/* Progress */}
        <div className="hidden md:flex items-center gap-1 text-[11px] text-text-secondary/50">
          <span className="font-semibold text-shopee-orange">{step}</span>
          <span>/4 etapas</span>
        </div>
      </div>

      {/* ── Stepper (mesmo estilo do Criar Campanha Meta) ── */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, idx) => {
          const done = s.id < step;
          const current = s.id === step;
          const future = s.id > step;
          return (
            <div key={s.id} className="flex items-center flex-1 last:flex-none">
              <button
                type="button"
                onClick={() => (done || s.id === 1) ? setStep(s.id) : undefined}
                className={`flex flex-col sm:flex-row items-center gap-1 sm:gap-2 transition-all ${future ? "cursor-default opacity-40" : "cursor-pointer"}`}
              >
                {/* Círculo */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                  current ? "bg-shopee-orange text-white shadow-[0_0_12px_rgba(238,77,45,0.4)]"
                  : done ? "bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400"
                  : "bg-dark-card border-2 border-dark-border text-text-secondary"
                }`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.id}
          </div>
                {/* Label */}
                <span className={`hidden sm:block text-xs font-medium whitespace-nowrap ${current ? "text-text-primary font-semibold" : done ? "text-emerald-400" : "text-text-secondary"}`}>
                  {s.title}
                </span>
                    </button>
              {/* Linha conectora */}
              {idx < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${done ? "bg-emerald-500/40" : "bg-dark-border"}`} />
              )}
                  </div>
          );
        })}
                      </div>
      {/* Label mobile do step atual */}
      <p className="sm:hidden text-xs font-medium text-text-primary mt-2 ml-0.5">
        {STEPS[step - 1]?.title}
      </p>

      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/8 flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-400 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-xs px-1">✕</button>
                      </div>
      )}

      {/* ════════════════════════════════════════
          STEP 1: MÍDIA
      ════════════════════════════════════════ */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Import */}
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-shopee-orange/15 flex items-center justify-center">
                <ShoppingBag className="h-3.5 w-3.5 text-shopee-orange" />
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-text-primary">Importar da Shopee</p>
                <Tooltip text="Cole o link do produto (shopee.com.br/...) para buscar imagens e vídeos. Você também pode enviar arquivos próprios abaixo." wide />
              </div>
                </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              {/* Search */}
                  <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary/40" />
                  <input
                    type="text" value={shopeeUrl} onChange={(e) => setShopeeUrl(e.target.value)}
                    placeholder="https://shopee.com.br/produto-i.000.000"
                    className="w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 pl-9 pr-3 text-sm text-text-primary placeholder-text-secondary/40 focus:outline-none focus:border-shopee-orange/70 focus:ring-1 focus:ring-shopee-orange/20 transition-all"
                    onKeyDown={(e) => e.key === "Enter" && handleShopeeSearch()}
                  />
                  </div>
                <button type="button" onClick={handleShopeeSearch} disabled={searching || !shopeeUrl.trim()} className={btnPrimary}>
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  {searching ? "Buscando…" : "Buscar"}
                </button>
                </div>

              {/* Product tag */}
              {productName && !searching && (
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3.5 py-2.5">
                  <div className="w-1.5 h-8 rounded-full bg-emerald-500/60 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wide">Produto encontrado</p>
                    <p className="text-sm font-semibold text-text-primary truncate">{productName}</p>
                        </div>
                  {(videoCount > 0 || imageCount > 0) && (
                    <div className="ml-auto flex items-center gap-2 shrink-0">
                      {videoCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full">
                          <Video className="h-2.5 w-2.5" /> {videoCount}
                        </span>
                      )}
                      {imageCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-0.5 rounded-full">
                          <ImageIcon className="h-2.5 w-2.5" /> {imageCount}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Searching skeleton */}
              {searching && (
                <div className="flex flex-col items-center justify-center gap-3 py-8">
                  <div className="relative">
                    <span className="absolute inset-0 rounded-full bg-shopee-orange/15 animate-ping" />
                    <Loader2 className="h-8 w-8 animate-spin text-shopee-orange relative" />
                </div>
                  <p className="text-xs text-text-secondary/60">Buscando mídias do produto…</p>
                </div>
              )}

              {/* Media grid */}
              {!searching && mediaAssets.length > 0 && (
                <div className="flex flex-col gap-2 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-text-secondary/70 uppercase tracking-wide">
                      {selectedMedia.size}/{mediaAssets.length} selecionadas
                    </p>
                    <div className="flex gap-1.5">
                      <button type="button"
                        onClick={() => setSelectedMedia(new Set(mediaAssets.map((_, i) => i)))}
                        className="text-[10px] font-semibold text-shopee-orange hover:text-shopee-orange/80 transition-colors px-2 py-0.5 rounded-lg hover:bg-shopee-orange/10">
                        Todas
                </button>
                      <button type="button"
                        onClick={() => setSelectedMedia(new Set())}
                        className="text-[10px] font-semibold text-text-secondary/50 hover:text-text-secondary transition-colors px-2 py-0.5 rounded-lg hover:bg-white/5">
                        Limpar
                    </button>
                  </div>
              </div>
                  {(() => {
                    const perPage = 8;
                    const totalPages = Math.ceil(mediaAssets.length / perPage);
                    const paged = mediaAssets.slice(shopeeMediaPage * perPage, (shopeeMediaPage + 1) * perPage);
                    const pageOffset = shopeeMediaPage * perPage;
                    return (
                      <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                          {paged.map((asset, idx) => {
                            const i = pageOffset + idx;
                            const sel = selectedMedia.has(i);
                            return (
                              <button key={i} type="button"
                                onClick={() => setSelectedMedia((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(i)) next.delete(i); else next.add(i);
                                  return next;
                                })}
                                className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.03] ${
                                  sel ? "border-shopee-orange shadow-[0_0_12px_rgba(238,77,45,0.3)]" : "border-dark-border/30 opacity-50 hover:opacity-90 hover:border-dark-border"
                                }`}>
                                {asset.type === "image"
                                  ? <img src={asset.src} alt="" className="w-full h-full object-cover" />
                                  : <video src={asset.src} muted className="w-full h-full object-cover" />
                                }
                                {sel && (
                                  <div className="absolute inset-0 bg-shopee-orange/15 flex items-center justify-center">
                                    <div className="w-5 h-5 rounded-full bg-shopee-orange flex items-center justify-center shadow-lg">
                                      <Check className="h-3 w-3 text-white" />
                                    </div>
                  </div>
                )}
                                <span className={`absolute top-1 left-1 text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                                  asset.type === "video"
                                    ? "bg-purple-500/80 text-white"
                                    : "bg-black/60 text-white/80"
                                }`}>
                                  {asset.type === "video" ? "▶" : "⊞"}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <PaginationControls page={shopeeMediaPage} totalPages={totalPages}
                          onPrev={() => setShopeeMediaPage((p) => Math.max(0, p - 1))}
                          onNext={() => setShopeeMediaPage((p) => Math.min(totalPages - 1, p + 1))} />
                      </>
                    );
                  })()}
              </div>
            )}

              {/* Empty state */}
              {!searching && mediaAssets.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 py-8 text-text-secondary/30">
                  <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-dark-border/40 flex items-center justify-center">
                    <ShoppingBag className="h-6 w-6" />
                </div>
                  <p className="text-xs text-center">Cole um link da Shopee acima para importar imagens e vídeos do produto</p>
              </div>
            )}

              {/* Upload zone */}
              <label className="group flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-shopee-orange/50 bg-shopee-orange/10 py-3.5 cursor-pointer hover:border-shopee-orange/60 hover:bg-shopee-orange/50 transition-all mt-auto">
                <Upload className="h-3.5 w-3.5 text-shopee-orange/80 group-hover:text-shopee-orange/95 transition-colors" />
                <span className="text-xs text-shopee-orange/70 group-hover:text-shopee-orange/95 transition-colors">Ou envie seus próprios arquivos</span>
                <input type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFileUpload} />
              </label>
            </div>
          </div>

          {/* Right: Selected preview */}
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col">
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Mídias selecionadas</p>
                  <p className="text-[11px] text-text-secondary/50">Ordem de aparição no vídeo</p>
                  </div>
                </div>
              {selectedAssets.length > 0 && (
                <span className="text-xs font-bold text-white bg-shopee-orange px-2.5 py-0.5 rounded-full">
                  {selectedAssets.length}
                </span>
              )}
                </div>

            <div className="p-5 flex flex-col gap-4">
              {selectedAssets.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 text-text-secondary/25 py-8">
                  <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-dark-border/30 flex items-center justify-center">
                    <ImageIcon className="h-7 w-7" />
              </div>
                  <p className="text-xs text-center max-w-[160px]">Selecione mídias na esquerda para visualizar aqui</p>
                </div>
              ) : (
                (() => {
                  const perPage = 8;
                  const totalPages = Math.ceil(selectedAssets.length / perPage);
                  const paged = selectedAssets.slice(selectedMediaPage * perPage, (selectedMediaPage + 1) * perPage);
                  const pageOffset = selectedMediaPage * perPage;
                  return (
                    <>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {paged.map((asset, idx) => {
                          const i = pageOffset + idx;
                          return (
                            <div key={`${asset.src}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-dark-border/30 group">
                              {asset.type === "image"
                                ? <img src={asset.src} alt="" className="w-full h-full object-cover" />
                                : <video src={asset.src} muted className="w-full h-full object-cover" />
                              }
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                              <span className="absolute bottom-1.5 left-1.5 text-[10px] font-bold text-white/90 bg-black/60 px-1.5 py-0.5 rounded-md pointer-events-none">
                                {i + 1}
                              </span>
                              {asset.type === "video" && (
                                <span className="absolute top-1.5 right-8 text-[9px] font-bold text-white bg-purple-600/80 px-1.5 py-0.5 rounded-md pointer-events-none">▶</span>
                              )}
                              <button
                                type="button"
                                aria-label="Remover mídia"
                                title="Remover"
                                onClick={() => removeSelectedAssetAt(i)}
                                className="absolute top-1.5 right-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-lg bg-black/70 text-white/90 ring-1 ring-white/15 backdrop-blur-sm transition hover:bg-red-500/90 hover:text-white hover:ring-red-400/40"
                              >
                                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <PaginationControls page={selectedMediaPage} totalPages={totalPages}
                        onPrev={() => setSelectedMediaPage((p) => Math.max(0, p - 1))}
                        onNext={() => setSelectedMediaPage((p) => Math.min(totalPages - 1, p + 1))} />
                    </>
                  );
                })()
            )}

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={selectedAssets.length === 0}
                className={`w-full ${btnPrimary} py-3`}
              >
                Continuar para Copy & Voz
                <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
                </div>
              </div>
            )}

      {/* ════════════════════════════════════════
          STEP 2: COPY & VOZ
      ════════════════════════════════════════ */}
      {step === 2 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Copy */}
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
                <Wand2 className="h-3.5 w-3.5 text-violet-400" />
                </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Copy com IA</p>
                <p className="text-[11px] text-text-secondary/50">Gere o roteiro do vídeo automaticamente</p>
          </div>
        </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              <div>
                <FieldLabel hint="Usado pela IA para gerar o roteiro. Pode ser o nome que veio da Shopee ou um título que você preferir.">Nome do produto</FieldLabel>
                <input type="text" value={productName} onChange={(e) => setProductName(e.target.value)}
                  placeholder="Ex: Camiseta Oversized Anime" className={inputCls} />
            </div>

              {/* Style cards */}
              <div>
                <FieldLabel hint="Vendas: tom persuasivo. Humor: viral e engraçado. Urgência: escassez e oferta por tempo limitado.">Estilo da copy</FieldLabel>
                <div className="grid grid-cols-3 gap-2">
                  {COPY_STYLES.map((s) => {
                    const Icon = s.icon;
                    const active = copyStyle === s.value;
                    const colorMap = { emerald: "emerald", yellow: "yellow", red: "red" } as const;
                    const c = colorMap[s.color];
              return (
                      <button key={s.value} type="button" onClick={() => setCopyStyle(s.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                          active
                            ? c === "emerald" ? "border-emerald-500/60 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                              : c === "yellow" ? "border-yellow-500/60 bg-yellow-500/10 shadow-[0_0_12px_rgba(234,179,8,0.15)]"
                              : "border-red-500/60 bg-red-500/10 shadow-[0_0_12px_rgba(239,68,68,0.15)]"
                            : "border-dark-border/50 hover:border-dark-border"
                        }`}>
                        <Icon className={`h-4 w-4 ${
                          active
                            ? c === "emerald" ? "text-emerald-400" : c === "yellow" ? "text-yellow-400" : "text-red-400"
                            : "text-text-secondary/50"
                        }`} />
                        <span className={`text-[10px] font-semibold text-center leading-tight ${
                          active ? "text-text-primary" : "text-text-secondary/60"
                        }`}>{s.label}</span>
                    </button>
              );
            })}
                </div>
              </div>

              <button type="button" onClick={handleGenerateCopy} disabled={generatingCopy || !productName.trim()} className={btnPrimary}>
                {generatingCopy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingCopy ? "Gerando copy…" : "Gerar Copy com IA"}
              </button>

              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-between mb-1.5">
                  <FieldLabel hint="Texto que será narrado no vídeo. Gere com IA acima ou edite manualmente. As legendas seguem esse texto com timestamps automáticos.">Roteiro da narração</FieldLabel>
                  {wordCount > 0 && (
                    <span className="text-[10px] text-text-secondary/50 bg-dark-bg/80 px-2 py-0.5 rounded-full border border-dark-border/50">
                      {wordCount} palavras · ~{Math.round(wordCount / 2.5)}s
                    </span>
            )}
          </div>
                <textarea
                  value={copyText} onChange={(e) => setCopyText(e.target.value)}
                  placeholder="Cole ou gere a copy com IA acima…"
                  className={`${inputCls} resize-none flex-1 min-h-[140px] font-medium leading-relaxed scrollbar-shopee overflow-y-auto`}
                />
            </div>
        </div>
                </div>

          {/* Right: Voice */}
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-pink-500/15 flex items-center justify-center">
                <Mic className="h-3.5 w-3.5 text-pink-400" />
                    </div>
                    <div>
                <p className="text-sm font-bold text-text-primary">Voz com IA + Legendas</p>
                <p className="text-[11px] text-text-secondary/50">ElevenLabs · timestamps sincronizados</p>
                      </div>
                    </div>

            <div className="p-5 flex flex-col gap-4 flex-1">
              {/* Voice selector */}
              <div>
                <FieldLabel hint="Vozes ElevenLabs. A narração será gerada com timestamps para legendas automáticas.">Escolha a voz</FieldLabel>
                {loadingVoices ? (
                  <div className="flex items-center gap-2 rounded-xl border border-dark-border bg-dark-bg px-3.5 py-2.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary/50" />
                    <span className="text-xs text-text-secondary/50">Carregando vozes…</span>
                        </div>
                ) : (
                  <select value={voiceId} onChange={(e) => setVoiceId(e.target.value)} className={selectCls}>
                    {voices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}{v.labels?.accent ? ` · ${v.labels.accent}` : ""}{v.labels?.description ? ` · ${v.labels.description}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Generate button */}
              <button type="button" onClick={handleGenerateVoice}
                disabled={generatingVoice || !copyText.trim() || !voiceId}
                className={`${btnPrimary} py-3 w-full`}>
                {generatingVoice
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Gerando voz e legendas…</>
                  : <><Volume2 className="h-4 w-4" /> Gerar Voz + Legendas</>
                }
              </button>

              {/* Audio result */}
              {voiceAudioUrl && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/6 overflow-hidden">
                  <div className="px-4 py-3 flex items-center gap-3 border-b border-emerald-500/15">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Check className="h-4 w-4 text-emerald-400" />
                  </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-300">Áudio gerado com sucesso</p>
                      <p className="text-[11px] text-emerald-400/60">{voiceAudioDuration.toFixed(1)}s de narração</p>
                </div>
                    {captions.length > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-1 rounded-lg">
                        <Check className="h-2.5 w-2.5" /> {captions.length} legendas
                      </span>
            )}
          </div>
                  <div className="px-4 py-3">
                    <audio src={voiceAudioUrl} controls className="w-full h-9 rounded-lg" />
        </div>
                </div>
              )}

              {/* Captions status: dica curta */}
              {!voiceAudioUrl && !generatingVoice && copyText && (
                <p className="text-[11px] text-text-secondary/50 flex items-center gap-1.5">
                  <Star className="h-3 w-3 text-amber-400/70 shrink-0" />
                  Clique em <strong className="text-text-secondary/70">Gerar Voz + Legendas</strong> para narração e legendas sincronizadas.
                </p>
              )}

              {generatingVoice && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex items-center gap-1.5">
                    {[0, 1, 2, 3, 4].map(i => (
                      <div key={i} className="w-1 bg-shopee-orange rounded-full animate-pulse"
                        style={{ height: `${12 + (i % 3) * 8}px`, animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
                  <p className="text-xs text-text-secondary/50">Sintetizando voz e sincronizando legendas…</p>
            </div>
                )}

              {/* Music — Biblioteca + Upload */}
              <div className="mt-auto pt-2 border-t border-dark-border/40">
                <div className="flex items-center gap-1.5 mb-2">
                  <label className="text-[11px] font-semibold text-text-secondary/60 uppercase tracking-wide">Música de fundo (opcional)</label>
                  <Tooltip text="Escolha uma música royalty-free da biblioteca ou envie seu próprio MP3. Use o slider para ajustar o volume." wide />
                </div>

                {/* Selected track display */}
                {selectedTrack && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/8 px-3 py-2 mb-2">
                    <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-text-primary truncate">{selectedTrack.name}</p>
                      <p className="text-[10px] text-text-secondary/50">{selectedTrack.artist} · {Math.floor(selectedTrack.duration / 60)}:{String(selectedTrack.duration % 60).padStart(2, "0")}</p>
                    </div>
                    <button type="button" onClick={() => { setMusicUrl(null); setSelectedTrack(null); }}
                      className="p-1.5 rounded-lg text-text-secondary/50 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}

                {/* Genre selector + search */}
                {!selectedTrack && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <select value={musicGenre} onChange={(e) => { setMusicGenre(e.target.value); setMusicPage(0); fetchMusicTracks(e.target.value); }} className={`${selectCls} flex-1`}>
                        {MUSIC_GENRES.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                      </select>
                      <button type="button" onClick={() => fetchMusicTracks(musicGenre)} disabled={loadingMusic}
                        className={`${btnPrimary} px-3`}>
                        {loadingMusic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                      </button>
                </div>

                    {/* Track list */}
                    {musicTracks.length > 0 && (() => {
                      const perPage = 3;
                      const totalMusicPages = Math.ceil(musicTracks.length / perPage);
                      const pagedTracks = musicTracks.slice(musicPage * perPage, (musicPage + 1) * perPage);
              return (
                        <>
                          <div className="rounded-xl border border-dark-border/40 divide-y divide-dark-border/20">
                            {pagedTracks.map((track) => (
                              <div key={track.id} className="flex items-center gap-2 px-3 py-2 hover:bg-white/3 transition-colors">
                                <button type="button" onClick={() => handlePreviewTrack(track)}
                                  className="w-7 h-7 rounded-lg bg-dark-bg flex items-center justify-center shrink-0 hover:bg-shopee-orange/20 transition-colors">
                                  {loadingTrackId === track.id
                                    ? <Loader2 className="h-3 w-3 animate-spin text-shopee-orange" />
                                    : previewingTrackId === track.id
                                      ? <div className="w-2.5 h-2.5 rounded-sm bg-shopee-orange" />
                                      : <Play className="h-3 w-3 text-text-secondary ml-0.5" />
                                  }
                                </button>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-text-primary truncate">{track.name}</p>
                                  <p className="text-[10px] text-text-secondary/50 truncate">{track.artist} · {Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, "0")}</p>
                </div>
                                <button type="button" onClick={() => handleSelectTrack(track)}
                                  className="text-[10px] font-bold text-shopee-orange hover:text-shopee-orange/80 px-2 py-1 rounded-lg hover:bg-shopee-orange/10 transition-all shrink-0">
                                  Usar
                                </button>
                              </div>
                            ))}
                          </div>
                          <PaginationControls page={musicPage} totalPages={totalMusicPages}
                            onPrev={() => setMusicPage((p) => Math.max(0, p - 1))}
                            onNext={() => setMusicPage((p) => Math.min(totalMusicPages - 1, p + 1))} />
                        </>
                      );
                    })()}

                    {!loadingMusic && musicTracks.length === 0 && (
                      <p className="text-[10px] text-text-secondary/40 text-center py-2">Selecione um gênero e clique em buscar</p>
                    )}
                    {loadingMusic && (
                      <div className="flex items-center justify-center gap-2 py-3">
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-text-secondary/50" />
                        <span className="text-xs text-text-secondary/50">Buscando músicas…</span>
              </div>
            )}
                    {musicLibraryError && !loadingMusic && (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                        <p className="text-[11px] text-amber-200/90 leading-relaxed">
                          {musicLibraryError}
                        </p>
                        <button
                          type="button"
                          onClick={() => fetchMusicTracks(musicGenre)}
                          className="mt-2 text-[10px] font-semibold text-amber-200 hover:text-amber-100 transition-colors"
                        >
                          Tentar novamente
                        </button>
            </div>
          )}
        </div>
                )}

                {/* Upload own MP3 */}
                <label className={`group flex items-center justify-center gap-2.5 rounded-xl border-2 border-dashed cursor-pointer py-2.5 transition-all mt-2 ${
                  musicUrl && !selectedTrack
                    ? "border-emerald-500/30 bg-emerald-500/6 hover:bg-emerald-500/10"
                    : "border-dark-border/40 hover:border-dark-border/60 bg-transparent hover:bg-white/3"
                }`}>
                  {musicUrl && !selectedTrack
                    ? <><Check className="h-3 w-3 text-emerald-400 shrink-0" /><span className="text-[10px] text-emerald-300 font-medium">MP3 carregado</span></>
                    : <><Upload className="h-3 w-3 text-text-secondary/40 group-hover:text-text-secondary/60 transition-colors shrink-0" /><span className="text-[10px] text-text-secondary/40 group-hover:text-text-secondary/60 transition-colors">Ou envie seu próprio MP3</span></>
                  }
                  <input type="file" accept="audio/*" className="hidden" onChange={handleMusicUpload} />
                </label>

                {/* Volume slider */}
                {musicUrl && (
                  <div className="flex items-center gap-3 mt-2.5">
                    <Volume2 className="h-3 w-3 text-text-secondary/40 shrink-0" />
                    <input type="range" min={0} max={0.5} step={0.01} value={musicVolume}
                      onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                      className="flex-1 accent-shopee-orange" />
                    <span className="text-[11px] text-text-secondary/60 w-8 text-right font-mono">{Math.round(musicVolume * 100)}%</span>
                  </div>
                )}
                </div>

              {/* Nav */}
              <div className="flex gap-2 shrink-0 pt-1">
                <button type="button" onClick={() => setStep(1)} className={btnSecondary}>
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <button type="button" onClick={() => setStep(3)} className={`flex-1 ${btnPrimary}`}>
                  Continuar para Estilo <ChevronRight className="h-4 w-4" />
                </button>
                    </div>
                  </div>
                </div>
                  </div>
                )}

      {/* ════════════════════════════════════════
          STEP 3: ESTILO
      ════════════════════════════════════════ */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-shopee-orange/15 flex items-center justify-center">
                <Film className="h-3.5 w-3.5 text-shopee-orange" />
                  </div>
              <div>
                <p className="text-sm font-bold text-text-primary">Estilo do vídeo</p>
                <p className="text-[11px] text-text-secondary/50">Template de edição e formato</p>
                </div>
                  </div>
            <div className="p-5 flex flex-col gap-4 flex-1">
              {(() => {
                const allStyles = Object.entries(VIDEO_STYLES);
                const perPage = 4;
                const totalPages = Math.ceil(allStyles.length / perPage);
                const paged = allStyles.slice(videoStylePage * perPage, (videoStylePage + 1) * perPage);
                return (
                  <>
                    <div className="grid grid-cols-1 gap-2">
                      {paged.map(([key, val]) => (
                        <button key={key} type="button" onClick={() => setVideoStyle(key as VideoStyleId)}
                          className={`text-left rounded-xl border p-3 transition-all ${
                            videoStyle === key ? "border-shopee-orange bg-shopee-orange/8" : "border-dark-border/50 hover:border-dark-border"
                          }`}>
                          <p className={`text-sm font-semibold ${videoStyle === key ? "text-shopee-orange" : "text-text-primary"}`}>{val.label}</p>
                          <p className="text-[11px] text-text-secondary/50 mt-0.5">{val.description}</p>
                        </button>
                      ))}
                </div>
                    <PaginationControls page={videoStylePage} totalPages={totalPages}
                      onPrev={() => setVideoStylePage((p) => Math.max(0, p - 1))}
                      onNext={() => setVideoStylePage((p) => Math.min(totalPages - 1, p + 1))} />
                  </>
                );
              })()}
              <div>
                <FieldLabel hint="Proporção do vídeo final. Stories 9:16, Feed 1:1, Paisagem 16:9.">Formato</FieldLabel>
                <div className="flex gap-2">
                  {ASPECT_RATIOS.map((r) => (
                    <button key={r.value} type="button" onClick={() => setAspectRatio(r.value)}
                      className={`flex-1 flex flex-col items-center py-2.5 rounded-xl text-xs font-semibold border transition-all gap-1 ${
                        aspectRatio === r.value ? "border-shopee-orange bg-shopee-orange/8 text-shopee-orange" : "border-dark-border text-text-secondary/60 hover:border-dark-border"
                      }`}>
                      <span className="text-base">{r.icon}</span>
                      <span>{r.label}</span>
                      <span className="text-[9px] opacity-60">{r.sub}</span>
                    </button>
                  ))}
                </div>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel hint="Exibido como overlay no vídeo (ex.: R$ 49,90). Deixe em branco se não quiser.">Preço (opcional)</FieldLabel>
                  <input type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="R$ 49,90" className={inputCls} />
                    </div>
                <div>
                  <FieldLabel hint="Chamada final do vídeo (ex.: Link na bio, Compre agora).">CTA final</FieldLabel>
                  <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Link na bio" className={inputCls} />
                  </div>
                    </div>
                    </div>
                    </div>
          <div className="bg-dark-card rounded-2xl border border-dark-border flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/15 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-text-primary">Estilo das legendas</p>
                <Tooltip text="Legendas em 3 palavras por vez, UPPERCASE, sincronizadas com a narração. Escolha a aparência (fonte, cor, posição)." wide />
                    </div>
                        </div>
            <div className="p-5 flex flex-col gap-2 flex-1">
              {(() => {
                const allThemes = Object.entries(SUBTITLE_THEMES);
                const perPage = 4;
                const totalPages = Math.ceil(allThemes.length / perPage);
                const paged = allThemes.slice(subtitlePage * perPage, (subtitlePage + 1) * perPage);
                return (
                  <>
                    {paged.map(([key, theme]) => (
                      <button key={key} type="button" onClick={() => setSubtitleThemeKey(key)}
                        className={`rounded-xl border p-3 flex items-center gap-3 transition-all ${
                          subtitleThemeKey === key ? "border-shopee-orange bg-shopee-orange/8" : "border-dark-border/50 hover:border-dark-border"
                        }`}>
                        <div className="shrink-0 rounded-lg w-24 h-10 flex items-center justify-center"
                          style={{ backgroundColor: theme.bgColor !== "transparent" ? theme.bgColor : "#1a1a1a" }}>
                          <span style={{ fontFamily: theme.fontFamily, fontSize: 12, fontWeight: 900, color: theme.color,
                            WebkitTextStroke: `${theme.strokeWidth * 0.25}px ${theme.strokeColor}`, paintOrder: "stroke fill", textTransform: "uppercase" }}>
                            LEGENDA
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${subtitleThemeKey === key ? "text-shopee-orange" : "text-text-primary"}`}>
                          {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
                        </span>
                      </button>
                    ))}
                    <PaginationControls page={subtitlePage} totalPages={totalPages}
                      onPrev={() => setSubtitlePage((p) => Math.max(0, p - 1))}
                      onNext={() => setSubtitlePage((p) => Math.min(totalPages - 1, p + 1))} />
                  </>
                );
              })()}
              <div className="flex gap-2 mt-auto pt-2">
                <button type="button" onClick={() => setStep(2)} className={btnSecondary}><ChevronLeft className="h-4 w-4" /> Voltar</button>
                <button type="button" onClick={() => setStep(4)} className={`flex-1 ${btnPrimary}`}>Ver Preview <ChevronRight className="h-4 w-4" /></button>
            </div>
            </div>
                    </div>
                  </div>
                )}

      {/* ════════════════════════════════════════
          STEP 4: PREVIEW & EXPORTAR
      ════════════════════════════════════════ */}
      {step === 4 && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
          {/* Left: Player (principal) */}
          <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-dark-border/60 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-shopee-orange/15 flex items-center justify-center">
                  <Play className="h-3.5 w-3.5 text-shopee-orange ml-0.5" />
                    </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Preview em tempo real</p>
                  <p className="text-[11px] text-text-secondary/50">{dimensions.width}×{dimensions.height} · {fps}fps · ~{totalDurationSec}s</p>
                      </div>
                  </div>
              <div className="flex items-center gap-1.5">
                {captions.length > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-1 rounded-lg">
                    <Check className="h-2.5 w-2.5" /> {captions.length} legendas
                  </span>
                )}
                {voiceAudioUrl && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-blue-300 bg-blue-500/15 px-2 py-1 rounded-lg">
                    <Volume2 className="h-2.5 w-2.5" /> {voiceAudioDuration.toFixed(0)}s voz
                  </span>
                          )}
              </div>
                  </div>

            {/* Player */}
            <div className="flex items-center justify-center bg-black/40 p-6">
              <div
                className="rounded-xl overflow-hidden border border-dark-border/40 shadow-2xl"
                style={{
                  width: aspectRatio === "16:9" ? 560 : aspectRatio === "1:1" ? 380 : 270,
                  height: aspectRatio === "16:9" ? 315 : aspectRatio === "1:1" ? 380 : 480,
                }}
              >
                <Player
                  component={VideoComposition}
                  inputProps={compositionProps}
                  durationInFrames={durationInFrames}
                  compositionWidth={dimensions.width}
                  compositionHeight={dimensions.height}
                  fps={fps}
                  controls
                  style={{ width: "100%", height: "100%" }}
                  autoPlay={false}
                />
        </div>
      </div>

            {/* Bottom bar */}
            <div className="px-5 py-3 border-t border-dark-border/60 flex items-center justify-between">
              <p className="text-[11px] text-text-secondary/40">
                Use play/pause para validar o criativo antes de exportar
              </p>
              <button type="button" onClick={() => setStep(3)} className={btnSecondary}>
                <ChevronLeft className="h-3.5 w-3.5" /> Editar estilo
        </button>
        </div>
      </div>

          {/* Right: Summary + Export */}
          <div className="flex flex-col gap-3">
            {/* Summary card */}
            <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
              <div className="px-4 py-3.5 border-b border-dark-border/60">
                <p className="text-xs font-bold text-text-primary uppercase tracking-wide">Configurações</p>
              </div>
              <div className="p-4 space-y-0">
                {[
                  { label: "Estilo", value: VIDEO_STYLES[videoStyle].label, icon: Film },
                  { label: "Mídias", value: `${selectedAssets.length} arquivo(s)`, icon: ImageIcon },
                  { label: "Formato", value: `${aspectRatio} · ${dimensions.width}×${dimensions.height}`, icon: Maximize2 },
                  { label: "Duração", value: `~${totalDurationSec}s`, icon: Timer },
                  { label: "Voz IA", value: voiceAudioUrl ? `${voiceAudioDuration.toFixed(1)}s` : "—", icon: Mic },
                  { label: "Legendas", value: captions.length > 0 ? `${captions.length} palavras` : "—", icon: Sparkles },
                  { label: "Música", value: musicUrl ? `${Math.round(musicVolume * 100)}%` : "—", icon: Music },
                ].map(({ label, value, icon: Icon }, i, arr) => (
                  <div key={label} className={`flex items-center gap-2.5 py-2.5 ${i < arr.length - 1 ? "border-b border-dark-border/30" : ""}`}>
                    <Icon className="h-3 w-3 text-text-secondary/40 shrink-0" />
                    <span className="text-xs text-text-secondary/60 flex-1">{label}</span>
                    <span className="text-xs font-semibold text-text-primary text-right">{value}</span>
          </div>
              ))}
            </div>
            </div>

            {/* Export card */}
            <div className="bg-dark-card rounded-2xl border border-dark-border overflow-hidden">
              <div className="p-4 space-y-3">
                <button
                  type="button"
                  disabled={
                    exportPrep
                    || remotionExport.state.status === "invoking"
                    || selectedAssets.length === 0
                  }
                  onClick={() => {
                    void (async () => {
                      setError(null);
                      try {
                        setExportPrep(true);
                        const resolved = await resolveInputPropsForRender(compositionProps);
                        setExportPrep(false);
                        await remotionExport.startRender(resolved);
                      } catch (e) {
                        setExportPrep(false);
                        setError(e instanceof Error ? e.message : "Erro ao preparar exportação");
                      }
                    })();
                  }}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all ${
                    exportPrep
                    || remotionExport.state.status === "invoking"
                    || selectedAssets.length === 0
                      ? "bg-gradient-to-r from-shopee-orange/40 to-shopee-orange/20 border-shopee-orange/30 text-shopee-orange/60 cursor-not-allowed"
                      : "bg-gradient-to-r from-shopee-orange to-shopee-orange/90 border-shopee-orange text-white hover:opacity-95 cursor-pointer"
                  }`}
                >
                  {exportPrep || remotionExport.state.status === "invoking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {exportPrep
                    ? "Preparando mídias..."
                    : remotionExport.state.status === "invoking"
                      ? "Gerando vídeo..."
                      : "Exportar MP4"}
                </button>
                {remotionExport.state.status === "invoking" && (
                  <div className="space-y-1">
                    <p className="text-[11px] text-text-secondary/80 text-center">{remotionExport.state.phase}</p>
                    <div className="h-1.5 rounded-full bg-dark-border overflow-hidden">
                      <div
                        className="h-full bg-shopee-orange transition-all"
                        style={{ width: `${Math.min(100, Math.round(remotionExport.state.progress * 100))}%` }}
                      />
                          </div>
                    {remotionExport.state.subtitle ? (
                      <p className="text-[10px] text-text-secondary/50 text-center">{remotionExport.state.subtitle}</p>
                    ) : null}
                            </div>
                          )}
                {remotionExport.state.status === "error" && (
                  <p className="text-[11px] text-red-400 text-center">{remotionExport.state.error}</p>
                )}
                {remotionExport.state.status === "done" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-emerald-400/90 text-center">
                      Pronto ({(remotionExport.state.size / (1024 * 1024)).toFixed(2)} MB)
                    </p>
                    <a
                      href={remotionExport.state.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center text-xs font-semibold text-shopee-orange hover:underline"
                    >
                      Abrir / baixar vídeo
                    </a>
                    <button
                      type="button"
                      onClick={() => remotionExport.reset()}
                      className="w-full text-[10px] text-text-secondary/60 hover:text-text-primary"
                    >
                      Fechar
                    </button>
                        </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-secondary/60">{label}</span>
      <span className="text-text-primary font-medium text-right">{value}</span>
    </div>
  );
}
