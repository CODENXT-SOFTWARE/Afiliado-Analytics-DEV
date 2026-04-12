"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  AlertCircle,
  Settings,
  ChevronRight,
  Building2,
  Target,
  Image as ImageIcon,
  Link2,
  CheckCircle2,
  Loader2,
  Upload,
  ImagePlus,
  Video,
  ChevronLeft,
  Zap,
  Instagram,
  Play,
  Check,
  X,
  Info,
  AlertTriangle,
} from "lucide-react";
import { createPortal } from "react-dom";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import MetaCountryPicker from "@/app/components/meta/MetaCountryPicker";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import ShopeeLinkHistoryPickButton from "@/app/components/shopee/ShopeeLinkHistoryPickButton";
import {
  META_CREATE_CAMPAIGN_OBJECTIVES,
  META_CALL_TO_ACTIONS,
  META_PUBLISHER_PLATFORMS,
  META_SALES_CONVERSION_EVENTS,
  META_PIXEL_CONVERSION_EVENTS,
  META_LEADS_CAMPAIGN_CONVERSION_PICKER_EVENTS,
  META_GENDER_OPTIONS,
  getOptimizationGoalsForObjective,
  getDefaultGoalForObjective,
  isMetaLeadsWebsiteConversionEvent,
} from "@/lib/meta-ads-constants";

type AdAccount = { id: string; name: string; business_id?: string };
type Page = { id: string; name: string; instagram_account?: { id: string; username: string } | null };
type Pixel = { id: string; name: string };
type InstagramAccount = { id: string; username: string; profile_pic: string | null };
type LibraryImage = { hash: string; url: string | null; id: string | null };
type LibraryVideo = { id: string; title: string; source: string | null; length: number | null; picture: string | null };

const STEPS = [
  { id: 1, title: "Conta & Página", icon: Building2 },
  { id: 2, title: "Campanha", icon: Megaphone },
  { id: 3, title: "Conjunto", icon: Target },
  { id: 4, title: "Anúncio", icon: ImageIcon },
];

// ─── Field helpers ─────────────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:border-shopee-orange transition-colors";

function Tooltip({ text, wide }: { text: string; wide?: boolean }) {
  const [visible, setVisible] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const anchorRef = React.useRef<HTMLSpanElement>(null);

  const show = React.useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = React.useCallback(() => setVisible(false), []);

  const tip = visible ? createPortal(
    <span
      style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
    </span>, document.body
  ) : null;

  return (
    <span ref={anchorRef} className="inline-flex items-center" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors cursor-help">
        <Info className="h-2.5 w-2.5" />
      </span>
      {tip}
    </span>
  );
}

function FieldLabel({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5 flex items-center gap-1.5">
      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wide">{children}</label>
      {hint && <Tooltip text={hint} wide />}
    </div>
  );
}

function SectionBox({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-4">
      <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
        <Icon className="h-3.5 w-3.5 text-shopee-orange/80" />
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function MetaAdsClient() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [adAccountId, setAdAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [campaignObjective, setCampaignObjective] = useState("OUTCOME_TRAFFIC");
  const [campaignId, setCampaignId] = useState("");
  const [adsetName, setAdsetName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("10");
  const [countryCodes, setCountryCodes] = useState<string[]>(["BR"]);
  /** Pixel só para rastreamento no anúncio (tráfego sem meta de conversão no conjunto), via tracking_specs. */
  const [trafficTrackingPixelId, setTrafficTrackingPixelId] = useState("");
  const [ageMin, setAgeMin] = useState("18");
  const [ageMax, setAgeMax] = useState("65");
  const [gender, setGender] = useState<"all" | "male" | "female">("all");
  const [optimizationGoal, setOptimizationGoal] = useState("LINK_CLICKS");
  const [pixelId, setPixelId] = useState("");
  const [conversionEvent, setConversionEvent] = useState("PURCHASE");
  /** Plataformas de veiculação (enviadas em targeting.publisher_platforms). */
  const [publisherPlatforms, setPublisherPlatforms] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(META_PUBLISHER_PLATFORMS.map((p) => [p.value, true]))
  );
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [adsetId, setAdsetId] = useState("");
  const [adName, setAdName] = useState("");
  const [adLink, setAdLink] = useState("");
  const [adMessage, setAdMessage] = useState("");
  const [adTitle, setAdTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageHash, setImageHash] = useState("");
  const [libraryImages, setLibraryImages] = useState<LibraryImage[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [useInstagramIdentity, setUseInstagramIdentity] = useState(false);
  const [createdAdId, setCreatedAdId] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [videoId, setVideoId] = useState("");
  const [libraryVideos, setLibraryVideos] = useState<LibraryVideo[]>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [callToAction, setCallToAction] = useState("LEARN_MORE");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [tokenDebug, setTokenDebug] = useState<{ scopes: string[]; has_pages_manage_ads: boolean; is_valid: boolean } | null>(null);
  const [loadingTokenDebug, setLoadingTokenDebug] = useState(false);
  const [promotePages, setPromotePages] = useState<Page[]>([]);
  const [loadingPromotePages, setLoadingPromotePages] = useState(false);
  const [igAccounts, setIgAccounts] = useState<InstagramAccount[]>([]);
  const [loadingIgAccounts, setLoadingIgAccounts] = useState(false);
  const [igDebug, setIgDebug] = useState<string | null>(null);
  const [igManualMode, setIgManualMode] = useState(false);
  const [adEligibleIgIds, setAdEligibleIgIds] = useState<Set<string>>(new Set());
  const [adAccountIgListNonEmpty, setAdAccountIgListNonEmpty] = useState(false);
  const [imgPage, setImgPage] = useState(0);
  const [vidPage, setVidPage] = useState(0);

  const IMG_PER_PAGE = 12; // 4 colunas × 3 linhas
  const VID_PER_PAGE = 6;  // 2 colunas × 3 linhas
  const selectedAccount = adAccounts.find((a) => a.id === adAccountId);
  const isPortfolioAccount = Boolean(selectedAccount?.business_id);
  const pageList = isPortfolioAccount ? pages : (promotePages.length ? promotePages : pages);
  const selectedPage = pageList.find((p) => p.id === pageId) || pages.find((p) => p.id === pageId);

  useEffect(() => {
    let cancelled = false;
    setLoadingAccounts(true);
    (async () => {
      try {
        const [accRes, pagRes] = await Promise.all([fetch("/api/meta/accounts"), fetch("/api/meta/pages")]);
        const accJson = await accRes.json();
        const pagJson = await pagRes.json();
        if (cancelled) return;
        if (accRes.ok && accJson.adAccounts?.length) setAdAccounts(accJson.adAccounts);
        if (pagRes.ok && pagJson.pages?.length) setPages(pagJson.pages);
        if (!accRes.ok && accJson.error) setError(accJson.error);
        else if (!pagRes.ok && pagJson.error) setError(pagJson.error);
      } catch { if (!cancelled) setError("Erro ao carregar contas e páginas."); }
      finally { if (!cancelled) setLoadingAccounts(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!adAccountId) { setPixels([]); setPromotePages([]); return; }
    let cancelled = false;
    setLoadingPromotePages(true);
    const selectedAccount = adAccounts.find((a) => a.id === adAccountId);
    const query = new URLSearchParams({ ad_account_id: adAccountId });
    if (selectedAccount?.business_id) query.set("business_id", selectedAccount.business_id);
    fetch(`/api/meta/promote-pages?${query.toString()}`)
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (cancelled) return;
        if (ok && json.pages) {
          setPromotePages(json.pages);
          setPageId((prev) => {
            if (!prev) return prev;
            if (json.pages.some((p: Page) => p.id === prev)) return prev;
            return "";
          });
          setError(null);
        } else { setPromotePages([]); if (!ok && json?.error) setError(json.error); }
      })
      .catch(() => { if (!cancelled) { setPromotePages([]); setError("Erro ao carregar Páginas desta conta."); } })
      .finally(() => { if (!cancelled) setLoadingPromotePages(false); });
    return () => { cancelled = true; };
  }, [adAccountId, adAccounts]);

  useEffect(() => {
    if (!adAccountId) {
      setIgAccounts([]);
      setInstagramAccountId("");
      setAdEligibleIgIds(new Set());
      setAdAccountIgListNonEmpty(false);
      return;
    }
    let cancelled = false;
    setLoadingIgAccounts(true);
    setAdAccountIgListNonEmpty(false);
    const params = new URLSearchParams({ ad_account_id: adAccountId });
    if (pageId) params.set("page_id", pageId);
    const acct = adAccounts.find((a) => a.id === adAccountId);
    if (acct?.business_id) params.set("business_id", acct.business_id);
    fetch(`/api/meta/instagram-accounts?${params.toString()}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setIgAccounts(json.accounts ?? []);
        setAdEligibleIgIds(new Set(json.ad_eligible_ids ?? []));
        setAdAccountIgListNonEmpty(Boolean(json.ad_account_ig_list_nonempty));
        setIgDebug(json._debug ? json._debug.join(" | ") : null);
      })
      .catch(() => {
        if (!cancelled) {
          setIgAccounts([]);
          setAdEligibleIgIds(new Set());
          setAdAccountIgListNonEmpty(false);
          setIgDebug(null);
        }
      })
      .finally(() => { if (!cancelled) setLoadingIgAccounts(false); });
    return () => { cancelled = true; };
  }, [adAccountId, pageId, adAccounts]);

  useEffect(() => {
    // Mantém seleção atual se ainda existir
    if (instagramAccountId && igAccounts.some((ig) => ig.id === instagramAccountId)) return;
    // Seleção automática apenas entre IDs retornados pelo endpoint de IG para anúncios.
    if (igAccounts.length > 0) {
      setInstagramAccountId(igAccounts[0].id);
      return;
    }
    setInstagramAccountId("");
  }, [igAccounts, instagramAccountId]);

  useEffect(() => {
    if (!adAccountId) { setPixels([]); return; }
    let cancelled = false;
    fetch(`/api/meta/pixels?ad_account_id=${encodeURIComponent(adAccountId)}`)
      .then((r) => r.json())
      .then((json) => { if (!cancelled && json.pixels) setPixels(json.pixels); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adAccountId]);

  useEffect(() => {
    if (step !== 4 || !adAccountId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/meta/adimages?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
      fetch(`/api/meta/advideos?ad_account_id=${encodeURIComponent(adAccountId)}`).then((r) => r.json()),
    ]).then(([imgJson, vidJson]) => {
      if (!cancelled && imgJson.images) setLibraryImages(imgJson.images);
      if (!cancelled && vidJson.videos) setLibraryVideos(vidJson.videos);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [step, adAccountId]);

  const canStep2 = adAccountId && pageId;
  const canStep3 = campaignId && campaignName;
  const isSalesCampaign = campaignObjective === "OUTCOME_SALES";
  const isLeadsCampaign = campaignObjective === "OUTCOME_LEADS";
  const allowedGoalsForObjective = getOptimizationGoalsForObjective(campaignObjective);
  const isCurrentGoalAllowed = allowedGoalsForObjective.some((o) => o.value === optimizationGoal);

  const adAccountPickerOptions = useMemo(
    () => adAccounts.map((a) => ({ value: a.id, label: a.name, description: a.id.replace(/^act_/, "") })),
    [adAccounts]
  );
  const pagePickerOptions = useMemo(
    () =>
      (adAccountId ? pageList : pages).map((p) => ({
        value: p.id,
        label: p.name,
        description: p.id,
      })),
    [adAccountId, pageList, pages]
  );
  const instagramPickerOptions = useMemo(
    () =>
      igAccounts.map((ig) => ({
        value: ig.id,
        label: `@${ig.username}`,
        description: ig.id,
      })),
    [igAccounts]
  );
  const pixelPickerOptions = useMemo(
    () => pixels.map((p) => ({ value: p.id, label: p.name || "Pixel", description: p.id })),
    [pixels]
  );
  const campaignObjectiveOptions = useMemo(
    () => META_CREATE_CAMPAIGN_OBJECTIVES.map((o) => ({ value: o.value, label: o.label })),
    []
  );
  const genderPickerOptions = useMemo(
    () => META_GENDER_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    []
  );
  const ctaPickerOptions = useMemo(
    () => META_CALL_TO_ACTIONS.map((c) => ({ value: c.value, label: c.label })),
    []
  );
  const salesConversionPickerOptions = useMemo(
    () => META_SALES_CONVERSION_EVENTS.map((o) => ({ value: o.value, label: o.label })),
    []
  );
  const pixelConversionPickerOptions = useMemo(() => {
    const src = isLeadsCampaign ? META_LEADS_CAMPAIGN_CONVERSION_PICKER_EVENTS : META_PIXEL_CONVERSION_EVENTS;
    return src.map((o) => ({ value: o.value, label: o.label }));
  }, [isLeadsCampaign]);
  const optimizationGoalPickerOptions = useMemo(
    () => allowedGoalsForObjective.map((o) => ({ value: o.value, label: o.label })),
    [allowedGoalsForObjective]
  );

  const displayOptimizationGoal = isCurrentGoalAllowed ? optimizationGoal : getDefaultGoalForObjective(campaignObjective);

  const handleOptimizationGoalPick = useCallback((v: string) => {
    setOptimizationGoal(v);
    if (!["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(v)) {
      setPixelId("");
      setConversionEvent("PURCHASE");
    } else {
      setConversionEvent((prev) => {
        if (campaignObjective === "OUTCOME_LEADS") {
          return isMetaLeadsWebsiteConversionEvent(prev) ? prev : "LEAD";
        }
        return "PURCHASE";
      });
    }
  }, [campaignObjective]);

  useEffect(() => {
    if (!canStep3) return;
    if (isSalesCampaign) {
      setOptimizationGoal("OFFSITE_CONVERSIONS");
      setConversionEvent((ev) => (ev === "ADD_TO_CART" ? "ADD_TO_CART" : "PURCHASE"));
      return;
    }
    const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (isLeadsCampaign && convGoals.includes(optimizationGoal)) {
      setConversionEvent((ev) => (isMetaLeadsWebsiteConversionEvent(ev) ? ev : "LEAD"));
      return;
    }
    if (!isCurrentGoalAllowed) {
      setOptimizationGoal(getDefaultGoalForObjective(campaignObjective));
      setPixelId("");
      setConversionEvent("PURCHASE");
    }
  }, [campaignObjective, canStep3, isSalesCampaign, isLeadsCampaign, isCurrentGoalAllowed, optimizationGoal]);

  const canStep4 = adsetId && adsetName;

  const createCampaign = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_account_id: adAccountId, name: campaignName, objective: campaignObjective }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar campanha");
      setCampaignId(json.campaign_id); setStep(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar campanha"); }
    finally { setLoading(false); }
  };

  const createAdSet = async () => {
    const budgetCents = Math.round(parseFloat(dailyBudget || "0") * 100);
    if (budgetCents < 100) { setError("Orçamento diário mínimo: R$ 6,00 (100 centavos)."); return; }
    if (!countryCodes.length) { setError("Selecione ao menos um país no público."); return; }
    const pubList = META_PUBLISHER_PLATFORMS.map((p) => p.value).filter((p) => publisherPlatforms[p]);
    if (pubList.length === 0) { setError("Selecione ao menos uma plataforma (Facebook, Instagram, etc.)."); return; }
    if (isSalesCampaign && (!pixelId.trim() || !["PURCHASE", "ADD_TO_CART"].includes(conversionEvent))) {
      setError("Campanha de vendas: escolha o Pixel e o evento Comprar ou Adicionar ao carrinho.");
      return;
    }
    const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (
      isLeadsCampaign &&
      convGoals.includes(optimizationGoal) &&
      (!pixelId.trim() || !isMetaLeadsWebsiteConversionEvent(conversionEvent))
    ) {
      setError("Campanha de leads com meta Conversões no site: escolha o Pixel e um evento adequado (ex.: Lead).");
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adAccountId, campaign_id: campaignId, name: adsetName,
          daily_budget: budgetCents,
          country_codes: countryCodes.length ? countryCodes : ["BR"],
          country_code: (countryCodes.length ? countryCodes : ["BR"])[0],
          age_min: parseInt(ageMin, 10) || 18, age_max: parseInt(ageMax, 10) || 65,
          gender,
          optimization_goal: isSalesCampaign ? "OFFSITE_CONVERSIONS" : optimizationGoal,
          pixel_id: pixelId.trim() || undefined,
          conversion_event: isSalesCampaign ? conversionEvent : (pixelId.trim() ? conversionEvent || undefined : undefined),
          publisher_platforms: pubList,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar conjunto");
      setAdsetId(json.adset_id); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar conjunto"); }
    finally { setLoading(false); }
  };

  const createAd = async () => {
    const hasImage = imageHash.trim() || imageUrl.trim();
    const hasVideo = mediaType === "video" && videoId.trim();
    if (useInstagramIdentity && !instagramAccountId.trim()) {
      setError("Selecione uma conta do Instagram antes de criar o anúncio.");
      return;
    }
    if (!adMessage.trim()) { setError("Preencha o texto do anúncio."); return; }
    if (mediaType === "image" && !hasImage) { setError("Escolha uma imagem da biblioteca, envie uma nova ou use a URL."); return; }
    if (mediaType === "video") {
      if (!hasVideo) { setError("Escolha um vídeo da biblioteca ou envie um novo."); return; }
      if (!hasImage) { setError("O Meta exige uma imagem de capa para anúncios com vídeo."); return; }
    }
    setLoading(true); setError(null);
    try {
      const body: Record<string, string | undefined> = {
        ad_account_id: adAccountId, adset_id: adsetId, name: adName || "Anúncio",
        page_id: pageId, link: adLink.trim(), message: adMessage.trim(),
        title: adTitle.trim() || undefined, call_to_action: callToAction,
        instagram_actor_id: useInstagramIdentity ? (instagramAccountId || undefined) : undefined,
      };
      if (mediaType === "video") {
        body.video_id = videoId.trim();
        if (imageHash.trim()) body.image_hash = imageHash.trim();
        else body.image_url = imageUrl.trim();
      } else {
        if (imageHash.trim()) body.image_hash = imageHash.trim();
        else body.image_url = imageUrl.trim();
      }
      const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
      const trackingPix =
        trafficTrackingPixelId.trim() ||
        (!isSalesCampaign && convGoals.includes(optimizationGoal) && pixelId.trim() ? pixelId.trim() : "");
      if (trackingPix) body.tracking_pixel_id = trackingPix;
      const res = await fetch("/api/meta/ads", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await res.json() as {
        error?: string;
        meta_error?: { message?: string; error_user_msg?: string; error_subcode?: number };
        ad_id?: string;
      };
      if (!res.ok) {
        let errMsg = json?.error ?? "Erro ao criar anúncio";
        const meta = json?.meta_error;
        if (meta?.error_user_msg) errMsg += ` — ${meta.error_user_msg}`;
        else if (meta?.message && !errMsg.includes(meta.message)) errMsg += ` — ${meta.message}`;
        throw new Error(errMsg);
      }
      setCreatedAdId(json.ad_id ?? ""); setStep(4);
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar anúncio"); }
    finally { setLoading(false); }
  };

  const handleReset = () => { setStep(1); setCampaignId(""); setAdsetId(""); setCreatedAdId(""); setError(null); };

  // Upload helpers
  const uploadImage = async (file: File) => {
    if (!adAccountId) return;
    setUploadingImage(true); setError(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("ad_account_id", adAccountId);
      const res = await fetch("/api/meta/adimages", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
      setImageHash(json.hash); setImageUrl("");
      setLibraryImages((prev) => [{ hash: json.hash, url: null, id: null }, ...prev]);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao enviar imagem"); }
    finally { setUploadingImage(false); }
  };

  const uploadVideo = async (file: File) => {
    if (!adAccountId) return;
    setUploadingVideo(true); setError(null);
    try {
      const form = new FormData(); form.set("file", file); form.set("ad_account_id", adAccountId);
      const res = await fetch("/api/meta/advideos", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar");
      setVideoId(json.video_id);
      setLibraryVideos((prev) => [{ id: json.video_id, title: json.video_id, source: null, length: null, picture: null }, ...prev]);
    } catch (err) { setError(err instanceof Error ? err.message : "Erro ao enviar vídeo"); }
    finally { setUploadingVideo(false); }
  };

  return (
    <>
      {loading && <LoadingOverlay message="Criando no Meta..." />}

      {/* ── Header ── */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 flex items-center justify-center shrink-0">
            <Megaphone className="h-5 w-5 text-shopee-orange" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-text-primary leading-tight">Criar Campanha Meta</h1>
            <p className="text-[11px] text-text-secondary/70 mt-px">Tudo criado em modo <strong className="text-text-secondary">Pausado</strong> — ative no Gerenciador quando quiser.</p>
          </div>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-5 p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button type="button" onClick={() => router.push("/configuracoes")} className="text-xs text-shopee-orange hover:underline font-semibold">
                Configurações →
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoadingTokenDebug(true); setTokenDebug(null);
                  try {
                    const res = await fetch("/api/meta/debug-token");
                    const json = await res.json();
                    if (res.ok && json.scopes) setTokenDebug({ scopes: json.scopes, has_pages_manage_ads: !!json.has_pages_manage_ads, is_valid: !!json.is_valid });
                    else setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false });
                  } catch { setTokenDebug({ scopes: [], has_pages_manage_ads: false, is_valid: false }); }
                  finally { setLoadingTokenDebug(false); }
                }}
                disabled={loadingTokenDebug}
                className="text-xs text-text-secondary hover:text-text-primary disabled:opacity-50 underline"
              >
                {loadingTokenDebug ? "Carregando…" : "Ver permissões do token"}
              </button>
            </div>
            {tokenDebug && (
              <div className="mt-2 p-2.5 rounded-xl bg-dark-bg/80 text-xs text-text-secondary border border-dark-border space-y-1">
                <p className="font-semibold text-text-primary">
                  Token válido: <span className={tokenDebug.is_valid ? "text-emerald-400" : "text-red-400"}>{tokenDebug.is_valid ? "Sim" : "Não"}</span>
                  {" · "}pages_manage_ads: <span className={tokenDebug.has_pages_manage_ads ? "text-emerald-400" : "text-red-400"}>{tokenDebug.has_pages_manage_ads ? "Sim" : "Não"}</span>
                </p>
                <p>Permissões: {tokenDebug.scopes.length ? tokenDebug.scopes.join(", ") : "nenhuma"}</p>
                {!tokenDebug.has_pages_manage_ads && (
                  <p className="text-amber-400">Gere um novo token no Graph API Explorer com a permissão <strong>pages_manage_ads</strong> e cole em Configurações.</p>
                )}
              </div>
            )}
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400/50 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {/* ── Stepper ── */}
      <div className="mb-7">
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
                  <span className={`hidden sm:block text-xs font-medium whitespace-nowrap ${current ? "text-text-primary" : done ? "text-emerald-400" : "text-text-secondary"}`}>
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
      </div>

      {/* ── Step 1: Conta e Página ── */}
      {step === 1 && (
        <div className="flex justify-center">
        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 w-full max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Conta de anúncios & Página</h2>
          </div>

          {loadingAccounts ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12">
              <div className="relative flex items-center justify-center">
                <span className="absolute inline-flex h-16 w-16 rounded-full bg-shopee-orange/10 animate-ping" />
                <span className="absolute inline-flex h-12 w-12 rounded-full bg-shopee-orange/15 animate-pulse" />
                <Loader2 className="h-10 w-10 animate-spin text-shopee-orange relative z-10" />
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm font-semibold text-text-primary">Conectando ao Meta Ads</span>
                <span className="text-xs text-text-secondary/50">Buscando contas e páginas…</span>
              </div>
            </div>
          ) : adAccounts.length === 0 ? (
            <div className="py-6 flex flex-col items-center gap-3 text-center border border-dashed border-dark-border rounded-xl">
              <Settings className="h-8 w-8 text-text-secondary/30" />
              <p className="text-xs text-text-secondary/60">Configure o token do Meta em Configurações para listar contas.</p>
              <button type="button" onClick={() => router.push("/configuracoes")}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-shopee-orange text-white text-xs font-semibold hover:opacity-90">
                <Settings className="h-3.5 w-3.5" /> Configurações
              </button>
            </div>
          ) : (
            <>
              <div>
                <FieldLabel hint="A conta onde a campanha será criada. Precisa da permissão pages_manage_ads.">Conta de anúncios</FieldLabel>
                <MetaSearchablePicker
                  value={adAccountId}
                  onChange={setAdAccountId}
                  options={adAccountPickerOptions}
                  modalTitle="Conta de anúncios"
                  modalDescription="Busque pelo nome da conta. É preciso ter pages_manage_ads no token."
                  searchPlaceholder="Filtrar contas…"
                  emptyButtonLabel="Buscar e selecionar conta"
                />
              </div>
              <div>
                <FieldLabel hint="Página do Facebook que aparecerá como autor do anúncio.">Página do Facebook</FieldLabel>
                {loadingPromotePages && adAccountId && !isPortfolioAccount ? (
                  <div className="flex items-center gap-2 text-xs text-text-secondary py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando páginas…
                  </div>
                ) : (
                  <>
                    <MetaSearchablePicker
                      value={pageId}
                      onChange={setPageId}
                      options={pagePickerOptions}
                      modalTitle="Página do Facebook"
                      modalDescription="Página que aparecerá como autor do anúncio."
                      searchPlaceholder="Filtrar páginas…"
                      emptyButtonLabel="Buscar e selecionar página"
                      disabled={Boolean(adAccountId && !isPortfolioAccount && promotePages.length === 0)}
                      emptyOptionsMessage="Nenhuma página disponível para esta conta."
                    />
                    {adAccountId && !isPortfolioAccount && !loadingPromotePages && promotePages.length === 0 && (
                      <p className="text-xs text-amber-400 mt-1.5">Nenhuma Página disponível. Vincule uma Página ao negócio no Facebook.</p>
                    )}
                  </>
                )}
              </div>
              <div>
                <FieldLabel hint="Selecione Conta de anúncios e Página do Facebook para ver contas do Instagram disponíveis. Caso você não selecione uma conta do Instagram, o Meta fará isso por você; esse campo não é obrigatório.">
                  Perfil do Instagram
                </FieldLabel>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useInstagramIdentity}
                    title={useInstagramIdentity ? "Desativar identidade do Instagram no anúncio" : "Ativar identidade do Instagram no anúncio"}
                    onClick={() => setUseInstagramIdentity((v) => !v)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-shopee-orange/50 ${
                      useInstagramIdentity ? "bg-shopee-orange border-transparent" : "bg-dark-border border-gray-600"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition ${
                        useInstagramIdentity ? "translate-x-4" : "translate-x-0.5"
                      }`}
                    />
                  </button>
                  <span className="text-xs text-text-secondary">Usar Conta Instagram</span>
                </div>
                {!useInstagramIdentity ? null : !adAccountId || !pageId ? (
                  <div className="py-1">
                    <Loader2 className="h-4 w-4 animate-spin text-text-secondary/60" />
                  </div>
                ) : loadingIgAccounts ? (
                  <div className="w-full rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-sm text-text-secondary/70">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-shopee-orange" />
                      <span>Carregando perfis do Instagram...</span>
                    </div>
                  </div>
                ) : instagramPickerOptions.length > 0 ? (
                  <MetaSearchablePicker
                    value={instagramAccountId}
                    onChange={(v) => {
                      setInstagramAccountId(v);
                      setIgManualMode(false);
                    }}
                    options={instagramPickerOptions}
                    modalTitle="Perfil do Instagram"
                    modalDescription="Selecione o perfil para anunciar no posicionamento Instagram."
                    searchPlaceholder="Filtrar perfis…"
                    emptyButtonLabel="Selecionar perfil do Instagram"
                  />
                ) : (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                    <p className="text-xs text-amber-300">
                      Nenhum perfil do Instagram encontrado automaticamente para esta conta/página.
                    </p>
                    {!igManualMode ? (
                      <button
                        type="button"
                        onClick={() => setIgManualMode(true)}
                        className="text-xs text-shopee-orange hover:underline font-semibold"
                      >
                        Inserir ID do Instagram manualmente
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={instagramAccountId}
                          onChange={(e) => setInstagramAccountId(e.target.value.trim())}
                          placeholder="Ex: 17841400000000000"
                          className={inputCls}
                        />
                        <p className="text-[11px] text-text-secondary/70">
                          Use se você já sabe o IG User ID e o token tem as permissões de Instagram.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                {useInstagramIdentity && instagramAccountId && adAccountIgListNonEmpty && !adEligibleIgIds.has(instagramAccountId) && !loadingIgAccounts && (
                  <div className="flex items-start gap-2 mt-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-300 leading-relaxed">
                      O Meta listou outras contas de Instagram para esta conta de anúncios, mas <strong>não esta</strong>.
                      Verifique se você selecionou a mesma conta de anúncios do Business Manager (ex.: HGARDEN1) e se a Página do anúncio é a vinculada a esse Instagram.
                    </p>
                  </div>
                )}
              </div>

            </>
          )}

          <button type="button" onClick={() => setStep(2)} disabled={!canStep2}
            className="inline-flex items-center gap-2 rounded-xl bg-shopee-orange px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
            Próximo <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        </div>
      )}

      {/* ── Step 2: Campanha ── */}
      {step === 2 && (
        <div className="flex justify-center">
        <div className="bg-dark-card rounded-2xl border border-dark-border p-6 w-full max-w-xl space-y-5">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-shopee-orange" />
            <h2 className="text-sm font-bold text-text-primary">Nova campanha</h2>
          </div>
          <div>
            <FieldLabel hint="Determina como o Meta otimiza a entrega dos seus anúncios.">Objetivo da campanha</FieldLabel>
            <MetaSearchablePicker
              value={campaignObjective}
              onChange={setCampaignObjective}
              options={campaignObjectiveOptions}
              modalTitle="Objetivo da campanha"
              searchPlaceholder="Filtrar objetivos…"
              emptyButtonLabel="Escolher objetivo"
            />
          </div>
          <div>
            <FieldLabel>Nome da campanha</FieldLabel>
            <input type="text" value={campaignName} onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ex: Black Friday — Afiliado Shopee" className={inputCls} />
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <button type="button" onClick={createCampaign} disabled={!campaignName.trim() || loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Criar campanha e continuar
            </button>
          </div>
        </div>
        </div>
      )}

      {/* ── Step 3: Conjunto ── */}
      {step === 3 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl mx-auto" style={{ alignItems: "stretch" }}>

          {/* ── Coluna esquerda: nome, orçamento, otimização ── */}
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 pb-1 border-b border-dark-border/50 shrink-0">
              <Target className="h-4 w-4 text-shopee-orange" />
              <h2 className="text-sm font-bold text-text-primary">Conjunto de anúncios</h2>
            </div>

            <div className="shrink-0">
              <FieldLabel>Nome do conjunto</FieldLabel>
              <input type="text" value={adsetName} onChange={(e) => setAdsetName(e.target.value)}
                placeholder="Ex: Conjunto BR 18-45" className={inputCls} />
            </div>

            <div className="shrink-0">
              <FieldLabel hint="Mínimo R$ 6,00. Quanto mais alto, maior o alcance diário.">Orçamento diário (R$)</FieldLabel>
              <input type="number" min="1" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} className={inputCls} />
            </div>

            {/* Otimização */}
            {isSalesCampaign ? (
              <div className="flex-1 rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-4">
                <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
                  <Target className="h-3.5 w-3.5 text-shopee-orange/80" />
                  <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Otimização (vendas no site)</h3>
                </div>
                <p className="text-xs text-text-secondary/80">
                  O Meta otimiza para conversões no site. Escolha o pixel e se quer priorizar <strong>compras</strong> ou <strong>adicionar ao carrinho</strong>.
                </p>
                <div>
                  <FieldLabel hint="Obrigatório para campanhas de vendas.">Pixel</FieldLabel>
                  <MetaSearchablePicker
                    value={pixelId}
                    onChange={setPixelId}
                    options={pixelPickerOptions}
                    modalTitle="Pixel"
                    modalDescription="Conjunto de dados (pixel) para otimizar vendas no site."
                    searchPlaceholder="Filtrar por nome ou ID…"
                    emptyButtonLabel="Buscar e selecionar pixel"
                    emptyOptionsMessage="Nenhum pixel nesta conta."
                  />
                </div>
                <div>
                  <FieldLabel>Evento para otimizar</FieldLabel>
                  <MetaSearchablePicker
                    value={conversionEvent}
                    onChange={setConversionEvent}
                    options={salesConversionPickerOptions}
                    modalTitle="Evento para otimizar"
                    searchPlaceholder="Filtrar eventos…"
                    emptyButtonLabel="Escolher evento"
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1 space-y-4">
                <div>
                  <FieldLabel hint="Metas permitidas para o objetivo da campanha (tráfego, leads ou vendas).">
                    Meta de desempenho
                  </FieldLabel>
                  <MetaSearchablePicker
                    value={displayOptimizationGoal}
                    onChange={handleOptimizationGoalPick}
                    options={optimizationGoalPickerOptions}
                    modalTitle="Meta de desempenho"
                    modalDescription="Como o Meta otimiza a entrega neste conjunto."
                    searchPlaceholder="Filtrar metas…"
                    emptyButtonLabel="Escolher meta de desempenho"
                  />
                </div>
                {!["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(optimizationGoal) && (
                  <div className="rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 border-l-2 border-emerald-500/50 pl-2">
                      <Link2 className="h-3.5 w-3.5 text-emerald-400/90" />
                      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Rastreamento — eventos do site</h3>
                    </div>
                    
                    <div>
                      <FieldLabel hint="Opcional. Deixe em branco se não quiser rastrear com pixel neste fluxo.">Pixel</FieldLabel>
                      <MetaSearchablePicker
                        value={trafficTrackingPixelId}
                        onChange={setTrafficTrackingPixelId}
                        options={pixelPickerOptions}
                        modalTitle="Pixel — rastreamento no anúncio"
                        modalDescription="Opcional. Eventos do site via tracking_specs, sem mudar a meta do conjunto."
                        searchPlaceholder="Filtrar pixels…"
                        emptyButtonLabel="Escolher pixel (opcional)"
                        emptyAsTag
                        emptyTagLabel="Nenhum"
                        allowClear
                        clearLabel="Sem pixel de rastreamento"
                        emptyOptionsMessage="Nenhum pixel nesta conta."
                      />
                    </div>
                  </div>
                )}
                {["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"].includes(optimizationGoal) && (
                  <div className="rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-4">
                    <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
                      <Target className="h-3.5 w-3.5 text-shopee-orange/80" />
                      <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Pixel & conversão</h3>
                    </div>
                    <div>
                      <FieldLabel
                        hint={
                          isLeadsCampaign
                            ? "Obrigatório para leads com esta meta (conversões no site). Opcional em tráfego puro."
                            : "Opcional para tráfego com meta de conversão."
                        }
                      >
                        Conjunto de dados (Pixel)
                      </FieldLabel>
                      <MetaSearchablePicker
                        value={pixelId}
                        onChange={setPixelId}
                        options={pixelPickerOptions}
                        modalTitle="Conjunto de dados (Pixel)"
                        searchPlaceholder="Filtrar pixels…"
                        emptyButtonLabel="Buscar e selecionar pixel"
                        emptyAsTag
                        emptyTagLabel="Nenhum"
                        allowClear
                        clearLabel="Nenhum"
                        emptyOptionsMessage="Nenhum pixel nesta conta."
                      />
                    </div>
                    {pixelId ? (
                      <div>
                        <FieldLabel hint={isLeadsCampaign ? "Ex.: Lead, Cadastro completo — alinhado ao evento disparado no seu site." : undefined}>
                          Evento de conversão
                        </FieldLabel>
                        <MetaSearchablePicker
                          value={conversionEvent}
                          onChange={setConversionEvent}
                          options={pixelConversionPickerOptions}
                          modalTitle="Evento de conversão"
                          searchPlaceholder="Filtrar eventos…"
                          emptyButtonLabel="Escolher evento"
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-auto shrink-0">
              <button type="button" onClick={() => setStep(2)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <button type="button" onClick={createAdSet} disabled={!adsetName.trim() || loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Criar conjunto e continuar
              </button>
            </div>
          </div>

          {/* ── Coluna direita: plataformas + público ── */}
          <div className="bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-5">
            <div className="flex items-center gap-2 pb-1 border-b border-dark-border/50 shrink-0">
              <Zap className="h-4 w-4 text-shopee-orange" />
              <h2 className="text-sm font-bold text-text-primary">Distribuição & Público</h2>
            </div>

            {/* Plataformas */}
            <div className="rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-3 shrink-0">
              <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
                <Zap className="h-3.5 w-3.5 text-shopee-orange/80" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Plataformas</h3>
              </div>
              <p className="text-[11px] text-text-secondary/60">Onde o anúncio pode aparecer (publisher_platforms).</p>
              <div className="grid grid-cols-2 gap-2">
                {META_PUBLISHER_PLATFORMS.map((p) => (
                  <label key={p.value}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 cursor-pointer text-sm font-medium transition-all ${
                      publisherPlatforms[p.value]
                        ? "border-shopee-orange/50 bg-shopee-orange/8 text-text-primary"
                        : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30"
                    }`}>
                    <input
                      type="checkbox"
                      checked={Boolean(publisherPlatforms[p.value])}
                      onChange={() => setPublisherPlatforms((prev) => ({ ...prev, [p.value]: !prev[p.value] }))}
                      className="rounded border-dark-border accent-shopee-orange"
                    />
                    {p.label}
                  </label>
                ))}
              </div>
              <button type="button"
                onClick={() => setPublisherPlatforms(Object.fromEntries(META_PUBLISHER_PLATFORMS.map((x) => [x.value, true])))}
                className="text-xs text-shopee-orange hover:underline">
                Marcar todas
              </button>
            </div>

            {/* Público */}
            <div className="flex-1 rounded-xl border border-dark-border/60 bg-dark-bg/40 p-4 space-y-4">
              <div className="flex items-center gap-2 border-l-2 border-shopee-orange/60 pl-2">
                <Target className="h-3.5 w-3.5 text-shopee-orange/80" />
                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wide">Público-alvo</h3>
              </div>

              <div>
                <FieldLabel hint="Vários países no mesmo conjunto, como no Gerenciador de Anúncios. Pesquise no modal e confirme; os países aparecem como tags laranja.">
                  Países (público)
                </FieldLabel>
               
                <MetaCountryPicker value={countryCodes} onChange={setCountryCodes} max={25} />
              </div>

              <div>
                <FieldLabel>Gênero</FieldLabel>
                <MetaSearchablePicker
                  value={gender}
                  onChange={(v) => setGender(v as "all" | "male" | "female")}
                  options={genderPickerOptions}
                  modalTitle="Gênero do público"
                  searchPlaceholder="Filtrar…"
                  emptyButtonLabel="Escolher gênero"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <FieldLabel>Idade mín.</FieldLabel>
                  <input type="number" min="18" max="65" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <FieldLabel>Idade máx.</FieldLabel>
                  <input type="number" min="18" max="65" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Anúncio ── */}
      {step === 4 && (() => {
        const imgTotalPages = Math.max(1, Math.ceil(libraryImages.length / IMG_PER_PAGE));
        const vidTotalPages = Math.max(1, Math.ceil(libraryVideos.length / VID_PER_PAGE));
        const pagedImages = libraryImages.slice(imgPage * IMG_PER_PAGE, (imgPage + 1) * IMG_PER_PAGE);
        const pagedVideos = libraryVideos.slice(vidPage * VID_PER_PAGE, (vidPage + 1) * VID_PER_PAGE);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-5xl mx-auto" style={{ alignItems: "stretch" }}>

            {/* ── Coluna esquerda: formulário ── */}
            <div className="bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 pb-1 border-b border-dark-border/50 shrink-0">
                <ImageIcon className="h-4 w-4 text-shopee-orange" />
                <h2 className="text-sm font-bold text-text-primary">Anúncio — detalhes</h2>
              </div>

              {/* Identidade resumida */}
              <div className="flex items-center gap-3 rounded-xl bg-dark-bg/60 border border-dark-border/50 px-3 py-2.5 shrink-0">
                <Building2 className="h-4 w-4 text-shopee-orange/70 shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-primary truncate">
                    {pages.find((p) => p.id === pageId)?.name || pageList.find((p) => p.id === pageId)?.name || "—"}
                  </p>
                  {instagramAccountId && (
                    <p className="text-[11px] text-text-secondary truncate">
                      Instagram: {
                        igAccounts.find((ig) => ig.id === instagramAccountId)?.username
                          ? `@${igAccounts.find((ig) => ig.id === instagramAccountId)?.username}`
                          : instagramAccountId
                      }
                    </p>
                  )}
                </div>
              </div>

              <div className="shrink-0">
                <FieldLabel>Nome do anúncio</FieldLabel>
                <input type="text" value={adName} onChange={(e) => setAdName(e.target.value)}
                  placeholder="Ex: Anúncio 1 — Shopee Verão" className={inputCls} />
              </div>

              <div className="shrink-0">
                <FieldLabel hint="Opcional — pode gerar depois no ATI com o ad_id. Use a lupa para escolher um link já gerado no Gerador Shopee (com sub-IDs).">
                  <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> Link de destino</span>
                </FieldLabel>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={adLink}
                    onChange={(e) => setAdLink(e.target.value)}
                    placeholder="Deixe em branco ou cole o link da Shopee"
                    className={`${inputCls} flex-1 min-w-0`}
                  />
                  <ShopeeLinkHistoryPickButton onPick={setAdLink} />
                </div>
              </div>

              <div className="flex-1">
                <FieldLabel>Texto do anúncio *</FieldLabel>
                <textarea value={adMessage} onChange={(e) => setAdMessage(e.target.value)}
                  placeholder="Descrição ou chamada para ação…"
                  className={`${inputCls} resize-none w-full h-full min-h-[100px]`} />
              </div>

              <div className="shrink-0 rounded-xl border border-dark-border/60 bg-dark-bg/40 p-3 space-y-3">
                <div className="flex items-center gap-1.5 border-l-2 border-shopee-orange/50 pl-2">
                  <Link2 className="h-3 w-3 text-shopee-orange/70" />
                  <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Link do anúncio</span>
                </div>
                <div>
                  <FieldLabel>Título (opcional)</FieldLabel>
                  <input type="text" value={adTitle} onChange={(e) => setAdTitle(e.target.value)}
                    placeholder="Ex: Oferta exclusiva Shopee" className={inputCls} />
                </div>
                <div>
                  <FieldLabel hint="Botão de ação exibido no anúncio.">Chamada para ação</FieldLabel>
                  <MetaSearchablePicker
                    value={callToAction}
                    onChange={setCallToAction}
                    options={ctaPickerOptions}
                    modalTitle="Chamada para ação"
                    modalDescription="Texto do botão no anúncio com link."
                    searchPlaceholder="Filtrar CTAs…"
                    emptyButtonLabel="Escolher chamada para ação"
                  />
                </div>
              </div>

              <div className="flex gap-2 shrink-0 mt-auto">
                <button type="button" onClick={() => setStep(3)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dark-border px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">
                  <ChevronLeft className="h-4 w-4" /> Voltar
                </button>
                <button type="button" onClick={createAd}
                  disabled={!adMessage.trim() || loading ||
                    (mediaType === "image" && !imageHash.trim() && !imageUrl.trim()) ||
                    (mediaType === "video" && (!videoId.trim() || (!imageHash.trim() && !imageUrl.trim())))}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-shopee-orange px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 transition-all shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Criar anúncio
                </button>
              </div>
            </div>

            {/* ── Coluna direita: biblioteca de mídia ── */}
            <div className="bg-dark-card rounded-2xl border border-dark-border p-6 flex flex-col gap-3">

              {/* Header + tabs */}
              <div className="flex items-center justify-between pb-2 border-b border-dark-border/50 shrink-0">
                <div className="flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-shopee-orange" />
                  <h2 className="text-sm font-bold text-text-primary">Biblioteca de Mídia</h2>
                </div>
                <div className="flex rounded-xl overflow-hidden border border-dark-border text-xs font-semibold">
                  {([
                    { type: "image" as const, label: "Imagem", Icon: ImageIcon },
                    { type: "video" as const, label: "Vídeo", Icon: Video },
                  ]).map(({ type, label, Icon }) => (
                    <button key={type} type="button"
                      onClick={() => { setMediaType(type); setVideoId(""); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                        mediaType === type ? "bg-shopee-orange text-white" : "bg-dark-bg text-text-secondary hover:text-text-primary"
                      }`}>
                      <Icon className="h-3.5 w-3.5" /> {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Banner de seleção */}
              <div className="shrink-0 h-9">
                {mediaType === "image" && (imageHash || imageUrl) ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 h-full">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400 font-medium flex-1">
                      {imageUrl ? "URL de imagem definida" : "Imagem da biblioteca selecionada"}
                    </p>
                    <button type="button" onClick={() => { setImageHash(""); setImageUrl(""); }}
                      className="text-text-secondary/50 hover:text-red-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : mediaType === "video" && videoId ? (
                  <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 h-full">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <p className="text-xs text-emerald-400 font-medium flex-1">Vídeo selecionado</p>
                    <button type="button" onClick={() => setVideoId("")}
                      className="text-text-secondary/50 hover:text-red-400 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : <div className="h-full" />}
              </div>

              {/* Upload */}
              <div className="shrink-0">
                {mediaType === "image" ? (
                  <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-all ${uploadingImage ? "border-shopee-orange/40 bg-shopee-orange/5 cursor-not-allowed" : "border-dark-border hover:border-shopee-orange/50 hover:bg-shopee-orange/5"}`}>
                    {uploadingImage ? <Loader2 className="h-4 w-4 text-shopee-orange animate-spin" /> : <Upload className="h-4 w-4 text-text-secondary/50" />}
                    <span className="text-xs text-text-secondary font-medium">
                      {uploadingImage ? "Enviando imagem…" : "Clique ou arraste para enviar nova imagem"}
                    </span>
                    <input type="file" accept="image/*" className="sr-only" disabled={uploadingImage || !adAccountId}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadImage(f); e.target.value = ""; } }} />
                  </label>
                ) : (
                  <label className={`flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-3 cursor-pointer transition-all ${uploadingVideo ? "border-shopee-orange/40 bg-shopee-orange/5 cursor-not-allowed" : "border-dark-border hover:border-shopee-orange/50 hover:bg-shopee-orange/5"}`}>
                    {uploadingVideo ? <Loader2 className="h-4 w-4 text-shopee-orange animate-spin" /> : <Upload className="h-4 w-4 text-text-secondary/50" />}
                    <span className="text-xs text-text-secondary font-medium">
                      {uploadingVideo ? "Enviando vídeo…" : "Clique ou arraste para enviar novo vídeo"}
                    </span>
                    <input type="file" accept="video/*" className="sr-only" disabled={uploadingVideo || !adAccountId}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadVideo(f); e.target.value = ""; } }} />
                  </label>
                )}
              </div>

              {/* Label contagem */}
              <div className="flex items-center justify-between shrink-0">
                <p className="text-[11px] text-text-secondary/60 font-medium uppercase tracking-wide">
                  {mediaType === "image" ? `Imagens (${libraryImages.length})` : `Vídeos (${libraryVideos.length})`}
                </p>
                {mediaType === "image" && imgTotalPages > 1 && (
                  <p className="text-[11px] text-text-secondary/50">Pág. {imgPage + 1}/{imgTotalPages}</p>
                )}
                {mediaType === "video" && vidTotalPages > 1 && (
                  <p className="text-[11px] text-text-secondary/50">Pág. {vidPage + 1}/{vidTotalPages}</p>
                )}
              </div>

              {/* Grade fixa — flex-1 para ocupar espaço disponível */}
              <div className="flex-1 min-h-0">
                {mediaType === "image" ? (
                  libraryImages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 h-full text-center">
                      <ImageIcon className="h-10 w-10 text-text-secondary/20" />
                      <p className="text-xs text-text-secondary/50">Nenhuma imagem na conta.<br />Envie a primeira acima.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 content-start h-full">
                      {pagedImages.map((img) => {
                        const selected = imageHash === img.hash;
                        return (
                          <button key={img.hash} type="button"
                            onClick={() => { setImageHash(img.hash); setImageUrl(""); }}
                            className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] focus:outline-none ${selected ? "border-shopee-orange shadow-[0_0_0_2px_rgba(238,77,45,0.3)]" : "border-transparent hover:border-shopee-orange/40"}`}
                          >
                            {img.url ? (
                              <img src={img.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-dark-bg to-dark-border flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-text-secondary/30" />
                              </div>
                            )}
                            {selected && (
                              <div className="absolute inset-0 bg-shopee-orange/20 flex items-center justify-center">
                                <div className="w-5 h-5 rounded-full bg-shopee-orange flex items-center justify-center shadow-lg">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                ) : (
                  libraryVideos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 h-full text-center">
                      <Video className="h-10 w-10 text-text-secondary/20" />
                      <p className="text-xs text-text-secondary/50">Nenhum vídeo na conta.<br />Envie o primeiro acima.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 content-start h-full">
                      {pagedVideos.map((v) => {
                        const selected = videoId === v.id;
                        return (
                          <button key={v.id} type="button"
                            onClick={() => setVideoId(v.id)}
                            className={`relative aspect-video rounded-xl overflow-hidden border-2 transition-all hover:scale-[1.02] focus:outline-none group ${selected ? "border-shopee-orange shadow-[0_0_0_2px_rgba(238,77,45,0.3)]" : "border-transparent hover:border-shopee-orange/40"}`}
                          >
                            {v.picture ? (
                              <img src={v.picture} alt={v.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-dark-bg to-dark-border" />
                            )}
                            <div className={`absolute inset-0 flex items-center justify-center transition-all ${selected ? "bg-shopee-orange/25" : "bg-black/30 group-hover:bg-black/50"}`}>
                              {selected ? (
                                <div className="w-7 h-7 rounded-full bg-shopee-orange flex items-center justify-center shadow-lg">
                                  <Check className="h-4 w-4 text-white" />
                                </div>
                              ) : (
                                <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                                  <Play className="h-4 w-4 text-white ml-0.5" />
                                </div>
                              )}
                            </div>
                            {v.length != null && (
                              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">
                                {Math.floor(v.length / 60)}:{String(Math.round(v.length % 60)).padStart(2, "0")}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )
                )}
              </div>

              {/* Paginação */}
              <div className="shrink-0 flex items-center justify-between gap-2">
                {mediaType === "image" ? (
                  <>
                    <button type="button" disabled={imgPage === 0}
                      onClick={() => setImgPage((p) => Math.max(0, p - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dark-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: imgTotalPages }).map((_, i) => (
                        <button key={i} type="button" onClick={() => setImgPage(i)}
                          className={`w-6 h-6 rounded-lg text-[11px] font-bold transition-colors ${imgPage === i ? "bg-shopee-orange text-white" : "bg-dark-bg border border-dark-border text-text-secondary hover:border-shopee-orange/40"}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button type="button" disabled={imgPage >= imgTotalPages - 1}
                      onClick={() => setImgPage((p) => Math.min(imgTotalPages - 1, p + 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dark-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      Próxima <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" disabled={vidPage === 0}
                      onClick={() => setVidPage((p) => Math.max(0, p - 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dark-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                    </button>
                    <div className="flex gap-1">
                      {Array.from({ length: vidTotalPages }).map((_, i) => (
                        <button key={i} type="button" onClick={() => setVidPage(i)}
                          className={`w-6 h-6 rounded-lg text-[11px] font-bold transition-colors ${vidPage === i ? "bg-shopee-orange text-white" : "bg-dark-bg border border-dark-border text-text-secondary hover:border-shopee-orange/40"}`}>
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <button type="button" disabled={vidPage >= vidTotalPages - 1}
                      onClick={() => setVidPage((p) => Math.min(vidTotalPages - 1, p + 1))}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-dark-border text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                      Próxima <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* URL fallback (imagens) */}
              {mediaType === "image" && (
                <div className="shrink-0 pt-2 border-t border-dark-border/50 space-y-1.5">
                  <p className="text-[11px] text-text-secondary/50">Ou cole URL pública</p>
                  <div className="flex gap-2">
                    <input type="url" value={imageUrl}
                      onChange={(e) => { setImageUrl(e.target.value); if (e.target.value) setImageHash(""); }}
                      placeholder="https://..." className={`${inputCls} text-xs`} />
                    {imageUrl && (
                      <button type="button" onClick={() => setImageUrl("")}
                        className="shrink-0 rounded-xl border border-dark-border px-2 text-text-secondary hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Capa do vídeo */}
              {mediaType === "video" && videoId && (
                <div className="shrink-0 pt-2 border-t border-dark-border/50 space-y-2">
                  <p className="text-[11px] text-text-secondary/60 font-medium uppercase tracking-wide">
                    Imagem de capa * <span className="normal-case text-text-secondary/40">(obrigatória)</span>
                  </p>
                  {(imageHash || imageUrl) ? (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <p className="text-xs text-emerald-400 font-medium flex-1">Capa selecionada</p>
                      <button type="button" onClick={() => { setImageHash(""); setImageUrl(""); }}
                        className="text-text-secondary/50 hover:text-red-400 transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-400/80">Mude para aba Imagem e selecione a capa, ou envie:</p>
                  )}
                  <label className={`inline-flex items-center gap-1.5 rounded-xl border border-dark-border bg-dark-bg px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-shopee-orange/40 cursor-pointer transition-all ${uploadingImage ? "opacity-50 cursor-not-allowed" : ""}`}>
                    {uploadingImage ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploadingImage ? "Enviando…" : "Enviar capa"}
                    <input type="file" accept="image/*" className="sr-only" disabled={uploadingImage || !adAccountId}
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) { await uploadImage(f); e.target.value = ""; } }} />
                  </label>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── Sucesso ── */}
      {step === 4 && createdAdId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={handleReset}>
          <div className="rounded-2xl border border-emerald-500/30 bg-dark-card p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-emerald-400">Anúncio criado!</h2>
                <p className="text-xs text-text-secondary">Em modo pausado — ative quando quiser.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-1">
              <button type="button" onClick={handleReset}
                className="flex-1 rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.2)]">
                Nova campanha
              </button>
              <button type="button" onClick={() => { handleReset(); router.push("/dashboard/ati"); }}
                className="flex-1 rounded-xl border border-dark-border bg-dark-bg px-4 py-2 text-sm font-semibold text-text-primary hover:bg-dark-card transition-colors">
                Ir para o ATI →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
