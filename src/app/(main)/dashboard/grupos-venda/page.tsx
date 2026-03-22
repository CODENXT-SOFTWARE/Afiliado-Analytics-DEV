"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  MessageCircle, Loader2, Trash2, Send, AlertCircle, Search,
  Clock, PlusCircle, Info, Zap, Tag, RefreshCw,
  Play, Pause, Hash, Layers, X, ChevronLeft, ChevronRight, ChevronDown,
  List as ListIcon, User, Settings2, Smartphone, CheckCheck,
} from "lucide-react";
import BuscarGruposModal, {
  type BuscarGruposPayload,
  type EvolutionInstanceItem,
} from "../gpl/BuscarGruposModal";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ListaGrupos = { id: string; instanceId: string; nomeLista: string; createdAt: string };
type ContinuoItem = {
  id: string; listaId: string | null; listaNome: string;
  listaOfertasId: string | null; listaOfertasNome: string | null;
  instanceId: string; keywords: string[]; subId1: string; subId2: string; subId3: string;
  ativo: boolean; proximoIndice: number; ultimoDisparoAt: string | null; updatedAt: string;
  proximaKeyword: string | null;
  horarioInicio: string | null; horarioFim: string | null;
};
type ListaOfertasItem = { id: string; nome: string; totalItens: number };
type Instance = EvolutionInstanceItem & { id: string };

// ─── Utils ──────────────────────────────────────────────────────────────────────
function cn(...classes: (string | false | undefined | null)[]): string { return classes.filter(Boolean).join(" "); }

// ─── Tooltip (portal) ──────────────────────────────────────────────────────────
function Tooltip({ text, children, wide }: { text: string; children?: React.ReactNode; wide?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const tooltip = visible ? createPortal(
    <span style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
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

// ─── FieldLabel ─────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">{children}</label>;
}

// ─── WizardStepper ──────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 1, label: "Canal" },
  { id: 2, label: "Lista Alvo" },
  { id: 3, label: "Conteúdo" },
  { id: 4, label: "Ativar" },
];

function WizardStepper({ currentStep, onClose }: { currentStep: number; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[#2c2c32]">
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-4 gap-2 sm:hidden">
          {WIZARD_STEPS.map((step) => {
            const isDone = currentStep > step.id;
            const isActive = currentStep === step.id;
            return (
              <div key={step.id} className="flex flex-col items-center gap-1 min-w-0">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2 shrink-0",
                  isDone ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : isActive ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                    : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]")}>
                  {isDone ? <CheckCheck className="w-3 h-3" /> : step.id}
                </div>
                <p className={cn("text-[6px] font-bold uppercase tracking-[0.14em] text-center leading-tight whitespace-normal break-words max-w-full",
                  isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]")}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:flex items-center">
          {WIZARD_STEPS.map((step, index) => {
            const isDone = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isLast = index === WIZARD_STEPS.length - 1;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 shrink-0 min-w-[78px]">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border-2",
                    isDone ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : isActive ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                      : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]")}>
                    {isDone ? <CheckCheck className="w-3.5 h-3.5" /> : step.id}
                  </div>
                  <p className={cn("text-[8px] font-bold uppercase tracking-widest whitespace-nowrap",
                    isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]")}>
                    {step.label}
                  </p>
                </div>
                {!isLast && (
                  <div className={cn("flex-1 h-px mx-3 mb-4 transition-all", isDone ? "bg-emerald-500/35" : "bg-[#2c2c32]")} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onClose} title="Cancelar e voltar ao painel"
        className="text-[#a0a0a0] hover:text-white transition p-1.5 rounded-lg hover:bg-[#222228] shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── DisparoCard ────────────────────────────────────────────────────────────────
function DisparoCard({ c, togglingId, onToggle, onRemove }: {
  c: ContinuoItem; togglingId: string | null;
  onToggle: (id: string, ativar: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const isActive = c.ativo;
  return (
    <div className={cn("bg-[#1c1c1f] border rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-all min-w-0",
      isActive ? "border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "border-[#2c2c32] hover:border-[#3e3e3e]")}>
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <h3 className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight line-clamp-2 flex-1 min-w-0">{c.listaNome}</h3>
        {isActive ? (
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Ativo
          </span>
        ) : (
          <span className="text-[8px] font-bold text-[#a0a0a0] bg-[#121214] border border-[#2c2c32] px-1.5 py-0.5 rounded-full shrink-0">Parado</span>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {c.keywords.length > 0 && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Hash className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">{c.keywords.slice(0, 2).join(", ")}{c.keywords.length > 2 ? ` +${c.keywords.length - 2}` : ""}</span>
          </div>
        )}
        {c.listaOfertasNome && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-words md:truncate">
              Lista: <span className="text-white">{c.listaOfertasNome}</span>
            </span>
          </div>
        )}
        {c.instanceId && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <User className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-all md:truncate">{c.instanceId}</span>
          </div>
        )}
        {c.horarioInicio && c.horarioFim && (
          <div className="flex items-center gap-1.5 text-[9px] min-w-0">
            <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-semibold break-words">{c.horarioInicio} – {c.horarioFim}</span>
          </div>
        )}
        {c.ultimoDisparoAt && (
          <div className="flex items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span className="break-words">Próx: <span className="text-white font-semibold">{new Date(c.ultimoDisparoAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-[#2c2c32]">
        {isActive ? (
          <button onClick={() => onToggle(c.id, false)} disabled={togglingId === c.id}
            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-red-400 border border-red-400/15 bg-red-400/5 py-1.5 rounded-lg hover:bg-red-400/15 disabled:opacity-40 transition">
            {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Pause className="w-2.5 h-2.5 fill-red-400" />}
            Pausar
          </button>
        ) : (
          <button onClick={() => onToggle(c.id, true)} disabled={togglingId === c.id}
            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-400 border border-emerald-500/15 bg-emerald-500/5 py-1.5 rounded-lg hover:bg-emerald-500/15 disabled:opacity-40 transition">
            {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-emerald-400" />}
            Ativar
          </button>
        )}
        <button onClick={() => onRemove(c.id)}
          className="text-[#a0a0a0] hover:text-red-400 transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-red-400/20 shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function GruposVendaPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [listas, setListas] = useState<ListaGrupos[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedListaId, setSelectedListaId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [continuoList, setContinuoList] = useState<ContinuoItem[]>([]);
  const [continuoLoading, setContinuoLoading] = useState(false);
  const [continuoTogglingId, setContinuoTogglingId] = useState<string | null>(null);
  const [deletingListaId, setDeletingListaId] = useState<string | null>(null);
  const [cronTestLoading, setCronTestLoading] = useState(false);
  const [cronTestResult, setCronTestResult] = useState<string | null>(null);
  const [listasOfertas, setListasOfertas] = useState<ListaOfertasItem[]>([]);
  const [loadingListasOfertas, setLoadingListasOfertas] = useState(false);
  const [selectedListaOfertasId, setSelectedListaOfertasId] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");

  // Wizard state
  const [view, setView] = useState<"panel" | "wizard">("panel");
  const [wizardStep, setWizardStep] = useState(1);
  const [showStepInfo, setShowStepInfo] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [contentMode, setContentMode] = useState<"keywords" | "list">("keywords");
  const [scheduleMode, setScheduleMode] = useState<"24h" | "window">("window");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelPage, setPanelPage] = useState(1);
  /** Step 3 mobile: bloco Sub IDs recolhido por padrão */
  const [mobileSubIdsOpen, setMobileSubIdsOpen] = useState(false);
  /** Step 4 mobile: resumo da automação recolhido por padrão */
  const [mobileResumoOpen, setMobileResumoOpen] = useState(false);
  /** Painel: 2 cards/página abaixo de lg; 6 no desktop (lg+, 1024px) */
  const [panelPerPage, setPanelPerPage] = useState(2);

  // ─── API ────────────────────────────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch("/api/evolution/instances");
      const data = await res.json();
      const list = Array.isArray(data.instances) ? data.instances : [];
      const mapped = list.map((i: { id: string; nome_instancia: string; hash?: string | null }) => ({ id: i.id, nome_instancia: i.nome_instancia, hash: i.hash ?? null }));
      setInstances(mapped);
      if (mapped.length > 0 && !selectedInstanceId) setSelectedInstanceId(mapped[0].id);
    } catch { setInstances([]); }
  }, [selectedInstanceId]);

  const loadListas = useCallback(async () => {
    setLoadingListas(true);
    try {
      const url = selectedInstanceId ? `/api/grupos-venda/listas?instanceId=${encodeURIComponent(selectedInstanceId)}` : "/api/grupos-venda/listas";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(data.data) ? data.data : []);
    } catch (e) { setListas([]); setError(e instanceof Error ? e.message : "Erro"); }
    finally { setLoadingListas(false); }
  }, [selectedInstanceId]);

  const loadContinuo = useCallback(async () => {
    setContinuoLoading(true);
    try {
      const res = await fetch("/api/grupos-venda/continuo");
      const data = await res.json();
      if (res.ok) setContinuoList(Array.isArray(data.data) ? data.data : []);
    } catch { setContinuoList([]); }
    finally { setContinuoLoading(false); }
  }, []);

  const loadListasOfertas = useCallback(async () => {
    setLoadingListasOfertas(true);
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas");
      const data = await res.json();
      if (res.ok) setListasOfertas(Array.isArray(data.data) ? data.data : []);
    } catch { setListasOfertas([]); }
    finally { setLoadingListasOfertas(false); }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);
  useEffect(() => { loadListas(); }, [loadListas]);
  useEffect(() => { loadContinuo(); }, [loadContinuo]);
  useEffect(() => { loadListasOfertas(); }, [loadListasOfertas]);

  const handleConfirmGroups = useCallback(async (payload: BuscarGruposPayload) => {
    const instance = instances.find((i) => i.nome_instancia === payload.nomeInstancia);
    if (!instance) { setError("Instância não encontrada."); return; }
    const nomeLista = payload.nomeLista?.trim();
    if (!nomeLista) { setError("Informe o nome da lista."); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/grupos-venda/listas", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: instance.id, nomeLista, groups: payload.grupos.map((g) => ({ id: g.id, nome: g.nome })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao criar lista");
      setFeedback(`Lista "${data.data?.nomeLista ?? nomeLista}" criada com ${data.data?.groupsCount ?? payload.grupos.length} grupo(s).`);
      setTimeout(() => setFeedback(""), 5000);
      loadListas();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar lista"); }
    finally { setSaving(false); }
    setModalOpen(false);
  }, [instances, loadListas]);

  const handleDeleteLista = useCallback(async (id: string) => {
    setDeletingListaId(id);
    try {
      const res = await fetch(`/api/grupos-venda/listas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      loadListas();
      setContinuoList((prev) => prev.filter((c) => c.listaId !== id));
    } catch { setError("Erro ao remover lista"); }
    finally { setDeletingListaId(null); }
  }, [loadListas]);

  const handleDisparar = useCallback(async () => {
    if (!selectedListaId) { setError("Selecione uma lista de grupos."); return; }
    const kwList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (kwList.length === 0) { setError("Digite ao menos uma keyword."); return; }
    setDisparando(true); setError(null); setFeedback("");
    try {
      const res = await fetch("/api/grupos-venda/disparar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listaId: selectedListaId, keywords: kwList, subId1, subId2, subId3 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao disparar");
      const sent = data.sent ?? 0;
      const errList = data.errors ?? [];
      setFeedback(`${sent} oferta(s) enviada(s).${errList.length > 0 ? ` ${errList.length} erro(s).` : ""}`);
      setTimeout(() => setFeedback(""), 8000);
      if (errList.length > 0) setError(errList.map((e: { keyword: string; error: string }) => `${e.keyword}: ${e.error}`).join("; "));
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao disparar"); }
    finally { setDisparando(false); }
  }, [selectedListaId, keywords, subId1, subId2, subId3]);

  const handleContinuoToggle = useCallback(async (configId: string, ativar: boolean) => {
    setContinuoTogglingId(configId); setError(null);
    try {
      if (!ativar) {
        const res = await fetch("/api/grupos-venda/continuo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: configId, ativo: false }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro");
        setFeedback("Disparo 24h pausado.");
      } else {
        const c = continuoList.find((x) => x.id === configId);
        if (!c?.listaId) throw new Error("Config sem lista");
        const res = await fetch("/api/grupos-venda/continuo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: configId, listaId: c.listaId, listaOfertasId: c.listaOfertasId || undefined, keywords: c.keywords, subId1: c.subId1, subId2: c.subId2, subId3: c.subId3, horarioInicio: c.horarioInicio || undefined, horarioFim: c.horarioFim || undefined, ativo: true }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao ativar");
        setFeedback("Disparo 24h ativado.");
      }
      setTimeout(() => setFeedback(""), 4000);
      await loadContinuo();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setContinuoTogglingId(null); }
  }, [continuoList, loadContinuo]);

  const handleAddContinuo = useCallback(async () => {
    if (!selectedListaId) { setError("Selecione uma lista de grupos."); return; }
    const useListaOfertas = !!selectedListaOfertasId;
    const kwList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!useListaOfertas && kwList.length === 0) { setError("Digite ao menos uma keyword ou selecione uma lista de ofertas."); return; }
    setContinuoTogglingId("new"); setError(null);
    try {
      const res = await fetch("/api/grupos-venda/continuo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listaId: selectedListaId, listaOfertasId: useListaOfertas ? selectedListaOfertasId : undefined, keywords: useListaOfertas ? [] : kwList, subId1, subId2, subId3, horarioInicio: horaInicio || undefined, horarioFim: horaFim || undefined, ativo: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro");
      const horarioMsg = horaInicio && horaFim ? ` Ativo das ${horaInicio} às ${horaFim}.` : "";
      setFeedback(useListaOfertas ? `Disparo 24h por lista de ofertas adicionado.${horarioMsg}` : `Disparo 24h adicionado.${horarioMsg}`);
      setTimeout(() => setFeedback(""), 5000);
      setSelectedListaId(""); setKeywords(""); setSelectedListaOfertasId(""); setSubId1(""); setSubId2(""); setSubId3(""); setHoraInicio(""); setHoraFim("");
      setView("panel");
      await loadContinuo();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao adicionar disparo 24h"); }
    finally { setContinuoTogglingId(null); }
  }, [selectedListaId, selectedListaOfertasId, keywords, subId1, subId2, subId3, horaInicio, horaFim, loadContinuo]);

  const handleRemoveContinuo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/grupos-venda/continuo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      loadContinuo();
    } catch { setError("Erro ao remover disparo"); }
  }, [loadContinuo]);

  const handleTestCron = useCallback(async () => {
    setCronTestLoading(true); setCronTestResult(null); setError(null);
    try {
      const res = await fetch("/api/grupos-venda/cron-disparo");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setCronTestResult(`Erro ${res.status}: ${data?.error ?? res.statusText}`); return; }
      const processed = data.processed ?? 0;
      const results = data.results ?? [];
      const okCount = results.filter((r: { ok?: boolean }) => r.ok).length;
      const errCount = results.filter((r: { ok?: boolean }) => !r.ok).length;
      setCronTestResult(`Processados: ${processed}. OK: ${okCount}${errCount > 0 ? `, erros: ${errCount}` : ""}. ${results.length ? results.map((r: { keyword?: string; ok?: boolean; error?: string }) => (r.ok ? `"${r.keyword}" enviado` : `"${r.keyword}": ${r.error}`)).join("; ") : "Nenhum disparo ativo."}`);
      if (processed > 0) loadContinuo();
    } catch (e) { setCronTestResult(`Falha: ${e instanceof Error ? e.message : "Erro ao chamar cron"}`); }
    finally { setCronTestLoading(false); }
  }, [loadContinuo]);

  const activeCount = continuoList.filter((c) => c.ativo).length;
  const keywordCount = keywords.split("\n").filter((k) => k.trim()).length;
  const selectedList = listas.find((l) => l.id === selectedListaId);
  const filteredLists = listas.filter((l) => l.nomeLista.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredDisparos = continuoList.filter((d) =>
    d.listaNome.toLowerCase().includes(panelSearch.toLowerCase()) ||
    d.instanceId?.toLowerCase().includes(panelSearch.toLowerCase())
  );

  const panelTotalPages = Math.max(1, Math.ceil(filteredDisparos.length / panelPerPage));
  const safePanelPage = Math.min(panelPage, panelTotalPages);
  const pagedDisparos = filteredDisparos.slice(
    (safePanelPage - 1) * panelPerPage,
    safePanelPage * panelPerPage,
  );

  useEffect(() => {
    setPanelPage(1);
  }, [panelSearch]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPanelPerPage(mq.matches ? 6 : 2);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setPanelPage((p) => Math.min(p, panelTotalPages));
  }, [panelTotalPages, panelPerPage]);

  useEffect(() => {
    if (wizardStep !== 3) setMobileSubIdsOpen(false);
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep !== 4) setMobileResumoOpen(false);
  }, [wizardStep]);

  const subIdsFilledCount = [subId1, subId2, subId3].filter((s) => s.trim()).length;
  const subIdsMobileSummary =
    subIdsFilledCount === 0
      ? "Opcional — toque para configurar"
      : subIdsFilledCount === 3
        ? "Canal, lista e campanha preenchidos"
        : `${subIdsFilledCount} campo${subIdsFilledCount > 1 ? "s" : ""} preenchido${subIdsFilledCount > 1 ? "s" : ""}`;

  const listaOfertasPickerOptions = useMemo(
    () => [
      {
        value: "",
        label: "Sem lista de ofertas (usa keywords)",
        description: "Envio por keywords em vez de produtos fixos",
      },
      ...listasOfertas.map((l) => ({
        value: l.id,
        label: l.nome,
        description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
      })),
    ],
    [listasOfertas],
  );

  function openWizard() { setWizardStep(1); setShowStepInfo(false); setView("wizard"); }
  function closeWizard() { setShowStepInfo(false); setView("panel"); }
  function handleNext() { setShowStepInfo(false); if (wizardStep < 4) setWizardStep((s) => s + 1); }
  function handleBack() { setShowStepInfo(false); if (wizardStep > 1) setWizardStep((s) => s - 1); }
  function handleFinish() {
    if (wizardStep === 4) {
      if (scheduleMode === "24h") { handleAddContinuo(); }
      else { handleDisparar(); closeWizard(); }
    } else { closeWizard(); }
  }

  const stepMeta: Record<number, { title: string; description: ReactNode }> = {
    1: { title: "Selecionar Canal WhatsApp", description: "Selecione o número do WhatsApp que será usado para disparar mensagens nos grupos. Apenas instâncias conectadas estão disponíveis." },
    2: { title: "Definir Lista de Grupos Alvo", description: (<>Selecione uma lista já salva ou crie uma nova buscando os grupos da instância <span className="text-white font-semibold">{instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? selectedInstanceId}</span>.</>) },
    3: { title: "Configurar Conteúdo e Rastreamento", description: "Defina o que será enviado nos grupos e configure os Sub IDs para rastreamento de vendas por canal." },
    4: { title: "Definir Horário e Ativar Disparo", description: "Defina a janela de funcionamento e escolha como ativar. A automação aparecerá no Painel de Controle após confirmação." },
  };

  return (
    <div className="flex flex-col w-full text-[#f0f0f2]  rounded-lg p-3 sm:p-6 gap-4 sm:gap-5">
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3e3e3e; border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #e24c30; }
      `}</style>

      {/* Header */}
      <header>
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2.5 text-white">
          <div className="p-1.5 bg-[#e24c30]/10 rounded-lg border border-[#e24c30]/20 shrink-0">
            <MessageCircle className="w-4 h-4 text-[#e24c30]" />
          </div>
          Grupos de Venda
        </h1>
        <p className="text-[11px] text-[#a0a0a0] mt-1 leading-relaxed max-md:hidden">
          Dispare ofertas automaticamente em grupos do WhatsApp — uma vez ou em loop 24h.
        </p>
      </header>

      {/* Feedback / Error */}
      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400">{feedback}</p>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {/* Panel view */}
      {view === "panel" && (
        <>
          {/* Criar Nova Automação */}
          <button onClick={openWizard}
            className="w-full flex items-center justify-between bg-[#27272a] border border-[#2c2c32] hover:border-[#e24c30]/40 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 transition-all group gap-3 text-left">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 max-md:items-center">
              <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 group-hover:shadow-lg group-hover:shadow-[#e24c30]/15 transition-all">
                <PlusCircle className="w-4 h-4 text-[#e24c30]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">Criar Nova Automação</p>
                <p className="text-[9px] sm:text-[10px] text-[#a0a0a0] mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none max-md:hidden">Configure instância, lista de grupos, conteúdo e horário passo a passo.</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/10 group-hover:border-[#e24c30]/25 transition-all">
              <ChevronRight className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e24c30] transition-colors" />
            </div>
          </button>

          {/* Painel de Controle */}
          <section className="bg-[#27272a] border border-[#2c2c32] rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#2c2c32]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-[#e24c30]" /> Painel de Controle
                  </h2>
                  <span className="text-[9px] font-bold text-[#a0a0a0] bg-[#222228] border border-[#2c2c32] px-2 py-0.5 rounded-md">{continuoList.length} disparos</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">{activeCount} ativos</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3 h-3 text-[#a0a0a0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} placeholder="Buscar disparo..."
                      className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg pl-7 pr-7 py-2 sm:py-1.5 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                    {panelSearch && (
                      <button onClick={() => setPanelSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleTestCron} disabled={cronTestLoading}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-amber-400 border border-amber-400/25 bg-amber-400/5 px-3 py-2 sm:py-1.5 rounded-lg text-[9px] font-bold hover:bg-amber-400/10 disabled:opacity-40 transition">
                      {cronTestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-amber-400" />}
                      <span className="sm:hidden">Testar</span><span className="hidden sm:inline">Testar agora</span>
                    </button>
                    <button onClick={loadContinuo} disabled={continuoLoading}
                      className="text-[#a0a0a0] hover:text-white transition p-2 sm:p-1.5 rounded-lg hover:bg-[#222228] shrink-0 disabled:opacity-40">
                      <RefreshCw className={cn("w-3.5 h-3.5", continuoLoading && "animate-spin")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {cronTestResult && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-dark-bg border border-dark-border text-xs text-text-primary leading-relaxed">
                {cronTestResult}
              </div>
            )}

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-h-[120px]">
                {continuoLoading ? (
                  <div className="col-span-full flex items-center justify-center gap-2 py-10 text-[#a0a0a0] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : filteredDisparos.length > 0 ? (
                  pagedDisparos.map((item) => (
                    <DisparoCard key={item.id} c={item} togglingId={continuoTogglingId} onToggle={handleContinuoToggle} onRemove={handleRemoveContinuo} />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <Search className="w-7 h-7 text-[#2c2c32]" />
                    <p className="text-[11px] font-semibold text-[#a0a0a0]">
                      {continuoList.length === 0 ? "Nenhum disparo configurado" : "Nenhum disparo encontrado"}
                    </p>
                    <p className="text-[9px] text-[#a0a0a0]/60">
                      {continuoList.length === 0 ? "Clique em \"Criar Nova Automação\" para começar." : "Tente outro título ou instância."}
                    </p>
                  </div>
                )}
              </div>

              {!continuoLoading && filteredDisparos.length > 0 && (
                <div className="mt-4 pt-4 pb-1 border-t border-[#2c2c32] flex flex-col items-center gap-4 lg:mt-3 lg:pt-3 lg:gap-2 px-2 sm:px-4">
                  <p className="text-[11px] lg:text-[9px] text-[#a0a0a0] text-center leading-relaxed lg:leading-snug max-w-md">
                    Mostrando {(safePanelPage - 1) * panelPerPage + 1}–
                    {Math.min(safePanelPage * panelPerPage, filteredDisparos.length)} de {filteredDisparos.length} disparo
                    {filteredDisparos.length !== 1 ? "s" : ""}
                    <span className="text-[#686868]"> · Página {safePanelPage} de {panelTotalPages}</span>
                  </p>
                  <div
                    className="flex items-center justify-center gap-2.5 sm:gap-3 lg:gap-1.5 flex-wrap w-full max-w-md mx-auto"
                    role="navigation"
                    aria-label="Paginação do painel"
                  >
                    <button
                      type="button"
                      onClick={() => setPanelPage((p) => Math.max(1, p - 1))}
                      disabled={safePanelPage <= 1}
                      className="w-9 h-9 sm:w-10 sm:h-10 lg:w-7 lg:h-7 rounded-xl lg:rounded-lg bg-[#1c1c1f] border border-[#2c2c32] flex items-center justify-center text-[#a0a0a0] hover:text-[#f0f0f2] hover:border-[#3e3e3e] disabled:opacity-30 transition shrink-0"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="w-4 h-4 lg:w-3 lg:h-3" />
                    </button>
                    {Array.from({ length: panelTotalPages }, (_, i) => i + 1)
                      .slice(Math.max(0, safePanelPage - 3), Math.min(panelTotalPages, safePanelPage + 2))
                      .map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPanelPage(p)}
                          className={cn(
                            "min-w-[2.25rem] h-9 sm:min-w-10 sm:h-10 lg:min-w-[1.625rem] lg:h-7 px-2 lg:px-1 rounded-xl lg:rounded-lg text-[11px] sm:text-xs lg:text-[10px] font-semibold transition shrink-0",
                            p === safePanelPage
                              ? "bg-[#e24c30] text-white shadow-md shadow-[#e24c30]/25 scale-105 lg:scale-100 lg:shadow-sm"
                              : "bg-[#121214] border border-[#2c2c32] text-[#a0a0a0] hover:text-[#f0f0f2] hover:border-[#3e3e3e]",
                          )}
                        >
                          {p}
                        </button>
                      ))}
                    <button
                      type="button"
                      onClick={() => setPanelPage((p) => Math.min(panelTotalPages, p + 1))}
                      disabled={safePanelPage >= panelTotalPages}
                      className="w-9 h-9 sm:w-10 sm:h-10 lg:w-7 lg:h-7 rounded-xl lg:rounded-lg bg-[#121214] border border-[#2c2c32] flex items-center justify-center text-[#a0a0a0] hover:text-[#f0f0f2] hover:border-[#3e3e3e] disabled:opacity-30 transition shrink-0"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="w-4 h-4 lg:w-3 lg:h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Wizard view */}
      {view === "wizard" && (
        <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col min-w-0">
          <WizardStepper currentStep={wizardStep} onClose={closeWizard} />

          <div className="px-4 sm:px-6 py-4 border-b border-[#2c2c32]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-white leading-snug">{stepMeta[wizardStep].title}</h2>
              <button type="button" onClick={() => setShowStepInfo((v) => !v)}
                className="sm:hidden w-7 h-7 rounded-full border border-[#2c2c32] bg-[#222228] text-[#a0a0a0] hover:text-white hover:border-[#3e3e3e] transition shrink-0">
                ⓘ
              </button>
            </div>
            <p className="hidden sm:block text-[11px] text-[#a0a0a0] leading-relaxed mt-1">{stepMeta[wizardStep].description}</p>
            {showStepInfo && (
              <div className="sm:hidden mt-3 rounded-xl border border-[#2c2c32] bg-[#1c1c1f] px-3 py-2.5 text-[10px] text-[#a0a0a0] leading-relaxed">
                {stepMeta[wizardStep].description}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 sm:p-6 min-w-0">
            {/* Step 1: Selecionar instância */}
            {wizardStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 sm:gap-6">
                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 flex flex-col gap-2 h-fit max-md:hidden">
                  <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">💡 Sobre Instâncias</p>
                  <p className="text-[10px] text-[#a0a0a0] leading-relaxed">Cada instância representa um número de WhatsApp conectado à plataforma. Múltiplas instâncias permitem separar campanhas por conta.</p>
                </div>
                <div className="flex flex-col gap-2.5 min-w-0">
                  {instances.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-[#a0a0a0] text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando instâncias...</div>
                  ) : instances.map((inst) => {
                    const isSelected = selectedInstanceId === inst.id;
                    return (
                      <button key={inst.id} onClick={() => setSelectedInstanceId(inst.id)}
                        className={cn("flex items-start sm:items-center gap-4 p-4 rounded-xl border-2 text-left transition-all min-w-0",
                          isSelected ? "border-[#e24c30] bg-[#e24c30]/5 shadow-lg shadow-[#e24c30]/10"
                            : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]")}>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                          isSelected ? "bg-[#e24c30]/10 border-[#e24c30]/30" : "bg-[#1c1c1f] border-[#2c2c32]")}>
                          <Smartphone className={cn("w-4 h-4", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[12px] font-bold truncate", isSelected ? "text-white" : "text-[#d8d8d8]")}>{inst.nome_instancia}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] text-emerald-400 font-semibold">Conectada</span>
                          </div>
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
              </div>
            )}

            {/* Step 2: Selecionar lista */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-[#a0a0a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Buscar lista por nome..."
                      className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg pl-8 pr-8 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                    {listSearch && <button onClick={() => setListSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition"><X className="w-3 h-3" /></button>}
                  </div>
                  <button onClick={() => setModalOpen(true)}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 shrink-0 bg-[#e24c30]/5 border border-[#e24c30]/25 hover:bg-[#e24c30]/10 hover:border-[#e24c30]/45 rounded-lg px-3.5 py-2.5 sm:py-2 transition-all group">
                    <div className="w-5 h-5 rounded-md bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 transition-all">
                      <PlusCircle className="w-3 h-3 text-[#e24c30]" />
                    </div>
                    <span className="text-[10px] font-bold text-[#e24c30]">Criar nova lista</span>
                  </button>
                </div>

                {loadingListas ? (
                  <div className="flex items-center gap-2 py-4 text-[#a0a0a0] text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando listas...</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-[192px] overflow-y-auto scrollbar-thin pr-1">
                    {filteredLists.length > 0 ? filteredLists.map((list) => {
                      const isSelected = selectedListaId === list.id;
                      return (
                        <button key={list.id} onClick={() => setSelectedListaId(isSelected ? "" : list.id)}
                          className={cn("flex items-center gap-3 p-2.5 rounded-xl border-2 text-left transition-all min-w-0",
                            isSelected ? "border-[#e24c30] bg-[#e24c30]/5" : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]")}>
                          <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border",
                            isSelected ? "bg-[#e24c30]/10 border-[#e24c30]/30" : "bg-[#1c1c1f] border-[#2c2c32]")}>
                            <ListIcon className={cn("w-3.5 h-3.5", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-[11px] font-bold truncate", isSelected ? "text-white" : "text-[#d8d8d8]")}>{list.nomeLista}</p>
                            <p className="text-[9px] text-[#a0a0a0] mt-0.5 truncate">{instances.find((i) => i.id === list.instanceId)?.nome_instancia ?? list.instanceId.slice(0, 8)}</p>
                          </div>
                          {isSelected && <CheckCheck className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />}
                        </button>
                      );
                    }) : (
                      <div className="col-span-full flex flex-col items-center justify-center gap-2 py-8 text-center">
                        <Search className="w-6 h-6 text-[#2c2c32]" />
                        <p className="text-[11px] font-semibold text-[#a0a0a0]">Nenhuma lista encontrada</p>
                        <p className="text-[9px] text-[#a0a0a0]/60">Tente um nome diferente ou crie uma nova lista.</p>
                      </div>
                    )}
                  </div>
                )}

                {saving && <p className="text-xs text-text-secondary flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando lista...</p>}

                {selectedList && (
                  <div className="flex items-start sm:items-center gap-2.5 bg-[#e24c30]/5 border border-[#e24c30]/20 rounded-lg px-4 py-2.5">
                    <CheckCheck className="w-3.5 h-3.5 text-[#e24c30] shrink-0 mt-0.5 sm:mt-0" />
                    <p className="text-[10px] font-semibold text-white leading-relaxed">
                      <span className="text-[#e24c30]">{selectedList.nomeLista}</span> selecionada
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Conteúdo + Sub IDs */}
            {wizardStep === 3 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="flex flex-col gap-3 min-w-0">
                  <FieldLabel>Tipo de Conteúdo</FieldLabel>
                  <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-[#2c2c32]">
                    <button onClick={() => setContentMode("keywords")}
                      className={cn("flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all sm:border-r border-[#2c2c32]",
                        contentMode === "keywords" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white")}>
                      <Hash className="w-3 h-3" /> Keywords
                    </button>
                    <button onClick={() => setContentMode("list")}
                      className={cn("flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 border-[#2c2c32]",
                        contentMode === "list" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white")}>
                      <Layers className="w-3 h-3" /> Lista de Ofertas
                    </button>
                  </div>

                  {contentMode === "keywords" ? (
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <FieldLabel>Keywords (uma por linha)</FieldLabel>
                      <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)}
                        placeholder={"camisa masculina\ntenis corrida\nfone bluetooth"}
                        className="w-full h-[140px] bg-[#222228] border border-[#3e3e3e] rounded-xl p-3.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none resize-none scrollbar-thin leading-relaxed transition" />
                      <p className="text-[9px] text-[#a0a0a0] leading-relaxed">{keywordCount} keyword{keywordCount !== 1 ? "s" : ""} · 1 produto por keyword por grupo.</p>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <FieldLabel>Lista de Ofertas</FieldLabel>
                      {loadingListasOfertas ? (
                        <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas…
                        </div>
                      ) : (
                        <MetaSearchablePicker
                          value={selectedListaOfertasId}
                          onChange={setSelectedListaOfertasId}
                          options={listaOfertasPickerOptions}
                          modalTitle="Lista de ofertas"
                          modalDescription="Escolha uma lista salva em Minha Lista de Ofertas ou use apenas keywords."
                          searchPlaceholder="Filtrar listas…"
                          emptyButtonLabel="Escolher lista de ofertas"
                          emptyAsTag
                          emptyTagLabel="Selecionar Lista"
                          emptyOptionsMessage="Nenhuma lista cadastrada."
                          className="w-full max-w-full"
                        />
                      )}
                      <p className="text-[9px] text-[#a0a0a0] mt-2 leading-relaxed">A lista de ofertas substitui as keywords e envia produtos fixos em rotação.</p>
                    </div>
                  )}
                </div>

                {/* Sub IDs — desktop: sempre expandido */}
                <div className="hidden md:flex flex-col gap-3 min-w-0">
                  <FieldLabel>
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      <Tag className="w-2.5 h-2.5" /> Sub IDs de Rastreamento
                      <span className="text-[8px] normal-case tracking-normal font-normal text-[#a0a0a0] ml-1">(opcional)</span>
                    </span>
                  </FieldLabel>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "Canal", value: subId1, setter: setSubId1, ph: "Ex: Whtasapp" },
                      { label: "Lista", value: subId2, setter: setSubId2, ph: "Ex: Camisa Anime" },
                      { label: "Campanha", value: subId3, setter: setSubId3, ph: "Ex: Natal" },
                    ].map(({ label, value, setter, ph }) => (
                      <div key={label} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-3">
                        <span className="text-[8px] text-[#a0a0a0] uppercase tracking-widest font-bold w-full sm:w-16 shrink-0">{label}</span>
                        <input type="text" value={value} onChange={(e) => setter(e.target.value)} placeholder={ph}
                          className="w-full flex-1 bg-[#222228] border border-[#3e3e3e] rounded-lg px-3 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sub IDs — mobile: dropdown estilo instância, começa recolhido */}
                <div className="md:hidden min-w-0 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setMobileSubIdsOpen((o) => !o)}
                    aria-expanded={mobileSubIdsOpen}
                    className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#1a1a1c] border border-[#2c2c32] px-4 py-3 text-left transition hover:border-[#3e3e3e] active:scale-[0.99]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest flex items-center gap-1.5">
                        <Tag className="w-2.5 h-2.5 text-[#e24c30] shrink-0" />
                        Sub IDs de Rastreamento
                        <span className="text-[8px] normal-case tracking-normal font-normal text-[#a0a0a0]">(opcional)</span>
                      </p>
                      <p className="text-[10px] text-[#f0f0f2] mt-1 truncate">{subIdsMobileSummary}</p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 shrink-0 text-[#f0f0f2] transition-transform duration-200",
                        mobileSubIdsOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>
                  {mobileSubIdsOpen && (
                    <div className="flex flex-col gap-2 pl-0.5 pt-1 border border-[#2c2c32] rounded-xl bg-[#222228]/50 p-3">
                      {[
                        { label: "Canal", value: subId1, setter: setSubId1, ph: "Ex: Whtasapp" },
                        { label: "Lista", value: subId2, setter: setSubId2, ph: "Ex: Camisa Anime" },
                        { label: "Campanha", value: subId3, setter: setSubId3, ph: "Ex: Natal" },
                      ].map(({ label, value, setter, ph }) => (
                        <div key={label} className="flex flex-col gap-1.5">
                          <span className="text-[8px] text-[#a0a0a0] uppercase tracking-widest font-bold">{label}</span>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => setter(e.target.value)}
                            placeholder={ph}
                            className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Horário + Resumo */}
            {wizardStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest leading-relaxed">
                      <Clock className="w-2.5 h-2.5 text-[#e24c30] shrink-0" /> Horário de Funcionamento
                    </label>
                    <div className="flex rounded-lg overflow-hidden border border-[#2c2c32] text-[9px] font-bold self-start sm:self-auto">
                      <button onClick={() => setScheduleMode("window")}
                        className={cn("px-3 py-1.5 transition-all", scheduleMode === "window" ? "bg-[#e24c30]/20 text-[#e24c30]" : "bg-transparent text-[#a0a0a0] hover:text-white")}>
                        JANELA
                      </button>
                      <button onClick={() => setScheduleMode("24h")}
                        className={cn("px-3 py-1.5 border-l border-[#2c2c32] transition-all", scheduleMode === "24h" ? "bg-[#e24c30]/20 text-[#e24c30]" : "bg-transparent text-[#a0a0a0] hover:text-white")}>
                        24H
                      </button>
                    </div>
                  </div>
                  {scheduleMode === "24h" ? (
                    <p className="text-[10px] text-[#a0a0a0] leading-relaxed"><span className="text-emerald-400 font-semibold">✓ Sem restrição</span> — o disparo funciona o dia todo, sem interrupções.</p>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                      <div className="flex-1">
                        <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Início</p>
                        <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
                          className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition" />
                      </div>
                      <span className="hidden sm:block text-[#a0a0a0] mt-4">→</span>
                      <div className="flex-1">
                        <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Fim</p>
                        <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)}
                          className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl min-w-0 overflow-hidden">
                  {/* Mobile: cabeçalho dropdown (começa recolhido) */}
                  <button
                    type="button"
                    onClick={() => setMobileResumoOpen((o) => !o)}
                    aria-expanded={mobileResumoOpen}
                    className="md:hidden w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#1c1c1f]/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">Resumo da Automação</p>
                      <p className="text-[10px] text-[#f0f0f2] mt-1 truncate">
                        {instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? "Canal"}{" "}
                        ·{" "}
                        {contentMode === "keywords"
                          ? `${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}`
                          : "Lista de ofertas"}{" "}
                        · {scheduleMode === "24h" ? "24h" : horaInicio && horaFim ? `${horaInicio}–${horaFim}` : "Janela"}
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 shrink-0 text-[#f0f0f2] transition-transform duration-200",
                        mobileResumoOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>

                  {/* Desktop: título fixo */}
                  <p className="hidden md:block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest px-4 pt-4 mb-4">
                    Resumo da Automação
                  </p>

                  <div
                    className={cn(
                      "flex flex-col gap-3 px-4 pb-4 max-md:border-t max-md:border-[#2c2c32] max-md:pt-3 md:pt-0",
                      !mobileResumoOpen && "max-md:hidden",
                    )}
                  >
                    {[
                      { icon: <Smartphone className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Canal", value: instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? "Não selecionado", warn: !selectedInstanceId },
                      { icon: <ListIcon className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Lista", value: selectedList?.nomeLista ?? null, warn: !selectedList },
                      { icon: <Hash className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Conteúdo", value: contentMode === "keywords" ? `${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}` : "Lista de ofertas", warn: false },
                      { icon: <Clock className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Horário", value: scheduleMode === "24h" ? "24h — sem restrição" : (horaInicio && horaFim ? `${horaInicio} – ${horaFim}` : "Janela configurada"), warn: false },
                    ].map(({ icon, label, value, warn }) => (
                      <div key={label} className="flex items-start gap-3 py-2 border-b border-[#2c2c32] last:border-0 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[#1c1c1f] border border-[#2c2c32] flex items-center justify-center shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] text-[#a0a0a0] uppercase tracking-widest font-bold">{label}</p>
                          {warn ? (
                            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Nenhuma selecionada</p>
                          ) : (
                            <p className="text-[10px] text-white font-semibold mt-0.5 break-words">{value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer wizard */}
          <div className="px-4 sm:px-6 py-4 border-t border-[#2c2c32] bg-[#191920] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-xl sm:rounded-b-2xl">
            <button onClick={handleBack} disabled={wizardStep === 1}
              className={cn("w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border",
                wizardStep === 1 ? "text-[#a0a0a0]/30 border-[#2c2c32]/30 cursor-not-allowed"
                  : "text-[#a0a0a0] border-[#2c2c32] hover:text-white hover:border-[#3e3e3e] bg-[#222228]")}>
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-1.5 mr-2">
                {WIZARD_STEPS.map((s) => (
                  <div key={s.id} className={cn("rounded-full transition-all",
                    s.id === wizardStep ? "w-4 h-1.5 bg-[#e24c30]"
                      : s.id < wizardStep ? "w-1.5 h-1.5 bg-emerald-500/50"
                      : "w-1.5 h-1.5 bg-[#2c2c32]")} />
                ))}
              </div>
              {wizardStep < 4 ? (
                <button onClick={handleNext}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#e24c30] hover:bg-[#c94028] text-white px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg shadow-[#e24c30]/20">
                  Avançar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button onClick={handleFinish} disabled={continuoTogglingId === "new" || disparando}
                  className={cn("w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg group disabled:opacity-40",
                    scheduleMode === "24h"
                      ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 shadow-emerald-500/5"
                      : "bg-[#e24c30]/10 border border-[#e24c30]/25 text-[#e24c30] hover:bg-[#e24c30] hover:text-white shadow-[#e24c30]/5")}>
                  {continuoTogglingId === "new" || disparando ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : scheduleMode === "24h" ? <PlusCircle className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-300" />
                    : <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />}
                  {scheduleMode === "24h" ? "Disparo 24h" : "Disparar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal buscar grupos */}
      <BuscarGruposModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={handleConfirmGroups}
        criarListaMode
        initialInstanceId={selectedInstanceId || undefined}
      />
    </div>
  );
}
