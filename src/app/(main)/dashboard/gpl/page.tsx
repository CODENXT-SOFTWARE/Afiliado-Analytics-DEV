"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIdbKeyState } from "@/app/hooks/useIdbKeyState";
import { useSupabase } from "@/app/components/auth/AuthProvider";
import {
  Calculator, Users, Calendar, DollarSign, TrendingUp, TrendingDown,
  AlertCircle, AlertTriangle, Info, ArrowRight, MessageCircle,
  Search, Loader2, ChevronDown, ChevronUp,
  MousePointerClick, Zap, Target, BarChart3, CheckCircle2, XCircle,
  ArrowUpRight, ArrowDownRight, Activity, CheckSquare,
  RefreshCcw, Clock,
} from "lucide-react";
import Link from "next/link";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { usePlanEntitlements } from "../PlanEntitlementsContext";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CommissionDataRow {
  "ID do pedido": string;
  "Comissão líquida do afiliado(R$)": string;
  "Horário do pedido": string;
  "Status do Pedido"?: string;
  Canal?: string;
  "Canal do pedido"?: string;
  "Canal de divulgação"?: string;
  "Canal do afiliado"?: string;
  "Canal de origem"?: string;
  [key: string]: unknown;
}

// ─── Utils ──────────────────────────────────────────────────────────────────────
function cn(...classes: Array<string | false | null | undefined>) { return classes.filter(Boolean).join(" "); }

function parseMoneyPt(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const s = String(input).trim();
  if (!s) return 0;
  const cleaned = s.replace(/\s/g, "").replace(/[R$\u00A0]/g, "").replace(/[%]/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatCurrency(value: number) {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function normalizeStr(input?: unknown): string {
  return String(input ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}
function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function getYesterday(): string { const d = new Date(); d.setDate(d.getDate() - 1); return localYMD(d); }
function get3MonthsAgo(): string { const d = new Date(); d.setMonth(d.getMonth() - 3); return localYMD(d); }
function formatDateBR(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return [d, m, y].join("/");
}
function extractChannel(row: CommissionDataRow): string {
  const candidates = ["Canal", "Canal do pedido", "Canal de divulgação", "Canal do afiliado", "Canal de origem"];
  for (const key of candidates) { const v = row[key]; if (v != null && String(v).trim() !== "") return String(v); }
  return "";
}
type CanonicalChannel = "whatsapp" | "websites" | "others" | "unknown";
function normalizeChannel(raw: unknown): CanonicalChannel {
  const s = normalizeStr(raw);
  if (!s) return "unknown";
  if (s.includes("whats")) return "whatsapp";
  if (s.includes("web")) return "websites";
  if (s.includes("other") || s.includes("outro")) return "others";
  return "unknown";
}
const TARGET_CHANNELS: CanonicalChannel[] = ["whatsapp", "websites", "others"];
function extractOrderStatus(row: CommissionDataRow): string { const v = row["Status do Pedido"]; if (v == null) return ""; return String(v); }
type CanonicalOrderStatus = "pending" | "completed" | "other" | "unknown";
function normalizeOrderStatus(raw: unknown): CanonicalOrderStatus {
  const s = normalizeStr(raw);
  if (!s) return "unknown";
  if (s.includes("pend")) return "pending";
  if (s.includes("conclu") || s.includes("complet")) return "completed";
  if (s.includes("cancel") || s.includes("nao pago") || s.includes("não pago") || s.includes("unpaid")) return "other";
  return "other";
}
const TARGET_ORDER_STATUSES: CanonicalOrderStatus[] = ["pending", "completed"];
function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

type ApiCheckState = "checking" | "hasKeys" | "noKeys";
type GplApiRangeCache = { fromDraft: string; toDraft: string; fromApplied: string; toApplied: string };
type EvolutionInstanceItem = { id: string; nome_instancia: string; numero_whatsapp: string | null };
type WhatsAppGroup = { id: string; nome: string; qtdMembros: number };
type TraficoGruposAd = { id: string; name: string; status: string; spend: number; clicks: number; impressions: number; ctr: number; cpc: number };
type TraficoGruposAdSet = { id: string; name: string; status: string; spend: number; ads: TraficoGruposAd[] };
type TraficoGruposCampaignDetail = { id: string; name: string; ad_account_id: string; status: string; spend: number; adSets: TraficoGruposAdSet[] };

const LS_API_CHECK_KEY = "gpl_api_check_state_v1";
function readApiCheckFromLocalStorage(): ApiCheckState {
  if (typeof window === "undefined") return "checking";
  const v = window.localStorage.getItem(LS_API_CHECK_KEY);
  return v === "hasKeys" || v === "noKeys" ? v : "checking";
}
function writeApiCheckToLocalStorage(v: ApiCheckState) {
  if (typeof window === "undefined") return;
  if (v === "hasKeys" || v === "noKeys") window.localStorage.setItem(LS_API_CHECK_KEY, v);
}

// ─── Tooltip (portal) ──────────────────────────────────────────────────────────
function Tooltip({ text, children, wide }: { text: string; children?: React.ReactNode; wide?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const show = useCallback(() => {
    const el = anchorRef.current; if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const tooltip = visible ? createPortal(
    <span style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111111]" />
    </span>, document.body
  ) : null;
  return (
    <span ref={anchorRef} className="relative inline-flex items-center" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children ?? (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors cursor-help">
          <Info className="h-2.5 w-2.5" />
        </span>
      )}
      {tooltip}
    </span>
  );
}

// ─── OrangeCheckbox ─────────────────────────────────────────────────────────────
function OrangeCheckbox({ checked, onChange, className }: { checked: boolean; onChange: () => void; className?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={checked} onClick={onChange}
      className={`shrink-0 w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${checked ? "bg-shopee-orange border-shopee-orange shadow-[0_0_8px_rgba(238,77,45,0.4)]" : "bg-dark-bg border-dark-border hover:border-shopee-orange/50"} ${className ?? ""}`}>
      {checked && (
        <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6 5,9 10,3" />
        </svg>
      )}
    </button>
  );
}

// ─── InlineInfoTooltip ──────────────────────────────────────────────────────────
function InlineInfoTooltip({ text, iconClassName }: { text: string; iconClassName?: string }) {
  return (
    <div className="group relative flex items-center shrink-0">
      <Info className={cn("w-3.5 h-3.5 cursor-help", iconClassName || "text-text-secondary")} />
      <div className="pointer-events-none absolute right-0 top-full mt-2 w-max max-w-[260px] bg-[#232328] border border-dark-border text-[10px] text-white px-2.5 py-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center shadow-lg whitespace-normal leading-tight">
        {text}
      </div>
    </div>
  );
}

// ─── Field ──────────────────────────────────────────────────────────────────────
function Field({ label, icon, value, onChange, type = "text", inputClass, tooltip, readOnly }: {
  label: string; icon?: React.ReactNode; value: string; onChange?: (v: string) => void;
  type?: string; inputClass?: string; tooltip?: string; readOnly?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
        {icon} {label}
        {tooltip && (
          <div className="group relative flex items-center ml-0.5">
            <Info className="w-3 h-3 text-text-secondary cursor-help" />
            <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-max max-w-[180px] bg-[#232328] border border-dark-border text-[10px] text-white px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center shadow-lg whitespace-normal leading-tight">
              {tooltip}
            </div>
          </div>
        )}
      </label>
      <input type={type} value={value} onChange={(e) => onChange?.(e.target.value)} readOnly={readOnly}
        className={cn("h-8 w-full min-w-0 rounded-md border border-dark-border bg-[#1c1c1f] px-2 text-xs font-semibold focus:border-[#e24c30] focus:outline-none focus:ring-1 focus:ring-[#e24c30] transition",
          readOnly && "cursor-default opacity-80",
          inputClass || "text-text-primary")} />
    </div>
  );
}

// ─── ResultCard ─────────────────────────────────────────────────────────────────
function ResultCard({ title, value, footer, valueClassName, highlight }: {
  title: string; value: string; footer?: string; valueClassName?: string; highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg flex flex-col", highlight ? "bg-[#27272a] border border-[#2c2c32] p-3" : "px-1")}>
      <p className="text-[10px] text-text-secondary uppercase tracking-wider leading-tight">{title}</p>
      <p className={cn("mt-0.5 text-2xl font-bold font-heading break-words leading-tight", valueClassName || "text-white")}>{value}</p>
      {footer && <p className="mt-0.5 text-[9px] text-text-secondary">{footer}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function GplCalculatorPage() {
  const context = useSupabase();
  const session = context?.session;
  const { entitlements } = usePlanEntitlements();
  const showSummaryCards = entitlements?.gpl.showSummaryCards ?? false;
  const showGroupsCampaignsInstance = entitlements?.gpl.showGroupsCampaignsInstance ?? false;

  const [idbRawData, , isDataLoading] = useIdbKeyState<CommissionDataRow[]>("commissionsRawData_idb", []);
  const [apiRowsCache, setApiRowsCache, isApiRowsCacheLoading] = useIdbKeyState<CommissionDataRow[]>("gplApiRows_idb", []);
  const [apiRangeCache, setApiRangeCache, isApiRangeCacheLoading] = useIdbKeyState<GplApiRangeCache>("gplApiRange_idb", { fromDraft: "", toDraft: "", fromApplied: "", toApplied: "" });
  const [apiCheckState, setApiCheckState] = useState<ApiCheckState>(() => readApiCheckFromLocalStorage());
  const hasShopeeKeys = apiCheckState === "hasKeys";

  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiFetchTick, setApiFetchTick] = useState(0);
  const [apiFetchedOnce, setApiFetchedOnce] = useState(false);

  const [startDateDraft, setStartDateDraft] = useState<string>("");
  const [endDateDraft, setEndDateDraft] = useState<string>("");
  const [startDateApplied, setStartDateApplied] = useState<string>("");
  const [endDateApplied, setEndDateApplied] = useState<string>("");

  const [groupSize, setGroupSize] = useState<string>("");
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [gplPeriod, setGplPeriod] = useState<number>(0);
  const [gplMonthly, setGplMonthly] = useState<number>(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [daysInPeriod, setDaysInPeriod] = useState<number>(0);
  const [draftDays, setDraftDays] = useState<number>(0);
  const [showShortPeriodWarning, setShowShortPeriodWarning] = useState(false);
  const [showMaxPeriodWarning, setShowMaxPeriodWarning] = useState(false);

  const [evolutionInstances, setEvolutionInstances] = useState<EvolutionInstanceItem[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [groupsCache, setGroupsCache] = useState<Record<string, WhatsAppGroup[]>>({});
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupNameFilter, setGroupNameFilter] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [groupsLastFetchedAt, setGroupsLastFetchedAt] = useState<string | null>(null);
  const [groupSnapshots, setGroupSnapshots] = useState<Array<{ date: string; groups: WhatsAppGroup[] }>>([]);
  const [previousGroupsForComparison, setPreviousGroupsForComparison] = useState<WhatsAppGroup[] | null>(null);
  const [baseGroups, setBaseGroups] = useState<WhatsAppGroup[] | null>(null);
  const [groupCumulative, setGroupCumulative] = useState<Record<string, { total_novos: number; total_saidas: number }>>({});
  const [gplActionsGroup, setGplActionsGroup] = useState<WhatsAppGroup | null>(null);
  const [gplClearing, setGplClearing] = useState(false);

  const [traficoGruposCampaigns, setTraficoGruposCampaigns] = useState<TraficoGruposCampaignDetail[]>([]);
  const [traficoGruposLoading, setTraficoGruposLoading] = useState(false);
  const [traficoGruposError, setTraficoGruposError] = useState<string | null>(null);
  const [expandedTraficoCampaigns, setExpandedTraficoCampaigns] = useState<Record<string, boolean>>({});
  const [expandedTraficoAdSets, setExpandedTraficoAdSets] = useState<Record<string, boolean>>({});
  const [selectedTraficoCampaignIds, setSelectedTraficoCampaignIds] = useState<Set<string>>(new Set());
  const [traficoGruposCache, setTraficoGruposCache, isTraficoCacheLoading] = useIdbKeyState<Record<string, { campaigns: TraficoGruposCampaignDetail[]; fetchedAt: string }>>("gpl_trafico_grupos_cache", {});

  // Tab state (mock: "grupos" | "campanhas")
  const [activeTab, setActiveTab] = useState<"grupos" | "campanhas">("grupos");
  const [groupSearchFilter, setGroupSearchFilter] = useState("");
  const [campaignSearchFilter, setCampaignSearchFilter] = useState("");
  const [campaignListPage, setCampaignListPage] = useState(1);

  const LIST_PAGE_SIZE = 10;

  const instancePickerOptions = useMemo(
    () =>
      evolutionInstances.map((i) => ({
        value: i.id,
        label: i.nome_instancia,
        description: i.numero_whatsapp ? String(i.numero_whatsapp) : undefined,
      })),
    [evolutionInstances],
  );

  // 1) Checar chaves
  useEffect(() => {
    if (isApiRowsCacheLoading || isApiRangeCacheLoading) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/settings/shopee");
        const json = await res.json();
        if (!res.ok) throw new Error();
        const ok = !!json?.has_key && !!json?.shopee_app_id;
        if (!alive) return;
        if (!ok) { setApiCheckState("noKeys"); writeApiCheckToLocalStorage("noKeys"); return; }
        setApiCheckState("hasKeys"); writeApiCheckToLocalStorage("hasKeys");
        const hasCachedRows = (apiRowsCache?.length ?? 0) > 0;
        const hasCachedRange = !!apiRangeCache?.fromApplied && !!apiRangeCache?.toApplied;
        if (hasCachedRows && hasCachedRange) {
          setStartDateDraft(apiRangeCache.fromDraft || apiRangeCache.fromApplied);
          setEndDateDraft(apiRangeCache.toDraft || apiRangeCache.toApplied);
          setStartDateApplied(apiRangeCache.fromApplied);
          setEndDateApplied(apiRangeCache.toApplied);
          setApiFetchedOnce(true);
          return;
        }
        const y = getYesterday();
        setStartDateDraft((prev) => prev || y);
        setEndDateDraft((prev) => prev || y);
        setStartDateApplied(y); setEndDateApplied(y);
        setApiRangeCache({ fromDraft: y, toDraft: y, fromApplied: y, toApplied: y });
        setApiFetchTick((t) => t + 1);
      } catch {
        if (!alive) return;
        setApiCheckState("noKeys"); writeApiCheckToLocalStorage("noKeys");
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiRowsCacheLoading, isApiRangeCacheLoading]);

  useEffect(() => {
    if (hasShopeeKeys) return;
    setStartDateApplied(startDateDraft); setEndDateApplied(endDateDraft);
  }, [hasShopeeKeys, startDateDraft, endDateDraft]);

  useEffect(() => {
    if (!startDateDraft || !endDateDraft) { setDraftDays(0); setShowShortPeriodWarning(false); setShowMaxPeriodWarning(false); return; }
    const start = new Date(startDateDraft + "T00:00:00");
    const end = new Date(endDateDraft + "T00:00:00");
    if (end < start) { setEndDateDraft(""); setDraftDays(0); setShowShortPeriodWarning(false); setShowMaxPeriodWarning(false); return; }
    const inclusiveDays = getInclusiveDays(startDateDraft, endDateDraft);
    if (inclusiveDays > 30) { setEndDateDraft(""); setDraftDays(0); setShowShortPeriodWarning(false); setShowMaxPeriodWarning(false); return; }
    setDraftDays(inclusiveDays);
    setShowShortPeriodWarning(inclusiveDays < 3);
    setShowMaxPeriodWarning(inclusiveDays === 30);
  }, [startDateDraft, endDateDraft]);

  const availableDateRange = useMemo(() => {
    if (hasShopeeKeys) return { min: get3MonthsAgo(), max: getYesterday() };
    return null as null | { min: string; max: string };
  }, [hasShopeeKeys]);

  const maxEndDate = useMemo(() => {
    const range = availableDateRange;
    if (!startDateDraft || !range) return range?.max || "";
    const start = new Date(startDateDraft + "T00:00:00");
    const maxAllowed = new Date(start); maxAllowed.setDate(start.getDate() + 29);
    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, availableDateRange]);

  useEffect(() => {
    if (!hasShopeeKeys || !startDateApplied || !endDateApplied) return;
    let alive = true;
    (async () => {
      setIsApiLoading(true); setApiError(null);
      try {
        const res = await fetch(`/api/shopee/conversion-report?start=${encodeURIComponent(startDateApplied)}&end=${encodeURIComponent(endDateApplied)}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao buscar dados da Shopee");
        if (!alive) return;
        const rows = (json?.data ?? []) as CommissionDataRow[];
        setApiRowsCache(rows);
        setApiRangeCache({ fromDraft: startDateDraft || startDateApplied, toDraft: endDateDraft || endDateApplied, fromApplied: startDateApplied, toApplied: endDateApplied });
        setApiFetchedOnce(true);
      } catch (e) {
        if (!alive) return;
        setApiRowsCache([]); setApiFetchedOnce(true); setApiError(e instanceof Error ? e.message : "Erro");
      } finally { if (alive) setIsApiLoading(false); }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShopeeKeys, startDateApplied, endDateApplied, apiFetchTick]);

  const sourceRows = useMemo(() => { if (hasShopeeKeys) return apiRowsCache ?? []; return idbRawData ?? []; }, [hasShopeeKeys, apiRowsCache, idbRawData]);
  const filteredData = useMemo(() => {
    return (sourceRows ?? []).filter((row) => {
      const chOk = TARGET_CHANNELS.includes(normalizeChannel(extractChannel(row as CommissionDataRow)));
      const stOk = TARGET_ORDER_STATUSES.includes(normalizeOrderStatus(extractOrderStatus(row as CommissionDataRow)));
      return chOk && stOk;
    });
  }, [sourceRows]);

  const idbDateRange = useMemo(() => {
    if (hasShopeeKeys) return null;
    if (!filteredData || filteredData.length === 0) return null;
    const ymds: string[] = [];
    for (const row of filteredData) {
      const dateStr = (row as CommissionDataRow)["Horário do pedido"];
      if (!dateStr) continue;
      const d = new Date(String(dateStr));
      if (!Number.isNaN(d.getTime())) ymds.push(localYMD(d));
    }
    if (ymds.length === 0) return null;
    ymds.sort();
    return { min: ymds[0], max: ymds[ymds.length - 1] };
  }, [hasShopeeKeys, filteredData]);

  const effectiveRange = hasShopeeKeys ? availableDateRange : idbDateRange;
  const maxEndDateEffective = useMemo(() => {
    const range = effectiveRange;
    if (!startDateDraft || !range) return range?.max || "";
    const start = new Date(startDateDraft + "T00:00:00");
    const maxAllowed = new Date(start); maxAllowed.setDate(start.getDate() + 29);
    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, effectiveRange]);

  useEffect(() => {
    if (!startDateApplied || !endDateApplied) { setDaysInPeriod(0); return; }
    const start = new Date(startDateApplied + "T00:00:00");
    const end = new Date(endDateApplied + "T00:00:00");
    if (end < start) { setDaysInPeriod(0); return; }
    setDaysInPeriod(getInclusiveDays(startDateApplied, endDateApplied));
  }, [startDateApplied, endDateApplied]);

  useEffect(() => {
    if (!filteredData || filteredData.length === 0 || !startDateApplied || !endDateApplied) { setTotalProfit(0); return; }
    let profitSum = 0;
    for (const row of filteredData) {
      const dateStr = (row as CommissionDataRow)["Horário do pedido"];
      if (!dateStr) continue;
      const orderDate = new Date(String(dateStr));
      if (Number.isNaN(orderDate.getTime())) continue;
      const orderYMD = localYMD(orderDate);
      if (orderYMD < startDateApplied || orderYMD > endDateApplied) continue;
      profitSum += parseMoneyPt((row as CommissionDataRow)["Comissão líquida do afiliado(R$)"]);
    }
    setTotalProfit(profitSum);
  }, [filteredData, startDateApplied, endDateApplied]);

  useEffect(() => {
    const groupNum = parseFloat(groupSize || "0");
    if (isNaN(groupNum) || groupNum <= 0 || daysInPeriod === 0) { setGplPeriod(0); setGplMonthly(0); setMonthlyRevenue(0); return; }
    const gplInPeriod = totalProfit / groupNum;
    setGplPeriod(gplInPeriod);
    const gplMonth = (gplInPeriod / daysInPeriod) * 30;
    setGplMonthly(gplMonth);
    setMonthlyRevenue(gplMonth * groupNum);
  }, [groupSize, totalProfit, daysInPeriod]);

  useEffect(() => {
    let alive = true;
    fetch("/api/evolution/instances").then((r) => r.json()).then((data) => {
        if (alive && Array.isArray(data.instances)) setEvolutionInstances(data.instances);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const selectedInstance = evolutionInstances.find((i) => i.id === selectedInstanceId);
  const selectedInstanceName = selectedInstance?.nome_instancia ?? "";

  const fetchGroupsForInstance = async (instanceId: string, nomeInstancia: string) => {
    setGroupsLoading(true); setGroupsError(null);
    setPreviousGroupsForComparison(groups.length > 0 ? [...groups] : null);
    try {
      const res = await fetch("/api/evolution/n8n-action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipoAcao: "buscar_grupo", nomeInstancia }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao buscar grupos");
      const lista = json?.grupos ?? [];
      const normalized: WhatsAppGroup[] = lista.map((g: { id?: string; nome?: string; subject?: string; name?: string; qtdMembros?: number; size?: number; participants?: unknown[] }) => ({
        id: String(g.id ?? ""),
        nome: String(g.nome ?? g.subject ?? g.name ?? "Sem nome"),
        qtdMembros: Number(g.qtdMembros ?? g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0)),
      }));
      setGroups(normalized);
      setGroupsCache((prev) => ({ ...prev, [instanceId]: normalized }));
      const saveRes = await fetch("/api/gpl/group-snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instance_id: instanceId, groups: normalized }) });
      if (saveRes.ok) {
        setGroupsLastFetchedAt(new Date().toISOString());
        setGroupSnapshots((prev) => [{ date: new Date().toISOString().slice(0, 10), groups: normalized }, ...prev]);
        const start = startDateApplied || getYesterday();
        const end = endDateApplied || getYesterday();
        const params = new URLSearchParams({ instance_id: instanceId });
        if (start && end) { params.set("start", start); params.set("end", end); }
        fetch(`/api/gpl/group-snapshots?${params.toString()}`, { cache: "no-store" }).then((r) => r.json()).then((data) => {
            const baseRaw = data.base?.groups;
          const baseNorm = Array.isArray(baseRaw) ? (baseRaw as Array<{ id?: string; nome?: string; qtdMembros?: number }>).map((g) => ({ id: String(g?.id ?? ""), nome: String(g?.nome ?? ""), qtdMembros: Number(g?.qtdMembros ?? 0) })) : [];
            setBaseGroups(baseNorm.length > 0 ? baseNorm : null);
            const cum = data.cumulative ?? [];
            const cumMap: Record<string, { total_novos: number; total_saidas: number }> = {};
          for (const c of cum) { if (c?.group_id) cumMap[c.group_id] = { total_novos: Number(c.total_novos ?? 0), total_saidas: Number(c.total_saidas ?? 0) }; }
            setGroupCumulative(cumMap);
        }).catch(() => {});
      } else {
        setGroupsLastFetchedAt(new Date().toISOString());
        setGroupSnapshots([{ date: new Date().toISOString().slice(0, 10), groups: normalized }]);
      }
    } catch (e) {
      setGroups([]); setGroupsError(e instanceof Error ? e.message : "Erro ao buscar grupos"); setGroupsCache((prev) => ({ ...prev, [instanceId]: [] }));
    } finally { setGroupsLoading(false); }
  };

  const refetchGroupCumulative = useCallback(async () => {
    if (!selectedInstanceId) return;
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    const params = new URLSearchParams({ instance_id: selectedInstanceId });
    if (start && end) {
      params.set("start", start);
      params.set("end", end);
    }
    try {
      const res = await fetch(`/api/gpl/group-snapshots?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();
      const cum = data.cumulative ?? [];
      const cumMap: Record<string, { total_novos: number; total_saidas: number }> = {};
      for (const c of cum) {
        if (c?.group_id) cumMap[c.group_id] = { total_novos: Number(c.total_novos ?? 0), total_saidas: Number(c.total_saidas ?? 0) };
      }
      setGroupCumulative(cumMap);
    } catch {
      // ignore
    }
  }, [selectedInstanceId, startDateApplied, endDateApplied]);

  async function handleGplClearGroupCumulative() {
    if (!gplActionsGroup || !selectedInstanceId) return;
    setGplClearing(true);
    try {
      const res = await fetch("/api/gpl/group-snapshots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instance_id: selectedInstanceId,
          group_id: gplActionsGroup.id,
          group_name: gplActionsGroup.nome,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao limpar dados");
      setGplActionsGroup(null);
      await refetchGroupCumulative();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro ao limpar dados");
    } finally {
      setGplClearing(false);
    }
  }

  const filteredGroups = useMemo(() => {
    const q = normalizeStr(groupSearchFilter);
    if (!q) return groups;
    return groups.filter((g) => normalizeStr(g.nome).includes(q));
  }, [groups, groupSearchFilter]);

  const groupMemberDelta = useMemo(() => {
    const map = new Map<string, { anterior: number; delta: number }>();
    let anteriorList: WhatsAppGroup[]; let atualList: WhatsAppGroup[];
    if (baseGroups !== null) { anteriorList = baseGroups; atualList = groups; }
    else if (previousGroupsForComparison !== null) { anteriorList = previousGroupsForComparison; atualList = groups; }
    else if (groupSnapshots.length >= 2) { anteriorList = groupSnapshots[groupSnapshots.length - 1].groups; atualList = groupSnapshots[0].groups; }
    else return map;
    const porIdAnterior = new Map<string, number>();
    for (const g of anteriorList) porIdAnterior.set(g.id, g.qtdMembros);
    for (const g of atualList) { const anterior = porIdAnterior.get(g.id) ?? g.qtdMembros; map.set(g.id, { anterior, delta: g.qtdMembros - anterior }); }
    return map;
  }, [baseGroups, previousGroupsForComparison, groupSnapshots, groups]);

  /** Mesma regra do card: tag "Alta evasão" quando há saídas (cumulativo ou delta). */
  const sortedFilteredGroups = useMemo(() => {
    const sairamValor = (g: WhatsAppGroup) => {
      const cum = groupCumulative[g.id];
      const delta = groupMemberDelta.get(g.id);
      return cum ? cum.total_saidas : (delta !== undefined && delta.delta < 0 ? Math.abs(delta.delta) : 0);
    };
    const copy = [...filteredGroups];
    copy.sort((a, b) => {
      const ha = sairamValor(a) > 0;
      const hb = sairamValor(b) > 0;
      if (ha === hb) return 0;
      return ha ? -1 : 1;
    });
    return copy;
  }, [filteredGroups, groupCumulative, groupMemberDelta]);

  const filteredCampaigns = useMemo(() => {
    const q = normalizeStr(campaignSearchFilter);
    if (!q) return traficoGruposCampaigns;
    return traficoGruposCampaigns.filter((c) => normalizeStr(c.name).includes(q));
  }, [traficoGruposCampaigns, campaignSearchFilter]);

  const campaignTotalPages = Math.max(1, Math.ceil(filteredCampaigns.length / LIST_PAGE_SIZE));
  const safeCampaignPage = Math.min(campaignListPage, campaignTotalPages);
  const pagedCampaigns = filteredCampaigns.slice((safeCampaignPage - 1) * LIST_PAGE_SIZE, safeCampaignPage * LIST_PAGE_SIZE);

  useEffect(() => {
    setCampaignListPage(1);
  }, [campaignSearchFilter, activeTab]);

  useEffect(() => {
    setCampaignListPage((p) => Math.min(p, campaignTotalPages));
  }, [campaignTotalPages]);

  const handleInstancePickerChange = (newId: string) => {
    setSelectedInstanceId(newId);
    setSelectedGroupIds(new Set());
    if (!newId) {
      setGroups([]);
      setBaseGroups(null);
      setGroupCumulative({});
      setGroupsError(null);
      setGroupSnapshots([]);
      setGroupsLastFetchedAt(null);
      setPreviousGroupsForComparison(null);
      return;
    }
    const inst = evolutionInstances.find((i) => i.id === newId);
    if (inst) void fetchGroupsForInstance(newId, inst.nome_instancia);
  };

  const totalMembersSelected = useMemo(() => groups.filter((g) => selectedGroupIds.has(g.id)).reduce((acc, g) => acc + g.qtdMembros, 0), [groups, selectedGroupIds]);
  useEffect(() => { if (totalMembersSelected > 0) setGroupSize(String(totalMembersSelected)); }, [totalMembersSelected]);

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleTraficoCampaign = (id: string) => setExpandedTraficoCampaigns((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleTraficoAdSet = (id: string) => setExpandedTraficoAdSets((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleTraficoCampaignSelection = (id: string) => {
    setSelectedTraficoCampaignIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const custoTráfegoGrupos = useMemo(() => traficoGruposCampaigns.filter((c) => selectedTraficoCampaignIds.has(c.id)).reduce((acc, c) => acc + c.spend, 0), [traficoGruposCampaigns, selectedTraficoCampaignIds]);
  const totalCliquesMeta = useMemo(() => traficoGruposCampaigns.filter((c) => selectedTraficoCampaignIds.has(c.id)).reduce((acc, c) => acc + c.adSets.reduce((s, aset) => s + aset.ads.reduce((a, ad) => a + (ad.clicks ?? 0), 0), 0), 0), [traficoGruposCampaigns, selectedTraficoCampaignIds]);
  const totalNovos = useMemo(() => groups.filter((g) => selectedGroupIds.has(g.id)).reduce((acc, g) => acc + (groupCumulative[g.id]?.total_novos ?? 0), 0), [groups, selectedGroupIds, groupCumulative]);
  const pessoasNoGrupo = useMemo(() => { const n = parseInt(String(groupSize).replace(/\D/g, ""), 10); return Number.isFinite(n) && n > 0 ? n : totalMembersSelected; }, [groupSize, totalMembersSelected]);
  const totalSaidas = useMemo(() => groups.filter((g) => selectedGroupIds.has(g.id)).reduce((acc, g) => acc + (groupCumulative[g.id]?.total_saidas ?? 0), 0), [groups, selectedGroupIds, groupCumulative]);
  const cplInicial = useMemo(() => { if (custoTráfegoGrupos <= 0 || totalNovos <= 0) return 0; return custoTráfegoGrupos / totalNovos; }, [custoTráfegoGrupos, totalNovos]);
  const prejuizoSaidas = useMemo(() => { if (totalSaidas <= 0 || cplInicial <= 0) return 0; return totalSaidas * cplInicial; }, [totalSaidas, cplInicial]);
  const cplMeta = useMemo(() => { if (custoTráfegoGrupos <= 0 || totalCliquesMeta <= 0) return 0; return custoTráfegoGrupos / totalCliquesMeta; }, [custoTráfegoGrupos, totalCliquesMeta]);
  const cplReal = useMemo(() => { if (custoTráfegoGrupos <= 0) return 0; const liquido = totalNovos - totalSaidas; if (liquido <= 0) return 0; return custoTráfegoGrupos / liquido; }, [custoTráfegoGrupos, totalNovos, totalSaidas]);

  const fetchTraficoGrupos = async () => {
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    setTraficoGruposLoading(true); setTraficoGruposError(null);
    try {
      const res = await fetch(`/api/ati/trafico-grupos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar campanhas");
      const campaigns = Array.isArray(json.campaigns) ? json.campaigns : [];
      setTraficoGruposCampaigns(campaigns);
      const periodKey = `${start}_${end}`;
      setTraficoGruposCache((prev) => ({ ...prev, [periodKey]: { campaigns, fetchedAt: new Date().toISOString() } }));
    } catch (e) { setTraficoGruposError(e instanceof Error ? e.message : "Erro ao carregar campanhas"); }
    finally { setTraficoGruposLoading(false); }
  };

  useEffect(() => {
    if (isTraficoCacheLoading) return;
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    const periodKey = `${start}_${end}`;
    const cached = traficoGruposCache[periodKey];
    setTraficoGruposCampaigns(cached?.campaigns ?? []);
  }, [startDateApplied, endDateApplied, traficoGruposCache, isTraficoCacheLoading]);

  const performanceBadge = useMemo(() => {
    if (gplMonthly >= 1.5) return { text: "Excelente", className: "bg-green-500/10 text-green-400 border-green-500/20" };
    if (gplMonthly >= 0.8) return { text: "Boa", className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20" };
    if (gplMonthly > 0) return { text: "Alerta", className: "bg-red-500/10 text-red-400 border-red-500/20" };
    return null;
  }, [gplMonthly]);

  const summaryCards = [
    { label: "Custo Tráfego", value: formatCurrency(custoTráfegoGrupos), tone: "text-red-400", tooltip: "Soma de todos os investimentos em campanhas de tráfego no período." },
    { label: "CPL Inicial", value: custoTráfegoGrupos > 0 && totalNovos > 0 ? formatCurrency(cplInicial) : "—", tone: "text-amber-300", tooltip: "Custo bruto por lead, sem considerar as saídas." },
    { label: "CPL Meta", value: custoTráfegoGrupos > 0 && totalCliquesMeta > 0 ? formatCurrency(cplMeta) : "—", tone: "text-sky-300", tooltip: "Seu teto de gastos ideal por lead para manter a lucratividade." },
    { label: "CPL Real", value: cplReal > 0 ? formatCurrency(cplReal) : "—", tone: "text-emerald-400", tooltip: "Custo líquido por lead, dividindo o investimento apenas pelos leads que ficaram." },
    { label: "Membros", value: pessoasNoGrupo > 0 ? String(pessoasNoGrupo) : "—", tone: "text-sky-400", tooltip: "Pessoas ativas retidas no momento atual." },
    { label: "Entradas", value: totalNovos > 0 ? String(totalNovos) : "—", tone: "text-emerald-400", tooltip: "Volume de novos membros que ingressaram via tráfego." },
    { label: "Saídas", value: totalSaidas > 0 ? String(totalSaidas) : "—", tone: "text-red-400", tooltip: "Volume de membros que saíram (evasão)." },
    { label: "Prejuízo", value: prejuizoSaidas > 0 ? formatCurrency(prejuizoSaidas) : "—", tone: "text-red-400", tooltip: "Diferença negativa caso o custo do tráfego seja maior que o lucro." },
  ];

  const tabInfoTooltip = activeTab === "grupos"
    ? "Selecione uma instância no canto superior direito para carregar os grupos automaticamente. Use a busca abaixo para filtrar a lista. Marque os grupos para somar em 'Pessoas no grupo'."
    : "Selecione campanhas para somar o custo de tráfego. Certifique-se de marcar a tag no ATI para que elas apareçam aqui.";

  function onClickBuscar() {
    if (!hasShopeeKeys || !startDateDraft || !endDateDraft) return;
    setStartDateApplied(startDateDraft); setEndDateApplied(endDateDraft);
    setApiRangeCache({ fromDraft: startDateDraft, toDraft: endDateDraft, fromApplied: startDateDraft, toApplied: endDateDraft });
    setApiFetchTick((t) => t + 1);
    if (selectedInstanceId && selectedInstanceName) fetchGroupsForInstance(selectedInstanceId, selectedInstanceName);
  }

  const hasAnySource = hasShopeeKeys || (idbRawData && idbRawData.length > 0);

  if (!session) return <LoadingOverlay message="Carregando sessão..." />;
  if (apiCheckState === "checking") return <LoadingOverlay message="Verificando integração com a Shopee..." />;
  if (!hasShopeeKeys && isDataLoading) return <LoadingOverlay message="Carregando dados..." />;

  return (
    <div className="flex flex-col  text-text-primary space-y-4">
      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(56%) sepia(93%) saturate(1573%) hue-rotate(358deg) brightness(100%) contrast(103%); cursor: pointer; }
        input[type="date"]:disabled::-webkit-calendar-picker-indicator { filter: opacity(0.5); }
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        /* Trilho preto + thumb cinza claro (alinhado ao app / mobile) */
        .custom-scrollbar { scrollbar-width: thin; scrollbar-color: #9a9aa3 #000000; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #000000; border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #9a9aa3; border-radius: 999px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #b8b8c0; }
      `}</style>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-dark-border pb-3 shrink-0">
        <div>
          <h1 className="text-xl font-bold font-heading flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#e24c30]" /> Calculadora GPL
          </h1>
          <p className="text-xs text-text-secondary mt-0.5">
            Canais: <span className="text-text-primary font-medium">WhatsApp · Websites · Others</span>
            {startDateApplied && endDateApplied && (
              <span className="ml-2 text-text-secondary/70">· {formatDateBR(startDateApplied)} a {formatDateBR(endDateApplied)}{daysInPeriod > 0 && <span className="text-[#e24c30]/80"> ({daysInPeriod}d)</span>}</span>
            )}
          </p>
            </div>
        <div className={`shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border ${hasShopeeKeys ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>
          {hasShopeeKeys ? <><CheckCircle2 className="h-3 w-3" /> API Shopee</> : <><BarChart3 className="h-3 w-3" /> Relatório local</>}
          </div>
      </div>

      {/* Erro de API */}
      {apiError && (
        <div className="flex items-start gap-3 p-4 bg-red-500/8 border border-red-500/25 rounded-xl shrink-0">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-300">Erro ao buscar dados da Shopee</p>
            <p className="text-xs text-red-400/80 mt-0.5">{apiError}</p>
              </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/configuracoes" className="px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors">Configurações</Link>
            <button onClick={() => { setApiError(null); setApiFetchTick((t) => t + 1); }} className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors">Tentar novamente</button>
          </div>
        </div>
      )}

      {!hasAnySource ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 rounded-2xl bg-dark-card border border-dark-border mb-4">
            <Calculator className="h-12 w-12 text-text-secondary/40" />
              </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">Nenhum dado disponível</h2>
          <p className="text-sm text-text-secondary max-w-xs mb-6">Faça upload do relatório na seção &quot;Análise de Comissões&quot; ou cadastre suas chaves da Shopee.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-xl text-sm transition-colors">
            Ir para Análise <ArrowRight className="h-4 w-4" />
            </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0">

          {/* ── Coluna esquerda: Parâmetros ── */}
          <div className="md:col-span-4 lg:col-span-3 bg-[#27272a] rounded-xl border border-[#2c2c32] p-4 flex flex-col gap-4 overflow-y-auto overflow-x-hidden custom-scrollbar">
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 px-2 py-1.5 rounded border border-emerald-500/20 text-[11px] font-semibold">
              <CheckSquare className="w-3 h-3 shrink-0" /> {hasShopeeKeys ? "API Shopee Conectada" : "Relatório local carregado"}
                    </div>

            <div className="space-y-3 border-b border-dark-border pb-4">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Parâmetros</h3>
              <Field label="Pessoas no Grupo" icon={<Users className="w-3 h-3 text-sky-400" />}
                value={groupSize} onChange={setGroupSize} type="number"
                tooltip="Número total de membros ativos que visualizarão as ofertas no período analisado." />
              {totalMembersSelected > 0 && (
                <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Users className="h-3 w-3" /> {totalMembersSelected.toLocaleString("pt-BR")} membros selecionados</p>
              )}
              <div className="bg-[#27272a] p-2 rounded-lg border border-dark-border">
                <label className="mb-2 flex items-center justify-between text-xs font-medium">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-amber-400" /> Período</span>
                  <span className="text-[10px] bg-[#222228] border border-[#2c2c32] px-1.5 py-0.5 rounded text-text-secondary">{draftDays > 0 ? `${draftDays}d` : "—"}</span>
                </label>
                <div className="flex flex-col gap-2 mb-2">
                  <div className="w-full">
                    <span className="text-[9px] text-text-secondary px-1">Início</span>
                    <input type="date" value={startDateDraft} min={effectiveRange?.min} max={effectiveRange?.max}
                      onChange={(e) => setStartDateDraft(e.target.value)}
                      className="w-full bg-transparent border-b border-dark-border text-xs px-1 py-1 outline-none text-white focus:border-[#e24c30]" />
                  </div>
                  <div className="w-full">
                    <span className="text-[9px] text-text-secondary px-1">Fim</span>
                    <input type="date" value={endDateDraft} min={startDateDraft || effectiveRange?.min} max={maxEndDateEffective}
                      disabled={!startDateDraft} onChange={(e) => setEndDateDraft(e.target.value)}
                      className="w-full bg-transparent border-b border-dark-border text-xs px-1 py-1 outline-none text-white focus:border-[#e24c30] disabled:opacity-40" />
                  </div>
                </div>
                {showShortPeriodWarning && (
                  <p className="text-[9px] text-amber-400 mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3 shrink-0" /> Período curto — projeção imprecisa.</p>
                )}
                {showMaxPeriodWarning && (
                  <p className="text-[9px] text-blue-400 mb-2 flex items-center gap-1"><Info className="w-3 h-3 shrink-0" /> Período máximo de 30 dias.</p>
                )}
                <button onClick={onClickBuscar} disabled={!hasShopeeKeys || !startDateDraft || !endDateDraft || draftDays <= 0 || isApiLoading}
                  className="w-full bg-[#e24c30] text-white text-[11px] py-1.5 rounded font-semibold hover:opacity-90 disabled:opacity-40 transition flex items-center justify-center gap-1.5">
                  {isApiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Aplicar Filtro
                  </button>
            </div>
          </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Valores</h3>
              <Field label="Lucro Total (Líquido)" icon={<DollarSign className="w-3 h-3 text-emerald-400" />}
                value={isApiLoading ? "Carregando..." : formatCurrency(totalProfit)} readOnly
                tooltip="Soma das comissões líquidas geradas pelas campanhas conectadas." />
              <Field label="Custo de Tráfego" icon={<TrendingUp className="w-3 h-3 text-red-400" />}
                value={custoTráfegoGrupos > 0 ? formatCurrency(custoTráfegoGrupos) : "Selecione campanhas"} readOnly
                inputClass="text-red-400"
                tooltip="Soma total do valor investido para atrair os leads no mesmo período." />
            </div>
                </div>

          {/* ── Centro: Resumo + Grupos/Campanhas ── */}
          <div className="md:col-span-8 lg:col-span-6 flex flex-col gap-4 min-h-0">
            {/* Cards resumo */}
            {showSummaryCards ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 shrink-0">
              {summaryCards.map((card) => (
                <div key={card.label} className="bg-[#27272a] border border-[#2c2c32] rounded-lg p-2.5 flex flex-col justify-center">
                  <div className="flex items-center gap-1">
                    <p className="text-[9px] text-text-secondary uppercase tracking-wider leading-tight">{card.label}</p>
                    {card.tooltip && (
                      <div className="group relative flex items-center shrink-0">
                        <Info className="w-3 h-3 text-text-secondary cursor-help" />
                        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-max max-w-[180px] bg-[#232328] border border-dark-border text-[10px] text-white px-2 py-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center shadow-lg whitespace-normal leading-tight">
                          {card.tooltip}
                </div>
                  </div>
                )}
              </div>
                  <p className={cn("mt-0.5 text-sm font-bold break-words leading-tight", card.tone)}>{card.value}</p>
                </div>
              ))}
        </div>
            ) : (
              <div className="bg-dark-card border border-dark-border rounded-xl p-4 text-center text-sm text-text-secondary shrink-0">
                Cards de resumo disponíveis no Plano Pro.
              </div>
            )}

            {/* Panel grupos/campanhas */}
            {showGroupsCampaignsInstance ? (
            <div className=" rounded-xl  flex-1 relative min-h-[400px] lg:min-h-0">
              <div className="absolute inset-0 flex flex-col p-4">
                {/* Mobile: abas | (busca + instância na mesma linha). Desktop lg+: abas + instância | busca full width. */}
                <div className="flex flex-col gap-2 mb-2 shrink-0">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 w-full min-w-0">
                    <div className="flex bg-[#27272a] p-1 rounded-lg border border-dark-border shrink-0">
                      <button type="button" onClick={() => setActiveTab("grupos")}
                        className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
                          activeTab === "grupos" ? "bg-[#e24c30] text-white" : "text-text-secondary hover:text-white")}>
                        <Users className="w-3 h-3" /> Grupos
                </button>
                      <button type="button" onClick={() => setActiveTab("campanhas")}
                        className={cn("px-4 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-2",
                          activeTab === "campanhas" ? "bg-[#e24c30] text-white" : "text-text-secondary hover:text-white")}>
                        <Activity className="w-3 h-3" /> Campanhas
                </button>
            </div>
                    <div className="hidden lg:flex items-center justify-end gap-2 shrink-0 min-w-0 max-w-full sm:max-w-[min(100%,380px)] ml-auto">
                      <MetaSearchablePicker
                        value={selectedInstanceId}
                        onChange={handleInstancePickerChange}
                        options={instancePickerOptions}
                        modalTitle="Instância WhatsApp"
                        modalDescription="Escolha a instância Evolution para listar os grupos. Os grupos são atualizados automaticamente ao confirmar."
                        searchPlaceholder="Buscar instância…"
                        emptyButtonLabel="Selecionar instância"
                        emptyAsTag
                        emptyTagLabel="Instância"
                        className="flex justify-end items-center min-w-0 [&>div]:justify-end"
                        emptyOptionsMessage="Nenhuma instância disponível. Conecte o WhatsApp nas configurações."
                      />
                      {activeTab === "campanhas" && (
                        <button
                          type="button"
                          onClick={() => void fetchTraficoGrupos()}
                          className="text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/25 p-1.5 rounded-md transition-colors shrink-0"
                          title="Atualizar campanhas"
                        >
                          <RefreshCcw className="w-3 h-3" />
                </button>
                      )}
            </div>
                  </div>
                  <div className="flex flex-row items-center gap-2 w-full min-w-0 lg:flex-col lg:items-stretch lg:gap-2">
                    <div className="relative flex-1 min-w-0 lg:w-full">
                      <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary pointer-events-none" />
                <input
                  type="text"
                        placeholder={activeTab === "grupos" ? "Buscar grupo…" : "Buscar campanha…"}
                        value={activeTab === "grupos" ? groupSearchFilter : campaignSearchFilter}
                        onChange={(e) => {
                          if (activeTab === "grupos") setGroupSearchFilter(e.target.value);
                          else setCampaignSearchFilter(e.target.value);
                        }}
                        className="w-full bg-[#1c1c1f] border border-[#2c2c32] rounded-md py-2 pl-8 pr-3 text-xs focus:border-[#e24c30] outline-none min-w-0"
                />
              </div>
                    <div className="flex lg:hidden shrink-0 items-center justify-end gap-2 min-w-0">
                      <MetaSearchablePicker
                        value={selectedInstanceId}
                        onChange={handleInstancePickerChange}
                        options={instancePickerOptions}
                        modalTitle="Instância WhatsApp"
                        modalDescription="Escolha a instância Evolution para listar os grupos. Os grupos são atualizados automaticamente ao confirmar."
                        searchPlaceholder="Buscar instância…"
                        emptyButtonLabel="Selecionar instância"
                        emptyAsTag
                        emptyTagLabel="Instância"
                        className="flex justify-end items-center min-w-0 max-w-[min(100vw-8rem,200px)] [&>div]:justify-end"
                        emptyOptionsMessage="Nenhuma instância disponível. Conecte o WhatsApp nas configurações."
                      />
                      {activeTab === "campanhas" && (
              <button
                type="button"
                          onClick={() => void fetchTraficoGrupos()}
                          className="text-sky-300 hover:text-sky-200 bg-sky-500/10 hover:bg-sky-500/15 border border-sky-500/25 p-1.5 rounded-md transition-colors shrink-0"
                          title="Atualizar campanhas"
                        >
                          <RefreshCcw className="w-3 h-3" />
              </button>
              )}
            </div>
                  </div>
                </div>

                {/* Info linha */}
                <div className="mb-3 px-1 shrink-0 flex items-center justify-between gap-3">
                  {activeTab === "grupos" ? (
                    <p className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-semibold min-w-0">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      {groupsLastFetchedAt ? `Atualizado: ${new Date(groupsLastFetchedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Selecione uma instância para carregar os grupos"}
                    </p>
                  ) : (
                    <p className="text-[11px] text-sky-300 flex items-center gap-1.5 font-semibold min-w-0">
                      <Calendar className="w-3.5 h-3.5 shrink-0" /> Período: {formatDateBR(startDateApplied)} a {formatDateBR(endDateApplied)}
                    </p>
                  )}
                  <InlineInfoTooltip text={tabInfoTooltip} iconClassName={activeTab === "grupos" ? "text-emerald-400" : "text-sky-300"} />
              </div>

                {/* Seleção resumo */}
                {activeTab === "grupos" && selectedGroupIds.size > 0 && (
                  <div className="mb-2 px-2 py-1.5 bg-shopee-orange/8 border border-shopee-orange/20 rounded-lg flex flex-wrap items-center gap-x-3 gap-y-1 text-xs shrink-0">
                    <span className="text-shopee-orange font-medium">{selectedGroupIds.size} grupo{selectedGroupIds.size !== 1 ? "s" : ""} · {totalMembersSelected.toLocaleString("pt-BR")} membros</span>
                    <button onClick={() => { setSelectedGroupIds(new Set()); setGroupSize(""); }} className="ml-auto text-text-secondary/60 hover:text-red-400 transition-colors text-[10px]">limpar</button>
                  </div>
                )}

                {/* Lista */}
                <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
                  {activeTab === "grupos" ? (
                    groupsLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-text-secondary text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando grupos...</div>
                    ) : groupsError ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/8 border border-red-500/20 rounded-lg"><AlertCircle className="h-4 w-4 text-red-400 shrink-0" /><p className="text-xs text-red-400">{groupsError}</p></div>
                    ) : !selectedInstanceId ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center"><MessageCircle className="w-8 h-8 text-[#2c2c32] mb-2" /><p className="text-xs text-text-secondary">Selecione uma instância no canto superior direito para carregar os grupos</p></div>
            ) : filteredGroups.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center"><p className="text-xs text-text-secondary">{groups.length === 0 ? "Nenhum grupo retornado para esta instância." : "Nenhum grupo encontrado na busca."}</p></div>
            ) : (
                      <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {sortedFilteredGroups.map((g) => {
                  const cum = groupCumulative[g.id];
                  const delta = groupMemberDelta.get(g.id);
                  const novosValor = cum ? cum.total_novos : (delta !== undefined && delta.delta > 0 ? delta.delta : 0);
                  const sairamValor = cum ? cum.total_saidas : (delta !== undefined && delta.delta < 0 ? Math.abs(delta.delta) : 0);
                  const temComparacao = cum !== undefined || delta !== undefined;
                  const evasao = sairamValor > 0;
                          const isSelected = selectedGroupIds.has(g.id);
                  return (
                            <div key={g.id}
                              className={cn("relative bg-[#1c1c1f] border p-3 rounded-lg flex flex-col hover:border-text-secondary transition cursor-pointer",
                                evasao ? "border-[#5c3429]" : isSelected ? "border-shopee-orange/40 bg-shopee-orange/5" : "border-dark-border")}
                              onClick={() => toggleGroupSelection(g.id)}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <OrangeCheckbox checked={isSelected} onChange={() => toggleGroupSelection(g.id)} />
                                  </div>
                                  <span className="text-xs font-bold break-words">{g.nome}</span>
                    </div>
                                <span className="text-[10px] text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded font-medium shrink-0 whitespace-nowrap">{g.qtdMembros} membros</span>
                              </div>
                              {temComparacao && (
                                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 mt-1.5 text-[10px] w-full">
                                  <div className="flex flex-wrap items-center gap-4 min-w-0">
                                    <span className="text-emerald-400 flex items-center gap-1"><ArrowUpRight className="w-3 h-3 shrink-0" /> {novosValor} Entradas</span>
                                    <span className="text-red-400 flex items-center gap-1"><ArrowDownRight className="w-3 h-3 shrink-0" /> {sairamValor} Saídas</span>
                                    {evasao && <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Alta evasão</span>}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-white font-medium shrink-0 ml-auto hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setGplActionsGroup(g);
                                    }}
                                  >
                                    Ações
                                  </button>
                                </div>
                              )}
                            </div>
                  );
                })}
              </div>
                      </>
                    )
                  ) : (
                    /* Campanhas */
                    traficoGruposLoading ? (
                      <div className="flex items-center justify-center gap-2 py-8 text-text-secondary text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Carregando campanhas...</div>
                    ) : traficoGruposError ? (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/8 border border-red-500/20 rounded-lg"><XCircle className="h-4 w-4 text-red-400 shrink-0" /><p className="text-xs text-red-400">{traficoGruposError}</p></div>
                    ) : traficoGruposCampaigns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-sm text-text-secondary">Nenhuma campanha no cache para este período.</p>
                        <p className="text-xs text-text-secondary/60 mt-1">Use o botão de atualizar (ícone) ao lado da instância, no topo, para buscar na API.</p>
            </div>
                    ) : filteredCampaigns.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <p className="text-xs text-text-secondary">Nenhuma campanha encontrada na busca.</p>
              </div>
                    ) : (
                      <>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                        {pagedCampaigns.map((c) => {
                          const isSelected = selectedTraficoCampaignIds.has(c.id);
                          const isOpen = expandedTraficoCampaigns[c.id];
                  return (
                            <div
                              key={c.id}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleTraficoCampaignSelection(c.id); } }}
                              className={cn("bg-[#1c1c1f] border p-3 rounded-lg flex flex-col hover:border-text-secondary transition cursor-pointer",
                                isSelected ? "border-shopee-orange/40 bg-shopee-orange/5" : "border-dark-border")}
                              onClick={() => toggleTraficoCampaignSelection(c.id)}
                            >
                              <div className="flex items-start justify-between w-full gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <OrangeCheckbox checked={isSelected} onChange={() => toggleTraficoCampaignSelection(c.id)} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-bold break-words">{c.name}</span>
                                      <span className={cn("text-[10px] px-2 py-0.5 rounded font-medium shrink-0 whitespace-nowrap",
                                        c.status === "ACTIVE" ? "text-emerald-400 bg-emerald-500/10" : "text-sky-400 bg-sky-400/10")}>
                                        {c.status === "ACTIVE" ? "Ativo" : "Pausado"}
                          </span>
                      </div>
                                    <span className="text-[10px] text-sky-400 bg-sky-400/10 px-2 py-0.5 rounded font-medium inline-block mt-1.5 whitespace-nowrap">{formatCurrency(c.spend)} gasto</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                    onClick={() => toggleTraficoCampaign(c.id)}
                                    className="p-1 rounded-md hover:bg-white/5 text-text-secondary"
                                    aria-expanded={isOpen}
                                  >
                                    {isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                  <Link href="/dashboard/ati" className="text-[10px] font-semibold text-red-500 hover:text-red-400 transition whitespace-nowrap">Ver no ATI</Link>
                                        </div>
                              </div>
                              {isOpen && c.adSets.map((aset) => {
                                const adSetOpen = expandedTraficoAdSets[aset.id];
                                return (
                                  <div key={aset.id} className="mt-2 pl-2 border-l border-dark-border/50" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => toggleTraficoAdSet(aset.id)} className="w-full flex items-center gap-2 text-left py-1">
                                      {adSetOpen ? <ChevronUp className="w-3 h-3 text-text-secondary shrink-0" /> : <ChevronDown className="w-3 h-3 text-text-secondary shrink-0" />}
                                      <span className="text-xs font-medium text-text-primary truncate flex-1">{aset.name}</span>
                                      <span className="text-xs text-shopee-orange shrink-0">{formatCurrency(aset.spend)}</span>
                                    </button>
                                    {adSetOpen && aset.ads.map((ad) => (
                                      <div key={ad.id} className="flex items-center gap-2 py-1 pl-4 text-[11px] text-text-secondary">
                                        <span className="truncate flex-1">{ad.name}</span>
                                        <span>{formatCurrency(ad.spend)}</span>
                                        <span className="flex items-center gap-0.5 shrink-0"><MousePointerClick className="h-3 w-3" /> {ad.clicks}</span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                              </div>
                            );
                          })}
                      </div>
                      {campaignTotalPages > 1 && (
                        <div className="mt-3 pt-2 border-t border-[#2c2c32] flex flex-col items-center justify-center gap-2 text-[10px] text-text-secondary">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button type="button" onClick={() => setCampaignListPage((p) => Math.max(1, p - 1))} disabled={safeCampaignPage <= 1} className="px-3 py-1.5 rounded-md border border-[#2c2c32] bg-[#1c1c1f] text-text-secondary hover:text-white disabled:opacity-30 min-w-[76px]">Anterior</button>
                            <span className="text-text-primary/90 font-semibold tabular-nums px-2 shrink-0">Pág. {safeCampaignPage}/{campaignTotalPages}</span>
                            <button type="button" onClick={() => setCampaignListPage((p) => Math.min(campaignTotalPages, p + 1))} disabled={safeCampaignPage >= campaignTotalPages} className="px-3 py-1.5 rounded-md border border-[#2c2c32] bg-[#1c1c1f] text-text-secondary hover:text-white disabled:opacity-30 min-w-[76px]">Próxima</button>
                          </div>
                          <p className="text-center text-text-secondary/85 leading-relaxed max-w-md">
                            {(safeCampaignPage - 1) * LIST_PAGE_SIZE + 1}–{Math.min(safeCampaignPage * LIST_PAGE_SIZE, filteredCampaigns.length)} de {filteredCampaigns.length} campanhas
                          </p>
                        </div>
                      )}
                      </>
                    )
                      )}
                    </div>
              </div>
            </div>
            ) : (
              <div className="bg-dark-card border border-dark-border rounded-xl p-4 text-center text-sm text-text-secondary flex-1 flex items-center justify-center">
                Painel de grupos e campanhas disponível no Plano Pro.
              </div>
            )}
          </div>

          {/* ── Coluna direita: Visão Executiva ── */}
          <div className="md:col-span-12 lg:col-span-3 bg-[#27272a] rounded-xl border border-[#2c2c32] p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6 ">
                <Target className="w-4 h-4 text-[#e24c30]" />
                <h2 className="text-sm font-bold uppercase tracking-wide">Visão Executiva</h2>
              </div>
              <div className="space-y-4">
                <ResultCard title={`GPL no período (${daysInPeriod || draftDays}d)`} value={gplPeriod > 0 ? formatCurrency(gplPeriod) : "—"} footer="por lead" />
                <ResultCard title="GPL Mensal Projetado" value={gplMonthly > 0 ? formatCurrency(gplMonthly) : "—"} footer="por lead/mês" valueClassName="text-[#e24c30]" highlight />
                <ResultCard title="Receita Bruta Estimada" value={monthlyRevenue > 0 ? formatCurrency(monthlyRevenue) : "—"} footer="total projetado no mês" valueClassName="text-emerald-400" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-border">
              <p className="text-[10px] text-text-secondary mb-2 uppercase text-center tracking-wider">Status da Operação</p>
              {performanceBadge ? (
                <div className={cn("w-full py-2 rounded-lg text-center text-xs font-bold border uppercase tracking-wider flex items-center justify-center gap-2", performanceBadge.className)}>
                  <AlertCircle className="w-3 h-3" /> {performanceBadge.text}
                </div>
              ) : (
                <div className="w-full py-2 rounded-lg text-center text-xs text-text-secondary border border-dark-border bg-[#1c1c1f]">
                  {isApiLoading ? "Carregando dados..." : "Aguardando dados..."}
              </div>
            )}
              {gplPeriod > 0 && (
                <div className="mt-3 space-y-1.5 text-[10px] text-text-secondary">
                  <div className="flex justify-between"><span>Comissão</span><span className="text-emerald-400 font-semibold">{formatCurrency(totalProfit)}</span></div>
                  <div className="flex justify-between"><span>Membros</span><span className="text-sky-400 font-semibold">{pessoasNoGrupo > 0 ? pessoasNoGrupo.toLocaleString("pt-BR") : "—"}</span></div>
                  <div className="flex justify-between"><span>Período</span><span className="font-semibold">{daysInPeriod}d</span></div>
          </div>
              )}
        </div>
          </div>
        </div>
      )}

      {gplActionsGroup && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => !gplClearing && setGplActionsGroup(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-md bg-[#1c1c1f] border border-dark-border rounded-xl shadow-2xl p-5"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gpl-actions-title"
          >
            <h3 id="gpl-actions-title" className="text-base font-semibold text-text-primary mb-1">
              Ações
            </h3>
            <p className="text-xs text-text-secondary mb-4 line-clamp-2">{gplActionsGroup.nome}</p>
            <p className="text-xs text-text-secondary/90 mb-4">
              Limpar dados zera as <strong className="text-text-primary">Entradas</strong> e <strong className="text-text-primary">Saídas</strong> acumuladas deste grupo (Ação Irreversível).
            </p>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                disabled={gplClearing}
                onClick={() => setGplActionsGroup(null)}
                className="px-4 py-2.5 rounded-lg border border-dark-border text-text-secondary hover:text-text-primary text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={gplClearing}
                onClick={() => void handleGplClearGroupCumulative()}
                className="px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {gplClearing ? "Limpando…" : "Limpar dados"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
