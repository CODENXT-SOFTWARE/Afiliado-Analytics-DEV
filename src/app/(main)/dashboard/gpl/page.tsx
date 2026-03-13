"use client";

import { useState, useEffect, useMemo } from "react";
import { useIdbKeyState } from "@/app/hooks/useIdbKeyState";
import { useSupabase } from "@/app/components/auth/AuthProvider";
import {
  Calculator,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  MessageCircle,
  Search,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  MousePointerClick,
} from "lucide-react";
import Link from "next/link";
import LoadingOverlay from "@/app/components/ui/LoadingOverlay";

interface CommissionDataRow {
  "ID do pedido": string;
  "Comissão líquida do afiliado(R$)": string;
  "Horário do pedido": string;

  // ✅ chave usada no CSV e no payload da API no seu projeto
  "Status do Pedido"?: string;

  Canal?: string;
  "Canal do pedido"?: string;
  "Canal de divulgação"?: string;
  "Canal do afiliado"?: string;
  "Canal de origem"?: string;

  [key: string]: unknown;
}

function parseMoneyPt(input: unknown): number {
  if (typeof input === "number") return Number.isFinite(input) ? input : 0;
  if (input == null) return 0;
  const s = String(input).trim();
  if (!s) return 0;

  const cleaned = s
    .replace(/\s/g, "")
    .replace(/[R$\u00A0]/g, "")
    .replace(/[%]/g, "");

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

const formatCurrency = (value: number) =>
  `R$ ${value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function normalizeStr(input?: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function localYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localYMD(d);
}

function get3MonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 3);
  return localYMD(d);
}

/** Formata YYYY-MM-DD para DD/MM/YYYY para exibição */
function formatDateBR(ymd: string): string {
  if (!ymd || ymd.length < 10) return "—";
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return [d, m, y].join("/");
}

function extractChannel(row: CommissionDataRow): string {
  const candidates = [
    "Canal",
    "Canal do pedido",
    "Canal de divulgação",
    "Canal do afiliado",
    "Canal de origem",
  ];
  for (const key of candidates) {
    const v = row[key];
    if (v != null && String(v).trim() !== "") return String(v);
  }
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

// =========================
// ✅ STATUS FILTER (NOVO)
// =========================
function extractOrderStatus(row: CommissionDataRow): string {
  const v = row["Status do Pedido"];
  if (v == null) return "";
  return String(v);
}

type CanonicalOrderStatus = "pending" | "completed" | "other" | "unknown";

function normalizeOrderStatus(raw: unknown): CanonicalOrderStatus {
  const s = normalizeStr(raw);
  if (!s) return "unknown";

  // PT-BR comuns
  if (s.includes("pend")) return "pending"; // pendente, pending
  if (s.includes("conclu")) return "completed"; // concluido, concluído
  if (s.includes("complet")) return "completed"; // completed, completo

  // outros (não queremos)
  if (s.includes("cancel")) return "other";
  if (s.includes("nao pago") || s.includes("não pago") || s.includes("unpaid"))
    return "other";

  return "other";
}

const TARGET_ORDER_STATUSES: CanonicalOrderStatus[] = ["pending", "completed"];

function getInclusiveDays(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr + "T00:00:00");
  const end = new Date(endDateStr + "T00:00:00");
  const diffTime = end.getTime() - start.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

type ApiCheckState = "checking" | "hasKeys" | "noKeys";

type GplApiRangeCache = {
  fromDraft: string;
  toDraft: string;
  fromApplied: string;
  toApplied: string;
};

type EvolutionInstanceItem = { id: string; nome_instancia: string; numero_whatsapp: string | null };
type WhatsAppGroup = { id: string; nome: string; qtdMembros: number };

type TraficoGruposAd = {
  id: string;
  name: string;
  status: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
};

type TraficoGruposAdSet = {
  id: string;
  name: string;
  status: string;
  spend: number;
  ads: TraficoGruposAd[];
};

type TraficoGruposCampaignDetail = {
  id: string;
  name: string;
  ad_account_id: string;
  status: string;
  spend: number;
  adSets: TraficoGruposAdSet[];
};

// ✅ chave para persistir o resultado da checagem (evita voltar pra "checking")
const LS_API_CHECK_KEY = "gpl_api_check_state_v1";

function readApiCheckFromLocalStorage(): ApiCheckState {
  if (typeof window === "undefined") return "checking";
  const v = window.localStorage.getItem(LS_API_CHECK_KEY);
  return v === "hasKeys" || v === "noKeys" ? v : "checking";
}

function writeApiCheckToLocalStorage(v: ApiCheckState) {
  if (typeof window === "undefined") return;
  if (v === "hasKeys" || v === "noKeys")
    window.localStorage.setItem(LS_API_CHECK_KEY, v);
}

export default function GplCalculatorPage() {
  const context = useSupabase();
  const session = context?.session;

  // IDB (quando não tiver API)
  const [idbRawData, , isDataLoading] = useIdbKeyState<CommissionDataRow[]>(
    "commissionsRawData_idb",
    []
  );

  // Cache da API (persistente)
  const [apiRowsCache, setApiRowsCache, isApiRowsCacheLoading] =
    useIdbKeyState<CommissionDataRow[]>("gplApiRows_idb", []);

  const [apiRangeCache, setApiRangeCache, isApiRangeCacheLoading] =
    useIdbKeyState<GplApiRangeCache>("gplApiRange_idb", {
      fromDraft: "",
      toDraft: "",
      fromApplied: "",
      toApplied: "",
    });

  // ✅ estado inicial vem do localStorage (assim não fica "checking" toda vez)
  const [apiCheckState, setApiCheckState] = useState<ApiCheckState>(() =>
    readApiCheckFromLocalStorage()
  );
  const hasShopeeKeys = apiCheckState === "hasKeys";

  const [isApiLoading, setIsApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiFetchTick, setApiFetchTick] = useState(0);
  const [apiFetchedOnce, setApiFetchedOnce] = useState(false);

  // Draft (inputs)
  const [startDateDraft, setStartDateDraft] = useState<string>("");
  const [endDateDraft, setEndDateDraft] = useState<string>("");

  // Applied (range usado no fetch/cálculos em modo API)
  const [startDateApplied, setStartDateApplied] = useState<string>("");
  const [endDateApplied, setEndDateApplied] = useState<string>("");

  const [groupSize, setGroupSize] = useState<string>("");

  // Calculados
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [gplPeriod, setGplPeriod] = useState<number>(0);
  const [gplMonthly, setGplMonthly] = useState<number>(0);
  const [monthlyRevenue, setMonthlyRevenue] = useState<number>(0);
  const [daysInPeriod, setDaysInPeriod] = useState<number>(0);

  // Avisos (draft)
  const [draftDays, setDraftDays] = useState<number>(0);
  const [showShortPeriodWarning, setShowShortPeriodWarning] = useState(false);
  const [showMaxPeriodWarning, setShowMaxPeriodWarning] = useState(false);

  // Instâncias Evolution + grupos WhatsApp (n8n buscar_grupo)
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

  // Campanhas com tag "Tráfego para Grupos" — dados vêm do cache (IDB); só busca na API ao clicar em Atualizar
  const [traficoGruposCampaigns, setTraficoGruposCampaigns] = useState<TraficoGruposCampaignDetail[]>([]);
  const [traficoGruposLoading, setTraficoGruposLoading] = useState(false);
  const [traficoGruposError, setTraficoGruposError] = useState<string | null>(null);
  const [expandedTraficoCampaigns, setExpandedTraficoCampaigns] = useState<Record<string, boolean>>({});
  const [expandedTraficoAdSets, setExpandedTraficoAdSets] = useState<Record<string, boolean>>({});
  const [selectedTraficoCampaignIds, setSelectedTraficoCampaignIds] = useState<Set<string>>(new Set());
  const [traficoGruposCache, setTraficoGruposCache, isTraficoCacheLoading] = useIdbKeyState<Record<string, { campaigns: TraficoGruposCampaignDetail[]; fetchedAt: string }>>("gpl_trafico_grupos_cache", {});

  // 1) Checar chaves — reaproveita cache; e não volta a "checking" em toda entrada
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

        if (!ok) {
          setApiCheckState("noKeys");
          writeApiCheckToLocalStorage("noKeys");
          return;
        }

        setApiCheckState("hasKeys");
        writeApiCheckToLocalStorage("hasKeys");

        const hasCachedRows = (apiRowsCache?.length ?? 0) > 0;
        const hasCachedRange =
          !!apiRangeCache?.fromApplied && !!apiRangeCache?.toApplied;

        // Se já tem cache (rows + range), não refaz fetch automático ao voltar
        if (hasCachedRows && hasCachedRange) {
          setStartDateDraft(apiRangeCache.fromDraft || apiRangeCache.fromApplied);
          setEndDateDraft(apiRangeCache.toDraft || apiRangeCache.toApplied);
          setStartDateApplied(apiRangeCache.fromApplied);
          setEndDateApplied(apiRangeCache.toApplied);
          setApiFetchedOnce(true);
          return;
        }

        // Primeira entrada (sem cache): busca ontem→ontem
        const y = getYesterday();
        setStartDateDraft((prev) => prev || y);
        setEndDateDraft((prev) => prev || y);
        setStartDateApplied(y);
        setEndDateApplied(y);

        setApiRangeCache({
          fromDraft: y,
          toDraft: y,
          fromApplied: y,
          toApplied: y,
        });

        setApiFetchTick((t) => t + 1);
      } catch {
        if (!alive) return;
        setApiCheckState("noKeys");
        writeApiCheckToLocalStorage("noKeys");
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApiRowsCacheLoading, isApiRangeCacheLoading]);

  // 2) Em modo não-API, applied acompanha o draft
  useEffect(() => {
    if (hasShopeeKeys) return;
    setStartDateApplied(startDateDraft);
    setEndDateApplied(endDateDraft);
  }, [hasShopeeKeys, startDateDraft, endDateDraft]);

  // 3) Validar período (draft) e calcular dias (draft)
  useEffect(() => {
    if (!startDateDraft || !endDateDraft) {
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    const start = new Date(startDateDraft + "T00:00:00");
    const end = new Date(endDateDraft + "T00:00:00");

    if (end < start) {
      setEndDateDraft("");
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    const inclusiveDays = getInclusiveDays(startDateDraft, endDateDraft);

    if (inclusiveDays > 30) {
      setEndDateDraft("");
      setDraftDays(0);
      setShowShortPeriodWarning(false);
      setShowMaxPeriodWarning(false);
      return;
    }

    setDraftDays(inclusiveDays);
    setShowShortPeriodWarning(inclusiveDays < 3);
    setShowMaxPeriodWarning(inclusiveDays === 30);
  }, [startDateDraft, endDateDraft]);

  // 4) Faixa disponível
  const availableDateRange = useMemo(() => {
    if (hasShopeeKeys) {
      const min = get3MonthsAgo();
      const max = getYesterday();
      return { min, max };
    }
    return null as null | { min: string; max: string };
  }, [hasShopeeKeys]);

  // 5) maxEndDate
  const maxEndDate = useMemo(() => {
    const range = availableDateRange;
    if (!startDateDraft || !range) return range?.max || "";

    const start = new Date(startDateDraft + "T00:00:00");
    const maxAllowed = new Date(start);
    maxAllowed.setDate(start.getDate() + 29);

    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, availableDateRange]);

  // 6) Fetch API quando applied mudar
  useEffect(() => {
    if (!hasShopeeKeys) return;
    if (!startDateApplied || !endDateApplied) return;

    let alive = true;

    (async () => {
      setIsApiLoading(true);
      setApiError(null);
      try {
        const res = await fetch(
          `/api/shopee/conversion-report?start=${encodeURIComponent(
            startDateApplied
          )}&end=${encodeURIComponent(endDateApplied)}`
        );
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao buscar dados da Shopee");

        if (!alive) return;

        const rows = (json?.data ?? []) as CommissionDataRow[];

        setApiRowsCache(rows);
        setApiRangeCache({
          fromDraft: startDateDraft || startDateApplied,
          toDraft: endDateDraft || endDateApplied,
          fromApplied: startDateApplied,
          toApplied: endDateApplied,
        });

        setApiFetchedOnce(true);
      } catch (e) {
        if (!alive) return;
        setApiRowsCache([]);
        setApiFetchedOnce(true);
        setApiError(e instanceof Error ? e.message : "Erro");
      } finally {
        if (alive) setIsApiLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasShopeeKeys, startDateApplied, endDateApplied, apiFetchTick]);

  // 7) Fonte efetiva
  const sourceRows = useMemo(() => {
    if (hasShopeeKeys) return apiRowsCache ?? [];
    return idbRawData ?? [];
  }, [hasShopeeKeys, apiRowsCache, idbRawData]);

  // 8) ✅ Filtrar canais + status (NOVO)
  const filteredData = useMemo(() => {
    const src = sourceRows ?? [];

    return src.filter((row) => {
      const chOk = TARGET_CHANNELS.includes(
        normalizeChannel(extractChannel(row as CommissionDataRow))
      );

      const stOk = TARGET_ORDER_STATUSES.includes(
        normalizeOrderStatus(extractOrderStatus(row as CommissionDataRow))
      );

      return chOk && stOk;
    });
  }, [sourceRows]);

  // 9) Range do IDB quando não tem API
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
    const maxAllowed = new Date(start);
    maxAllowed.setDate(start.getDate() + 29);

    const reportMax = new Date(range.max + "T00:00:00");
    const finalMax = maxAllowed < reportMax ? maxAllowed : reportMax;
    return localYMD(finalMax);
  }, [startDateDraft, effectiveRange]);

  // 10) daysInPeriod
  useEffect(() => {
    if (!startDateApplied || !endDateApplied) {
      setDaysInPeriod(0);
      return;
    }
    const start = new Date(startDateApplied + "T00:00:00");
    const end = new Date(endDateApplied + "T00:00:00");
    if (end < start) {
      setDaysInPeriod(0);
      return;
    }
    setDaysInPeriod(getInclusiveDays(startDateApplied, endDateApplied));
  }, [startDateApplied, endDateApplied]);

  // 11) lucro total
  useEffect(() => {
    if (!filteredData || filteredData.length === 0 || !startDateApplied || !endDateApplied) {
      setTotalProfit(0);
      return;
    }

    let profitSum = 0;

    for (const row of filteredData) {
      const dateStr = (row as CommissionDataRow)["Horário do pedido"];
      if (!dateStr) continue;

      const orderDate = new Date(String(dateStr));
      if (Number.isNaN(orderDate.getTime())) continue;

      const orderYMD = localYMD(orderDate);
      if (orderYMD < startDateApplied || orderYMD > endDateApplied) continue;

      profitSum += parseMoneyPt(
        (row as CommissionDataRow)["Comissão líquida do afiliado(R$)"]
      );
    }

    setTotalProfit(profitSum);
  }, [filteredData, startDateApplied, endDateApplied]);

  // 12) GPL
  useEffect(() => {
    const groupNum = parseFloat(groupSize || "0");
    if (isNaN(groupNum) || groupNum <= 0 || daysInPeriod === 0) {
      setGplPeriod(0);
      setGplMonthly(0);
      setMonthlyRevenue(0);
      return;
    }

    const gplInPeriod = totalProfit / groupNum;
    setGplPeriod(gplInPeriod);

    const gplMonth = (gplInPeriod / daysInPeriod) * 30;
    setGplMonthly(gplMonth);

    setMonthlyRevenue(gplMonth * groupNum);
  }, [groupSize, totalProfit, daysInPeriod]);

  // Instâncias Evolution: carregar ao montar
  useEffect(() => {
    let alive = true;
    fetch("/api/evolution/instances")
      .then((r) => r.json())
      .then((data) => {
        if (alive && Array.isArray(data.instances)) setEvolutionInstances(data.instances);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const selectedInstance = evolutionInstances.find((i) => i.id === selectedInstanceId);
  const selectedInstanceName = selectedInstance?.nome_instancia ?? "";

  // Carrega grupos salvos (snapshots) + BASE do backend — sem chamar n8n
  const loadGroupSnapshots = async (instanceId: string, start?: string, end?: string) => {
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const params = new URLSearchParams({ instance_id: instanceId });
      if (start && end) {
        params.set("start", start);
        params.set("end", end);
      }
      const res = await fetch(`/api/gpl/group-snapshots?${params.toString()}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao carregar snapshots");
      const snapshots = Array.isArray(json.snapshots) ? json.snapshots : [];
      const normalized = snapshots.map((s: { date: string; groups: unknown[]; created_at?: string }) => ({
        date: s.date,
        groups: ((s.groups ?? []) as Array<{ id?: string; nome?: string; qtdMembros?: number }>).map((g) => ({
          id: String(g?.id ?? ""),
          nome: String(g?.nome ?? ""),
          qtdMembros: Number(g?.qtdMembros ?? 0),
        })),
      })) as Array<{ date: string; groups: WhatsAppGroup[] }>;
      setGroupSnapshots(normalized);
      const latest = normalized[0];
      const groupsFromSnapshot = latest?.groups ?? [];
      setGroups(groupsFromSnapshot);
      setGroupsCache((prev) => ({ ...prev, [instanceId]: groupsFromSnapshot }));
      setGroupsLastFetchedAt(snapshots[0]?.created_at ?? null);
      setPreviousGroupsForComparison(null);
      const baseRaw = json.base?.groups;
      const baseNormalized = Array.isArray(baseRaw)
        ? (baseRaw as Array<{ id?: string; nome?: string; qtdMembros?: number }>).map((g) => ({
            id: String(g?.id ?? ""),
            nome: String(g?.nome ?? ""),
            qtdMembros: Number(g?.qtdMembros ?? 0),
          }))
        : [];
      setBaseGroups(baseNormalized.length > 0 ? baseNormalized : null);
      const cum = json.cumulative ?? [];
      const cumMap: Record<string, { total_novos: number; total_saidas: number }> = {};
      for (const c of cum) {
        if (c?.group_id) cumMap[c.group_id] = { total_novos: Number(c.total_novos ?? 0), total_saidas: Number(c.total_saidas ?? 0) };
      }
      setGroupCumulative(cumMap);
    } catch (e) {
      setGroups([]);
      setBaseGroups(null);
      setGroupCumulative({});
      setGroupsError(e instanceof Error ? e.message : "Erro ao carregar grupos salvos");
      setGroupsCache((prev) => ({ ...prev, [instanceId]: [] }));
      setGroupSnapshots([]);
      setGroupsLastFetchedAt(null);
    } finally {
      setGroupsLoading(false);
    }
  };

  // Busca grupos na API (n8n) e salva snapshot — só ao clicar em "Atualizar"
  const fetchGroupsForInstance = async (instanceId: string, nomeInstancia: string) => {
    setGroupsLoading(true);
    setGroupsError(null);
    setPreviousGroupsForComparison(groups.length > 0 ? [...groups] : null);
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoAcao: "buscar_grupo", nomeInstancia }),
      });
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

      const saveRes = await fetch("/api/gpl/group-snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instance_id: instanceId, groups: normalized }),
      });
      if (saveRes.ok) {
        setGroupsLastFetchedAt(new Date().toISOString());
        setGroupSnapshots((prev) => [{ date: new Date().toISOString().slice(0, 10), groups: normalized }, ...prev]);
        // Atualiza a base no estado (primeira vez fica salva no backend; aqui só refletimos)
        const start = startDateApplied || getYesterday();
        const end = endDateApplied || getYesterday();
        const params = new URLSearchParams({ instance_id: instanceId });
        if (start && end) {
          params.set("start", start);
          params.set("end", end);
        }
        fetch(`/api/gpl/group-snapshots?${params.toString()}`, { cache: "no-store" })
          .then((r) => r.json())
          .then((data) => {
            const baseRaw = data.base?.groups;
            const baseNorm = Array.isArray(baseRaw)
              ? (baseRaw as Array<{ id?: string; nome?: string; qtdMembros?: number }>).map((g) => ({
                  id: String(g?.id ?? ""),
                  nome: String(g?.nome ?? ""),
                  qtdMembros: Number(g?.qtdMembros ?? 0),
                }))
              : [];
            setBaseGroups(baseNorm.length > 0 ? baseNorm : null);
            const cum = data.cumulative ?? [];
            const cumMap: Record<string, { total_novos: number; total_saidas: number }> = {};
            for (const c of cum) {
              if (c?.group_id) cumMap[c.group_id] = { total_novos: Number(c.total_novos ?? 0), total_saidas: Number(c.total_saidas ?? 0) };
            }
            setGroupCumulative(cumMap);
          })
          .catch(() => {});
      } else {
        setGroupsLastFetchedAt(new Date().toISOString());
        setGroupSnapshots([{ date: new Date().toISOString().slice(0, 10), groups: normalized }]);
      }
    } catch (e) {
      setGroups([]);
      setGroupsError(e instanceof Error ? e.message : "Erro ao buscar grupos");
      setGroupsCache((prev) => ({ ...prev, [instanceId]: [] }));
    } finally {
      setGroupsLoading(false);
    }
  };

  // Ao selecionar instância ou mudar período: carregar do backend (não chama n8n)
  useEffect(() => {
    if (!selectedInstanceId || !selectedInstanceName) {
      setGroups([]);
      setBaseGroups(null);
      setGroupCumulative({});
      setGroupsError(null);
      setGroupSnapshots([]);
      setGroupsLastFetchedAt(null);
      return;
    }
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    loadGroupSnapshots(selectedInstanceId, start, end);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadGroupSnapshots e fetch dependem do período
  }, [selectedInstanceId, selectedInstanceName, startDateApplied, endDateApplied]);

  const filteredGroups = useMemo(() => {
    if (!groupNameFilter.trim()) return groups;
    const q = normalizeStr(groupNameFilter);
    return groups.filter((g) => normalizeStr(g.nome).includes(q));
  }, [groups, groupNameFilter]);

  // Delta de membros: prioridade 1 = BASE (primeira atualização salva), 2 = anterior na tela, 3 = dois snapshots
  const groupMemberDelta = useMemo(() => {
    const map = new Map<string, { anterior: number; delta: number }>();
    let anteriorList: WhatsAppGroup[];
    let atualList: WhatsAppGroup[];
    if (baseGroups !== null) {
      anteriorList = baseGroups;
      atualList = groups;
    } else if (previousGroupsForComparison !== null) {
      anteriorList = previousGroupsForComparison;
      atualList = groups;
    } else if (groupSnapshots.length >= 2) {
      anteriorList = groupSnapshots[groupSnapshots.length - 1].groups;
      atualList = groupSnapshots[0].groups;
    } else {
      return map;
    }
    const porIdAnterior = new Map<string, number>();
    for (const g of anteriorList) porIdAnterior.set(g.id, g.qtdMembros);
    for (const g of atualList) {
      const anterior = porIdAnterior.get(g.id) ?? g.qtdMembros;
      map.set(g.id, { anterior, delta: g.qtdMembros - anterior });
    }
    return map;
  }, [baseGroups, previousGroupsForComparison, groupSnapshots, groups]);

  const totalMembersSelected = useMemo(() => {
    return groups
      .filter((g) => selectedGroupIds.has(g.id))
      .reduce((acc, g) => acc + g.qtdMembros, 0);
  }, [groups, selectedGroupIds]);

  useEffect(() => {
    if (totalMembersSelected > 0) setGroupSize(String(totalMembersSelected));
  }, [totalMembersSelected]);

  const toggleGroupSelection = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTraficoCampaign = (campaignId: string) => {
    setExpandedTraficoCampaigns((prev) => ({ ...prev, [campaignId]: !prev[campaignId] }));
  };
  const toggleTraficoAdSet = (adSetId: string) => {
    setExpandedTraficoAdSets((prev) => ({ ...prev, [adSetId]: !prev[adSetId] }));
  };
  const toggleTraficoCampaignSelection = (campaignId: string) => {
    setSelectedTraficoCampaignIds((prev) => {
      const next = new Set(prev);
      if (next.has(campaignId)) next.delete(campaignId);
      else next.add(campaignId);
      return next;
    });
  };

  const custoTráfegoGrupos = useMemo(() => {
    return traficoGruposCampaigns
      .filter((c) => selectedTraficoCampaignIds.has(c.id))
      .reduce((acc, c) => acc + c.spend, 0);
  }, [traficoGruposCampaigns, selectedTraficoCampaignIds]);

  // Total de cliques no link (Meta): para CPL Meta e Taxa de entrada
  const totalCliquesMeta = useMemo(() => {
    return traficoGruposCampaigns
      .filter((c) => selectedTraficoCampaignIds.has(c.id))
      .reduce((acc, c) => acc + c.adSets.reduce((s, aset) => s + aset.ads.reduce((a, ad) => a + (ad.clicks ?? 0), 0), 0), 0);
  }, [traficoGruposCampaigns, selectedTraficoCampaignIds]);

  // Total de novos (entraram) nos grupos selecionados — acumulado
  const totalNovos = useMemo(() => {
    return groups
      .filter((g) => selectedGroupIds.has(g.id))
      .reduce((acc, g) => acc + (groupCumulative[g.id]?.total_novos ?? 0), 0);
  }, [groups, selectedGroupIds, groupCumulative]);

  const pessoasNoGrupo = useMemo(() => {
    const n = parseInt(String(groupSize).replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : totalMembersSelected;
  }, [groupSize, totalMembersSelected]);

  // Total de saídas (acumulado): soma dos total_saidas dos grupos selecionados — leads perdidos
  const totalSaidas = useMemo(() => {
    return groups
      .filter((g) => selectedGroupIds.has(g.id))
      .reduce((acc, g) => acc + (groupCumulative[g.id]?.total_saidas ?? 0), 0);
  }, [groups, selectedGroupIds, groupCumulative]);

  // CPL Inicial: custo do anúncio ÷ total de entrada (usado também no Prejuízo)
  const cplInicial = useMemo(() => {
    if (custoTráfegoGrupos <= 0 || totalNovos <= 0) return 0;
    return custoTráfegoGrupos / totalNovos;
  }, [custoTráfegoGrupos, totalNovos]);

  // Prejuízo: total de saída × CPL Inicial
  const prejuizoSaidas = useMemo(() => {
    if (totalSaidas <= 0 || cplInicial <= 0) return 0;
    return totalSaidas * cplInicial;
  }, [totalSaidas, cplInicial]);

  // --- Novas métricas do relatório GPL ---
  // CPL Meta: custo por clique no link (Meta Leads) = spend / cliques
  const cplMeta = useMemo(() => {
    if (custoTráfegoGrupos <= 0 || totalCliquesMeta <= 0) return 0;
    return custoTráfegoGrupos / totalCliquesMeta;
  }, [custoTráfegoGrupos, totalCliquesMeta]);

  // CPL Real: custo tráfego ÷ (total de entrada − total de saída)
  const cplReal = useMemo(() => {
    if (custoTráfegoGrupos <= 0) return 0;
    const liquido = totalNovos - totalSaidas;
    if (liquido <= 0) return 0;
    return custoTráfegoGrupos / liquido;
  }, [custoTráfegoGrupos, totalNovos, totalSaidas]);

  // Buscar campanhas com tag "Tráfego para Grupos" — só ao clicar em Atualizar; resultado salvo no cache (IDB)
  const fetchTraficoGrupos = async () => {
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    setTraficoGruposLoading(true);
    setTraficoGruposError(null);
    try {
      const res = await fetch(`/api/ati/trafico-grupos?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar campanhas");
      const campaigns = Array.isArray(json.campaigns) ? json.campaigns : [];
      setTraficoGruposCampaigns(campaigns);
      const periodKey = `${start}_${end}`;
      setTraficoGruposCache((prev) => ({ ...prev, [periodKey]: { campaigns, fetchedAt: new Date().toISOString() } }));
    } catch (e) {
      setTraficoGruposError(e instanceof Error ? e.message : "Erro ao carregar campanhas");
    } finally {
      setTraficoGruposLoading(false);
    }
  };

  // Preencher campanhas do cache quando o período ou o cache mudar
  useEffect(() => {
    if (isTraficoCacheLoading) return;
    const start = startDateApplied || getYesterday();
    const end = endDateApplied || getYesterday();
    const periodKey = `${start}_${end}`;
    const cached = traficoGruposCache[periodKey];
    setTraficoGruposCampaigns(cached?.campaigns ?? []);
  }, [startDateApplied, endDateApplied, traficoGruposCache, isTraficoCacheLoading]);

  const getPerformanceBadge = () => {
    if (gplMonthly >= 1.5) {
      return {
        color: "bg-green-500/20 text-green-400 border-green-500/30",
        text: "🟢 Excelente performance",
      };
    } else if (gplMonthly >= 0.8) {
      return {
        color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
        text: "🟡 Boa performance",
      };
    } else if (gplMonthly > 0) {
      return {
        color: "bg-red-500/20 text-red-400 border-red-500/30",
        text: "🔴 Performance precisa melhorar",
      };
    }
    return null;
  };

  const performanceBadge = getPerformanceBadge();
  const showResults = gplPeriod > 0;

  if (!session) return <LoadingOverlay message="Carregando sessão..." />;

  // ✅ Agora o loading de integração só aparece na PRIMEIRA vez (sem estado salvo)
  if (apiCheckState === "checking") {
    return <LoadingOverlay message="Verificando integração com a Shopee..." />;
  }

  if (!hasShopeeKeys && isDataLoading) return <LoadingOverlay message="Carregando dados..." />;

  const hasAnySource = hasShopeeKeys || (idbRawData && idbRawData.length > 0);

  const hasFilteredData = hasShopeeKeys
    ? apiFetchedOnce
      ? filteredData.length > 0
      : true
    : filteredData.length > 0;

  const channelsLabel = "WhatsApp, Websites e Others";

  const canSearchApi =
    hasShopeeKeys &&
    !!startDateDraft &&
    !!endDateDraft &&
    draftDays > 0 &&
    !isApiLoading &&
    !apiError;

  function onClickBuscar() {
    if (!hasShopeeKeys) return;
    if (!startDateDraft || !endDateDraft) return;

    setStartDateApplied(startDateDraft);
    setEndDateApplied(endDateDraft);

    setApiRangeCache({
      fromDraft: startDateDraft,
      toDraft: endDateDraft,
      fromApplied: startDateDraft,
      toApplied: endDateDraft,
    });

    setApiFetchTick((t) => t + 1);
    if (selectedInstanceId && selectedInstanceName) {
      fetchGroupsForInstance(selectedInstanceId, selectedInstanceName);
    }
  }

  return (
    <div>
      {/* ... resto do seu JSX continua igual daqui pra baixo ... */}
      {/* (mantive exatamente como você enviou) */}

      <style jsx>{`
        input[type="date"]::-webkit-calendar-picker-indicator {
          filter: invert(56%) sepia(93%) saturate(1573%) hue-rotate(358deg)
            brightness(100%) contrast(103%);
          cursor: pointer;
        }
        input[type="date"]:disabled::-webkit-calendar-picker-indicator {
          filter: opacity(0.5);
        }
        .date-empty::-webkit-datetime-edit-text,
        .date-empty::-webkit-datetime-edit-month-field,
        .date-empty::-webkit-datetime-edit-day-field,
        .date-empty::-webkit-datetime-edit-year-field {
          color: rgb(156 163 175) !important;
        }
        .date-filled::-webkit-datetime-edit-text,
        .date-filled::-webkit-datetime-edit-month-field,
        .date-filled::-webkit-datetime-edit-day-field,
        .date-filled::-webkit-datetime-edit-year-field {
          color: rgb(243 244 246) !important;
        }
      `}</style>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-text-primary font-heading">Calculadora GPL</h1>
        <p className="text-text-secondary mt-2">
          Calcule o valor médio que cada lead gera de comissão (Ganho por Lead)
        </p>
        <p className="text-xs text-text-secondary mt-1">
          Métricas dos canais <span className="text-text-primary">{channelsLabel}</span>
        </p>
        {evolutionInstances.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-500/80 shrink-0" />
            <span className="text-xs text-text-secondary">Instância WhatsApp:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedInstanceId("");
                  setSelectedGroupIds(new Set());
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  !selectedInstanceId
                    ? "bg-shopee-orange text-white border border-shopee-orange"
                    : "bg-dark-bg text-text-secondary border border-dark-border hover:border-dark-border hover:text-text-primary"
                }`}
              >
                Nenhuma
              </button>
              {evolutionInstances.map((inst) => (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => {
                    setSelectedInstanceId(inst.id);
                    setSelectedGroupIds(new Set());
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    selectedInstanceId === inst.id
                      ? "bg-shopee-orange text-white border border-shopee-orange"
                      : "bg-dark-bg text-text-secondary border border-dark-border hover:border-dark-border hover:text-text-primary"
                  }`}
                >
                  {inst.nome_instancia}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-dark-card p-6 rounded-lg border border-red-500/30 mb-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">
                Erro ao buscar dados da Shopee
              </h2>
              <p className="text-sm text-text-secondary mt-1">{apiError}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href="/configuracoes"
                  className="px-4 py-2 rounded-lg border border-dark-border text-text-secondary hover:border-shopee-orange hover:text-shopee-orange transition-colors text-sm font-semibold"
                >
                  Ver Configurações
                </Link>
                <button
                  onClick={() => {
                    setApiError(null);
                    setApiFetchTick((t) => t + 1);
                  }}
                  className="px-4 py-2 rounded-lg bg-shopee-orange hover:bg-shopee-orange/90 text-white transition-colors text-sm font-semibold"
                >
                  Tentar novamente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!hasAnySource ? (
        <div className="bg-dark-card p-8 rounded-lg border-2 border-dashed border-dark-border">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="opacity-60">
              <div className="bg-dark-bg p-4 rounded-full mb-4 inline-block">
                <Calculator className="h-12 w-12 text-text-secondary" />
              </div>
              <h2 className="text-xl font-semibold text-text-primary mb-2">
                Relatório necessário
              </h2>
              <p className="text-text-secondary mb-6">
                📊 Para usar esta função, faça upload do relatório na seção
                &quot;Análise de Comissões&quot; ou cadastre suas chaves da Shopee.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 bg-shopee-orange hover:bg-shopee-orange/90 text-white font-semibold rounded-lg transition-colors"
            >
              Ir para Análise de Comissões
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      ) : !hasFilteredData ? (
        <div className="bg-dark-card p-8 rounded-lg border-2 border-dashed border-dark-border">
          <div className="flex flex-col items-center text-center max-w-md mx-auto">
            <div className="bg-dark-bg p-4 rounded-full mb-4 inline-block">
              <Calculator className="h-12 w-12 text-text-secondary" />
            </div>
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              Nenhum pedido nos canais {channelsLabel}
            </h2>
            <p className="text-text-secondary">
              Ajuste o período ou verifique se há pedidos com canal WhatsApp, Websites ou
              Others.
            </p>
          </div>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Coluna Esquerda */}
          <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-6">
              <div className="bg-green-500/10 p-2 rounded">
                <Calculator className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">
                  ✓ Usando dados da Shopee {hasShopeeKeys ? "via API" : "do seu relatório"}
                </h2>
                <p className="text-xs text-text-secondary">Preencha os campos abaixo</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Pessoas */}
              <div>
                <label
                  htmlFor="groupSize"
                  className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"
                >
                  <Users className="h-4 w-4 text-indigo-400" />
                  Pessoas no Grupo
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Total de membros no(s) canal(is) onde você divulga.
                      </p>
                    </div>
                  </button>
                </label>

                <input
                  id="groupSize"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Ex: 4741"
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-bg border border-dark-border rounded-lg text-text-primary focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>

              {/* Período */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                  <Calendar className="h-4 w-4 text-sky-400" />
                  Período de Análise
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Selecione um período de até 30 dias para análise.
                      </p>
                    </div>
                  </button>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="startDate" className="text-xs text-text-secondary mb-1 block">
                      Data Inicial
                    </label>
                    <input
                      id="startDate"
                      type="date"
                      value={startDateDraft}
                      min={effectiveRange?.min}
                      max={effectiveRange?.max}
                      onChange={(e) => setStartDateDraft(e.target.value)}
                      className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all ${
                        startDateDraft ? "date-filled" : "date-empty"
                      }`}
                    />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="text-xs text-text-secondary mb-1 block">
                      Data Final
                    </label>
                    <input
                      id="endDate"
                      type="date"
                      value={endDateDraft}
                      min={startDateDraft || effectiveRange?.min}
                      max={maxEndDateEffective}
                      disabled={!startDateDraft}
                      onChange={(e) => setEndDateDraft(e.target.value)}
                      className={`w-full px-3 py-2 bg-dark-bg border border-dark-border rounded-lg text-sm focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        endDateDraft ? "date-filled" : "date-empty"
                      }`}
                    />
                  </div>
                </div>

                {draftDays > 0 && (
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-text-secondary">
                      Período selecionado: {draftDays} dia(s)
                    </p>

                    {hasShopeeKeys && (
                      <button
                        type="button"
                        onClick={onClickBuscar}
                        disabled={!canSearchApi}
                        className="px-4 py-2 rounded-md bg-shopee-orange text-white text-xs font-semibold hover:opacity-90 disabled:opacity-60 transition-opacity"
                        title="Buscar dados da Shopee no período selecionado"
                      >
                        {isApiLoading ? "Buscando..." : "Buscar"}
                      </button>
                    )}
                  </div>
                )}

                {showShortPeriodWarning && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-400">
                      Atenção: períodos curtos podem gerar projeções imprecisas.
                    </p>
                  </div>
                )}

                {showMaxPeriodWarning && (
                  <div className="flex items-start gap-2 mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                    <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-400">
                      Você atingiu o período máximo de 30 dias.
                    </p>
                  </div>
                )}
              </div>

              {/* Lucro Total */}
              <div>
                <label
                  htmlFor="totalProfit"
                  className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2"
                >
                  <DollarSign className="h-4 w-4 text-green-400" />
                  Lucro Total (Comissão Líquida)
                  <button type="button" className="group relative" aria-label="Informação">
                    <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                      <p className="text-text-primary">
                        Valor total de comissões do período aplicado (calculado automaticamente).
                      </p>
                    </div>
                  </button>
                </label>
                <input
                  id="totalProfit"
                  type="text"
                  value={formatCurrency(totalProfit)}
                  disabled
                  className="w-full px-4 py-3 bg-dark-bg/50 border border-dark-border rounded-lg text-text-primary font-semibold cursor-not-allowed opacity-75"
                />
              </div>

              {/* Custo de Tráfego Para Grupos — aparece ao selecionar campanhas na seção abaixo */}
              {selectedTraficoCampaignIds.size > 0 && (
                <div>
                  <label className="flex items-center gap-2 text-sm font-medium text-text-primary mb-2">
                    <TrendingUp className="h-4 w-4 text-shopee-orange" />
                    Custo de Tráfego Para Grupos
                    <button type="button" className="group relative" aria-label="Informação">
                      <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                        <p className="text-text-primary">
                          Soma do gasto (spend) das campanhas marcadas como &quot;Tráfego para Grupos&quot; selecionadas abaixo, no período.
                        </p>
                      </div>
                    </button>
                  </label>
                  <input
                    type="text"
                    value={formatCurrency(custoTráfegoGrupos)}
                    disabled
                    className="w-full px-4 py-3 bg-dark-bg/50 border border-shopee-orange/30 rounded-lg text-shopee-orange font-semibold cursor-not-allowed opacity-90"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita */}
          <div className="bg-dark-card p-6 rounded-lg border border-dark-border">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5 text-shopee-orange" />
              <h2 className="text-lg font-semibold text-text-primary">Resultados</h2>
            </div>

            {showResults ? (
              <div className="space-y-4">
                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">
                    GPL no período ({daysInPeriod} dia{daysInPeriod !== 1 ? "s" : ""})
                  </p>
                  <p className="text-2xl font-bold text-text-primary">
                    {formatCurrency(gplPeriod)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">por lead</p>
                </div>

                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">GPL por mês projetado</p>
                  <p className="text-2xl font-bold text-shopee-orange">
                    {formatCurrency(gplMonthly)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">por lead/mês</p>
                </div>

                <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                  <p className="text-xs text-text-secondary mb-1.5">Receita mensal estimada</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(monthlyRevenue)}
                  </p>
                  <p className="text-xs text-text-secondary mt-1">total/mês</p>
                </div>

                {performanceBadge && (
                  <div
                    className={`p-3 rounded-lg border text-center text-sm font-semibold ${performanceBadge.color}`}
                  >
                    {performanceBadge.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="bg-dark-bg p-4 rounded-full mb-4">
                  <TrendingUp className="h-10 w-10 text-text-secondary" />
                </div>
                <p className="text-text-secondary">
                  Preencha o número de pessoas do grupo para ver os resultados.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Mini dashboard GPL: apenas as 8 métricas definidas */}
        {traficoGruposCampaigns.length > 0 && (selectedTraficoCampaignIds.size > 0 || pessoasNoGrupo > 0) && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                Custo tráfego
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Valor gasto no anúncio (soma do spend das campanhas selecionadas).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-shopee-orange">{formatCurrency(custoTráfegoGrupos)}</p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                Total de membros
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Quantidade de membros do grupo (grupos selecionados ou campo acima).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-indigo-400">{pessoasNoGrupo.toLocaleString("pt-BR")}</p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                Total de entrada
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Quantidade de membros que entraram até a atualização (acumulado desde a base).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-emerald-400">{totalNovos.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {pessoasNoGrupo > 0 ? `${((totalNovos / pessoasNoGrupo) * 100).toFixed(1)}% dos membros` : "—"}
              </p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                Total de saída
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Quantidade de membros que saíram até a atualização (acumulado desde a base).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-red-400">{totalSaidas.toLocaleString("pt-BR")}</p>
              <p className="text-xs text-text-secondary mt-0.5">
                {pessoasNoGrupo > 0 ? `${((totalSaidas / pessoasNoGrupo) * 100).toFixed(1)}% dos membros` : "—"}
              </p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                CPL Inicial
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Custo do anúncio dividido pelo total de entrada. Fórmula: custo tráfego ÷ total de entrada.</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-amber-400">
                {custoTráfegoGrupos > 0 && totalNovos > 0 ? formatCurrency(cplInicial) : "—"}
              </p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                CPL do Meta
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Custo de leads gerado no Meta (custo por clique no link / lead). Fórmula: custo tráfego ÷ cliques (leads).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-blue-400">
                {custoTráfegoGrupos > 0 && totalCliquesMeta > 0 ? formatCurrency(cplMeta) : "—"}
              </p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-dark-border">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                CPL Real
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Custo do tráfego dividido por (total de entrada menos total de saída). Fórmula: custo tráfego ÷ (entrada − saída).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-emerald-400">
                {cplReal > 0 ? formatCurrency(cplReal) : "—"}
              </p>
            </div>
            <div className="bg-dark-card p-4 rounded-lg border border-red-500/30">
              <p className="text-xs text-text-secondary mb-1 flex items-center gap-1">
                Prejuízo
                <button type="button" className="group relative flex-shrink-0" aria-label="Informação">
                  <Info className="h-4 w-4 text-text-secondary hover:text-text-primary transition-colors" />
                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 bg-dark-tooltip rounded-lg shadow-lg border border-dark-border opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-10 text-xs text-left">
                    <p className="text-text-primary">Total de saída × CPL Inicial (valor perdido com as saídas).</p>
                  </div>
                </button>
              </p>
              <p className="text-xl font-bold text-red-400">
                {totalSaidas > 0 && cplInicial > 0 ? formatCurrency(prejuizoSaidas) : "—"}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {selectedInstanceId ? (
          <div className="bg-dark-card p-5 rounded-lg border border-dark-border">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-emerald-500/80" />
              Grupos desta instância
            </h3>
            <p className="text-xs text-text-secondary mb-1">
              Selecione um ou mais grupos para preencher automaticamente &quot;Pessoas no grupo&quot; com a soma dos membros. Dados vêm do último snapshot salvo; clique em Atualizar para buscar da API.
            </p>
            {groupsLastFetchedAt && (
              <p className="text-xs text-emerald-400/90 mb-2">
                Última atualização: {new Date(groupsLastFetchedAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
            {(startDateApplied && endDateApplied) && groupSnapshots.length >= 2 && (
              <p className="text-xs text-text-secondary mb-2">
                Comparação no período: {formatDateBR(groupSnapshots[groupSnapshots.length - 1]?.date ?? "")} → {formatDateBR(groupSnapshots[0]?.date ?? "")}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                <input
                  type="text"
                  placeholder="Filtrar por nome do grupo"
                  value={groupNameFilter}
                  onChange={(e) => setGroupNameFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-md border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
              </div>
              <button
                type="button"
                onClick={() => selectedInstanceId && selectedInstanceName && fetchGroupsForInstance(selectedInstanceId, selectedInstanceName)}
                disabled={groupsLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-shopee-orange text-white text-sm font-semibold hover:bg-shopee-orange/90 disabled:opacity-50 transition-opacity shrink-0"
              >
                {groupsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Atualizar
              </button>
              {totalMembersSelected > 0 && (
                <p className="text-sm text-emerald-400 font-medium flex items-center gap-1 self-center">
                  <Users className="h-4 w-4" />
                  Total: {totalMembersSelected.toLocaleString("pt-BR")} pessoas
                </p>
              )}
            </div>
            {groupsError && (
              <p className="text-sm text-red-400 mb-3">{groupsError}</p>
            )}
            {groupsLoading ? (
              <div className="flex items-center gap-2 py-6 text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando grupos...
              </div>
            ) : filteredGroups.length === 0 ? (
              <p className="text-sm text-text-secondary py-4">
                {groups.length === 0 ? "Nenhum dado salvo. Clique em Atualizar para buscar grupos da API." : "Nenhum grupo encontrado no filtro."}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {filteredGroups.map((g) => {
                  const cum = groupCumulative[g.id];
                  const delta = groupMemberDelta.get(g.id);
                  const novosValor = cum ? cum.total_novos : (delta !== undefined && delta.delta > 0 ? delta.delta : 0);
                  const sairamValor = cum ? cum.total_saidas : (delta !== undefined && delta.delta < 0 ? Math.abs(delta.delta) : 0);
                  const temComparacao = cum !== undefined || delta !== undefined;
                  const evasao = sairamValor > 0;
                  return (
                  <label
                    key={g.id}
                    className={`flex flex-col p-4 rounded-lg border cursor-pointer transition-colors ${
                      evasao
                        ? "bg-red-500/10 border-red-500/50 hover:bg-red-500/15"
                        : selectedGroupIds.has(g.id)
                          ? "bg-shopee-orange/10 border-shopee-orange/50"
                          : "bg-dark-bg/50 border-dark-border hover:bg-dark-bg"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedGroupIds.has(g.id)}
                        onChange={() => toggleGroupSelection(g.id)}
                        className="mt-0.5 rounded border-dark-border text-shopee-orange focus:ring-shopee-orange"
                      />
                      <span className="text-sm font-medium text-text-primary line-clamp-2 flex-1" title={g.nome}>
                        {g.nome}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary pl-6">
                      {g.qtdMembros.toLocaleString("pt-BR")} membros
                    </p>
                    <p className={`text-xs pl-6 mt-1 flex items-center gap-1.5 font-medium ${novosValor > 0 ? "text-emerald-400" : "text-text-secondary"}`}>
                      <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" />
                      {temComparacao ? `Novos: ${novosValor > 0 ? `+${novosValor}` : "0"}` : "Novos: —"}
                    </p>
                    <p className={`text-xs pl-6 mt-0.5 flex items-center gap-1.5 font-medium ${sairamValor > 0 ? "text-red-400" : "text-text-secondary"}`}>
                      <TrendingDown className="h-3.5 w-3.5 flex-shrink-0" />
                      {temComparacao ? `Saíram: ${sairamValor}` : "Saíram: —"}
                    </p>
                    {evasao && (
                      <p className="text-xs pl-6 mt-2 flex items-start gap-1.5 text-red-400 bg-red-500/10 rounded px-2 py-1.5 border border-red-500/30">
                        <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                        <span>Cuidado, está tendo muita evasão deste grupo.</span>
                      </p>
                    )}
                  </label>
                  );
                })}
              </div>
            )}
          </div>
          ) : (
            <div className="bg-dark-card p-5 rounded-lg border border-dark-border flex flex-col justify-center">
              <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-500/80" />
                Grupos desta instância
              </h3>
              <p className="text-sm text-text-secondary">
                Selecione uma instância acima para listar os grupos do WhatsApp.
              </p>
            </div>
          )}
          <div className="bg-dark-card p-5 rounded-lg border border-dark-border">
            <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-shopee-orange/80" />
              Campanhas de Tráfego para Grupos
            </h3>
            <p className="text-xs text-text-secondary mb-1">
              Selecione as campanhas para somar o custo de tráfego (acima). Marque a tag no ATI para aparecer aqui.
            </p>
            {(startDateApplied && endDateApplied) && (
              <p className="text-xs text-shopee-orange/90 mb-2 font-medium">
                Período: {formatDateBR(startDateApplied)} a {formatDateBR(endDateApplied)}. Só busca na API ao clicar em Atualizar.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button
                type="button"
                onClick={fetchTraficoGrupos}
                disabled={traficoGruposLoading || !startDateApplied || !endDateApplied}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-shopee-orange text-white text-xs font-semibold hover:bg-shopee-orange/90 disabled:opacity-50"
              >
                {traficoGruposLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Atualizar campanhas
              </button>
            </div>
            {traficoGruposError && (
              <p className="text-sm text-red-400 mb-3">{traficoGruposError}</p>
            )}
            {traficoGruposLoading ? (
              <div className="flex items-center gap-2 py-6 text-text-secondary">
                <Loader2 className="h-5 w-5 animate-spin" />
                Carregando campanhas...
              </div>
            ) : traficoGruposCampaigns.length === 0 ? (
              <p className="text-sm text-text-secondary py-4">
                Nenhum dado no cache para este período. Clique em &quot;Atualizar campanhas&quot; para buscar da API. Se já marcou campanhas com a tag no ATI, elas aparecerão aqui.
              </p>
            ) : (
              <div className="space-y-2">
                {traficoGruposCampaigns.map((camp) => {
                  const isOpen = expandedTraficoCampaigns[camp.id];
                  const isSelected = selectedTraficoCampaignIds.has(camp.id);
                  return (
                    <div key={camp.id} className="rounded-lg border border-dark-border bg-dark-bg/30 overflow-hidden">
                      <div className="flex items-center gap-2 p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleTraficoCampaignSelection(camp.id)}
                          className="rounded border-dark-border text-shopee-orange focus:ring-shopee-orange"
                          title="Incluir custo desta campanha no Custo de Tráfego Para Grupos"
                        />
                        <button
                          type="button"
                          onClick={() => toggleTraficoCampaign(camp.id)}
                          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-90"
                        >
                          {isOpen ? (
                            <ChevronUp className="h-4 w-4 flex-shrink-0 text-text-secondary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 flex-shrink-0 text-text-secondary" />
                          )}
                          <span className="text-sm font-semibold text-text-primary truncate" title={camp.name}>{camp.name}</span>
                          <span className={`text-xs font-medium flex-shrink-0 ${camp.status === "ACTIVE" ? "text-emerald-400" : "text-text-secondary"}`}>
                            {camp.status === "ACTIVE" ? "Ativo" : "Pausado"}
                          </span>
                          <span className="text-xs text-shopee-orange font-medium flex-shrink-0">{formatCurrency(camp.spend)}</span>
                        </button>
                        <Link href="/dashboard/ati" className="text-xs text-shopee-orange hover:underline flex-shrink-0">Ver no ATI</Link>
                      </div>
                      {isOpen && (
                        <div className="border-t border-dark-border bg-dark-bg/50">
                          {camp.adSets.map((aset) => {
                            const adSetOpen = expandedTraficoAdSets[aset.id];
                            return (
                              <div key={aset.id} className="border-b border-dark-border/50 last:border-b-0">
                                <button
                                  type="button"
                                  onClick={() => toggleTraficoAdSet(aset.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-left hover:bg-dark-bg/50 border-l-2 border-shopee-orange/50"
                                >
                                  {adSetOpen ? (
                                    <ChevronUp className="h-3.5 w-3.5 text-text-secondary" />
                                  ) : (
                                    <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
                                  )}
                                  <span className="text-sm font-medium text-text-primary truncate">{aset.name}</span>
                                  <span className={`text-xs ${aset.status === "ACTIVE" ? "text-emerald-400" : "text-text-secondary"}`}>{aset.status === "ACTIVE" ? "Ativo" : "Pausado"}</span>
                                  <span className="text-xs text-shopee-orange">{formatCurrency(aset.spend)}</span>
                                </button>
                                {adSetOpen && (
                                  <div className="pl-6 pr-4 py-2 space-y-2 bg-dark-bg/30">
                                    {aset.ads.map((ad) => (
                                      <div key={ad.id} className="flex flex-wrap items-center justify-between gap-2 p-2 rounded border border-dark-border/50 bg-dark-card/50">
                                        <span className="text-sm text-text-primary font-medium truncate flex-1 min-w-0" title={ad.name}>{ad.name}</span>
                                        <div className="flex items-center gap-3 text-xs text-text-secondary flex-shrink-0">
                                          <span title="Gasto">{formatCurrency(ad.spend)}</span>
                                          <span className="flex items-center gap-0.5" title="Cliques"><MousePointerClick className="h-3 w-3" /> {ad.clicks}</span>
                                          <span title="CPC">{formatCurrency(ad.cpc)}</span>
                                          <span className={ad.status === "ACTIVE" ? "text-emerald-400" : "text-text-secondary"}>{ad.status === "ACTIVE" ? "Ativo" : "Pausado"}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}
