"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";

import { useSupabase } from "../../../components/auth/AuthProvider";
import LoadingOverlay from "../../../components/ui/LoadingOverlay";
import { usePlanEntitlements } from "../PlanEntitlementsContext";

import type { CaptureSiteRow, LayoutVariant, PageTemplate } from "./_lib/types";
import { PAGE_TEMPLATE_OPTIONS, pageTemplateLabel } from "./_lib/captureTemplates";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";
import { formatDateTimePtBR, isExpired, sanitizeSlug } from "./_lib/captureUtils";

import CapturePreviewCard from "./_components/CapturePreviewCard";
import CaptureVipLanding from "@/app/capture/[slug]/CaptureVipLanding";
import DeleteSiteModal from "./_components/DeleteSiteModal";
import LayoutVariantField from "./_components/LayoutVariantField";
import ResetMetricsModal from "./_components/ResetMetricsModal";

const DOMAIN = "s.afiliadoanalytics.com.br";
const LOGO_BUCKET = "capture-logos";
const PRO_CAPTURE_CHECKOUT_URL = "https://pay.kiwify.com.br/y7I4SuT";

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

  // Wizard step (agora 3)
  const [step, setStep] = useState<1 | 2 | 3>(1);

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
    } else {
      originalButtonUrlRef.current = "";
      modeRef.current = "empty";
      setMode("empty");
      setLogoUrl(null);
      setMetaPixelId("");
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
    }
  }

  function goPrevStep() {
    setError(null);
    if (step === 3) return setStep(2);
    if (step === 2) return setStep(1);
    setStep(1);
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

    const { error: upErr } = await supabase
      .from("capture_sites")
      .update({
        title: title.trim() || null,
        description: description.trim() || null,
        button_text: bt,
        whatsapp_url: url,
        button_color: buttonColor,
        layout_variant: layoutVariant,
        meta_pixel_id: metaPixelId.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", site.id);

    if (upErr) {
      setError(upErr.message);
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
      setLogoFile(null);
      setLogoUrl(null);
      setLogoPendingAction("keep");
      setLogoToast(null);
      originalButtonUrlRef.current = "";

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

  const isVipPreview = pageTemplate === "vip_rosa" || pageTemplate === "vip_terroso";

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
              <h2 className="text-lg sm:text-xl font-semibold text-text-primary flex items-center gap-2">
                <LayoutTemplate className="h-5 w-5 text-shopee-orange shrink-0" />
                Escolha o modelo do site
              </h2>
              <p className="text-sm text-text-secondary mt-1 max-w-xl">
                Cada opção muda o visual da página pública. Depois você preenche slug, textos e link como de costume.
              </p>
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

          <div className="grid gap-4 sm:grid-cols-3">
            {PAGE_TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => confirmTemplateChoice(opt.id)}
                className="text-left rounded-xl border border-dark-border bg-dark-bg/40 p-4 sm:p-5 hover:border-shopee-orange/45 hover:bg-shopee-orange/5 transition-all flex flex-col gap-2 min-h-[140px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary">{opt.title}</span>
                  {opt.badge ? (
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-shopee-orange/15 text-shopee-orange border border-shopee-orange/25">
                      {opt.badge}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-text-secondary leading-relaxed flex-1">{opt.description}</p>
                <span className="text-xs font-semibold text-shopee-orange mt-1">Usar este modelo →</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                if (step !== 3) {
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
                      <label className={labelClass}>Slug (imutável)</label>
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
                      <p className="mt-1.5 text-xs text-text-secondary/80">
                        Apenas letras minúsculas, números e hífen. O slug é único no link público ({DOMAIN}
                        /…): não pode repetir em outra conta nem em outro seu site.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className={labelClass}>Slug (imutável)</label>
                      <input value={site?.slug ?? ""} disabled className={inputDisabledClass} />
                      <p className="mt-1.5 text-xs text-text-secondary/80">Para mudar o slug, apague o site e crie outro.</p>
                    </div>
                  )}

                  <div className="rounded-lg border border-dark-border/60 bg-dark-bg/30 px-3 py-2.5">
                    <p className="text-xs text-text-secondary">
                      <span className="font-medium text-text-primary">Modelo visual:</span>{" "}
                      {pageTemplateLabel(pageTemplate)}
                      {mode === "edit" ? (
                        <span className="block mt-1 text-text-secondary/80">
                          O modelo não pode ser alterado após criar. Para trocar, crie outro site.
                        </span>
                      ) : null}
                    </p>
                  </div>

                  {/* Layout do card — só no template padrão */}
                  {pageTemplate === "classic" ? (
                    <LayoutVariantField value={layoutVariant} onChange={setLayoutVariant} />
                  ) : (
                    <p className="text-xs text-text-secondary/90 leading-relaxed">
                      Este modelo já inclui faixa de urgência, barra de vagas e lista de benefícios na página
                      pública (não usa “layout com ícones / escassez” do card clássico).
                    </p>
                  )}

                  {/* Logo */}
                  <div className="bg-dark-bg border border-dark-border rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="text-sm font-medium text-text-primary">Logo (opcional)</div>

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

                    {mode === "create" && (
                      <div className="mt-2 text-xs text-text-secondary">A logo será enviada automaticamente após criar o site.</div>
                    )}
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
                </div>
              )}

              {/* STEP 3 */}
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

              {/* Footer steps */}
              <div className="pt-4 border-t border-dark-border flex items-center justify-between">
                <div className="text-xs text-text-secondary">{step} de 3</div>

                <div className="flex items-center gap-2">
                  {step > 1 && (
                    <button
                      type="button"
                      onClick={goPrevStep}
                      className="h-9 px-3 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-text-primary hover:border-dark-border/80 transition-colors inline-flex items-center gap-2"
                      title="Voltar"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Voltar
                    </button>
                  )}

                  {step < 3 && (
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
              {step === 3 && (
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

          {/* Preview */}
          <div className="lg:sticky lg:top-6 self-start">
            {isVipPreview ? (
              <div className="rounded-lg border border-dark-border overflow-hidden bg-dark-card">
                <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
                  <div className="text-sm font-semibold text-text-primary">Preview (modelo VIP)</div>
                  <div className="text-xs text-text-secondary">Tempo real</div>
                </div>
                <div className="p-3 bg-dark-bg max-h-[min(78vh,820px)] overflow-y-auto scrollbar-thin">
                  <div className="origin-top scale-[0.72] sm:scale-[0.78] mx-auto w-[min(100%,420px)]">
                    <CaptureVipLanding
                      variant={pageTemplate === "vip_terroso" ? "vip_terroso" : "vip_rosa"}
                      title={previewTitle}
                      description={previewDesc}
                      buttonText={previewButtonText}
                      ctaHref={previewButtonUrl.trim() ? previewButtonUrl : "#"}
                      logoUrl={previewLogoSrc}
                      buttonColor={previewColor}
                      previewMode
                    />
                  </div>
                </div>
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