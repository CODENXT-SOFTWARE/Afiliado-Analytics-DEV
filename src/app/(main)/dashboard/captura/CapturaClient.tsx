"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import {
  Eye,
  MousePointerClick,
  ExternalLink,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Copy,
  Plus,
  X,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  LayoutTemplate,
  Smartphone,
  Monitor,
} from "lucide-react";

import { useSupabase } from "../../../components/auth/AuthProvider";
import LoadingOverlay from "../../../components/ui/LoadingOverlay";
import Toolist from "../../../components/ui/Toolist";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { usePlanEntitlements } from "../PlanEntitlementsContext";

import VipPreviewViewportShim from "./_components/VipPreviewViewportShim";
import type { CaptureSiteRow, LayoutVariant, PageTemplate } from "./_lib/types";
import { PAGE_TEMPLATE_OPTIONS, pageTemplateLabel } from "./_lib/captureTemplates";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";
import {
  DEFAULT_NOTIFICATIONS_POSITION,
  normalizeNotificationsPosition,
  NOTIFICATIONS_POSITION_OPTIONS,
  type NotificationsPosition,
} from "@/lib/capture-notifications";
import {
  CAPTURE_BLOCK_POSITION_OPTIONS,
  DEFAULT_YOUTUBE_POSITION,
  normalizeYoutubePosition,
  type CaptureBlockPosition,
} from "@/lib/capture-block-position";
import {
  DEFAULT_OFERT_CAROUSEL_POSITION,
  carouselPublicUrls,
  normalizeOfertCarouselPosition,
  normalizeOfertCarouselSlots,
  type OfertCarouselPosition,
} from "@/lib/capture-ofert-carousel";
import {
  normalizePromoSectionsEnabled,
  promoSectionTitlesToJsonb,
  promoTitlesForForm,
  resolvePromoTitlesForPublicPage,
} from "@/lib/capture-promo-sections";
import {
  AURORA_CARD_DEFAULTS,
  appendEmptyAuroraCard,
  appendEmptyRosaCard,
  appendEmptyTerrosoCard,
  appendSimpleLine,
  createDefaultPromoCardsDraft,
  mergePromoCardsDraftFromDb,
  promoSectionCardsToDbValue,
  PROMO_AURORA_MAX,
  PROMO_AURORA_MIN,
  PROMO_ROSA_MAX,
  PROMO_ROSA_MIN,
  PROMO_SIMPLE_MAX,
  PROMO_SIMPLE_MIN,
  PROMO_TERRO_MAX,
  PROMO_TERRO_MIN,
  removeAuroraCardAt,
  removeRosaCardAt,
  removeSimpleLineAt,
  removeTerrosoCardAt,
  resolvePromoCardsForPublicPage,
  type RosaLeadMode,
} from "@/lib/capture-promo-cards";
import {
  promoRosaUiOverridesFromUnknown,
  promoRosaUiToJsonb,
  type PromoRosaFontPreset,
  type PromoRosaUiOverrides,
} from "@/lib/capture-promo-rosa-ui";
import { normalizeRosaIconKey, vipRosaIconPickerOptions } from "@/lib/capture-promo-icons";
import {
  blankCanvasToDbValue,
  createDefaultBlankCanvas,
  mergeBlankCanvasFromDb,
} from "@/lib/capture-blank-canvas";
import { isValidOptionalYoutubeUrl } from "@/lib/youtube-embed";
import { formatDateTimePtBR, isExpired, sanitizeSlug } from "./_lib/captureUtils";

import CapturePreviewCard from "./_components/CapturePreviewCard";
import CaptureVipLanding from "@/app/capture/[slug]/CaptureVipLanding";
import CaptureBlankCanvas from "@/app/capture/[slug]/CaptureBlankCanvas";
import { CaptureEmBrancoToastsOnly } from "@/app/capture/[slug]/CaptureEmBrancoExtraBlocks";
import { CapturePreviewPortalContext } from "@/app/capture/[slug]/CapturePreviewPortalContext";
import DeleteSiteModal from "./_components/DeleteSiteModal";
import VipRosaIconPicker from "./_components/VipRosaIconPicker";
import EmBrancoBuilderPanel from "./_components/EmBrancoBuilderPanel";
import LayoutVariantField from "./_components/LayoutVariantField";
import ResetMetricsModal from "./_components/ResetMetricsModal";
import { persistOfertCarouselSlots } from "./_lib/ofertCarouselPersist";

/** Igual ao breakpoint `md` do Tailwind (768px). */
function useMatchMedia(query: string, ssrFallback = false): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(query).matches : ssrFallback),
    () => ssrFallback,
  );
}

const DOMAIN = "s.afiliadoanalytics.com.br";
const LOGO_BUCKET = "capture-logos";
const PRO_CAPTURE_CHECKOUT_URL = "https://pay.kiwify.com.br/y7I4SuT";

/** `public/celularmockup.png` (957×1949) — área útil da tela em % do retângulo do mockup. */
const VIP_PREVIEW_MOCKUP = {
  src: "/celularmockup.png",
  w: 957,
  h: 1949,
  /**
   * Insets em viewport larga (≥768px, Tailwind `md`): painel do dashboard em desktop.
   * top/bottom menores = conteúdo ocupa mais em altura; lados menores = mais largura.
   */
  screen: { top: "5.65%", left: "4.55%", right: "4.55%", bottom: "6.05%" },
  /**
   * Insets em viewport estreita (&lt;768px): dashboard no telemóvel / coluna estreita.
   * Calibre manualmente (valores iniciais abaixo).
   */
  screenMaxMd: { top: "2%", left: "4.55%", right: "2.55%", bottom: "4.05%" },
} as const;

/**
 * `public/pc.png` (2330×1464) — área do display em % do retângulo **da própria imagem**
 * (wrapper `w-fit` + img; evita desvio por letterboxing de `object-contain`).
 * Tela do asset é branca opaca: a moldura fica por cima com `mix-blend-multiply` para o conteúdo/vídeo aparecer “dentro” do ecrã.
 */
const VIP_PREVIEW_PC_MOCKUP = {
  src: "/pc.png",
  w: 2330,
  h: 1464,
  screen: { top: "4.4%", left: "13.7%", right: "11.7%", bottom: "30.5%" },
  /**
   * Viewport &lt;768px: encolhe a “janela” do conteúdo (aumentar top/left/right/bottom = menos W e H úteis).
   * Calibre à mão. O `max-h` do &lt;img&gt; também baixa no mobile — ver bloco do preview PC.
   */
  screenMaxMd: { top: "6.2%", left: "16.5%", right: "14.5%", bottom: "32%" },
} as const;

const DEFAULT_BUTTON_TEXT = "Acessar Grupo Vip";

const MAX_LOGO_BYTES = 1 * 1024 * 1024; // 1MB

const labelClass = "block text-sm font-medium text-text-primary mb-2";

const inputClass =
  "w-full h-11 px-4 bg-dark-bg border border-dark-border rounded-lg text-text-primary " +
  "placeholder:text-text-secondary/70 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-shopee-orange/60 focus:border-shopee-orange/60";

const inputDisabledClass =
  "w-full h-11 px-4 bg-dark-bg/50 border border-dark-border rounded-lg text-text-secondary cursor-not-allowed";

const textareaClass =
  "w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-text-primary " +
  "placeholder:text-text-secondary/70 transition-colors " +
  "focus:outline-none focus:ring-2 focus:ring-shopee-orange/60 focus:border-shopee-orange/60";

function normalizeHex(v: string) {
  const s = v.trim();
  if (!s) return "";
  return s.startsWith("#") ? s : `#${s}`;
}

function isValidHexColor(v: string) {
  return /^#[0-9a-fA-F]{6}$/.test(v);
}

function isValidPixelId(v: string) {
  if (!v.trim()) return true; // vazio é válido
  return /^\d{5,20}$/.test(v.trim());
}

function isValidHttpUrl(v: string) {
  const s = v.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function getErrorMessage(err: unknown, fallback = "Erro inesperado.") {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const maybe = err as Record<string, unknown>;
    const msg = maybe["message"];
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

function getButtonTextFromRow(row: unknown): string | undefined {
  if (!row || typeof row !== "object") return undefined;
  const v = (row as Record<string, unknown>)["button_text"];
  return typeof v === "string" ? v : undefined;
}

function rowPublicUrl(row: CaptureSiteRow) {
  return `https://${DOMAIN}/${row.slug}`;
}

type Mode = "empty" | "pickTemplate" | "create" | "view" | "edit";

export default function CapturaClient() {
  const ctx = useSupabase();
  const supabase = ctx?.supabase;
  const session = ctx?.session;
  const { entitlements, refresh } = usePlanEntitlements();
  const captureLimit = entitlements?.captureLinks ?? 1;

  const [pageLoading, setPageLoading] = useState(true);

  const [sites, setSites] = useState<CaptureSiteRow[]>([]);
  const [deleteTargetSite, setDeleteTargetSite] = useState<CaptureSiteRow | null>(null);

  const [site, setSite] = useState<CaptureSiteRow | null>(null);
  const [mode, setMode] = useState<Mode>("empty");

  // Wizard: 1 slug/logo/cor · 2 textos · 3 link/pixel · 4 YouTube, carrossel, notificações
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Scroll reset: rolar até o Header ("Site de Captura ...")
  const pageHeaderRef = useRef<HTMLDivElement | null>(null);

  // Mantém o mode atual acessível dentro de callbacks sem re-criar dependências
  const modeRef = useRef<Mode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const isWizardOpenRef = useRef(false);
  useEffect(() => {
    isWizardOpenRef.current = mode === "create" || mode === "edit" || mode === "pickTemplate";
  }, [mode]);

  useEffect(() => {
    if (mode !== "create" && mode !== "edit") return;

    requestAnimationFrame(() => {
      const el = pageHeaderRef.current;
      if (!el) return;

      const top = el.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top, behavior: "smooth" });
    });
  }, [step, mode]);

  // form states
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  // NÃO auto-preenche no create
  const [buttonText, setButtonText] = useState("");

  const [whatsappUrl, setWhatsappUrl] = useState(""); // Link do botão (mantive nome para não quebrar esquema/coluna)
  const [buttonColor, setButtonColor] = useState("#25D366");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubePosition, setYoutubePosition] = useState<CaptureBlockPosition>(DEFAULT_YOUTUBE_POSITION);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationsPosition, setNotificationsPosition] =
    useState<NotificationsPosition>(DEFAULT_NOTIFICATIONS_POSITION);

  const [ofertCarouselEnabled, setOfertCarouselEnabled] = useState(false);
  const [ofertCarouselPosition, setOfertCarouselPosition] = useState<OfertCarouselPosition>(
    DEFAULT_OFERT_CAROUSEL_POSITION,
  );
  const [carouselSlotPath, setCarouselSlotPath] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [carouselSlotFile, setCarouselSlotFile] = useState<(File | null)[]>([null, null, null, null]);
  const initialCarouselPathsRef = useRef<(string | null)[]>([null, null, null, null]);
  const [carouselBlobUrls, setCarouselBlobUrls] = useState<(string | null)[]>([null, null, null, null]);

  const [promoSectionsEnabled, setPromoSectionsEnabled] = useState(true);
  const [promoTitleBenefits, setPromoTitleBenefits] = useState("");
  const [promoTitleTestimonials, setPromoTitleTestimonials] = useState("");
  const [promoTitleInGroup, setPromoTitleInGroup] = useState("");
  const [promoCardsDraft, setPromoCardsDraft] = useState(createDefaultPromoCardsDraft);
  const [auroraAvatarFiles, setAuroraAvatarFiles] = useState<(File | null)[]>(() =>
    Array.from({ length: createDefaultPromoCardsDraft().aurora.length }, () => null),
  );
  const [auroraAvatarBlobUrls, setAuroraAvatarBlobUrls] = useState<(string | null)[]>([]);

  const [promoRosaUiDraft, setPromoRosaUiDraft] = useState<PromoRosaUiOverrides>({});
  const [rosaPromoImageFiles, setRosaPromoImageFiles] = useState<(File | null)[]>([]);
  const [rosaPromoBlobUrls, setRosaPromoBlobUrls] = useState<(string | null)[]>([]);

  const [blankCanvasDraft, setBlankCanvasDraft] = useState(createDefaultBlankCanvas);
  const [blankHeroFile, setBlankHeroFile] = useState<File | null>(null);
  const [blankHeroBlobUrl, setBlankHeroBlobUrl] = useState<string | null>(null);
  const [blankBgFile, setBlankBgFile] = useState<File | null>(null);
  const [blankBgBlobUrl, setBlankBgBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blankHeroFile) {
      setBlankHeroBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(blankHeroFile);
    setBlankHeroBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blankHeroFile]);

  useEffect(() => {
    if (!blankBgFile) {
      setBlankBgBlobUrl(null);
      return;
    }
    const u = URL.createObjectURL(blankBgFile);
    setBlankBgBlobUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blankBgFile]);

  useEffect(() => {
    const urls = auroraAvatarFiles.map((f) => (f ? URL.createObjectURL(f) : null));
    setAuroraAvatarBlobUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [auroraAvatarFiles]);

  useEffect(() => {
    const urls = rosaPromoImageFiles.map((f) => (f ? URL.createObjectURL(f) : null));
    setRosaPromoBlobUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [rosaPromoImageFiles]);

  useEffect(() => {
    const n = promoCardsDraft.rosa.length;
    setRosaPromoImageFiles((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(null);
      return next;
    });
  }, [promoCardsDraft.rosa.length]);

  useEffect(() => {
    const urls = carouselSlotFile.map((f) => (f ? URL.createObjectURL(f) : null));
    setCarouselBlobUrls(urls);
    return () => {
      urls.forEach((u) => u && URL.revokeObjectURL(u));
    };
  }, [carouselSlotFile]);
  /** Overlay onde o toast VIP é portado no preview (não cobre o resto do dashboard). */
  const [vipPreviewToastRoot, setVipPreviewToastRoot] = useState<HTMLDivElement | null>(null);
  /** Preview VIP: moldura celular ou notebook (`pc.png`). */
  const [vipPreviewDevice, setVipPreviewDevice] = useState<"mobile" | "desktop">("mobile");
  /** Recorte da “tela” no mockup celular: outro conjunto de % quando a janela é menor que 768px (Tailwind md). */
  const vipMobilePreviewNarrow = useMatchMedia("(max-width: 767px)");
  const vipMobileScreenInsets = vipMobilePreviewNarrow
    ? VIP_PREVIEW_MOCKUP.screenMaxMd
    : VIP_PREVIEW_MOCKUP.screen;
  const vipPcScreenInsets = vipMobilePreviewNarrow
    ? VIP_PREVIEW_PC_MOCKUP.screenMaxMd
    : VIP_PREVIEW_PC_MOCKUP.screen;

  // layout variant (icons | scarcity) — só página classic
  const [layoutVariant, setLayoutVariant] = useState<LayoutVariant>("icons");
  const [pageTemplate, setPageTemplate] = useState<PageTemplate>("classic");
  const pageTemplateRef = useRef<PageTemplate>("classic");
  useEffect(() => {
    pageTemplateRef.current = pageTemplate;
  }, [pageTemplate]);

  // UI states
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Logo
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoLocalPreviewUrl, setLogoLocalPreviewUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Ação pendente da logo (aplica apenas ao salvar no EDIT)
  const [logoPendingAction, setLogoPendingAction] = useState<"keep" | "remove" | "upload">("keep");

  // Mensagem fixa (não some sozinha) — FICA NO BLOCO DA LOGO
  const [logoToast, setLogoToast] = useState<string | null>(null);

  // Troca de link → modal de reset
  const originalButtonUrlRef = useRef<string>("");
  const [showResetMetricsModal, setShowResetMetricsModal] = useState(false);

  useEffect(() => {
    if (!logoFile) {
      setLogoLocalPreviewUrl(null);
      return;
    }
    const u = URL.createObjectURL(logoFile);
    setLogoLocalPreviewUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [logoFile]);

  const publicUrl = useMemo(() => {
    const s = site?.slug ?? slug;
    return s ? `https://${DOMAIN}/${s}` : `https://${DOMAIN}/seu-slug`;
  }, [site?.slug, slug]);

  const publicUrlForDelete = useMemo(() => {
    const t = deleteTargetSite ?? site;
    const s = t?.slug;
    return s ? `https://${DOMAIN}/${s}` : `https://${DOMAIN}/`;
  }, [deleteTargetSite, site?.slug]);

  const previewTitle = useMemo(() => title, [title]);
  const previewDesc = useMemo(() => description, [description]);
  const previewColor = useMemo(() => buttonColor, [buttonColor]);

  const previewLayout = useMemo<LayoutVariant>(() => layoutVariant, [layoutVariant]);

  const previewLogoSrc = useMemo(() => logoLocalPreviewUrl ?? logoUrl ?? null, [logoLocalPreviewUrl, logoUrl]);

  const hasMetricsData = useMemo(() => {
    const v = site?.view_count ?? 0;
    const c = site?.cta_click_count ?? 0;
    return v > 0 || c > 0;
  }, [site?.view_count, site?.cta_click_count]);

  const linkChanged = useMemo(() => {
    if (mode !== "edit") return false;
    const a = (originalButtonUrlRef.current || "").trim();
    const b = (whatsappUrl || "").trim();
    if (!a || !b) return false;
    return a !== b;
  }, [mode, whatsappUrl]);

  /** URLs do carrossel para o preview (deve ficar antes de qualquer return — Rules of Hooks). */
  const ofertCarouselPreviewUrls = useMemo(() => {
    if (!supabase) return [] as string[];
    const out: string[] = [];
    for (let i = 0; i < 4; i++) {
      if (carouselBlobUrls[i]) out.push(carouselBlobUrls[i]!);
      else if (carouselSlotPath[i]) {
        const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(carouselSlotPath[i]!);
        if (data.publicUrl) out.push(data.publicUrl);
      }
    }
    return out;
  }, [supabase, carouselBlobUrls, carouselSlotPath]);

  /** Preview por slot (0–3) para o grid do carrossel (passo 4 nos VIP; passo 5 no Em branco). */
  const carouselSlotPreviewByIndex = useMemo(() => {
    const out: (string | null)[] = [null, null, null, null];
    for (let i = 0; i < 4; i++) {
      if (carouselBlobUrls[i]) {
        out[i] = carouselBlobUrls[i];
        continue;
      }
      if (supabase && carouselSlotPath[i]) {
        const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(carouselSlotPath[i]!);
        out[i] = data.publicUrl ?? null;
      }
    }
    return out;
  }, [supabase, carouselBlobUrls, carouselSlotPath]);

  const promoAuroraAvatarUrlsPreview = useMemo(() => {
    if (pageTemplate !== "aurora_ledger" || !supabase) return undefined;
    return promoCardsDraft.aurora.map((row, i) => {
      if (auroraAvatarBlobUrls[i]) return auroraAvatarBlobUrls[i];
      const p = row.avatar_path?.trim();
      if (p) {
        const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(p);
        return data.publicUrl ?? null;
      }
      return null;
    });
  }, [pageTemplate, supabase, promoCardsDraft.aurora, auroraAvatarBlobUrls]);

  /** Miniaturas dos cards estilo Rosa (VIP Rosa / Em branco) para o preview ao vivo. */
  const promoRosaCardPreviewUrls = useMemo((): (string | null)[] | undefined => {
    if (pageTemplate !== "vip_rosa" && pageTemplate !== "em_branco") return undefined;
    return promoCardsDraft.rosa.map((row, i) => {
      if (rosaPromoBlobUrls[i]) return rosaPromoBlobUrls[i];
      const p = row.image_path?.trim();
      if (p && supabase) {
        const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(p);
        return data.publicUrl ?? null;
      }
      return null;
    });
  }, [pageTemplate, supabase, promoCardsDraft.rosa, rosaPromoBlobUrls]);

  const blankHeroPreviewUrl = useMemo(() => {
    if (blankHeroBlobUrl) return blankHeroBlobUrl;
    if (pageTemplate !== "em_branco" || !supabase) return null;
    const p = blankCanvasDraft.heroPath?.trim();
    if (!p) return null;
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(p);
    return data.publicUrl ?? null;
  }, [pageTemplate, supabase, blankCanvasDraft.heroPath, blankHeroBlobUrl]);

  const blankBgPreviewUrl = useMemo(() => {
    if (!blankCanvasDraft.bgImageEnabled) return null;
    if (blankBgBlobUrl) return blankBgBlobUrl;
    if (pageTemplate !== "em_branco" || !supabase) return null;
    const p = blankCanvasDraft.bgImagePath?.trim();
    if (!p) return null;
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(p);
    return data.publicUrl ?? null;
  }, [pageTemplate, supabase, blankCanvasDraft.bgImageEnabled, blankCanvasDraft.bgImagePath, blankBgBlobUrl]);

  const clearBlankHeroSlot = useCallback(async () => {
    const path = blankCanvasDraft.heroPath?.trim();
    if (site?.id && path) {
      try {
        const r = await fetch("/api/captura/ofert-carousel-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id, path }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j?.error || "Erro ao remover a imagem.");
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Erro ao remover a imagem."));
        return;
      }
    }
    setBlankHeroFile(null);
    setBlankCanvasDraft((d) => ({ ...d, heroPath: null }));
  }, [site?.id, blankCanvasDraft.heroPath]);

  const clearRosaPromoCardImage = useCallback(
    async (index: number) => {
      const path = promoCardsDraft.rosa[index]?.image_path?.trim();
      if (site?.id && path) {
        try {
          const r = await fetch("/api/captura/ofert-carousel-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ site_id: site.id, path }),
          });
          const j = (await r.json()) as { error?: string };
          if (!r.ok) throw new Error(j?.error || "Erro ao remover a imagem.");
        } catch (e: unknown) {
          setError(getErrorMessage(e, "Erro ao remover a imagem."));
          return;
        }
      }
      setRosaPromoImageFiles((prev) => {
        const next = [...prev];
        next[index] = null;
        return next;
      });
      setPromoCardsDraft((d) => {
        const rosa = [...d.rosa];
        rosa[index] = { ...rosa[index]!, image_path: null, lead_mode: "icon" };
        return { ...d, rosa };
      });
    },
    [site?.id, promoCardsDraft.rosa],
  );

  const clearBlankBgSlot = useCallback(async () => {
    const path = blankCanvasDraft.bgImagePath?.trim();
    if (site?.id && path) {
      try {
        const r = await fetch("/api/captura/ofert-carousel-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id, path }),
        });
        const j = (await r.json()) as { error?: string };
        if (!r.ok) throw new Error(j?.error || "Erro ao remover a imagem.");
      } catch (e: unknown) {
        setError(getErrorMessage(e, "Erro ao remover a imagem de fundo."));
        return;
      }
    }
    setBlankBgFile(null);
    setBlankCanvasDraft((d) => ({ ...d, bgImagePath: null, bgImageEnabled: false }));
  }, [site?.id, blankCanvasDraft.bgImagePath]);

  const clearAuroraSlotPhoto = useCallback(
    async (index: number, storedPath: string | null | undefined) => {
      const path = storedPath?.trim();
      if (site?.id && path) {
        try {
          const r = await fetch("/api/captura/ofert-carousel-delete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ site_id: site.id, path }),
          });
          const j = (await r.json()) as { error?: string };
          if (!r.ok) throw new Error(j?.error || "Erro ao remover a foto.");
        } catch (e: unknown) {
          setError(getErrorMessage(e, "Erro ao remover a foto."));
          return;
        }
      }
      setAuroraAvatarFiles((prev) => {
        const next = [...prev];
        if (index >= 0 && index < next.length) next[index] = null;
        return next;
      });
      setPromoCardsDraft((d) => {
        const aurora = [...d.aurora];
        if (!aurora[index]) return d;
        aurora[index] = { ...aurora[index]!, avatar_path: null };
        return { ...d, aurora };
      });
    },
    [site?.id],
  );

  const blockPositionPickerOptions = useMemo(
    () =>
      CAPTURE_BLOCK_POSITION_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        description:
          o.value === "below_title"
            ? "Zona logo abaixo do título"
            : o.value === "above_cta"
              ? "Antes do botão principal"
              : o.value === "below_cta"
                ? "Depois do botão e avisos"
                : "Última área do card",
      })),
    [],
  );

  const notificationsPickerOptions = useMemo(
    () =>
      NOTIFICATIONS_POSITION_OPTIONS.map((o) => ({
        value: o.value,
        label: o.label,
        description: o.value.replace(/_/g, " · "),
      })),
    [],
  );

  const setLogoFromLogopath = useCallback(
    (logopath: string | null) => {
      if (!supabase || !logopath) {
        setLogoUrl(null);
        return;
      }
      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(logopath);
      setLogoUrl(data.publicUrl ?? null);
    },
    [supabase]
  );

  // -------------------------
  // Fetch (sem derrubar wizard) — vários sites (Pro/Staff)
  // -------------------------
  const fetchSites = useCallback(async () => {
    if (!supabase || !session) return;

    const wizardOpen =
      modeRef.current === "create" || modeRef.current === "edit" || modeRef.current === "pickTemplate";

    if (!wizardOpen) setPageLoading(true);
    setError(null);

    const { data, error } = await supabase
      .from("capture_sites")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      setError(error.message);
      setSite(null);
      setSites([]);

      if (!wizardOpen) {
        modeRef.current = "empty";
        setMode("empty");
        setLogoUrl(null);
      }

      setPageLoading(false);
      return;
    }

    const rows = (data as CaptureSiteRow[]) ?? [];
    setSites(rows);

    if (rows.length === 0) {
      setSite(null);
      if (!wizardOpen) {
        modeRef.current = "empty";
        setMode("empty");
        setLogoUrl(null);
      }
      setPageLoading(false);
      return;
    }

    if (wizardOpen) {
      setPageLoading(false);
      return;
    }

    setSite(null);
    modeRef.current = "view";
    setMode("view");
    setPageLoading(false);
  }, [supabase, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (session && supabase) fetchSites();
  }, [session, supabase, fetchSites]);

  async function copyToClipboard(text: string, rowId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(rowId);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  }

  function openTemplatePicker() {
    if (sites.length >= captureLimit) {
      setError(`Limite de ${captureLimit} site(s) de captura atingido.`);
      return;
    }
    setError(null);
    modeRef.current = "pickTemplate";
    setMode("pickTemplate");
  }

  function cancelTemplatePicker() {
    setError(null);
    if (sites.length > 0) {
      modeRef.current = "view";
      setMode("view");
    } else {
      modeRef.current = "empty";
      setMode("empty");
    }
  }

  function confirmTemplateChoice(t: PageTemplate) {
    setError(null);
    pageTemplateRef.current = t;
    setPageTemplate(t);
    setStep(1);

    setSlug("");
    setTitle("");
    setDescription("");
    setButtonText("");
    setWhatsappUrl("");
    setButtonColor("#25D366");
    setLayoutVariant(t === "classic" ? "icons" : "scarcity");
    setMetaPixelId("");
    setYoutubeUrl("");
    setYoutubePosition(DEFAULT_YOUTUBE_POSITION);

    const emBrancoTpl = t === "em_branco";
    setNotificationsEnabled(!emBrancoTpl);
    setNotificationsPosition(DEFAULT_NOTIFICATIONS_POSITION);

    setOfertCarouselEnabled(false);
    setOfertCarouselPosition(DEFAULT_OFERT_CAROUSEL_POSITION);
    setCarouselSlotPath([null, null, null, null]);
    setCarouselSlotFile([null, null, null, null]);
    initialCarouselPathsRef.current = [null, null, null, null];

    const promoForm = promoTitlesForForm(t, {});
    setPromoSectionsEnabled(!emBrancoTpl);
    setPromoTitleBenefits(promoForm.benefits);
    setPromoTitleTestimonials(promoForm.testimonials);
    setPromoTitleInGroup(promoForm.inGroup);
    const fresh = createDefaultPromoCardsDraft();
    setPromoCardsDraft(fresh);
    setAuroraAvatarFiles(Array.from({ length: fresh.aurora.length }, () => null));
    setPromoRosaUiDraft({});
    setRosaPromoImageFiles([]);
    setBlankCanvasDraft(createDefaultBlankCanvas());
    setBlankHeroFile(null);
    setBlankBgFile(null);

    setLogoFile(null);
    setLogoPendingAction("keep");
    setLogoToast(null);

    originalButtonUrlRef.current = "";

    modeRef.current = "create";
    setMode("create");
  }

  function startEdit(row: CaptureSiteRow) {
    setError(null);
    setStep(1);

    setSite(row);
    setTitle(row.title ?? "");
    setDescription(row.description ?? "");
    setButtonText(getButtonTextFromRow(row) ?? DEFAULT_BUTTON_TEXT);
    setWhatsappUrl(row.whatsapp_url ?? "");
    setButtonColor(row.button_color ?? "#25D366");
    setLayoutVariant((row.layout_variant ?? "icons") as LayoutVariant);
    setPageTemplate(((row as CaptureSiteRow).page_template ?? "classic") as PageTemplate);
    setMetaPixelId(row.meta_pixel_id ?? "");
    setYoutubeUrl(row.youtube_url ?? "");
    setYoutubePosition(normalizeYoutubePosition(row.youtube_position));

    setNotificationsEnabled(row.notifications_enabled !== false);
    setNotificationsPosition(normalizeNotificationsPosition(row.notifications_position));

    const ocSlots = normalizeOfertCarouselSlots(row.ofert_carousel_image_paths);
    setOfertCarouselEnabled(row.ofert_carousel_enabled === true);
    setOfertCarouselPosition(normalizeOfertCarouselPosition(row.ofert_carousel_position));
    setCarouselSlotPath([...ocSlots]);
    initialCarouselPathsRef.current = [...ocSlots];
    setCarouselSlotFile([null, null, null, null]);

    const promoForm = promoTitlesForForm(
      (row.page_template ?? "classic") as PageTemplate,
      row.promo_section_titles,
    );
    setPromoSectionsEnabled(normalizePromoSectionsEnabled(row.promo_sections_enabled));
    setPromoTitleBenefits(promoForm.benefits);
    setPromoTitleTestimonials(promoForm.testimonials);
    setPromoTitleInGroup(promoForm.inGroup);
    const mergedCards = mergePromoCardsDraftFromDb(
      (row.page_template ?? "classic") as PageTemplate,
      row.promo_section_cards,
    );
    setPromoCardsDraft(mergedCards);
    setAuroraAvatarFiles(Array.from({ length: mergedCards.aurora.length }, () => null));
    setPromoRosaUiDraft(promoRosaUiOverridesFromUnknown((row as CaptureSiteRow).promo_rosa_ui));
    setRosaPromoImageFiles(Array.from({ length: mergedCards.rosa.length }, () => null));
    setBlankCanvasDraft(mergeBlankCanvasFromDb((row as CaptureSiteRow).blank_canvas_json));
    setBlankHeroFile(null);
    setBlankBgFile(null);

    setLogoFile(null);
    setLogoPendingAction("keep");
    setLogoToast(null);

    originalButtonUrlRef.current = (row.whatsapp_url ?? "").trim();

    modeRef.current = "edit";
    setMode("edit");
    setLogoFromLogopath(row.logopath);
  }

  function cancelEditOrCreate() {
    setError(null);
    setStep(1);

    setBlankHeroFile(null);
    setBlankBgFile(null);

    setLogoFile(null);
    setLogoPendingAction("keep");
    setLogoToast(null);

    setShowResetMetricsModal(false);

    if (site) {
      setTitle(site.title ?? "");
      setDescription(site.description ?? "");
      setButtonText(getButtonTextFromRow(site) ?? DEFAULT_BUTTON_TEXT);
      setWhatsappUrl(site.whatsapp_url ?? "");
      setButtonColor(site.button_color ?? "#25D366");
      setLayoutVariant((site.layout_variant ?? "icons") as LayoutVariant);
      setPageTemplate(((site as CaptureSiteRow).page_template ?? "classic") as PageTemplate);
      setMetaPixelId(site.meta_pixel_id ?? "");
      setYoutubeUrl(site.youtube_url ?? "");
      setYoutubePosition(normalizeYoutubePosition(site.youtube_position));
      setNotificationsEnabled(site.notifications_enabled !== false);
      setNotificationsPosition(normalizeNotificationsPosition(site.notifications_position));

      const ocSlotsCancel = normalizeOfertCarouselSlots(site.ofert_carousel_image_paths);
      setOfertCarouselEnabled(site.ofert_carousel_enabled === true);
      setOfertCarouselPosition(normalizeOfertCarouselPosition(site.ofert_carousel_position));
      setCarouselSlotPath([...ocSlotsCancel]);
      initialCarouselPathsRef.current = [...ocSlotsCancel];
      setCarouselSlotFile([null, null, null, null]);

      const promoCancel = promoTitlesForForm(
        (site.page_template ?? "classic") as PageTemplate,
        site.promo_section_titles,
      );
      setPromoSectionsEnabled(normalizePromoSectionsEnabled(site.promo_sections_enabled));
      setPromoTitleBenefits(promoCancel.benefits);
      setPromoTitleTestimonials(promoCancel.testimonials);
      setPromoTitleInGroup(promoCancel.inGroup);
      const mergedCancel = mergePromoCardsDraftFromDb(
        (site.page_template ?? "classic") as PageTemplate,
        site.promo_section_cards,
      );
      setPromoCardsDraft(mergedCancel);
      setAuroraAvatarFiles(Array.from({ length: mergedCancel.aurora.length }, () => null));
      setPromoRosaUiDraft(promoRosaUiOverridesFromUnknown((site as CaptureSiteRow).promo_rosa_ui));
      setRosaPromoImageFiles(Array.from({ length: mergedCancel.rosa.length }, () => null));
      setBlankCanvasDraft(mergeBlankCanvasFromDb((site as CaptureSiteRow).blank_canvas_json));

      originalButtonUrlRef.current = (site.whatsapp_url ?? "").trim();

      modeRef.current = "view";
      setMode("view");
      setSite(null);
      setLogoFromLogopath(null);
      setLogoUrl(null);
    } else if (sites.length > 0) {
      originalButtonUrlRef.current = "";
      modeRef.current = "view";
      setMode("view");
      setLogoUrl(null);
      setMetaPixelId("");
      setYoutubeUrl("");
      setYoutubePosition(DEFAULT_YOUTUBE_POSITION);
      setNotificationsEnabled(true);
      setNotificationsPosition(DEFAULT_NOTIFICATIONS_POSITION);
      setOfertCarouselEnabled(false);
      setOfertCarouselPosition(DEFAULT_OFERT_CAROUSEL_POSITION);
      setCarouselSlotPath([null, null, null, null]);
      setCarouselSlotFile([null, null, null, null]);
      initialCarouselPathsRef.current = [null, null, null, null];
      const promoEmpty = promoTitlesForForm("classic", {});
      setPromoSectionsEnabled(true);
      setPromoTitleBenefits(promoEmpty.benefits);
      setPromoTitleTestimonials(promoEmpty.testimonials);
      setPromoTitleInGroup(promoEmpty.inGroup);
      const fresh2 = createDefaultPromoCardsDraft();
      setPromoCardsDraft(fresh2);
      setAuroraAvatarFiles(Array.from({ length: fresh2.aurora.length }, () => null));
      setPromoRosaUiDraft({});
      setRosaPromoImageFiles([]);
      setBlankCanvasDraft(createDefaultBlankCanvas());
    } else {
      originalButtonUrlRef.current = "";
      modeRef.current = "empty";
      setMode("empty");
      setLogoUrl(null);
      setMetaPixelId("");
      setYoutubeUrl("");
      setYoutubePosition(DEFAULT_YOUTUBE_POSITION);
      setNotificationsEnabled(true);
      setNotificationsPosition(DEFAULT_NOTIFICATIONS_POSITION);
      setOfertCarouselEnabled(false);
      setOfertCarouselPosition(DEFAULT_OFERT_CAROUSEL_POSITION);
      setCarouselSlotPath([null, null, null, null]);
      setCarouselSlotFile([null, null, null, null]);
      initialCarouselPathsRef.current = [null, null, null, null];
      const promoEmpty2 = promoTitlesForForm("classic", {});
      setPromoSectionsEnabled(true);
      setPromoTitleBenefits(promoEmpty2.benefits);
      setPromoTitleTestimonials(promoEmpty2.testimonials);
      setPromoTitleInGroup(promoEmpty2.inGroup);
      const fresh3 = createDefaultPromoCardsDraft();
      setPromoCardsDraft(fresh3);
      setAuroraAvatarFiles(Array.from({ length: fresh3.aurora.length }, () => null));
      setPromoRosaUiDraft({});
      setRosaPromoImageFiles([]);
      setBlankCanvasDraft(createDefaultBlankCanvas());
    }
  }

  function goNextStep() {
    setError(null);

    if (step === 1) {
      if (mode === "create") {
        const cleanSlug = sanitizeSlug(slug);
        if (!cleanSlug) {
          setError("Slug obrigatório.");
          return;
        }
        if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
          setError("Slug inválido. Use apenas letras minúsculas, números e hífen.");
          return;
        }
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      const bt = buttonText.trim();
      if (!bt) {
        setError("Nome do botão é obrigatório.");
        return;
      }
      if (bt.length > 32) {
        setError("Nome do botão muito longo (máx. 32 caracteres).");
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      const url = whatsappUrl.trim();
      if (!isValidHttpUrl(url)) {
        setError("Link do botão inválido (use uma URL http/https válida).");
        return;
      }
      if (!isValidPixelId(metaPixelId)) {
        setError("Meta Pixel ID inválido.");
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4 && pageTemplate === "em_branco") {
      setStep(5);
      return;
    }
  }

  function goPrevStep() {
    setError(null);
    if (step === 5) return setStep(4);
    if (step === 4) return setStep(3);
    if (step === 3) return setStep(2);
    if (step === 2) return setStep(1);
    setStep(1);
  }

  /** No passo 1 da criação: volta à escolha do modelo de página. */
  function backToTemplatePicker() {
    setError(null);
    modeRef.current = "pickTemplate";
    setMode("pickTemplate");
  }

  function validateLogoFileOrThrow(f: File) {
    if (f.type !== "image/png") {
      throw new Error("A logo deve ser um arquivo PNG.");
    }
    if (f.size > MAX_LOGO_BYTES) {
      throw new Error("A logo deve ter no máximo 1MB.");
    }
  }

  // Usado no CREATE (logo sobe imediatamente após criar)
  async function uploadLogoNow(fileOverride?: File, siteId?: string) {
    const f = fileOverride ?? logoFile;
    if (!f) return;

    validateLogoFileOrThrow(f);

    const fd = new FormData();
    fd.append("file", f);
    if (siteId) fd.append("site_id", siteId);

    const r = await fetch("/api/captura/logo-upload", { method: "POST", body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Erro no upload da logo.");
  }

  async function resetMetrics(siteId: string) {
    const r = await fetch("/api/captura/metrics-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Erro ao resetar métricas.");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!session) return;

    setSaving(true);
    setError(null);
    setLogoToast(null);

    const cleanSlug = sanitizeSlug(slug);
    if (!cleanSlug) {
      setError("Slug obrigatório.");
      setSaving(false);
      return;
    }
    if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
      setError("Slug inválido. Use apenas letras minúsculas, números e hífen.");
      setSaving(false);
      return;
    }

    const bt = buttonText.trim();
    if (!bt) {
      setError("Nome do botão é obrigatório.");
      setSaving(false);
      return;
    }
    if (bt.length > 32) {
      setError("Nome do botão muito longo (máx. 32 caracteres).");
      setSaving(false);
      return;
    }

    const url = whatsappUrl.trim();
    if (!isValidHttpUrl(url)) {
      setError("Link do botão inválido (use uma URL http/https válida).");
      setSaving(false);
      return;
    }

    if (!isValidHexColor(buttonColor)) {
      setError("Cor do botão inválida.");
      setSaving(false);
      return;
    }

    if (!isValidPixelId(metaPixelId)) {
      setError("Meta Pixel ID inválido.");
      setSaving(false);
      return;
    }

    if (!isValidOptionalYoutubeUrl(youtubeUrl)) {
      setError("Link do YouTube inválido. Use um URL de vídeo ou o ID de 11 caracteres, ou deixe vazio.");
      setSaving(false);
      return;
    }

    if (ofertCarouselEnabled && !carouselSlotFile.some(Boolean)) {
      setError("Carrossel ativo: envie pelo menos uma imagem ou desative o carrossel.");
      setSaving(false);
      return;
    }

    const fileToUploadAfterCreate = logoFile;

    const res = await fetch("/api/captura/site-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: DOMAIN,
        slug: cleanSlug,
        title: title.trim() || null,
        description: description.trim() || null,
        button_text: bt,
        whatsapp_url: url,
        button_color: buttonColor,
        layout_variant: layoutVariant,
        meta_pixel_id: metaPixelId.trim() || null,
        page_template: pageTemplateRef.current,
        youtube_url: youtubeUrl.trim() || null,
        youtube_position: youtubePosition,
        notifications_enabled: notificationsEnabled,
        notifications_position: notificationsPosition,
        promo_sections_enabled: promoSectionsEnabled,
        promo_section_titles: promoSectionTitlesToJsonb({
          benefits: promoTitleBenefits,
          testimonials: promoTitleTestimonials,
          inGroup: promoTitleInGroup,
        }),
        promo_section_cards: promoSectionCardsToDbValue(
          normalizeCapturePageTemplate(pageTemplateRef.current) as PageTemplate,
          promoCardsDraft,
        ),
        blank_canvas_json:
          normalizeCapturePageTemplate(pageTemplateRef.current) === "em_branco"
            ? blankCanvasToDbValue({ ...blankCanvasDraft, btnBg: buttonColor })
            : null,
        promo_rosa_ui: promoRosaUiToJsonb(promoRosaUiDraft),
      }),
    });
    const created = (await res.json()) as { id?: string; error?: string; page_template?: unknown };

    if (!res.ok) {
      setError(created?.error || "Erro ao criar site.");
      setSaving(false);
      return;
    }

    const wantedTpl = normalizeCapturePageTemplate(pageTemplateRef.current);
    const savedTpl = normalizeCapturePageTemplate(created.page_template);
    if (savedTpl !== wantedTpl) {
      setError(
        `O modelo não foi gravado corretamente (escolhido: ${wantedTpl}, salvo: ${savedTpl}). ` +
          "Confirme a migration da coluna page_template no Supabase e a variável SUPABASE_SERVICE_ROLE_KEY na Vercel."
      );
    }

    try {
      await fetchSites();

      if (fileToUploadAfterCreate && created?.id) {
        await uploadLogoNow(fileToUploadAfterCreate, created.id);
        setLogoFile(null);
        await fetchSites();
      }

      if (supabase && created?.id && ofertCarouselEnabled) {
        const ofertDb = await persistOfertCarouselSlots({
          siteId: created.id,
          ofertCarouselEnabled: true,
          ofertCarouselPosition,
          carouselSlotPath: [null, null, null, null],
          carouselSlotFile,
          initialCarouselPaths: [null, null, null, null],
        });
        const { error: ocErr } = await supabase
          .from("capture_sites")
          .update({
            ofert_carousel_enabled: ofertDb.ofert_carousel_enabled,
            ofert_carousel_position: ofertDb.ofert_carousel_position,
            ofert_carousel_image_paths: ofertDb.ofert_carousel_image_paths,
            updated_at: new Date().toISOString(),
          })
          .eq("id", created.id);
        if (ocErr) throw new Error(ocErr.message);
        const slots = ofertDb.ofert_carousel_image_paths;
        initialCarouselPathsRef.current = [...slots];
        setCarouselSlotPath(slots);
        setCarouselSlotFile([null, null, null, null]);
        await fetchSites();
      }

      let draftAfterCreate = structuredClone(promoCardsDraft);
      let auroraUploaded = false;
      if (supabase && created?.id && wantedTpl === "aurora_ledger") {
        for (let i = 0; i < auroraAvatarFiles.length; i++) {
          const f = auroraAvatarFiles[i];
          if (!f) continue;
          const fd = new FormData();
          fd.append("file", f);
          fd.append("site_id", created.id);
          fd.append("slot", String(i));
          const oldPath = draftAfterCreate.aurora[i]?.avatar_path;
          if (oldPath) fd.append("old_path", oldPath);
          const up = await fetch("/api/captura/promo-avatar-upload", { method: "POST", body: fd });
          const ju = (await up.json()) as { error?: string; path?: string };
          if (!up.ok) throw new Error(ju?.error || "Erro ao enviar foto do depoimento.");
          const aurora = [...draftAfterCreate.aurora];
          aurora[i] = { ...aurora[i]!, avatar_path: ju.path ?? null };
          draftAfterCreate = { ...draftAfterCreate, aurora };
          auroraUploaded = true;
        }
        if (auroraUploaded) {
          const { error: prErr } = await supabase
            .from("capture_sites")
            .update({
              promo_section_cards: promoSectionCardsToDbValue(wantedTpl as PageTemplate, draftAfterCreate),
              updated_at: new Date().toISOString(),
            })
            .eq("id", created.id);
          if (prErr) throw new Error(prErr.message);
        }
      }

      let rosaPromoUploaded = false;
      if (supabase && created?.id && (wantedTpl === "vip_rosa" || wantedTpl === "em_branco")) {
        for (let i = 0; i < rosaPromoImageFiles.length; i++) {
          const f = rosaPromoImageFiles[i];
          if (!f) continue;
          const fd = new FormData();
          fd.append("file", f);
          fd.append("site_id", created.id);
          fd.append("slot", String(i));
          const oldPath = draftAfterCreate.rosa[i]?.image_path;
          if (oldPath) fd.append("old_path", oldPath);
          const up = await fetch("/api/captura/promo-rosa-card-upload", { method: "POST", body: fd });
          const ju = (await up.json()) as { error?: string; path?: string };
          if (!up.ok) throw new Error(ju?.error || "Erro ao enviar imagem do card promocional.");
          const rosa = [...draftAfterCreate.rosa];
          rosa[i] = { ...rosa[i]!, image_path: ju.path ?? null, lead_mode: "image" };
          draftAfterCreate = { ...draftAfterCreate, rosa };
          rosaPromoUploaded = true;
        }
        if (rosaPromoUploaded) {
          const { error: prRosaErr } = await supabase
            .from("capture_sites")
            .update({
              promo_section_cards: promoSectionCardsToDbValue(wantedTpl as PageTemplate, draftAfterCreate),
              updated_at: new Date().toISOString(),
            })
            .eq("id", created.id);
          if (prRosaErr) throw new Error(prRosaErr.message);
        }
      }

      let blankAfterCreate = structuredClone(blankCanvasDraft);
      if (supabase && created?.id && wantedTpl === "em_branco" && (blankHeroFile || blankBgFile)) {
        if (blankHeroFile) {
          const fd = new FormData();
          fd.append("file", blankHeroFile);
          fd.append("site_id", created.id);
          if (blankAfterCreate.heroPath) fd.append("old_path", blankAfterCreate.heroPath);
          const up = await fetch("/api/captura/blank-hero-upload", { method: "POST", body: fd });
          const ju = (await up.json()) as { error?: string; path?: string };
          if (!up.ok) throw new Error(ju?.error || "Erro ao enviar imagem de destaque.");
          blankAfterCreate = { ...blankAfterCreate, heroPath: ju.path ?? null };
        }
        if (blankBgFile) {
          const fd = new FormData();
          fd.append("file", blankBgFile);
          fd.append("site_id", created.id);
          if (blankAfterCreate.bgImagePath) fd.append("old_path", blankAfterCreate.bgImagePath);
          const up = await fetch("/api/captura/blank-bg-upload", { method: "POST", body: fd });
          const ju = (await up.json()) as { error?: string; path?: string };
          if (!up.ok) throw new Error(ju?.error || "Erro ao enviar imagem de fundo.");
          blankAfterCreate = {
            ...blankAfterCreate,
            bgImagePath: ju.path ?? null,
            bgImageEnabled: true,
          };
        }
        const { error: bErr } = await supabase
          .from("capture_sites")
          .update({
            blank_canvas_json: blankCanvasToDbValue({ ...blankAfterCreate, btnBg: buttonColor }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", created.id);
        if (bErr) throw new Error(bErr.message);
      }
      if (wantedTpl === "em_branco") {
        setBlankCanvasDraft(blankAfterCreate);
        setBlankHeroFile(null);
        setBlankBgFile(null);
      }

      setPromoCardsDraft(draftAfterCreate);
      setAuroraAvatarFiles(Array.from({ length: draftAfterCreate.aurora.length }, () => null));
      setRosaPromoImageFiles(Array.from({ length: draftAfterCreate.rosa.length }, () => null));

      setPageLoading(true);
      setStep(1);
      modeRef.current = "view";
      setMode("view");

      await fetchSites();
      setSaving(false);
      await refresh();
    } catch (e2: unknown) {
      setError(getErrorMessage(e2, "Erro ao criar site."));
      setSaving(false);
    }
  }

  async function performSave(opts: { resetAfterSave: boolean }) {
    if (!supabase || !session || !site) return;

    setSaving(true);
    setError(null);
    setLogoToast(null);

    const bt = buttonText.trim();
    if (!bt) {
      setError("Nome do botão é obrigatório.");
      setSaving(false);
      return;
    }
    if (bt.length > 32) {
      setError("Nome do botão muito longo (máx. 32 caracteres).");
      setSaving(false);
      return;
    }

    const url = whatsappUrl.trim();
    if (!isValidHttpUrl(url)) {
      setError("Link do botão inválido (use uma URL http/https válida).");
      setSaving(false);
      return;
    }

    if (!isValidHexColor(buttonColor)) {
      setError("Cor do botão inválida.");
      setSaving(false);
      return;
    }

    if (!isValidPixelId(metaPixelId)) {
      setError("Meta Pixel ID inválido.");
      setSaving(false);
      return;
    }

    if (!isValidOptionalYoutubeUrl(youtubeUrl)) {
      setError("Link do YouTube inválido. Use um URL de vídeo ou o ID de 11 caracteres, ou deixe vazio.");
      setSaving(false);
      return;
    }

    if (ofertCarouselEnabled) {
      const anyCarousel =
        carouselSlotFile.some(Boolean) ||
        carouselSlotPath.some((p) => !!p) ||
        initialCarouselPathsRef.current.some((p) => !!p);
      if (!anyCarousel) {
        setError("Carrossel ativo: envie pelo menos uma imagem ou desative o carrossel.");
        setSaving(false);
        return;
      }
    }

    let ofertDb: Awaited<ReturnType<typeof persistOfertCarouselSlots>>;
    try {
      ofertDb = await persistOfertCarouselSlots({
        siteId: site.id,
        ofertCarouselEnabled,
        ofertCarouselPosition,
        carouselSlotPath,
        carouselSlotFile,
        initialCarouselPaths: initialCarouselPathsRef.current,
      });
    } catch (e: unknown) {
      setError(getErrorMessage(e, "Erro ao guardar o carrossel."));
      setSaving(false);
      return;
    }

    const wantedTpl = normalizeCapturePageTemplate(pageTemplateRef.current);

    let workingPromoDraft = structuredClone(promoCardsDraft);
    if (wantedTpl === "aurora_ledger") {
      for (let i = 0; i < auroraAvatarFiles.length; i++) {
        const f = auroraAvatarFiles[i];
        if (!f) continue;
        const fd = new FormData();
        fd.append("file", f);
        fd.append("site_id", site.id);
        fd.append("slot", String(i));
        const oldPath = workingPromoDraft.aurora[i]?.avatar_path;
        if (oldPath) fd.append("old_path", oldPath);
        const res = await fetch("/api/captura/promo-avatar-upload", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; path?: string };
        if (!res.ok) {
          setError(j?.error || "Erro ao enviar foto do depoimento.");
          setSaving(false);
          return;
        }
        const aurora = [...workingPromoDraft.aurora];
        aurora[i] = { ...aurora[i]!, avatar_path: j.path ?? null };
        workingPromoDraft = { ...workingPromoDraft, aurora };
      }
    }

    if (wantedTpl === "vip_rosa" || wantedTpl === "em_branco") {
      for (let i = 0; i < rosaPromoImageFiles.length; i++) {
        const f = rosaPromoImageFiles[i];
        if (!f) continue;
        const fd = new FormData();
        fd.append("file", f);
        fd.append("site_id", site.id);
        fd.append("slot", String(i));
        const oldPath = workingPromoDraft.rosa[i]?.image_path;
        if (oldPath) fd.append("old_path", oldPath);
        const res = await fetch("/api/captura/promo-rosa-card-upload", { method: "POST", body: fd });
        const j = (await res.json()) as { error?: string; path?: string };
        if (!res.ok) {
          setError(j?.error || "Erro ao enviar imagem do card promocional.");
          setSaving(false);
          return;
        }
        const rosa = [...workingPromoDraft.rosa];
        rosa[i] = { ...rosa[i]!, image_path: j.path ?? null, lead_mode: "image" };
        workingPromoDraft = { ...workingPromoDraft, rosa };
      }
    }

    let workingBlank = structuredClone(blankCanvasDraft);
    if (wantedTpl === "em_branco" && blankHeroFile) {
      const fd = new FormData();
      fd.append("file", blankHeroFile);
      fd.append("site_id", site.id);
      if (workingBlank.heroPath) fd.append("old_path", workingBlank.heroPath);
      const res = await fetch("/api/captura/blank-hero-upload", { method: "POST", body: fd });
      const j = (await res.json()) as { error?: string; path?: string };
      if (!res.ok) {
        setError(j?.error || "Erro ao enviar imagem de destaque.");
        setSaving(false);
        return;
      }
      workingBlank = { ...workingBlank, heroPath: j.path ?? null };
    }
    if (wantedTpl === "em_branco" && blankBgFile) {
      const fd = new FormData();
      fd.append("file", blankBgFile);
      fd.append("site_id", site.id);
      if (workingBlank.bgImagePath) fd.append("old_path", workingBlank.bgImagePath);
      const res = await fetch("/api/captura/blank-bg-upload", { method: "POST", body: fd });
      const j = (await res.json()) as { error?: string; path?: string };
      if (!res.ok) {
        setError(j?.error || "Erro ao enviar imagem de fundo.");
        setSaving(false);
        return;
      }
      workingBlank = { ...workingBlank, bgImagePath: j.path ?? null, bgImageEnabled: true };
    }

    const { data: updatedRow, error: upErr } = await supabase
      .from("capture_sites")
      .update({
        title: title.trim() || null,
        description: description.trim() || null,
        button_text: bt,
        whatsapp_url: url,
        button_color: buttonColor,
        layout_variant: layoutVariant,
        meta_pixel_id: metaPixelId.trim() || null,
        page_template: wantedTpl,
        youtube_url: youtubeUrl.trim() || null,
        youtube_position: youtubePosition,
        notifications_enabled: notificationsEnabled,
        notifications_position: notificationsPosition,
        promo_sections_enabled: promoSectionsEnabled,
        promo_section_titles: promoSectionTitlesToJsonb({
          benefits: promoTitleBenefits,
          testimonials: promoTitleTestimonials,
          inGroup: promoTitleInGroup,
        }),
        promo_section_cards: promoSectionCardsToDbValue(wantedTpl, workingPromoDraft),
        blank_canvas_json:
          wantedTpl === "em_branco" ? blankCanvasToDbValue({ ...workingBlank, btnBg: buttonColor }) : null,
        ofert_carousel_enabled: ofertDb.ofert_carousel_enabled,
        ofert_carousel_position: ofertDb.ofert_carousel_position,
        ofert_carousel_image_paths: ofertDb.ofert_carousel_image_paths,
        promo_rosa_ui: promoRosaUiToJsonb(promoRosaUiDraft),
        updated_at: new Date().toISOString(),
      })
      .eq("id", site.id)
      .select("page_template")
      .maybeSingle();

    if (upErr) {
      setError(upErr.message);
      setSaving(false);
      return;
    }

    const savedTpl = normalizeCapturePageTemplate(
      (updatedRow as { page_template?: unknown } | null)?.page_template,
    );
    if (savedTpl !== wantedTpl) {
      setError(
        `O modelo não foi gravado corretamente (escolhido: ${wantedTpl}, salvo: ${savedTpl}). ` +
          "Confirme a migration da coluna page_template no Supabase e as permissões de UPDATE em capture_sites."
      );
      setSaving(false);
      return;
    }

    try {
      if (logoPendingAction === "remove") {
        const r = await fetch("/api/captura/logo-delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ site_id: site.id }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Erro ao remover a logo.");
        setLogoToast("Logo removida!");
      }

      if (logoPendingAction === "upload" && logoFile) {
        validateLogoFileOrThrow(logoFile);

        const fd = new FormData();
        fd.append("file", logoFile);
        fd.append("site_id", site.id);

        const r = await fetch("/api/captura/logo-upload", { method: "POST", body: fd });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "Erro ao enviar a logo.");
      }

      if (opts.resetAfterSave) {
        await resetMetrics(site.id);
      }

      originalButtonUrlRef.current = url;

      setLogoPendingAction("keep");
      setLogoFile(null);

      const slots = ofertDb.ofert_carousel_image_paths;
      initialCarouselPathsRef.current = [...slots];
      setCarouselSlotPath(slots);
      setCarouselSlotFile([null, null, null, null]);

      setPromoCardsDraft(workingPromoDraft);
      setAuroraAvatarFiles(Array.from({ length: workingPromoDraft.aurora.length }, () => null));
      setRosaPromoImageFiles(Array.from({ length: workingPromoDraft.rosa.length }, () => null));
      if (wantedTpl === "em_branco") {
        setBlankCanvasDraft(workingBlank);
        setBlankHeroFile(null);
        setBlankBgFile(null);
      }

      setPageLoading(true);
      setStep(1);
      modeRef.current = "view";
      setMode("view");

      await fetchSites();
      setSaving(false);
      await refresh();
    } catch (e2: unknown) {
      setError(getErrorMessage(e2, "Erro ao salvar."));
      setSaving(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !session || !site) return;

    if (linkChanged && hasMetricsData) {
      setShowResetMetricsModal(true);
      return;
    }

    await performSave({ resetAfterSave: false });
  }

  async function toggleActive(row: CaptureSiteRow) {
    if (!supabase) return;

    setSaving(true);
    setError(null);

    const { error: upErr } = await supabase
      .from("capture_sites")
      .update({
        active: !row.active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (upErr) setError(upErr.message);

    await fetchSites();
    await refresh();
    setSaving(false);
  }

  async function confirmDelete() {
    const target = deleteTargetSite ?? site;
    if (!target) return;

    setIsDeleting(true);
    setError(null);

    try {
      const r = await fetch("/api/captura/site-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_id: target.id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "Erro ao apagar o site.");

      setShowDeleteModal(false);
      setIsDeleting(false);
      setDeleteTargetSite(null);
      setStep(1);
      setSlug("");
      setTitle("");
      setDescription("");
      setButtonText("");
      setWhatsappUrl("");
      setButtonColor("#25D366");
      setLayoutVariant("icons");
      setMetaPixelId("");
      setYoutubeUrl("");
      setYoutubePosition(DEFAULT_YOUTUBE_POSITION);
      setOfertCarouselEnabled(false);
      setOfertCarouselPosition(DEFAULT_OFERT_CAROUSEL_POSITION);
      setCarouselSlotPath([null, null, null, null]);
      setCarouselSlotFile([null, null, null, null]);
      initialCarouselPathsRef.current = [null, null, null, null];
      setLogoFile(null);
      setLogoUrl(null);
      setLogoPendingAction("keep");
      setLogoToast(null);
      originalButtonUrlRef.current = "";
      const poDel = promoTitlesForForm("classic", {});
      setPromoSectionsEnabled(true);
      setPromoTitleBenefits(poDel.benefits);
      setPromoTitleTestimonials(poDel.testimonials);
      setPromoTitleInGroup(poDel.inGroup);
      const freshDel = createDefaultPromoCardsDraft();
      setPromoCardsDraft(freshDel);
      setAuroraAvatarFiles(Array.from({ length: freshDel.aurora.length }, () => null));
      setPromoRosaUiDraft({});
      setRosaPromoImageFiles([]);
      setBlankCanvasDraft(createDefaultBlankCanvas());
      setBlankHeroFile(null);
      setBlankBgFile(null);

      await fetchSites();
      await refresh();
    } catch (e2: unknown) {
      setError(getErrorMessage(e2, "Erro ao apagar o site."));
      setIsDeleting(false);
    }
  }

  if (!session) return <div className="p-6 text-text-secondary">Faça login para acessar.</div>;

  if (pageLoading) return <LoadingOverlay message="Carregando..." />;

  if (saving && (mode === "create" || mode === "edit")) return <LoadingOverlay message="Salvando..." />;

  const isVipPreview =
    pageTemplate === "vip_rosa" ||
    pageTemplate === "vip_terroso" ||
    pageTemplate === "vinho_rose" ||
    pageTemplate === "the_new_chance" ||
    pageTemplate === "aurora_ledger" ||
    pageTemplate === "jardim_floral";
  const isBlankPreview = pageTemplate === "em_branco";
  const showTemplatePreview = isVipPreview || isBlankPreview;
  /** Em branco: passo 4 = só visual do cartão; passo 5 = YouTube, carrossel, notificações e promo. */
  const captureWizardMaxStep = pageTemplate === "em_branco" ? 5 : 4;

  const canCreateAnotherSite = sites.length < captureLimit;

  const colorPresets = ["#25D366", "#F97316", "#2563EB", "#16A34A", "#DC2626", "#111827"];

  const previewButtonText = buttonText.trim() || DEFAULT_BUTTON_TEXT;
  const previewButtonUrl = whatsappUrl;

  return (
    <div className="px-4 sm:px-0">
      {/* Header */}
      <div ref={pageHeaderRef} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading">Site de Captura</h1>
          <p className="text-sm text-text-secondary mt-1">Crie uma página simples com botão e acompanhe visitas e cliques.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {mode === "empty" && canCreateAnotherSite && (
            <button
              onClick={openTemplatePicker}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold"
              type="button"
            >
              <Plus className="h-5 w-5" />
              Criar site
            </button>
          )}
          {mode === "view" && canCreateAnotherSite && (
            <button
              onClick={openTemplatePicker}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold"
              type="button"
            >
              <Plus className="h-5 w-5" />
              Criar outro site
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-3 sm:p-4 bg-red-500/10 border border-red-500/50 rounded-md text-red-400 text-sm flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Escolher template (antes do wizard) */}
      {mode === "pickTemplate" && (
        <div className="bg-dark-card p-4 sm:p-8 rounded-lg border border-dark-border">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary flex flex-wrap items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-shopee-orange shrink-0" />
                Escolha o modelo do site
                <Toolist
                  wide
                  variant="below"
                  text="Cada opção muda o visual da página pública. Depois você preenche slug, textos e link como de costume."
                />
              </h2>
            </div>
            <button
              type="button"
              onClick={cancelTemplatePicker}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md border border-dark-border text-text-secondary hover:text-text-primary text-sm"
            >
              <ChevronLeft className="h-4 w-4" />
              Voltar
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {PAGE_TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => confirmTemplateChoice(opt.id)}
                className="group text-left rounded-2xl border border-dark-border bg-dark-bg/40 overflow-hidden shadow-lg shadow-black/25 hover:border-shopee-orange/50 hover:bg-shopee-orange/[0.06] hover:shadow-xl hover:shadow-black/30 transition-all flex flex-col lg:flex-row lg:items-stretch min-h-0"
              >
                <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5 order-1 lg:min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text-primary pr-1">{opt.title}</span>
                    {opt.badge ? (
                      <span className="shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-shopee-orange/15 text-shopee-orange border border-shopee-orange/25">
                        {opt.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed flex-1">{opt.description}</p>
                  <span className="text-xs font-semibold text-shopee-orange mt-1 group-hover:underline underline-offset-2">
                    Usar este modelo →
                  </span>
                </div>

                <div
                  className={
                    "relative w-full shrink-0 border-t border-dark-border/80 lg:border-t-0 lg:border-l lg:border-dark-border/80 " +
                    "aspect-[5/4] sm:aspect-[16/9] lg:aspect-auto lg:w-[42%] lg:min-w-[9.5rem] lg:max-w-[200px] lg:min-h-[11rem] order-2"
                  }
                >
                  <Image
                    src={opt.previewSrc}
                    alt={`Prévia do modelo ${opt.title}`}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 1024px) 100vw, 200px"
                    unoptimized
                  />
                  {/* Overlay estilo capa Netflix: vinheta escura */}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/25"
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute inset-0 shadow-[inset_0_0_50px_rgba(0,0,0,0.5)]"
                    aria-hidden
                  />
                  <span className="pointer-events-none absolute bottom-2.5 left-3 right-3 text-[10px] font-semibold tracking-wide text-white/90 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
                    Prévia do layout
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* EMPTY */}
      {mode === "empty" && (
        <div className="bg-dark-card p-8 sm:p-12 rounded-lg border border-dark-border text-center">
          <h2 className="text-lg sm:text-xl font-semibold text-text-primary mb-2">Nenhum site criado ainda</h2>
          {canCreateAnotherSite ? (
            <>
              <p className="text-sm sm:text-base text-text-secondary/80 mb-6">
                Clique no botão abaixo para criar seu primeiro site de captura e gerar seu link com slug.
              </p>
              <button
                onClick={openTemplatePicker}
                className="inline-flex items-center gap-2 px-6 py-3 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold"
                type="button"
              >
                <Plus className="h-5 w-5" />
                Criar meu primeiro site
              </button>
            </>
          ) : (
            <p className="text-sm sm:text-base text-text-secondary/80">
              Seu plano não inclui sites de captura ou o limite foi atingido. Faça upgrade para criar páginas de captura.
            </p>
          )}
        </div>
      )}

      {/* VIEW — lista de cards (mais antigo primeiro) */}
      {mode === "view" && sites.length > 0 && (
        <div className="space-y-4">
          {sites.map((row) => {
            const url = rowPublicUrl(row);
            const lockedByPlan = captureLimit === 1 && !row.active;
            const logoSrc =
              row.logopath && supabase
                ? supabase.storage.from(LOGO_BUCKET).getPublicUrl(row.logopath).data.publicUrl
                : null;
            const rowExpired = isExpired(row.expiresat);

            return (
              <div key={row.id} className="relative rounded-lg border border-dark-border overflow-hidden bg-dark-card">
                {lockedByPlan && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/45 backdrop-blur-sm px-4">
                    <a
                      href={PRO_CAPTURE_CHECKOUT_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-5 py-2.5 bg-shopee-orange text-white rounded-md font-semibold hover:opacity-90 transition-opacity text-sm sm:text-base"
                    >
                      Desbloquear com PRO
                    </a>
                  </div>
                )}

                <div className="p-4 sm:p-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-grow min-w-0 space-y-3">
                    <div className="flex items-start gap-3">
                      {logoSrc ? (
                        <div className="relative h-12 w-12 shrink-0">
                          <Image src={logoSrc} alt="Logo" fill sizes="48px" className="object-contain" />
                        </div>
                      ) : (
                        <div className="h-12 w-12 shrink-0 rounded-md bg-dark-bg border border-dark-border" />
                      )}

                      <div className="min-w-0 flex-grow">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base sm:text-lg font-semibold text-text-primary break-words">
                            {row.title?.trim() || "Site de Captura"}
                          </h3>
                          <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-dark-bg border border-dark-border text-text-secondary">
                            {pageTemplateLabel((row as CaptureSiteRow).page_template)}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center gap-2 flex-wrap text-sm">
                          <span className="text-text-secondary">Link</span>
                          <button
                            onClick={() => copyToClipboard(url, row.id)}
                            className="text-shopee-orange hover:underline flex items-center gap-1 font-mono break-all text-left"
                            type="button"
                            title="Copiar link"
                            disabled={lockedByPlan}
                          >
                            {url}
                            {copiedId === row.id ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </button>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <MousePointerClick className="h-4 w-4 text-text-secondary" />
                            <span className="text-emerald-400 font-semibold">{row.cta_click_count}</span>
                            <span className="text-text-secondary">cliques</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Eye className="h-4 w-4 text-text-secondary" />
                            <span className="text-sky-400 font-semibold">{row.view_count}</span>
                            <span className="text-text-secondary">views</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-text-secondary">Criado em</span>
                            <span className="text-text-secondary">{formatDateTimePtBR(row.created_at)}</span>
                          </div>

                          {rowExpired && (
                            <span className="text-red-400 text-xs font-semibold border border-red-500/30 bg-red-500/10 px-2 py-1 rounded">
                              Expirado
                            </span>
                          )}
                        </div>

                        <div className="mt-2 text-xs text-text-secondary">
                          Slug não pode ser alterado. Para mudar o slug, apague o site e crie outro.
                        </div>
                      </div>
                    </div>
                  </div>

                  {!lockedByPlan && (
                    <div className="flex items-center gap-2 flex-shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-dark-border">
                      <button
                        onClick={() => toggleActive(row)}
                        className={`p-2 rounded-md transition-colors ${
                          row.active
                            ? "bg-green-500/10 text-green-500 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        }`}
                        title={row.active ? "Desativar" : "Ativar"}
                        type="button"
                      >
                        {row.active ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                      </button>

                      <button
                        onClick={() => startEdit(row)}
                        className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-shopee-orange hover:bg-dark-border transition-colors"
                        title="Editar"
                        type="button"
                      >
                        <Edit className="h-5 w-5" />
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-link hover:bg-dark-border transition-colors"
                        title="Abrir em nova guia"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>

                      <button
                        onClick={() => {
                          setDeleteTargetSite(row);
                          setShowDeleteModal(true);
                        }}
                        className="p-2 rounded-md bg-dark-bg text-text-secondary hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Apagar site"
                        type="button"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT */}
      {(mode === "create" || mode === "edit") && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          {/* Form */}
          <div className="bg-dark-card p-4 sm:p-6 rounded-lg border border-dark-border">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary">
                {mode === "create" ? "Criar Site de Captura" : "Editar Site de Captura"}
              </h2>

              {mode === "edit" && (
                <button
                  onClick={() => {
                    setDeleteTargetSite(null);
                    setShowDeleteModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors text-sm font-semibold"
                  type="button"
                  title="Apagar para poder mudar o slug"
                >
                  <Trash2 className="h-4 w-4" />
                  Apagar site
                </button>
              )}
            </div>

            <form
              onSubmit={(e) => {
                if (step !== captureWizardMaxStep) {
                  e.preventDefault();
                  goNextStep();
                  return;
                }
                return mode === "create" ? handleCreate(e) : handleSave(e);
              }}
              className="space-y-5"
            >
              {/* STEP 1 */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Slug */}
                  {mode === "create" ? (
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <label className="text-sm font-medium text-text-primary">Slug (imutável)</label>
                        <Toolist
                          wide
                          variant="below"
                          text={`Apenas letras minúsculas, números e hífen. O slug é único no link público (${DOMAIN}/…): não pode repetir em outra conta nem em outro seu site.`}
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="text-xs text-text-secondary whitespace-nowrap">{DOMAIN}/</span>
                        <input
                          value={slug}
                          onChange={(e) => setSlug(sanitizeSlug(e.target.value))}
                          placeholder="meu-slug"
                          className={inputClass}
                          required
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Slug (imutável)</label>
                      <input value={site?.slug ?? ""} disabled className={inputDisabledClass} />
                      <p className="mt-1.5 text-xs text-text-secondary/80">Para mudar o slug, apague o site e crie outro.</p>
                    </div>
                  )}

                  <div className="rounded-lg border border-dark-border/60 bg-dark-bg/30 px-3 py-2.5">
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">Modelo visual:</span>{" "}
                        {pageTemplateLabel(pageTemplate)}
                        {mode === "edit" ? (
                          <span className="block mt-1 text-text-secondary/80">
                            O modelo não pode ser alterado após criar. Para trocar, crie outro site.
                          </span>
                        ) : null}
                      </p>
                      {pageTemplate !== "classic" ? (
                        <Toolist
                          wide
                          variant="below"
                          text='Este modelo já inclui faixa de urgência, barra de vagas e lista de benefícios na página pública (não usa “layout com ícones / escassez” do card clássico).'
                        />
                      ) : null}
                    </div>
                  </div>

                  {/* Layout do card — só no template padrão */}
                  {pageTemplate === "classic" ? (
                    <LayoutVariantField value={layoutVariant} onChange={setLayoutVariant} />
                  ) : null}

                  {/* Logo */}
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-sm font-medium text-text-primary">Logo (opcional)</span>
                        <Toolist
                          wide
                          variant="below"
                          text={
                            mode === "create"
                              ? "A logo será enviada automaticamente após criar o site."
                              : "Alterações ou remoção da logo entram em vigor ao salvar o site."
                          }
                        />
                      </div>

                      {mode === "edit" && (logoUrl || logoPendingAction === "remove") && (
                        <div className="flex items-center gap-2">
                          {logoPendingAction !== "remove" ? (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setLogoPendingAction("remove");
                                setLogoFile(null);
                                setLogoUrl(null);
                                setLogoToast(null);
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-500/30 disabled:opacity-60"
                            >
                              Remover logo (ao salvar)
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setLogoPendingAction("keep");
                                setLogoToast(null);
                                setLogoFromLogopath(site?.logopath ?? null);
                              }}
                              className="text-xs px-2.5 py-1.5 rounded-md bg-dark-border text-text-primary disabled:opacity-60"
                            >
                              Desfazer
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {logoToast && (
                      <div className="mb-3 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-md px-3 py-2">
                        {logoToast}
                      </div>
                    )}

                    {(logoLocalPreviewUrl || (mode === "edit" && logoUrl)) && (
                      <div className="mb-3 flex items-center gap-3">
                        <div className="relative h-12 w-20 rounded-md border border-dark-border bg-white overflow-hidden">
                          {logoLocalPreviewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={logoLocalPreviewUrl} alt="Preview da logo" className="h-full w-full object-contain" />
                          ) : logoUrl ? (
                            <Image src={logoUrl} alt="Logo" fill sizes="80px" className="object-contain" />
                          ) : null}
                        </div>

                        {logoLocalPreviewUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPendingAction("keep");
                            }}
                            className="inline-flex items-center gap-2 px-3 py-2 bg-dark-bg border border-dark-border rounded-md text-text-secondary hover:text-text-primary text-sm"
                          >
                            <X className="h-4 w-4" />
                            Remover seleção
                          </button>
                        )}
                      </div>
                    )}

                    <label className="block cursor-pointer rounded-lg border border-dashed border-dark-border bg-dark-bg/40 hover:bg-dark-bg/60 transition-colors p-4">
                      <input
                        type="file"
                        accept="image/png"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] ?? null;

                          // permite selecionar o mesmo arquivo novamente depois
                          e.target.value = "";

                          setLogoToast(null);

                          if (!f) {
                            setLogoFile(null);
                            setLogoPendingAction("keep");
                            return;
                          }

                          // validação imediata (tipo e tamanho)
                          if (f.type !== "image/png") {
                            setError("A logo deve ser um arquivo PNG.");
                            setLogoFile(null);
                            setLogoPendingAction("keep");
                            return;
                          }
                          if (f.size > MAX_LOGO_BYTES) {
                            setError("A logo deve ter no máximo 1MB.");
                            setLogoFile(null);
                            setLogoPendingAction("keep");
                            return;
                          }

                          setError(null);
                          setLogoFile(f);
                          setLogoPendingAction("upload");
                        }}
                      />

                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-md bg-dark-card border border-dark-border flex items-center justify-center">
                          <Plus className="h-5 w-5 text-text-secondary" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-text-primary">Selecionar logo</div>
                          <div className="text-xs text-text-secondary truncate">PNG até 1MB</div>
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Cor do botão */}
                  <div>
                    <label className={labelClass}>Cor do botão</label>
                    <div className="flex items-center gap-3 flex-wrap">
                      <input
                        type="color"
                        value={buttonColor}
                        onChange={(e) => setButtonColor(e.target.value)}
                        className="h-11 w-14 rounded-md border border-dark-border bg-transparent"
                        aria-label="Selecionar cor"
                      />
                      <input
                        value={buttonColor}
                        onChange={(e) => setButtonColor(normalizeHex(e.target.value))}
                        onBlur={() => {
                          if (!isValidHexColor(buttonColor)) setButtonColor("#25D366");
                        }}
                        className="h-11 px-4 bg-dark-bg border border-dark-border rounded-lg text-text-primary font-mono text-sm w-44 focus:outline-none focus:ring-2 focus:ring-shopee-orange/60"
                        placeholder="#25D366"
                      />
                      <div className="flex items-center gap-2">
                        {colorPresets.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setButtonColor(c)}
                            className="h-9 w-9 rounded-md border border-dark-border hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                    {!isValidHexColor(buttonColor) && (
                      <div className="mt-2 text-xs text-red-400">Cor inválida. Use o formato #RRGGBB.</div>
                    )}
                    {isValidHexColor(buttonColor) ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-xs text-text-secondary/80">Cor global do botão na página</span>
                        <Toolist
                          variant="below"
                          wide
                          text="Usada no botão da página pública em todos os modelos. No Em branco não repetimos essa cor no passo 4 (só fundo, cartão e tipografia lá); no passo 5 configuram-se extras como YouTube e carrossel."
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Título</label>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Entre no meu grupo VIP"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Descrição</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={textareaClass}
                      placeholder="Ex: Clique no botão abaixo para acessar o conteúdo."
                      rows={4}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Nome do botão</label>
                    <input
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      className={inputClass}
                      placeholder="Ex: Acessar Grupo Vip"
                      maxLength={32}
                      required
                    />
                    <p className="mt-1.5 text-xs text-text-secondary/80">
                      Esse texto aparece dentro do botão na página de captura.
                    </p>
                  </div>

                  {pageTemplate === "em_branco" ? (
                    <div className="rounded-lg border border-dark-border/70 bg-dark-bg/30 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                          <span id="blank-show-subtitle-label" className="text-sm font-medium text-text-primary">
                            Linha curta sob o título
                          </span>
                          <Toolist
                            variant="below"
                            wide
                            text="Mostra ou esconde uma frase curta entre o título principal e a descrição na página Em branco (editável abaixo quando ativo)."
                          />
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-labelledby="blank-show-subtitle-label"
                          aria-checked={blankCanvasDraft.showSubtitle}
                          onClick={() =>
                            setBlankCanvasDraft((d) => ({ ...d, showSubtitle: !d.showSubtitle }))
                          }
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
                            blankCanvasDraft.showSubtitle ? "bg-shopee-orange" : "bg-dark-bg"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                              blankCanvasDraft.showSubtitle ? "translate-x-[1.35rem]" : "translate-x-0.5"
                            } mt-px`}
                          />
                        </button>
                      </div>
                      {blankCanvasDraft.showSubtitle ? (
                        <div>
                          <label className={labelClass}>Texto dessa linha</label>
                          <input
                            type="text"
                            value={blankCanvasDraft.subtitle}
                            maxLength={120}
                            onChange={(e) => setBlankCanvasDraft((d) => ({ ...d, subtitle: e.target.value }))}
                            className={inputClass}
                            placeholder="Ex: Oferta por tempo limitado"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}

              {/* STEP 3 — link + pixel */}
              {step === 3 && (
                <div className="space-y-5">
                  <div>
                    <label className={labelClass}>Link do botão (URL)</label>
                    <input
                      value={whatsappUrl}
                      onChange={(e) => setWhatsappUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://exemplo.com/..."
                      required
                    />

                    {mode === "edit" && linkChanged && hasMetricsData && (
                      <div className="mt-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 flex items-start gap-2">
                        <RotateCcw className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <span>
                          Você mudou o link do botão. Ao salvar, vamos sugerir resetar as métricas para começar do zero.
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={labelClass}>Meta Pixel ID (opcional)</label>
                    <input
                      value={metaPixelId}
                      onChange={(e) => {
                        const v = e.target.value.trim();
                        if (!v || /^\d+$/.test(v)) setMetaPixelId(v);
                      }}
                      className={inputClass}
                      placeholder="123456789012345"
                      maxLength={20}
                    />
                    <p className="mt-1.5 text-xs text-text-secondary/80">
                      Cole apenas o número do Pixel. Deixe vazio para não usar tracking.
                    </p>
                    {!!metaPixelId && !isValidPixelId(metaPixelId) && (
                      <div className="mt-2 text-xs text-red-400">Pixel ID inválido (use 5–20 dígitos).</div>
                    )}
                  </div>

                
                </div>
              )}

              {/* STEP 4 — Em branco: só o construtor visual do cartão */}
              {step === 4 && pageTemplate === "em_branco" && (
                <div className="space-y-5">
                  <EmBrancoBuilderPanel
                    value={blankCanvasDraft}
                    onChange={setBlankCanvasDraft}
                    heroFile={blankHeroFile}
                    onHeroFile={setBlankHeroFile}
                    onClearStoredHero={clearBlankHeroSlot}
                    bgFile={blankBgFile}
                    onBgFile={setBlankBgFile}
                    onClearStoredBg={clearBlankBgSlot}
                    heroPreviewUrl={blankHeroPreviewUrl}
                    bgPreviewUrl={blankBgPreviewUrl}
                    captureWizardMode={mode === "create" ? "create" : "edit"}
                  />
                </div>
              )}

              {/* STEP 4 (modelos que não são Em branco) ou STEP 5 (Em branco): YouTube, carrossel, notificações, promo */}
              {((step === 4 && pageTemplate !== "em_branco") || (step === 5 && pageTemplate === "em_branco")) && (
                <div className="space-y-5">
                  {step === 5 && pageTemplate === "em_branco" ? (
                    <div className="flex items-center gap-2 rounded-lg border border-dark-border/70 bg-dark-bg/30 px-3 py-2.5">
                      <span className="text-xs font-medium text-text-primary">Extras na página</span>
                      <Toolist
                        variant="below"
                        wide
                        text="Vídeo do YouTube, carrossel de imagens, notificações em bolha e textos/cards da secção promocional. Na página pública estes blocos ficam na mesma coluna, dentro do cartão (zonas como nos VIP)."
                      />
                    </div>
                  ) : null}
                  <>
                  <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-text-primary">YouTube</span>
                        <Toolist
                          wide
                          variant="below"
                          text="Opcional. Cole o link do vídeo ou só o ID (11 caracteres). A posição define onde o player aparece na página pública."
                        />
                      </div>
                    </div>
                    <input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className={inputClass}
                      placeholder="https://youtube.com/watch?v=… ou ID do vídeo"
                    />
                    {!!youtubeUrl.trim() && !isValidOptionalYoutubeUrl(youtubeUrl) && (
                      <div className="text-xs text-red-400">URL ou ID inválido.</div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <span className="text-xs font-medium text-text-secondary">Posição do vídeo</span>
                      <Toolist
                        variant="below"
                        text="Título, antes/depois do botão ou fim do card — igual às zonas do carrossel."
                      />
                    </div>
                    <MetaSearchablePicker
                      value={youtubePosition}
                      onChange={(v) => setYoutubePosition(normalizeYoutubePosition(v))}
                      options={blockPositionPickerOptions}
                      modalTitle="Posição do vídeo"
                      modalDescription="Escolha a zona da página onde o player será exibido."
                      searchPlaceholder="Filtrar posições…"
                      emptyButtonLabel="Escolher posição"
                      className="w-full"
                    />
                  </div>

                  <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-text-primary">Carrossel</span>
                        <Toolist
                          wide
                          variant="below"
                          text="Até 4 imagens: PNG, JPEG ou WebP, máximo 2 MB cada. Toque num slot para enviar ou trocar. Desligue o interruptor se não for usar."
                        />
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={ofertCarouselEnabled}
                        onClick={() => setOfertCarouselEnabled((v) => !v)}
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
                          ofertCarouselEnabled ? "bg-shopee-orange" : "bg-dark-bg"
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                            ofertCarouselEnabled ? "translate-x-[1.35rem]" : "translate-x-0.5"
                          } mt-px`}
                        />
                      </button>
                    </div>
                    {ofertCarouselEnabled ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-text-secondary">Posição do bloco</span>
                          <Toolist variant="below" text="Onde as imagens aparecem em relação ao título e ao botão." />
                        </div>
                        <MetaSearchablePicker
                          value={ofertCarouselPosition}
                          onChange={(v) =>
                            setOfertCarouselPosition(normalizeOfertCarouselPosition(v))
                          }
                          options={blockPositionPickerOptions}
                          modalTitle="Posição do carrossel"
                          modalDescription="Zona da página para o bloco de imagens."
                          searchPlaceholder="Filtrar posições…"
                          emptyButtonLabel="Escolher posição"
                          className="w-full"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          {([0, 1, 2, 3] as const).map((slot) => {
                            const inputId = `capture-carousel-slot-${slot}`;
                            const prevUrl = carouselSlotPreviewByIndex[slot];
                            const hasFile = !!(carouselSlotPath[slot] || carouselSlotFile[slot]);
                            return (
                              <div
                                key={slot}
                                className="relative aspect-[5/4] overflow-hidden rounded-xl border border-dashed border-dark-border/90 bg-dark-bg/40 transition-colors hover:border-shopee-orange/35"
                              >
                                <input
                                  id={inputId}
                                  type="file"
                                  accept="image/png,image/jpeg,image/webp"
                                  className="sr-only"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] ?? null;
                                    e.target.value = "";
                                    if (!f) return;
                                    if (f.size > 2 * 1024 * 1024) {
                                      setError("Imagem muito grande (máx. 2 MB).");
                                      return;
                                    }
                                    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
                                      setError("Use PNG, JPEG ou WebP.");
                                      return;
                                    }
                                    setCarouselSlotFile((prev) => {
                                      const n = [...prev];
                                      n[slot] = f;
                                      return n;
                                    });
                                    setError(null);
                                  }}
                                />
                                {prevUrl ? (
                                  <>
                                    <Image
                                      src={prevUrl}
                                      alt=""
                                      fill
                                      className="object-cover z-0"
                                      sizes="200px"
                                      unoptimized={prevUrl.startsWith("blob:")}
                                    />
                                    <label
                                      htmlFor={inputId}
                                      className="absolute inset-0 z-[1] cursor-pointer"
                                      aria-label={`Trocar imagem do slot ${slot + 1}`}
                                    />
                                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/80 via-black/35 to-transparent px-2 pb-2 pt-8 text-center text-[10px] font-medium text-white/95">
                                      Toque para trocar
                                    </div>
                                  </>
                                ) : (
                                  <label
                                    htmlFor={inputId}
                                    className="absolute inset-0 z-[1] flex cursor-pointer flex-col items-center justify-center gap-1 p-2 text-center"
                                  >
                                    <Plus className="h-6 w-6 text-text-secondary/80" aria-hidden />
                                    <span className="text-[11px] font-semibold text-text-secondary">
                                      Slot {slot + 1}
                                    </span>
                                    <span className="text-[10px] text-text-secondary/60">Toque para enviar</span>
                                  </label>
                                )}
                                {hasFile ? (
                                  <button
                                    type="button"
                                    className="absolute right-1.5 top-1.5 z-[3] flex h-7 w-7 items-center justify-center rounded-lg border border-dark-border bg-dark-card/95 text-text-secondary shadow hover:border-red-500/50 hover:text-red-400"
                                    aria-label={`Remover imagem ${slot + 1}`}
                                    onClick={(ev) => {
                                      ev.preventDefault();
                                      ev.stopPropagation();
                                      setCarouselSlotFile((prev) => {
                                        const n = [...prev];
                                        n[slot] = null;
                                        return n;
                                      });
                                      setCarouselSlotPath((prev) => {
                                        const n = [...prev];
                                        n[slot] = null;
                                        return n;
                                      });
                                    }}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </div>

                  {isVipPreview || pageTemplate === "em_branco" ? (
                    <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-text-primary">Notificações</span>
                          <Toolist
                            wide
                            variant="below"
                            text="Cartões tipo ‘alguém entrou’ ou cupom na roleta. Nos modelos VIP e Em branco. Desligue para uma landing mais limpa."
                          />
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={notificationsEnabled}
                          onClick={() => setNotificationsEnabled((v) => !v)}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
                            notificationsEnabled ? "bg-shopee-orange" : "bg-dark-bg"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                              notificationsEnabled ? "translate-x-[1.35rem]" : "translate-x-0.5"
                            } mt-px`}
                          />
                        </button>
                      </div>
                      {notificationsEnabled ? (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-medium text-text-secondary">Posição do cartão</span>
                            <Toolist variant="below" text="Canto da tela ou centro, conforme o espaço do modelo." />
                          </div>
                          <MetaSearchablePicker
                            value={notificationsPosition}
                            onChange={(v) =>
                              setNotificationsPosition(normalizeNotificationsPosition(v))
                            }
                            options={notificationsPickerOptions}
                            modalTitle="Posição da notificação"
                            modalDescription="Onde o cartão aparece sobre a página."
                            searchPlaceholder="Filtrar posições…"
                            emptyButtonLabel="Escolher posição"
                            className="w-full"
                          />
                        </>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-lg border border-dark-border/70 bg-dark-bg/15 px-3 py-2.5">
                      <span className="text-xs text-text-secondary">Notificações</span>
                      <Toolist
                        variant="below"
                        text="Só em modelos VIP. No clássico não há cartões sobre a página."
                      />
                    </div>
                  )}

                  {(isVipPreview && pageTemplate !== "jardim_floral") || pageTemplate === "em_branco" ? (
                    <div className="rounded-lg border border-dark-border bg-dark-bg/25 p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-sm font-medium text-text-primary">
                            Textos da secção promocional
                          </span>
                          <Toolist
                            wide
                            variant="below"
                            text="Só aparecem campos do modelo que você escolheu. Desligue o interruptor para esconder toda a secção na página pública."
                          />
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={promoSectionsEnabled}
                          onClick={() => setPromoSectionsEnabled((v) => !v)}
                          className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-dark-border transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange/50 ${
                            promoSectionsEnabled ? "bg-shopee-orange" : "bg-dark-bg"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
                              promoSectionsEnabled ? "translate-x-[1.35rem]" : "translate-x-0.5"
                            } mt-px`}
                          />
                        </button>
                      </div>
                      {promoSectionsEnabled ? (
                        <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1 scrollbar-thin">
                          {pageTemplate === "vip_rosa" || pageTemplate === "em_branco" ? (
                            <>
                              <div>
                                <label className={labelClass}>Título acima dos cards</label>
                                <textarea
                                  value={promoTitleBenefits}
                                  onChange={(e) => setPromoTitleBenefits(e.target.value)}
                                  className={textareaClass}
                                  rows={2}
                                  maxLength={120}
                                />
                              </div>
                              <div className="rounded-lg border border-dark-border/60 bg-dark-bg/20 p-3 space-y-3">
                                <div className="text-xs font-semibold text-text-primary">
                                  Cores e tipografia (cards estilo Rosa)
                                </div>
                                <p className="text-[11px] leading-snug text-text-secondary">
                                  Campos vazios usam o padrão do modelo. Pode usar{" "}
                                  <code className="text-[10px]">#hex</code> ou{" "}
                                  <code className="text-[10px]">rgba(...)</code> curto.
                                </p>
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                  <div>
                                    <label className={labelClass}>Fundo da secção</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.section_bg ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          section_bg: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                      placeholder="Ex.: #f5f5f5"
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Borda da secção</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.section_border ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          section_border: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                      placeholder="Ex.: rgba(0,0,0,0.08)"
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Cor do título da secção</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.heading_color ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          heading_color: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Tamanho do título (px)</label>
                                    <input
                                      type="number"
                                      min={10}
                                      max={22}
                                      value={promoRosaUiDraft.heading_font_px ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          heading_font_px:
                                            v === ""
                                              ? undefined
                                              : Math.min(22, Math.max(10, parseInt(v, 10) || 13)),
                                        }));
                                      }}
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Fundo do card</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.card_bg ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          card_bg: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Borda do card</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.card_border ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          card_border: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Barra lateral (acento)</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.left_accent ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          left_accent: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Cor do título do card</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.title_color ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          title_color: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Cor do texto do card</label>
                                    <input
                                      type="text"
                                      value={promoRosaUiDraft.body_color ?? ""}
                                      onChange={(e) =>
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          body_color: e.target.value.trim() || undefined,
                                        }))
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Tamanho título do card (px)</label>
                                    <input
                                      type="number"
                                      min={10}
                                      max={20}
                                      value={promoRosaUiDraft.title_font_px ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          title_font_px:
                                            v === ""
                                              ? undefined
                                              : Math.min(20, Math.max(10, parseInt(v, 10) || 13)),
                                        }));
                                      }}
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Tamanho corpo do card (px)</label>
                                    <input
                                      type="number"
                                      min={10}
                                      max={20}
                                      value={promoRosaUiDraft.body_font_px ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          body_font_px:
                                            v === ""
                                              ? undefined
                                              : Math.min(20, Math.max(10, parseInt(v, 10) || 13)),
                                        }));
                                      }}
                                      className={inputClass}
                                    />
                                  </div>
                                  <div className="sm:col-span-2">
                                    <label className={labelClass}>Fonte (Google Fonts)</label>
                                    <select
                                      value={promoRosaUiDraft.font_preset ?? "system"}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        setPromoRosaUiDraft((d) => ({
                                          ...d,
                                          font_preset:
                                            v === "system" ? undefined : (v as PromoRosaFontPreset),
                                        }));
                                      }}
                                      className={inputClass}
                                    >
                                      <option value="system">Sistema (padrão)</option>
                                      <option value="inter">Inter</option>
                                      <option value="dm_sans">DM Sans</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                              {promoCardsDraft.rosa.map((row, i) => (
                                <div
                                  key={`rosa-card-${i}`}
                                  className="rounded-lg border border-dark-border/80 bg-dark-bg/30 p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-shopee-orange/90">
                                      Card {i + 1} de {promoCardsDraft.rosa.length}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={promoCardsDraft.rosa.length <= PROMO_ROSA_MIN}
                                      onClick={() => {
                                        setPromoCardsDraft((d) => removeRosaCardAt(d, i));
                                        setRosaPromoImageFiles((prev) => {
                                          const next = [...prev];
                                          next.splice(i, 1);
                                          return next;
                                        });
                                      }}
                                      className="h-7 px-2 rounded-md text-xs font-medium border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                  <div>
                                    <label className={labelClass}>Destaque à esquerda</label>
                                    <select
                                      value={row.lead_mode}
                                      onChange={(e) => {
                                        const v = e.target.value as RosaLeadMode;
                                        setPromoCardsDraft((d) => {
                                          const rosa = [...d.rosa];
                                          const cur = rosa[i]!;
                                          rosa[i] = {
                                            ...cur,
                                            lead_mode: v,
                                            ...(v !== "image" ? { image_path: null } : {}),
                                          };
                                          return { ...d, rosa };
                                        });
                                        if (v !== "image") {
                                          setRosaPromoImageFiles((prev) => {
                                            const next = [...prev];
                                            next[i] = null;
                                            return next;
                                          });
                                        }
                                      }}
                                      className={inputClass}
                                    >
                                      <option value="icon">Ícone Lucide</option>
                                      <option value="emoji">Emoji</option>
                                      <option value="image">Imagem (upload)</option>
                                    </select>
                                  </div>
                                  <div>
                                    <label className={labelClass}>Título do card</label>
                                    <input
                                      type="text"
                                      value={row.title}
                                      maxLength={90}
                                      onChange={(e) =>
                                        setPromoCardsDraft((d) => {
                                          const rosa = [...d.rosa];
                                          rosa[i] = { ...rosa[i]!, title: e.target.value };
                                          return { ...d, rosa };
                                        })
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Texto do card</label>
                                    <textarea
                                      value={row.body}
                                      maxLength={260}
                                      onChange={(e) =>
                                        setPromoCardsDraft((d) => {
                                          const rosa = [...d.rosa];
                                          rosa[i] = { ...rosa[i]!, body: e.target.value };
                                          return { ...d, rosa };
                                        })
                                      }
                                      className={textareaClass}
                                      rows={3}
                                    />
                                  </div>
                                  {row.lead_mode === "icon" ? (
                                    <div>
                                      <label className={labelClass}>Ícone (Lucide)</label>
                                      <VipRosaIconPicker
                                        value={row.iconKey}
                                        onChange={(v) =>
                                          setPromoCardsDraft((d) => {
                                            const rosa = [...d.rosa];
                                            rosa[i] = {
                                              ...rosa[i]!,
                                              iconKey: normalizeRosaIconKey(v),
                                            };
                                            return { ...d, rosa };
                                          })
                                        }
                                        options={vipRosaIconPickerOptions}
                                        className="w-full"
                                        openButtonId={`vip-rosa-icon-card-${i}`}
                                      />
                                    </div>
                                  ) : null}
                                  {row.lead_mode === "emoji" ? (
                                    <div>
                                      <label className={labelClass}>Emoji</label>
                                      <input
                                        type="text"
                                        value={row.emoji}
                                        maxLength={8}
                                        placeholder="Ex.: ✨"
                                        onChange={(e) =>
                                          setPromoCardsDraft((d) => {
                                            const rosa = [...d.rosa];
                                            rosa[i] = { ...rosa[i]!, emoji: e.target.value };
                                            return { ...d, rosa };
                                          })
                                        }
                                        className={inputClass}
                                      />
                                    </div>
                                  ) : null}
                                  {row.lead_mode === "image" ? (
                                    <div className="space-y-2">
                                      <label className={labelClass}>
                                        Imagem (PNG, JPG ou WebP — máx. 2MB)
                                      </label>
                                      <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp"
                                        className={`${inputClass} py-1.5 text-xs file:mr-2 file:rounded file:border-0 file:bg-dark-card file:px-2 file:py-1 file:text-xs`}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          e.target.value = "";
                                          if (!file) return;
                                          if (file.size > 2 * 1024 * 1024) {
                                            setError("Imagem do card muito grande (máx. 2MB).");
                                            return;
                                          }
                                          setRosaPromoImageFiles((prev) => {
                                            const next = [...prev];
                                            next[i] = file;
                                            return next;
                                          });
                                          setPromoCardsDraft((d) => {
                                            const rosa = [...d.rosa];
                                            rosa[i] = { ...rosa[i]!, lead_mode: "image" };
                                            return { ...d, rosa };
                                          });
                                        }}
                                      />
                                      {rosaPromoBlobUrls[i] || row.image_path ? (
                                        <button
                                          type="button"
                                          onClick={() => void clearRosaPromoCardImage(i)}
                                          className="h-8 rounded-md border border-dark-border px-2 text-xs font-medium text-text-secondary hover:border-red-400/50 hover:text-red-400"
                                        >
                                          Remover imagem
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={promoCardsDraft.rosa.length >= PROMO_ROSA_MAX}
                                onClick={() => setPromoCardsDraft((d) => appendEmptyRosaCard(d))}
                                className="h-9 px-3 rounded-md text-sm font-medium border border-shopee-orange/60 text-shopee-orange hover:bg-shopee-orange/10 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                                Adicionar card
                              </button>
                            </>
                          ) : null}

                          {pageTemplate === "vip_terroso" ? (
                            <>
                              <div>
                                <label className={labelClass}>Título da grelha</label>
                                <textarea
                                  value={promoTitleInGroup}
                                  onChange={(e) => setPromoTitleInGroup(e.target.value)}
                                  className={textareaClass}
                                  rows={2}
                                  maxLength={120}
                                />
                              </div>
                              {promoCardsDraft.terroso.map((row, i) => (
                                <div
                                  key={`terro-card-${i}`}
                                  className="rounded-lg border border-dark-border/80 bg-dark-bg/30 p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="text-xs font-semibold text-shopee-orange/90">
                                      Card {i + 1} de {promoCardsDraft.terroso.length}
                                    </div>
                                    <button
                                      type="button"
                                      disabled={promoCardsDraft.terroso.length <= PROMO_TERRO_MIN}
                                      onClick={() => setPromoCardsDraft((d) => removeTerrosoCardAt(d, i))}
                                      className="h-7 px-2 rounded-md text-xs font-medium border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-40 disabled:pointer-events-none"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                  <div>
                                    <label className={labelClass}>Emoji</label>
                                    <input
                                      type="text"
                                      value={row.emoji}
                                      maxLength={12}
                                      placeholder="📦"
                                      onChange={(e) =>
                                        setPromoCardsDraft((d) => {
                                          const terroso = [...d.terroso];
                                          terroso[i] = { ...terroso[i]!, emoji: e.target.value };
                                          return { ...d, terroso };
                                        })
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Título</label>
                                    <input
                                      type="text"
                                      value={row.title}
                                      maxLength={90}
                                      onChange={(e) =>
                                        setPromoCardsDraft((d) => {
                                          const terroso = [...d.terroso];
                                          terroso[i] = { ...terroso[i]!, title: e.target.value };
                                          return { ...d, terroso };
                                        })
                                      }
                                      className={inputClass}
                                    />
                                  </div>
                                  <div>
                                    <label className={labelClass}>Descrição</label>
                                    <textarea
                                      value={row.body}
                                      maxLength={220}
                                      onChange={(e) =>
                                        setPromoCardsDraft((d) => {
                                          const terroso = [...d.terroso];
                                          terroso[i] = { ...terroso[i]!, body: e.target.value };
                                          return { ...d, terroso };
                                        })
                                      }
                                      className={textareaClass}
                                      rows={2}
                                    />
                                  </div>
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={promoCardsDraft.terroso.length >= PROMO_TERRO_MAX}
                                onClick={() => setPromoCardsDraft((d) => appendEmptyTerrosoCard(d))}
                                className="h-9 px-3 rounded-md text-sm font-medium border border-shopee-orange/60 text-shopee-orange hover:bg-shopee-orange/10 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                                Adicionar card
                              </button>
                            </>
                          ) : null}

                          {pageTemplate === "aurora_ledger" ? (
                            <>
                              <div>
                                <label className={labelClass}>Título da lista de depoimentos</label>
                                <textarea
                                  value={promoTitleTestimonials}
                                  onChange={(e) => setPromoTitleTestimonials(e.target.value)}
                                  className={textareaClass}
                                  rows={2}
                                  maxLength={120}
                                />
                              </div>
                              {promoCardsDraft.aurora.map((row, i) => {
                                const fallbackImg =
                                  AURORA_CARD_DEFAULTS[Math.min(i, AURORA_CARD_DEFAULTS.length - 1)]!
                                    .defaultAvatar;
                                const thumb = promoAuroraAvatarUrlsPreview?.[i] ?? null;
                                return (
                                  <div
                                    key={`aurora-card-${i}`}
                                    className="rounded-lg border border-dark-border/80 bg-dark-bg/30 p-3 space-y-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="text-xs font-semibold text-shopee-orange/90">
                                        Depoimento {i + 1} de {promoCardsDraft.aurora.length}
                                      </div>
                                      <button
                                        type="button"
                                        disabled={promoCardsDraft.aurora.length <= PROMO_AURORA_MIN}
                                        onClick={() => {
                                          setPromoCardsDraft((d) => removeAuroraCardAt(d, i));
                                          setAuroraAvatarFiles((prev) => prev.filter((_, j) => j !== i));
                                        }}
                                        className="h-7 px-2 rounded-md text-xs font-medium border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-40 disabled:pointer-events-none"
                                      >
                                        Remover
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap items-start gap-3">
                                      <div className="shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={thumb || fallbackImg}
                                          alt=""
                                          className="h-16 w-16 rounded-full object-cover border border-dark-border bg-dark-bg"
                                        />
                                      </div>
                                      <div className="min-w-0 flex-1 space-y-2">
                                        <label className={labelClass}>Foto do depoimento</label>
                                        <input
                                          type="file"
                                          accept="image/png,image/jpeg,image/jpg,image/webp"
                                          className="block w-full max-w-xs text-xs text-text-secondary file:mr-2 file:rounded file:border-0 file:bg-dark-card file:px-2 file:py-1 file:text-xs file:text-text-primary"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            e.target.value = "";
                                            if (!file) return;
                                            if (file.size > 2 * 1024 * 1024) {
                                              setError("Cada foto pode ter no máximo 2 MB (PNG, JPEG ou WebP).");
                                              return;
                                            }
                                            setError(null);
                                            setAuroraAvatarFiles((prev) => {
                                              const next = [...prev];
                                              while (next.length < promoCardsDraft.aurora.length) {
                                                next.push(null);
                                              }
                                              next[i] = file;
                                              return next.slice(0, promoCardsDraft.aurora.length);
                                            });
                                          }}
                                        />
                                        {(row.avatar_path || auroraAvatarFiles[i]) && (
                                          <button
                                            type="button"
                                            onClick={() => void clearAuroraSlotPhoto(i, row.avatar_path)}
                                            className="h-8 px-2 rounded-md text-xs border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50"
                                          >
                                            Remover foto (volta ao avatar padrão até gravar)
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                    <div>
                                      <label className={labelClass}>Nome</label>
                                      <input
                                        type="text"
                                        value={row.name}
                                        maxLength={48}
                                        onChange={(e) =>
                                          setPromoCardsDraft((d) => {
                                            const aurora = [...d.aurora];
                                            aurora[i] = { ...aurora[i]!, name: e.target.value };
                                            return { ...d, aurora };
                                          })
                                        }
                                        className={inputClass}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelClass}>Cidade</label>
                                      <input
                                        type="text"
                                        value={row.city}
                                        maxLength={48}
                                        onChange={(e) =>
                                          setPromoCardsDraft((d) => {
                                            const aurora = [...d.aurora];
                                            aurora[i] = { ...aurora[i]!, city: e.target.value };
                                            return { ...d, aurora };
                                          })
                                        }
                                        className={inputClass}
                                      />
                                    </div>
                                    <div>
                                      <label className={labelClass}>Citação</label>
                                      <textarea
                                        value={row.quote}
                                        maxLength={320}
                                        onChange={(e) =>
                                          setPromoCardsDraft((d) => {
                                            const aurora = [...d.aurora];
                                            aurora[i] = { ...aurora[i]!, quote: e.target.value };
                                            return { ...d, aurora };
                                          })
                                        }
                                        className={textareaClass}
                                        rows={3}
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                              <button
                                type="button"
                                disabled={promoCardsDraft.aurora.length >= PROMO_AURORA_MAX}
                                onClick={() => {
                                  setPromoCardsDraft((d) => appendEmptyAuroraCard(d));
                                  setAuroraAvatarFiles((prev) => [...prev, null]);
                                }}
                                className="h-9 px-3 rounded-md text-sm font-medium border border-shopee-orange/60 text-shopee-orange hover:bg-shopee-orange/10 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                                Adicionar depoimento
                              </button>
                            </>
                          ) : null}

                          {pageTemplate === "vinho_rose" || pageTemplate === "the_new_chance" ? (
                            <>
                              <div>
                                <label className={labelClass}>Título opcional acima da lista (deixe vazio para não mostrar)</label>
                                <textarea
                                  value={promoTitleBenefits}
                                  onChange={(e) => setPromoTitleBenefits(e.target.value)}
                                  className={textareaClass}
                                  rows={2}
                                  maxLength={120}
                                />
                              </div>
                              {promoCardsDraft.simpleFour.map((line, i) => (
                                <div
                                  key={`simple-${i}`}
                                  className="rounded-lg border border-dark-border/80 bg-dark-bg/30 p-3 space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <label className={labelClass}>Linha {i + 1} de {promoCardsDraft.simpleFour.length}</label>
                                    <button
                                      type="button"
                                      disabled={promoCardsDraft.simpleFour.length <= PROMO_SIMPLE_MIN}
                                      onClick={() => setPromoCardsDraft((d) => removeSimpleLineAt(d, i))}
                                      className="h-7 px-2 rounded-md text-xs font-medium border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 disabled:opacity-40 disabled:pointer-events-none shrink-0"
                                    >
                                      Remover
                                    </button>
                                  </div>
                                  <textarea
                                    value={line}
                                    maxLength={160}
                                    onChange={(e) =>
                                      setPromoCardsDraft((d) => {
                                        const simpleFour = [...d.simpleFour];
                                        simpleFour[i] = e.target.value;
                                        return { ...d, simpleFour };
                                      })
                                    }
                                    className={textareaClass}
                                    rows={2}
                                  />
                                </div>
                              ))}
                              <button
                                type="button"
                                disabled={promoCardsDraft.simpleFour.length >= PROMO_SIMPLE_MAX}
                                onClick={() => setPromoCardsDraft((d) => appendSimpleLine(d))}
                                className="h-9 px-3 rounded-md text-sm font-medium border border-shopee-orange/60 text-shopee-orange hover:bg-shopee-orange/10 disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-2"
                              >
                                <Plus className="h-4 w-4" aria-hidden />
                                Adicionar linha
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  </>
                </div>
              )}

              {/* Footer steps */}
              <div className="pt-4 border-t border-dark-border flex items-center justify-between">
                <div className="text-xs text-text-secondary">
                  {step} de {captureWizardMaxStep}
                </div>

                <div className="flex items-center gap-2">
                  {(step > 1 || (step === 1 && mode === "create")) && (
                    <button
                      type="button"
                      onClick={() => {
                        if (step > 1) goPrevStep();
                        else backToTemplatePicker();
                      }}
                      className="h-9 px-3 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-text-primary hover:border-dark-border/80 transition-colors inline-flex items-center gap-2"
                      title={step === 1 && mode === "create" ? "Escolher outro modelo" : "Voltar"}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Voltar
                    </button>
                  )}

                  {step < captureWizardMaxStep && (
                    <button
                      type="button"
                      onClick={goNextStep}
                      className="h-9 px-3 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-text-primary hover:border-dark-border/80 transition-colors inline-flex items-center gap-2"
                      title="Avançar"
                    >
                      Avançar
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Buttons */}
              {step === captureWizardMaxStep && (
                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="submit"
                    className="h-9 px-4 bg-shopee-orange text-white rounded-md hover:opacity-90 transition-opacity font-semibold text-sm disabled:opacity-50"
                    disabled={saving}
                  >
                    {mode === "create" ? "Criar site" : "Salvar alterações"}
                  </button>

                  <button
                    type="button"
                    onClick={cancelEditOrCreate}
                    className="h-9 px-4 bg-dark-bg border border-dark-border text-text-secondary rounded-md hover:border-shopee-orange hover:text-shopee-orange transition-colors font-semibold text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Preview: items-start na grelha evita esticar a coluna à altura do form (sticky deixa de “morrer”). */}
          <div className="min-w-0 lg:sticky lg:top-6">
            {showTemplatePreview ? (
              <div className="rounded-lg border border-dark-border overflow-hidden bg-dark-card">
                <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-text-primary">
                    {isBlankPreview ? "Preview (Em branco)" : "Preview (modelo VIP)"}
                  </div>
                  <div className="flex items-center gap-2">
                    {!isBlankPreview ? (
                      <>
                        <div
                          className="inline-flex rounded-lg border border-dark-border bg-dark-bg/80 p-0.5"
                          role="group"
                          aria-label="Dispositivo do preview"
                        >
                          <button
                            type="button"
                            onClick={() => setVipPreviewDevice("mobile")}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                              vipPreviewDevice === "mobile"
                                ? "bg-shopee-orange text-white shadow-sm"
                                : "text-text-secondary hover:text-text-primary hover:bg-dark-card"
                            }`}
                            title="Ver no celular"
                            aria-pressed={vipPreviewDevice === "mobile"}
                          >
                            <Smartphone className="h-4 w-4" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => setVipPreviewDevice("desktop")}
                            className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                              vipPreviewDevice === "desktop"
                                ? "bg-shopee-orange text-white shadow-sm"
                                : "text-text-secondary hover:text-text-primary hover:bg-dark-card"
                            }`}
                            title="Ver no PC"
                            aria-pressed={vipPreviewDevice === "desktop"}
                          >
                            <Monitor className="h-4 w-4" aria-hidden />
                          </button>
                        </div>
                        <span className="text-xs text-text-secondary hidden sm:inline">Tempo real</span>
                      </>
                    ) : (
                      <span className="text-xs text-text-secondary hidden sm:inline">Ao vivo</span>
                    )}
                  </div>
                </div>
                <CapturePreviewPortalContext.Provider value={{ root: vipPreviewToastRoot }}>
                  <div className="relative flex h-[min(78vh,820px)] max-h-[min(78vh,820px)] flex-col overflow-hidden bg-black/30">
                    {isBlankPreview ? (
                      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                        <CaptureEmBrancoToastsOnly
                          notificationsEnabled={notificationsEnabled}
                          notificationsPosition={notificationsPosition}
                        />
                        <div className="relative z-[1] min-h-0 flex flex-1 flex-col">
                          <CaptureBlankCanvas
                            config={blankCanvasDraft}
                            title={previewTitle}
                            description={previewDesc}
                            buttonText={previewButtonText}
                            ctaHref={previewButtonUrl.trim() ? previewButtonUrl : "#"}
                            logoUrl={previewLogoSrc}
                            heroPublicUrl={blankHeroPreviewUrl}
                            previewMode
                            siteButtonColor={previewColor}
                            bgImagePublicUrl={blankBgPreviewUrl}
                            emBrancoCardMedia={{
                              youtubeUrl: youtubeUrl.trim() || null,
                              youtubePosition,
                              ofertCarouselEnabled,
                              ofertCarouselPosition,
                              ofertCarouselImageUrls: ofertCarouselPreviewUrls,
                              promoSectionsEnabled,
                              promoTitles: resolvePromoTitlesForPublicPage(
                                "em_branco",
                                promoSectionTitlesToJsonb({
                                  benefits: promoTitleBenefits,
                                  testimonials: promoTitleTestimonials,
                                  inGroup: promoTitleInGroup,
                                }),
                              ),
                              promoCards: resolvePromoCardsForPublicPage(
                                "em_branco",
                                promoSectionCardsToDbValue("em_branco", promoCardsDraft),
                              ),
                              accentColor: previewColor,
                              promoRosaUi: promoRosaUiDraft,
                              promoRosaCardImageUrls: promoRosaCardPreviewUrls,
                            }}
                          />
                        </div>
                        {/* Alvo do portal das notificações (igual ao mockup VIP). */}
                        <div
                          ref={setVipPreviewToastRoot}
                          className="pointer-events-none absolute inset-0 z-[40]"
                          aria-hidden
                        />
                      </div>
                    ) : (
                    <div className="flex min-h-0 flex-1 items-center justify-center p-3 sm:p-4">
                      {(() => {
                        const mock =
                          vipPreviewDevice === "mobile" ? VIP_PREVIEW_MOCKUP : VIP_PREVIEW_PC_MOCKUP;
                        const screenRoundClass =
                          vipPreviewDevice === "mobile"
                            ? "rounded-[3.05rem] sm:rounded-[3.2rem]"
                            : "rounded-md sm:rounded-lg";
                        const frameMaxWClass =
                          vipPreviewDevice === "mobile"
                            ? "max-w-[min(100%,320px)]"
                            : "max-w-[min(100%,min(920px,96vw))]";
                        const isMobileFrame = vipPreviewDevice === "mobile";

                        const vipPreviewToastOverlay = (
                          <div
                            ref={setVipPreviewToastRoot}
                            className="pointer-events-none absolute inset-0 z-[40]"
                            aria-hidden
                          />
                        );

                        const vipLanding = (
                          <CaptureVipLanding
                            variant={
                              pageTemplate === "vip_terroso"
                                ? "vip_terroso"
                                : pageTemplate === "vinho_rose"
                                  ? "vinho_rose"
                                  : pageTemplate === "the_new_chance"
                                    ? "the_new_chance"
                                    : pageTemplate === "aurora_ledger"
                                      ? "aurora_ledger"
                                      : pageTemplate === "jardim_floral"
                                        ? "jardim_floral"
                                        : "vip_rosa"
                            }
                            title={previewTitle}
                            description={previewDesc}
                            buttonText={previewButtonText}
                            ctaHref={previewButtonUrl.trim() ? previewButtonUrl : "#"}
                            logoUrl={previewLogoSrc}
                            buttonColor={previewColor}
                            youtubeUrl={youtubeUrl.trim() || null}
                            youtubePosition={youtubePosition}
                            previewMode
                            notificationsEnabled={notificationsEnabled}
                            notificationsPosition={notificationsPosition}
                            ofertCarouselEnabled={ofertCarouselEnabled}
                            ofertCarouselPosition={ofertCarouselPosition}
                            ofertCarouselImageUrls={ofertCarouselPreviewUrls}
                            promoSectionsEnabled={promoSectionsEnabled}
                            promoTitles={resolvePromoTitlesForPublicPage(
                              pageTemplate,
                              promoSectionTitlesToJsonb({
                                benefits: promoTitleBenefits,
                                testimonials: promoTitleTestimonials,
                                inGroup: promoTitleInGroup,
                              }),
                            )}
                            promoCards={resolvePromoCardsForPublicPage(
                              pageTemplate,
                              promoSectionCardsToDbValue(pageTemplate, promoCardsDraft),
                            )}
                            promoAuroraAvatarUrls={promoAuroraAvatarUrlsPreview}
                            {...(pageTemplate === "vip_rosa"
                              ? {
                                  promoRosaUi: promoRosaUiDraft,
                                  promoRosaCardImageUrls: promoRosaCardPreviewUrls,
                                }
                              : {})}
                          />
                        );

                        if (isMobileFrame) {
                          return (
                            <div
                              className={`relative mx-auto h-full max-h-full w-auto shrink-0 ${frameMaxWClass}`}
                              style={{ aspectRatio: `${mock.w} / ${mock.h}` }}
                            >
                              <div
                                className={`absolute z-[1] overflow-hidden ${screenRoundClass}`}
                                style={vipMobileScreenInsets}
                              >
                                <VipPreviewViewportShim
                                  enabled={vipMobilePreviewNarrow}
                                  overlay={vipPreviewToastOverlay}
                                >
                                  {vipLanding}
                                </VipPreviewViewportShim>
                              </div>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={mock.src}
                                alt=""
                                width={mock.w}
                                height={mock.h}
                                className="pointer-events-none absolute inset-0 z-[50] h-full w-full select-none object-contain"
                                draggable={false}
                              />
                            </div>
                          );
                        }

                        /* PC: wrapper com o tamanho exato do PNG (sem letterboxing) + moldura por cima;
                         * multiply faz a tela branca “deixar passar” o iframe/conteúdo por baixo. */
                        return (
                          <div className="isolate relative mx-auto inline-block max-h-full max-w-[min(920px,96vw)] leading-none">
                            <div
                              className={`absolute z-[1] overflow-hidden ${screenRoundClass}`}
                              style={vipPcScreenInsets}
                            >
                              <VipPreviewViewportShim
                                enabled={vipMobilePreviewNarrow}
                                overlay={vipPreviewToastOverlay}
                              >
                                {vipLanding}
                              </VipPreviewViewportShim>
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={VIP_PREVIEW_PC_MOCKUP.src}
                              alt=""
                              width={VIP_PREVIEW_PC_MOCKUP.w}
                              height={VIP_PREVIEW_PC_MOCKUP.h}
                              className={`relative z-50 block h-auto w-auto max-w-full select-none object-contain mix-blend-multiply pointer-events-none ${
                                vipMobilePreviewNarrow
                                  ? "max-h-[min(40vh,340px)]"
                                  : "max-h-[min(calc(78vh-5rem),760px)]"
                              }`}
                              draggable={false}
                            />
                          </div>
                        );
                      })()}
                    </div>
                    )}
                  </div>
                </CapturePreviewPortalContext.Provider>
              </div>
            ) : (
              <CapturePreviewCard
                title={previewTitle}
                description={previewDesc}
                buttonColor={previewColor}
                layoutVariant={previewLayout}
                logoSrc={previewLogoSrc}
                buttonText={previewButtonText}
                buttonUrl={previewButtonUrl}
                youtubeUrl={youtubeUrl}
                youtubePosition={youtubePosition}
                ofertCarouselEnabled={ofertCarouselEnabled}
                ofertCarouselPosition={ofertCarouselPosition}
                ofertCarouselImageUrls={ofertCarouselPreviewUrls}
              />
            )}
          </div>
        </div>
      )}

      <DeleteSiteModal
        open={showDeleteModal && !!(deleteTargetSite ?? site)}
        isDeleting={isDeleting}
        publicUrl={publicUrlForDelete}
        onClose={() => {
          if (!isDeleting) {
            setShowDeleteModal(false);
            setDeleteTargetSite(null);
          }
        }}
        onConfirm={confirmDelete}
      />

      <ResetMetricsModal
        open={showResetMetricsModal}
        oldUrl={originalButtonUrlRef.current}
        newUrl={whatsappUrl.trim()}
        viewCount={site?.view_count ?? 0}
        clickCount={site?.cta_click_count ?? 0}
        saving={saving}
        onCancel={() => setShowResetMetricsModal(false)}
        onSaveWithoutReset={async () => {
          setShowResetMetricsModal(false);
          await performSave({ resetAfterSave: false });
        }}
        onSaveWithReset={async () => {
          setShowResetMetricsModal(false);
          await performSave({ resetAfterSave: hasMetricsData });
        }}
      />

      <div className="h-8" />
    </div>
  );
}