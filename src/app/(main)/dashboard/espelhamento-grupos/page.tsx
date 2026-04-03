"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Loader2,
  PlusCircle,
  Trash2,
  RefreshCw,
  ArrowLeftRight,
  AlertCircle,
  CheckCheck,
  ChevronRight,
  Settings2,
  Smartphone,
  Play,
  Pause,
  X,
  Download,
  Upload,
  Hash,
  ScrollText,
  Info,
  ShieldCheck,
} from "lucide-react";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import BuscarGruposModal, {
  type BuscarGruposPayload,
  type EvolutionInstanceItem,
} from "../gpl/BuscarGruposModal";
import { usePlanEntitlements } from "../PlanEntitlementsContext";
import ProFeatureGate from "../ProFeatureGate";

type Instance = EvolutionInstanceItem & { id: string };

type ConfigRow = {
  id: string;
  instanceId: string;
  nomeInstancia: string;
  grupoOrigemJid: string;
  grupoDestinoJid: string;
  grupoOrigemNome: string | null;
  grupoDestinoNome: string | null;
  subId1: string;
  subId2: string;
  subId3: string;
  ativo: boolean;
  updatedAt: string;
};

type PayloadRow = {
  id: string;
  config_id: string | null;
  status: string;
  grupo_origem_jid: string;
  texto_entrada: string;
  texto_saida: string | null;
  erro_detalhe: string | null;
  created_at: string;
};

type GrupoVendaRow = {
  groupId: string;
};

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">{children}</label>
  );
}

const inputCls =
  "w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg py-2.5 px-3 text-[11px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition";

/** Card de uma config salva — mesmo ritmo visual que DisparoCard em Grupos de Venda */
function EspelhamentoCard({
  group,
  pendingIds,
  onToggleBatch,
  onOpenDetails,
}: {
  group: {
    key: string;
    nomeInstancia: string;
    grupoOrigemNome: string | null;
    grupoOrigemJid: string;
    subId1: string;
    subId2: string;
    subId3: string;
    destinos: ConfigRow[];
  };
  pendingIds: string[];
  onToggleBatch: (ids: string[], ativar: boolean) => void;
  onOpenDetails: (groupKey: string) => void;
}) {
  const total = group.destinos.length;
  const active = group.destinos.filter((d) => d.ativo).length;
  const isAllActive = active === total && total > 0;
  const ids = group.destinos.map((d) => d.id);
  return (
    <div
      className={cn(
        "bg-[#1c1c1f] border rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-all min-w-0",
        isAllActive ? "border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "border-[#2c2c32] hover:border-[#3e3e3e]"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <h3 className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight line-clamp-2 flex-1 min-w-0">
          {group.nomeInstancia}
        </h3>
        {isAllActive ? (
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Todos ativos
          </span>
        ) : (
          <span className="text-[8px] font-bold text-[#a0a0a0] bg-[#121214] border border-[#2c2c32] px-1.5 py-0.5 rounded-full shrink-0">
            {active}/{total} ativos
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-w-0 text-[9px] text-[#a0a0a0]">
        <div className="flex items-start gap-1.5 min-w-0">
          <Download className="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-0.5" />
          <span className="line-clamp-2 break-words">
            <span className="text-emerald-400/90 font-semibold">Origem · </span>
            {group.grupoOrigemNome ?? "Grupo origem"}
          </span>
        </div>
        <div className="flex items-start gap-1.5 min-w-0">
          <Upload className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
          <span className="line-clamp-2 break-words">
            <span className="text-[#e24c30]/90 font-semibold">Destinos · </span>
            {total} grupo{total !== 1 ? "s" : ""}
          </span>
        </div>
        {(group.subId1 || group.subId2 || group.subId3) && (
          <div className="flex items-start gap-1.5 min-w-0">
            <Hash className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span className="line-clamp-1 break-all opacity-90">
              Sub IDs: {[group.subId1, group.subId2, group.subId3].filter(Boolean).join(" · ") || "—"}
            </span>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#2c2c32]">
        <button
          type="button"
          onClick={() => onToggleBatch(ids, true)}
          disabled={ids.some((id) => pendingIds.includes(id))}
          className="w-full flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-400 border border-emerald-500/15 bg-emerald-500/5 py-1.5 rounded-lg hover:bg-emerald-500/15 disabled:opacity-40 transition"
        >
          <Play className="w-2.5 h-2.5 fill-emerald-400" />
          Ativar todos
        </button>
        <button
          type="button"
          onClick={() => onOpenDetails(group.key)}
          className="w-full flex items-center justify-center gap-1 text-[9px] font-bold text-[#a0a0a0] hover:text-white transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-[#3e3e3e]"
          title="Ver mais"
        >
          <ChevronRight className="w-3 h-3" /> Ver mais
        </button>
      </div>
    </div>
  );
}

export default function EspelhamentoGruposPage() {
  const { entitlements } = usePlanEntitlements();
  const [instances, setInstances] = useState<Instance[]>([]);
  const [instanceStatusMap, setInstanceStatusMap] = useState<Record<string, "open" | "close" | null>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [payloads, setPayloads] = useState<PayloadRow[]>([]);
  const [gruposVendaIds, setGruposVendaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingActionIds, setPendingActionIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState<"ativar" | "pausar" | null>(null);

  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");

  const [origem, setOrigem] = useState<{ jid: string; nome: string } | null>(null);
  const [destinos, setDestinos] = useState<{ jid: string; nome: string }[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<"origem" | "destino">("origem");
  const [detailsGroupKey, setDetailsGroupKey] = useState<string | null>(null);
  const [cardsPageIndex, setCardsPageIndex] = useState(0);
  const [itemsPerCardsPage, setItemsPerCardsPage] = useState(2);

  const activeCount = useMemo(() => configs.filter((c) => c.ativo).length, [configs]);
  const configById = useMemo(() => new Map(configs.map((c) => [c.id, c])), [configs]);
  const groupedConfigs = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        nomeInstancia: string;
        grupoOrigemNome: string | null;
        grupoOrigemJid: string;
        subId1: string;
        subId2: string;
        subId3: string;
        destinos: ConfigRow[];
      }
    >();
    for (const c of configs) {
      const key = [c.instanceId, c.grupoOrigemJid, c.subId1, c.subId2, c.subId3].join("::");
      const current = map.get(key);
      if (current) {
        current.destinos.push(c);
      } else {
        map.set(key, {
          key,
          nomeInstancia: c.nomeInstancia,
          grupoOrigemNome: c.grupoOrigemNome,
          grupoOrigemJid: c.grupoOrigemJid,
          subId1: c.subId1,
          subId2: c.subId2,
          subId3: c.subId3,
          destinos: [c],
        });
      }
    }
    return [...map.values()];
  }, [configs]);
  const detailsGroup = useMemo(
    () => groupedConfigs.find((g) => g.key === detailsGroupKey) ?? null,
    [groupedConfigs, detailsGroupKey]
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setItemsPerCardsPage(mq.matches ? 4 : 2);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const totalCardsPages = Math.max(1, Math.ceil(groupedConfigs.length / itemsPerCardsPage));
  const paginatedGroupedConfigs = useMemo(() => {
    const start = cardsPageIndex * itemsPerCardsPage;
    return groupedConfigs.slice(start, start + itemsPerCardsPage);
  }, [groupedConfigs, cardsPageIndex, itemsPerCardsPage]);

  useEffect(() => {
    setCardsPageIndex((p: number) => Math.min(p, Math.max(0, totalCardsPages - 1)));
  }, [groupedConfigs.length, itemsPerCardsPage, totalCardsPages]);
  const sharedGroupsUsed = useMemo(() => {
    const set = new Set<string>();
    for (const gid of gruposVendaIds) {
      const n = gid.trim().toLowerCase();
      if (n) set.add(n);
    }
    for (const c of configs) {
      const n = c.grupoDestinoJid.trim().toLowerCase();
      if (n) set.add(n);
    }
    return set.size;
  }, [configs, gruposVendaIds]);
  const maxSharedGroups = entitlements?.gruposVenda.maxGroupsTotal ?? 0;
  const sharedGroupsRemaining = Math.max(0, maxSharedGroups - sharedGroupsUsed);
  const sharedUsagePercent = maxSharedGroups > 0 ? Math.min(100, Math.round((sharedGroupsUsed / maxSharedGroups) * 100)) : 0;

  const load = useCallback(async (opts?: { soft?: boolean }) => {
    if (opts?.soft) setRefreshing(true);
    else setError(null);
    try {
      const [ir, cr, pr, gr] = await Promise.all([
        fetch("/api/evolution/instances").then((r) => r.json()),
        fetch("/api/espelhamento/config").then((r) => r.json()),
        fetch("/api/espelhamento/payloads?limit=25").then((r) => r.json()),
        fetch("/api/grupos-venda/groups").then((r) => r.json()),
      ]);
      if (Array.isArray(ir.instances)) {
        setInstances(ir.instances as Instance[]);
        setSelectedInstanceId((prev) => {
          if (prev && ir.instances.some((i: Instance) => i.id === prev)) return prev;
          return (ir.instances[0] as Instance | undefined)?.id ?? "";
        });
      }
      if (cr.data) setConfigs(cr.data as ConfigRow[]);
      if (pr.data) setPayloads(pr.data as PayloadRow[]);
      if (Array.isArray(gr?.data)) {
        const ids = (gr.data as GrupoVendaRow[])
          .map((g) => String(g.groupId ?? "").trim())
          .filter(Boolean);
        setGruposVendaIds(ids);
      } else {
        setGruposVendaIds([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadInstanceStatus = useCallback(async (items: Instance[]) => {
    if (items.length === 0) {
      setInstanceStatusMap({});
      return;
    }
    setStatusLoading(true);
    const nextMap: Record<string, "open" | "close" | null> = {};
    const checks = items.map(async (inst) => {
      try {
        const res = await fetch("/api/evolution/n8n-action", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoAcao: "verificar_status",
            nomeInstancia: inst.nome_instancia,
            hash: inst.hash ?? undefined,
          }),
        });
        const json = await res.json();
        const connected = json?.status === "open" || json?.conectado === true;
        nextMap[inst.id] = connected ? "open" : "close";
      } catch {
        nextMap[inst.id] = null;
      }
    });
    await Promise.all(checks);
    setInstanceStatusMap(nextMap);
    setStatusLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadInstanceStatus(instances);
  }, [instances, loadInstanceStatus]);

  const openModal = (t: "origem" | "destino") => {
    setModalTarget(t);
    setModalOpen(true);
  };

  const onModalConfirm = (p: BuscarGruposPayload) => {
    const g = p.grupos[0];
    if (!g) return;
    if (modalTarget === "origem") setOrigem({ jid: g.id, nome: g.nome });
    else {
      const next = p.grupos.map((item) => ({ jid: item.id, nome: item.nome }));
      setDestinos(next);
    }
  };

  const salvarNovo = async () => {
    if (!selectedInstanceId || !origem || destinos.length === 0) {
      setError("Escolha instância, grupo origem e ao menos um grupo destino.");
      return;
    }
    setSaving(true);
    setError(null);
    setFeedback(null);
    try {
      const results = await Promise.all(
        destinos.map(async (destino) => {
          const res = await fetch("/api/espelhamento/config", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              instanceId: selectedInstanceId,
              grupoOrigemJid: origem.jid,
              grupoDestinoJid: destino.jid,
              grupoOrigemNome: origem.nome,
              grupoDestinoNome: destino.nome,
              subId1,
              subId2,
              subId3,
              ativo: false,
            }),
          });
          const j = await res.json().catch(() => ({}));
          return { ok: res.ok, error: j?.error as string | undefined };
        })
      );
      const okCount = results.filter((r) => r.ok).length;
      const fail = results.find((r) => !r.ok);
      if (okCount === 0) throw new Error(fail?.error ?? "Erro ao salvar");
      setOrigem(null);
      setDestinos([]);
      setShowForm(false);
      if (okCount === destinos.length) {
        setFeedback(`${okCount} configuração(ões) criada(s) (inativas). Ative no painel abaixo quando estiver pronto.`);
      } else {
        setFeedback(
          `${okCount} de ${destinos.length} configuração(ões) criada(s). Algumas falharam: ${fail?.error ?? "erro desconhecido"}.`
        );
      }
      await load({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, ativar: boolean) => {
    setTogglingId(id);
    setPendingActionIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    setError(null);
    try {
      const res = await fetch("/api/espelhamento/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ativo: ativar }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Erro");
      await load({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setPendingActionIds((prev) => prev.filter((x) => x !== id));
      setTogglingId(null);
    }
  };

  const handleToggleBatch = async (ids: string[], ativar: boolean) => {
    if (ids.length === 0) return;
    setError(null);
    setBatchLoading(ativar ? "ativar" : "pausar");
    setPendingActionIds((prev) => [...new Set([...prev, ...ids])]);
    try {
      await Promise.all(
        ids.map(async (id) => {
          const res = await fetch("/api/espelhamento/config", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ativo: ativar }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error ?? "Erro");
        })
      );
      setFeedback(
        ativar ? "Todos os destinos deste card foram ativados." : "Todos os destinos deste card foram pausados."
      );
      await load({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setPendingActionIds((prev) => prev.filter((x) => !ids.includes(x)));
      setBatchLoading(null);
      setTogglingId(null);
    }
  };

  const remover = async (id: string) => {
    if (!confirm("Remover esta configuração de espelhamento?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/espelhamento/config?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Erro");
      setFeedback("Configuração removida.");
      await load({ soft: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  };

  const closeForm = () => {
    setShowForm(false);
    setError(null);
    setOrigem(null);
    setDestinos([]);
  };

  if (loading) {
    return (
      <ProFeatureGate feature="espelhamentogrupos">
        <div className="flex flex-col w-full text-[#f0f0f2] rounded-lg p-6">
          <div className="flex items-center justify-center gap-2 py-20 text-[#a0a0a0] text-sm">
            <Loader2 className="w-5 h-5 animate-spin text-[#e24c30]" />
            Carregando…
          </div>
        </div>
      </ProFeatureGate>
    );
  }

  return (
    <ProFeatureGate feature="espelhamentogrupos">
    <div className="flex flex-col w-full text-[#f0f0f2] rounded-lg p-3 sm:p-6 gap-4 sm:gap-5">
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #3e3e3e;
          border-radius: 10px;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #e24c30;
        }
      `}</style>

      <header>
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2.5 text-white">
          <div className="p-1.5 bg-[#e24c30]/10 rounded-lg border border-[#e24c30]/20 shrink-0">
            <ArrowLeftRight className="w-4 h-4 text-[#e24c30]" />
          </div>
          Espelhamento de grupos
        </h1>
        <p className="text-[11px] text-[#a0a0a0] mt-1 leading-relaxed max-w-2xl hidden">
          Copie ofertas do grupo <span className="text-white font-semibold">origem</span> para o{" "}
          <span className="text-white font-semibold">destino</span> trocando links Shopee pelos seus (afiliado). O n8n
          envia mensagens para{" "}
          <code className="text-[10px] bg-[#222228] border border-[#2c2c32] px-1 rounded">/api/espelhamento/n8n/pipeline</code>{" "}
          com Bearer <code className="text-[10px] bg-[#222228] border border-[#2c2c32] px-1 rounded">ESPELHAMENTO_N8N_SECRET</code>.
        </p>
      </header>

      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400 flex-1">{feedback}</p>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-emerald-400/60 hover:text-emerald-400 text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-red-400/60 hover:text-red-400 text-xs shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      {!showForm ? (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setFeedback(null);
            setError(null);
          }}
          className="w-full flex items-center justify-between bg-[#27272a] border border-[#2c2c32] hover:border-[#e24c30]/40 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 transition-all group gap-3 text-left"
        >
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 max-md:items-center">
            <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 group-hover:shadow-lg group-hover:shadow-[#e24c30]/15 transition-all">
              <PlusCircle className="w-4 h-4 text-[#e24c30]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">Nova configuração de espelhamento</p>
              <p className="text-[9px] sm:text-[10px] text-[#a0a0a0] mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none max-md:hidden">
                Instância, grupo de onde copiar, grupo onde publicar e Sub IDs para rastrear vendas.
              </p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/10 group-hover:border-[#e24c30]/25 transition-all">
            <ChevronRight className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e24c30] transition-colors" />
          </div>
        </button>
      ) : (
        <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col min-w-0">
          <div className="px-4 sm:px-6 py-3.5 border-b border-[#2c2c32] flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-white leading-snug">Configurar espelhamento</h2>
              <p className="text-[11px] text-[#a0a0a0] leading-relaxed mt-1">
                Escolha a instância WhatsApp, os grupos origem/destino e opcionalmente Sub IDs (Shopee). Após salvar, ative o espelhamento no painel.
              </p>
            </div>
            <button
              type="button"
              onClick={closeForm}
              title="Fechar"
              className="text-[#a0a0a0] hover:text-white transition p-1.5 rounded-lg hover:bg-[#222228] shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 sm:gap-6">
              <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 flex flex-col gap-2 h-fit max-md:hidden">
                <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest flex items-center gap-1.5">
                  <Info className="w-3 h-3 text-[#e24c30]" /> Sobre o fluxo
                </p>
                <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
                   Só mensagens com link Shopee no texto são
                  convertidas. Respeita o limite de automações do plano e não usa destino já ocupado pelo disparo contínuo
                  de Grupos de Venda.
                </p>
              </div>

              <div className="flex flex-col gap-4 min-w-0">
                <div>
                  <FieldLabel>Instância WhatsApp</FieldLabel>
                  {instances.length === 0 ? (
                    <p className="text-[11px] text-[#a0a0a0] py-2">Nenhuma instância — configure em Configurações → Evolution.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {instances.map((inst) => {
                        const isSelected = selectedInstanceId === inst.id;
                        const instanceStatus = instanceStatusMap[inst.id] ?? null;
                        const statusLabel =
                          instanceStatus === "open" ? "Conectada" : instanceStatus === "close" ? "Desconectada" : "Não verificado";
                        const statusClass =
                          instanceStatus === "open"
                            ? "text-emerald-400"
                            : instanceStatus === "close"
                              ? "text-rose-400"
                              : "text-[#a0a0a0]";
                        return (
                          <button
                            key={inst.id}
                            type="button"
                            onClick={() => setSelectedInstanceId(inst.id)}
                            className={cn(
                              "flex items-start sm:items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all min-w-0",
                              isSelected
                                ? "border-[#e24c30] bg-[#e24c30]/5 shadow-lg shadow-[#e24c30]/10"
                                : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]"
                            )}
                          >
                            <div
                              className={cn(
                                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                isSelected ? "bg-[#e24c30]/10 border-[#e24c30]/30" : "bg-[#1c1c1f] border-[#2c2c32]"
                              )}
                            >
                              <Smartphone className={cn("w-4 h-4", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-[12px] font-bold truncate", isSelected ? "text-white" : "text-[#d8d8d8]")}>
                                {inst.nome_instancia}
                              </p>
                              <span className={cn("text-[9px]", statusClass)}>
                                Status: {statusLoading && instanceStatus === null ? "Verificando..." : statusLabel}
                              </span>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-[#e24c30] flex items-center justify-center shrink-0">
                                <CheckCheck className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel>Sub ID 1 (opcional)</FieldLabel>
                    <input className={inputCls} value={subId1} onChange={(e) => setSubId1(e.target.value)} placeholder="Ex: espelho" />
                  </div>
                  <div>
                    <FieldLabel>Sub ID 2</FieldLabel>
                    <input className={inputCls} value={subId2} onChange={(e) => setSubId2(e.target.value)} />
                  </div>
                  <div>
                    <FieldLabel>Sub ID 3</FieldLabel>
                    <input className={inputCls} value={subId3} onChange={(e) => setSubId3(e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={() => openModal("origem")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-emerald-500/25 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/40 py-3 px-4 text-[11px] font-bold text-emerald-400 transition"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    Grupo origem (copiar)
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal("destino")}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border-2 border-[#e24c30]/25 bg-[#e24c30]/5 hover:bg-[#e24c30]/10 hover:border-[#e24c30]/40 py-3 px-4 text-[11px] font-bold text-[#e24c30] transition"
                  >
                    <Upload className="w-4 h-4 shrink-0" />
                    Grupo destino (publicar)
                  </button>
                </div>

                {(origem || destinos.length > 0) && (
                  <div className="rounded-xl border border-[#2c2c32] bg-[#121214]/80 p-3 space-y-2 text-[10px]">
                    {origem && (
                      <p className="text-[#a0a0a0]">
                        <span className="text-emerald-400 font-bold">Origem · </span>
                        {origem.nome}
                      </p>
                    )}
                    {destinos.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[#e24c30] font-bold">Destinos selecionados · {destinos.length}</p>
                        <div className="max-h-24 overflow-y-auto scrollbar-thin space-y-1 pr-1">
                          {destinos.map((d) => (
                            <p key={d.jid} className="text-[#a0a0a0]">
                              {d.nome}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={saving || !selectedInstanceId || !origem || destinos.length === 0}
                    onClick={salvarNovo}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#e24c30] px-5 py-2.5 text-[11px] font-bold text-white hover:opacity-90 disabled:opacity-40 shadow-lg shadow-[#e24c30]/20 transition"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
                    Adicionar Espelhamento
                  </button>
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-xl border border-[#2c2c32] px-5 py-2.5 text-[11px] font-semibold text-[#a0a0a0] hover:bg-[#222228] hover:text-white transition"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="bg-[#27272a] border border-[#2c2c32] rounded-xl overflow-hidden">
        <div className="px-4 sm:px-5 py-3.5 border-b border-[#2c2c32]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5 text-[#e24c30]" />
                Painel de espelhamentos
              </h2>
              <span className="hidden text-[9px] font-bold text-[#a0a0a0] bg-[#222228] border border-[#2c2c32] px-2 py-0.5 rounded-md">
                {configs.length} regra{configs.length !== 1 ? "s" : ""}
              </span>
              <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">
                {activeCount} ativo{activeCount !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={() => load({ soft: true })}
              disabled={refreshing}
              className="text-[#a0a0a0] hover:text-white transition p-2 rounded-lg hover:bg-[#222228] shrink-0 disabled:opacity-40"
              title="Atualizar"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-4 rounded-xl border border-[#2c2c32] bg-[#1c1c1f] p-3.5 hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#e24c30]" />
                  Saldo compartilhado de grupos
                </p>
              
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-white bg-[#222228] border border-[#2c2c32] px-2 py-1 rounded-md">
                  {sharedGroupsUsed}/{maxSharedGroups || "—"}
                </span>
                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-md">
                  {sharedGroupsRemaining} livres
                </span>
              </div>
            </div>

            <div className="mt-3 h-2 rounded-full bg-[#121214] border border-[#2c2c32] overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all",
                  sharedUsagePercent >= 90 ? "bg-red-500/80" : sharedUsagePercent >= 70 ? "bg-amber-500/80" : "bg-emerald-500/80"
                )}
                style={{ width: `${sharedUsagePercent}%` }}
              />
            </div>
            <p className="text-[9px] text-[#868686] mt-1.5">
              Uso atual: {sharedUsagePercent}% do limite do seu plano.
            </p>
          </div>

          {configs.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <ArrowLeftRight className="w-8 h-8 text-[#2c2c32]" />
              <p className="text-[11px] font-semibold text-[#a0a0a0]">Nenhuma regra de espelhamento</p>
              <p className="text-[9px] text-[#a0a0a0]/60 max-w-xs">
                Use &quot;Nova configuração de espelhamento&quot; acima para criar a primeira.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
                {paginatedGroupedConfigs.map((group) => (
                  <EspelhamentoCard
                    key={group.key}
                    group={group}
                    pendingIds={pendingActionIds}
                    onToggleBatch={handleToggleBatch}
                    onOpenDetails={setDetailsGroupKey}
                  />
                ))}
              </div>
              {totalCardsPages > 1 && (
                <nav
                  className="mt-4 pt-4 pb-1 border-t border-[#2c2c32] lg:mt-3 lg:pt-3 px-2 sm:px-4"
                  aria-label="Paginação das regras de espelhamento"
                >
                  <GeradorPaginationBar
                    page={cardsPageIndex + 1}
                    totalPages={totalCardsPages}
                    summary={`Mostrando ${cardsPageIndex * itemsPerCardsPage + 1}–${Math.min((cardsPageIndex + 1) * itemsPerCardsPage, groupedConfigs.length)} de ${groupedConfigs.length} ${groupedConfigs.length === 1 ? "regra" : "regras"}`}
                    onPrev={() => setCardsPageIndex((p: number) => Math.max(0, p - 1))}
                    onNext={() => setCardsPageIndex((p: number) => Math.min(totalCardsPages - 1, p + 1))}
                  />
                </nav>
              )}
            </>
          )}
        </div>
      </section>

      <section className="bg-[#27272a] border border-[#2c2c32] rounded-xl overflow-hidden hidden">
        <div className="px-4 sm:px-5 py-3 border-b border-[#2c2c32] flex items-center gap-2">
          <ScrollText className="w-3.5 h-3.5 text-[#e24c30]" />
          <h2 className="text-[10px] font-bold text-white uppercase tracking-widest">Últimos eventos (pipeline)</h2>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto scrollbar-thin">
          {payloads.length === 0 ? (
            <p className="text-[11px] text-[#a0a0a0] text-center py-8">
              Nenhum evento ainda. Quando o n8n chamar o pipeline, os registros aparecem aqui.
            </p>
          ) : (
            <ul className="space-y-2">
              {payloads.map((p) => (
                (() => {
                  const linkedConfig =
                    (p.config_id ? configById.get(p.config_id) : undefined) ??
                    configs.find((c) => c.grupoOrigemJid === p.grupo_origem_jid);
                  const origemNome = linkedConfig?.grupoOrigemNome ?? "Grupo origem";
                  const destinoNome = linkedConfig?.grupoDestinoNome ?? "Grupo destino";
                  return (
                <li
                  key={p.id}
                  className="rounded-lg border border-[#2c2c32] bg-[#1c1c1f] p-3 text-[10px] leading-relaxed"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span
                      className={cn(
                        "font-bold text-[9px] uppercase tracking-wide px-2 py-0.5 rounded-md border",
                        p.status === "enviado" && "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                        p.status === "ignorado" && "text-[#a0a0a0] border-[#2c2c32] bg-[#121214]",
                        p.status === "erro" && "text-red-400 border-red-500/30 bg-red-500/10"
                      )}
                    >
                      {p.status}
                    </span>
                    <span className="text-[#a0a0a0]">{new Date(p.created_at).toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-2">
                      <p className="text-[9px] text-emerald-400 font-semibold truncate">{origemNome}</p>
                    </div>
                    <div className="rounded-lg border border-red-500/25 bg-red-500/5 p-2">
                      <p className="text-[9px] text-red-400 font-semibold truncate">{destinoNome}</p>
                    </div>
                  </div>
                  {p.erro_detalhe && <p className="text-red-300/90 mt-2 text-[9px] break-all">{p.erro_detalhe}</p>}
                </li>
                  );
                })()
              ))}
            </ul>
          )}
        </div>
      </section>

      <BuscarGruposModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={onModalConfirm}
        initialInstanceId={selectedInstanceId || undefined}
      />

      {detailsGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#1b1b1e] border border-[#2c2c32] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[#2c2c32] flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold text-white uppercase tracking-wide">
                  Destinos do espelhamento
                </p>
                <p className="text-[10px] text-[#a0a0a0]">
                  {detailsGroup.grupoOrigemNome ?? "Grupo origem"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailsGroupKey(null)}
                className="text-[#a0a0a0] hover:text-white transition p-1.5 rounded-lg hover:bg-[#222228]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => handleToggleBatch(detailsGroup.destinos.map((d) => d.id), true)}
                  disabled={batchLoading !== null}
                  className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-bold text-emerald-400 disabled:opacity-50"
                >
                  {batchLoading === "ativar" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-emerald-400" />}{" "}
                  Ativar todos
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleBatch(detailsGroup.destinos.map((d) => d.id), false)}
                  disabled={batchLoading !== null}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold text-red-400 disabled:opacity-50"
                >
                  {batchLoading === "pausar" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3 fill-red-400" />}{" "}
                  Pausar todos
                </button>
              </div>
              <div className="max-h-[45vh] overflow-y-auto scrollbar-thin space-y-2">
                {detailsGroup.destinos.map((d) => (
                  <div key={d.id} className="rounded-lg border border-[#2c2c32] bg-[#121214] p-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-[10px] text-white font-semibold">
                          {d.grupoDestinoNome ?? "Grupo destino"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          className={cn(
                            "text-[8px] font-bold px-1.5 py-0.5 rounded-md border",
                            d.ativo
                              ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
                              : "text-[#a0a0a0] border-[#2c2c32] bg-[#1c1c1f]"
                          )}
                        >
                          {d.ativo ? "Ativo" : "Parado"}
                        </span>
                        {d.ativo ? (
                          <button
                            type="button"
                            onClick={() => handleToggle(d.id, false)}
                            disabled={pendingActionIds.includes(d.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[9px] font-bold text-red-400 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            {pendingActionIds.includes(d.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3 fill-red-400" />}{" "}
                            Pausar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleToggle(d.id, true)}
                            disabled={pendingActionIds.includes(d.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400 hover:bg-emerald-500/15 disabled:opacity-50"
                          >
                            {pendingActionIds.includes(d.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-emerald-400" />}{" "}
                            Ativar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => remover(d.id)}
                          className="inline-flex items-center gap-1 rounded-md border border-red-500/20 bg-red-500/5 px-2 py-1 text-[9px] font-bold text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3 h-3" /> Excluir
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </ProFeatureGate>
  );
}
