"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Send,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Pencil,
  Play,
  Pause,
  Clock,
  Hash,
  Layers,
  User,
  ChevronLeft,
  ChevronRight,
  X,
  Smartphone,
  ListChecks,
  FileText,
  Tag,
  Settings2,
  Search,
  PlusCircle,
  CheckCheck,
  Zap,
  ListChecks as ListIcon,
} from "lucide-react";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";
import { isGruposVendaMlOfferBlocked, MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";

// ─── Types ─────────────────────────────────────────────────────────────────────
type TelegramBot = {
  id: string;
  bot_username: string;
  bot_name: string;
  ativo: boolean;
  webhook_set_at: string | null;
};

type ListaResumo = { id: string; nome_lista: string; bot_id: string; groups_count: number };
type OfertaListaItem = { id: string; nome: string; totalItens?: number };

type TelegramGrupo = {
  id: string;
  bot_id: string;
  lista_id: string | null;
  chat_id: string;
  group_name: string;
  ultima_mensagem_em: string | null;
};

type AutomacaoRow = {
  id: string;
  listaId: string | null;
  listaNome: string;
  botId: string;
  botUsername: string | null;
  botName: string | null;
  listaOfertasId: string | null;
  listaOfertasNome: string | null;
  listaOfertasMlId: string | null;
  listaOfertasMlNome: string | null;
  listaOfertasInfoId: string | null;
  listaOfertasInfoNome: string | null;
  keywords: string[];
  subId1: string;
  subId2: string;
  subId3: string;
  ativo: boolean;
  proximoIndice: number;
  ultimoDisparoAt: string | null;
  proximaKeyword: string | null;
  horarioInicio: string | null;
  horarioFim: string | null;
};

type ContentMode = "keywords" | "list";
type OfferSource = "shopee" | "ml" | "crossover" | "infoprodutor";

const WIZARD_STEPS = [
  { id: 1, label: "Bot" },
  { id: 2, label: "Lista Alvo" },
  { id: 3, label: "Conteúdo" },
  { id: 4, label: "Ativar" },
] as const;

// ─── Utils ──────────────────────────────────────────────────────────────────────
function cn(...c: (string | false | undefined | null)[]): string {
  return c.filter(Boolean).join(" ");
}

function detectPlatformFromAutomacao(c: AutomacaoRow): { showShopee: boolean; showMl: boolean; showInfo: boolean } {
  const hasShopeeList = !!c.listaOfertasId;
  const hasMlList = !!c.listaOfertasMlId;
  const hasInfoList = !!c.listaOfertasInfoId;
  const keywordsAsShopee = c.keywords.length > 0 && !hasShopeeList && !hasMlList && !hasInfoList;
  return {
    showShopee: hasShopeeList || keywordsAsShopee,
    showMl: hasMlList,
    showInfo: hasInfoList,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════════
export default function TelegramAutomacoesClient() {
  const [view, setView] = useState<"panel" | "wizard">("panel");

  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [listas, setListas] = useState<ListaResumo[]>([]);
  const [automacoes, setAutomacoes] = useState<AutomacaoRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedBotId, setSelectedBotId] = useState("");
  const [selectedListaId, setSelectedListaId] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [contentMode, setContentMode] = useState<ContentMode>("keywords");
  const [offerSource, setOfferSource] = useState<OfferSource>("shopee");
  const [keywords, setKeywords] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [horaInicio, setHoraInicio] = useState("08:00");
  const [horaFim, setHoraFim] = useState("22:00");
  const [selectedListaShopeeId, setSelectedListaShopeeId] = useState("");
  const [selectedListaMlId, setSelectedListaMlId] = useState("");
  const [selectedListaInfoId, setSelectedListaInfoId] = useState("");
  const [saving, setSaving] = useState(false);

  // Listas de ofertas
  const [listasOfertasShopee, setListasOfertasShopee] = useState<OfertaListaItem[]>([]);
  const [listasOfertasMl, setListasOfertasMl] = useState<OfertaListaItem[]>([]);
  const [listasOfertasInfo, setListasOfertasInfo] = useState<OfertaListaItem[]>([]);
  const [loadingShopee, setLoadingShopee] = useState(false);
  const [loadingMl, setLoadingMl] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // Painel
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [panelStatusFilter, setPanelStatusFilter] = useState<"all" | "active" | "paused">("all");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelPage, setPanelPage] = useState(1);
  const [panelPerPage, setPanelPerPage] = useState(2);
  const [cronTestLoading, setCronTestLoading] = useState(false);
  const [cronTestFeedback, setCronTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  // Modal Buscar Grupos / Criar Lista
  const [criarListaModalOpen, setCriarListaModalOpen] = useState(false);
  const [editingListaId, setEditingListaId] = useState<string | null>(null);
  const [editingListaPrefill, setEditingListaPrefill] = useState<{
    nome_lista: string;
    chat_ids: string[];
  } | null>(null);
  const [listaDeleteConfirm, setListaDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);
  const [deletingListaId, setDeletingListaId] = useState<string | null>(null);

  // Alerts
  const [alertListaOpen, setAlertListaOpen] = useState(false);
  const [alertContentOpen, setAlertContentOpen] = useState(false);
  const [alertContentMsg, setAlertContentMsg] = useState("");

  // 2 cards/page mobile, 6 desktop
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPanelPerPage(mq.matches ? 6 : 2);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setPanelPage(1);
  }, [panelSearch, panelStatusFilter]);

  const filteredAutomacoes = useMemo(() => {
    return automacoes.filter((d) => {
      if (panelStatusFilter === "active" && !d.ativo) return false;
      if (panelStatusFilter === "paused" && d.ativo) return false;
      const q = panelSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        d.listaNome.toLowerCase().includes(q) ||
        (d.botUsername ?? "").toLowerCase().includes(q) ||
        (d.botName ?? "").toLowerCase().includes(q)
      );
    });
  }, [automacoes, panelStatusFilter, panelSearch]);

  const panelTotalPages = Math.max(1, Math.ceil(filteredAutomacoes.length / panelPerPage));
  const safePanelPage = Math.min(panelPage, panelTotalPages);
  const pagedAutomacoes = useMemo(
    () => filteredAutomacoes.slice((safePanelPage - 1) * panelPerPage, safePanelPage * panelPerPage),
    [filteredAutomacoes, safePanelPage, panelPerPage]
  );

  const activeCount = useMemo(() => automacoes.filter((a) => a.ativo).length, [automacoes]);

  // ─── Loading data ──────────────────────────────────────────────────────────
  const loadAutomacoes = useCallback(async () => {
    try {
      const r = await fetch("/api/telegram/continuo");
      const j = await r.json();
      if (r.ok) setAutomacoes(Array.isArray(j.data) ? j.data : []);
    } catch {
      /* silencioso */
    }
  }, []);

  const loadBotsELista = useCallback(async () => {
    setLoading(true);
    try {
      const [botsRes, listasRes] = await Promise.all([
        fetch("/api/telegram/bots"),
        fetch("/api/telegram/listas"),
      ]);
      const bJson = await botsRes.json();
      const lJson = await listasRes.json();
      setBots(Array.isArray(bJson.bots) ? bJson.bots : []);
      setListas(Array.isArray(lJson.data) ? lJson.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadListasOfertas = useCallback(async () => {
    try {
      setLoadingShopee(true);
      setLoadingMl(true);
      setLoadingInfo(true);
      const [rs, rm, ri] = await Promise.all([
        fetch("/api/shopee/minha-lista-ofertas/listas"),
        fetch("/api/mercadolivre/minha-lista-ofertas/listas"),
        fetch("/api/infoprodutor/minha-lista-ofertas/listas"),
      ]);
      const [js, jm, ji] = await Promise.all([rs.json(), rm.json(), ri.json()]);
      setListasOfertasShopee(Array.isArray(js.data) ? js.data : []);
      setListasOfertasMl(Array.isArray(jm.data) ? jm.data : []);
      setListasOfertasInfo(Array.isArray(ji.data) ? ji.data : []);
    } finally {
      setLoadingShopee(false);
      setLoadingMl(false);
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadBotsELista();
    loadAutomacoes();
    loadListasOfertas();
  }, [loadBotsELista, loadAutomacoes, loadListasOfertas]);

  const listasDoBot = useMemo(() => {
    if (!selectedBotId) return [] as ListaResumo[];
    return listas.filter((l) => l.bot_id === selectedBotId);
  }, [listas, selectedBotId]);

  const filteredListasDoBot = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return listasDoBot;
    return listasDoBot.filter((l) => l.nome_lista.toLowerCase().includes(q));
  }, [listasDoBot, listSearch]);

  const botById = useMemo(() => {
    const m = new Map<string, TelegramBot>();
    bots.forEach((b) => m.set(b.id, b));
    return m;
  }, [bots]);

  // ─── Wizard navigation ────────────────────────────────────────────────────
  const resetWizard = useCallback(() => {
    setWizardStep(1);
    setEditingId(null);
    setSelectedBotId(bots[0]?.id ?? "");
    setSelectedListaId("");
    setListSearch("");
    setContentMode("keywords");
    setOfferSource("shopee");
    setKeywords("");
    setSubId1("");
    setSubId2("");
    setSubId3("");
    setHoraInicio("08:00");
    setHoraFim("22:00");
    setSelectedListaShopeeId("");
    setSelectedListaMlId("");
    setSelectedListaInfoId("");
  }, [bots]);

  const openNewWizard = () => {
    if (bots.length === 0) {
      setError("Conecte um bot Telegram em Configurações antes de criar uma automação.");
      return;
    }
    resetWizard();
    setError(null);
    setOk(null);
    setView("wizard");
  };

  const openEditWizard = (a: AutomacaoRow) => {
    setEditingId(a.id);
    setSelectedBotId(a.botId);
    setSelectedListaId(a.listaId ?? "");
    setListSearch("");
    setSubId1(a.subId1 ?? "");
    setSubId2(a.subId2 ?? "");
    setSubId3(a.subId3 ?? "");
    setHoraInicio(a.horarioInicio ?? "08:00");
    setHoraFim(a.horarioFim ?? "22:00");

    if (a.listaOfertasInfoId) {
      setContentMode("list");
      setOfferSource("infoprodutor");
      setSelectedListaInfoId(a.listaOfertasInfoId);
      setSelectedListaShopeeId("");
      setSelectedListaMlId("");
      setKeywords("");
    } else if (a.listaOfertasId && a.listaOfertasMlId) {
      setContentMode("list");
      setOfferSource("crossover");
      setSelectedListaShopeeId(a.listaOfertasId);
      setSelectedListaMlId(a.listaOfertasMlId);
      setSelectedListaInfoId("");
      setKeywords("");
    } else if (a.listaOfertasMlId) {
      setContentMode("list");
      setOfferSource("ml");
      setSelectedListaMlId(a.listaOfertasMlId);
      setSelectedListaShopeeId("");
      setSelectedListaInfoId("");
      setKeywords("");
    } else if (a.listaOfertasId) {
      setContentMode("list");
      setOfferSource("shopee");
      setSelectedListaShopeeId(a.listaOfertasId);
      setSelectedListaMlId("");
      setSelectedListaInfoId("");
      setKeywords("");
    } else {
      setContentMode("keywords");
      setOfferSource("shopee");
      setKeywords((a.keywords ?? []).join("\n"));
      setSelectedListaShopeeId("");
      setSelectedListaMlId("");
      setSelectedListaInfoId("");
    }

    setWizardStep(1);
    setError(null);
    setOk(null);
    setView("wizard");
  };

  const closeWizard = () => {
    setView("panel");
    resetWizard();
  };

  const advanceStep = () => {
    if (wizardStep === 1) {
      if (!selectedBotId) {
        setAlertContentMsg("Selecione um bot pra continuar.");
        setAlertContentOpen(true);
        return;
      }
      setWizardStep(2);
      setError(null);
    } else if (wizardStep === 2) {
      if (!selectedListaId) {
        setAlertListaOpen(true);
        return;
      }
      setWizardStep(3);
      setError(null);
    } else if (wizardStep === 3) {
      if (contentMode === "keywords") {
        const list = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
        if (list.length === 0) {
          setAlertContentMsg("Adicione pelo menos uma keyword pra avançar.");
          setAlertContentOpen(true);
          return;
        }
      } else {
        if (isGruposVendaMlOfferBlocked(offerSource)) {
          setAlertContentMsg("Mercado Livre e Crossover estão em breve. Use Shopee, Infoprodutor ou keywords.");
          setAlertContentOpen(true);
          return;
        }
        if (offerSource === "shopee" && !selectedListaShopeeId) {
          setAlertContentMsg("Selecione uma lista de ofertas Shopee.");
          setAlertContentOpen(true);
          return;
        }
        if (offerSource === "ml" && !selectedListaMlId) {
          setAlertContentMsg("Selecione uma lista de ofertas Mercado Livre.");
          setAlertContentOpen(true);
          return;
        }
        if (offerSource === "crossover" && (!selectedListaShopeeId || !selectedListaMlId)) {
          setAlertContentMsg("No Crossover, selecione uma lista Shopee e uma lista Mercado Livre.");
          setAlertContentOpen(true);
          return;
        }
        if (offerSource === "infoprodutor" && !selectedListaInfoId) {
          setAlertContentMsg("Selecione uma lista do Infoprodutor.");
          setAlertContentOpen(true);
          return;
        }
      }
      setWizardStep(4);
      setError(null);
    }
  };

  const goBack = () => {
    if (wizardStep > 1) setWizardStep((s) => (s - 1) as 1 | 2 | 3 | 4);
  };

  const handleFinish = async () => {
    const jErr = mensagemErroJanela(horaInicio, horaFim);
    if (jErr) {
      setError(jErr);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const keywordsList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
      const useShopee = contentMode === "list" && (offerSource === "shopee" || offerSource === "crossover");
      const useMl = contentMode === "list" && (offerSource === "ml" || offerSource === "crossover");
      const useInfo = contentMode === "list" && offerSource === "infoprodutor";
      const useListaOfertas = useShopee || useMl || useInfo;

      const payload: Record<string, unknown> = {
        listaId: selectedListaId,
        keywords: useListaOfertas ? [] : keywordsList,
        subId1,
        subId2,
        subId3,
        listaOfertasId: useShopee ? selectedListaShopeeId : "",
        listaOfertasMlId: useMl ? selectedListaMlId : "",
        listaOfertasInfoId: useInfo ? selectedListaInfoId : "",
        horarioInicio: horaInicio,
        horarioFim: horaFim,
        ativo: true,
      };
      if (editingId) {
        payload.id = editingId;
        payload.updateOnly = true;
      }
      const r = await fetch("/api/telegram/continuo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao salvar");
      setOk(editingId ? "Automação atualizada." : "Nova automação criada e ativada.");
      closeWizard();
      loadAutomacoes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  // ─── Card actions ──────────────────────────────────────────────────────────
  const togglePauseResume = async (id: string, ativar: boolean) => {
    const a = automacoes.find((x) => x.id === id);
    if (!a) return;
    setTogglingId(id);
    setError(null);
    setOk(null);
    try {
      const body: Record<string, unknown> = ativar
        ? {
            id,
            listaId: a.listaId,
            listaOfertasId: a.listaOfertasId,
            listaOfertasMlId: a.listaOfertasMlId,
            listaOfertasInfoId: a.listaOfertasInfoId,
            keywords: a.keywords,
            subId1: a.subId1,
            subId2: a.subId2,
            subId3: a.subId3,
            horarioInicio: a.horarioInicio,
            horarioFim: a.horarioFim,
            ativo: true,
          }
        : { id, ativo: false };
      const r = await fetch("/api/telegram/continuo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro");
      setAutomacoes((prev) => prev.map((x) => (x.id === id ? { ...x, ativo: ativar } : x)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setTogglingId(null);
    }
  };

  const removeAutomacao = async (id: string) => {
    const a = automacoes.find((x) => x.id === id);
    if (!a) return;
    if (!confirm(`Excluir esta automação? "${a.listaNome}"`)) return;
    setRemovingId(id);
    try {
      const r = await fetch(`/api/telegram/continuo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro");
      setAutomacoes((prev) => prev.filter((x) => x.id !== id));
      setOk("Automação excluída.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setRemovingId(null);
    }
  };

  const testarDisparo = async (id: string) => {
    setTestingId(id);
    setError(null);
    setOk(null);
    try {
      const r = await fetch("/api/telegram/cron-disparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ configId: id }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro");
      const result = j?.results?.[0];
      if (result?.ok) {
        setOk(`Teste OK: ${result.sent ?? 0} mensagem(ns) enviada(s).`);
      } else if (result) {
        setError(`Teste falhou: ${result.error ?? "erro desconhecido"}`);
      } else {
        setError(j?.message ?? "Sem resultado");
      }
      loadAutomacoes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setTestingId(null);
    }
  };

  const handleTestCron = async () => {
    setCronTestLoading(true);
    setCronTestFeedback(null);
    try {
      const r = await fetch("/api/telegram/cron-disparo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await r.json();
      if (!r.ok) {
        setCronTestFeedback({ ok: false, message: j?.error ?? "Erro ao executar cron" });
      } else {
        const total = j?.processed ?? 0;
        const okCount = Array.isArray(j?.results) ? j.results.filter((x: { ok: boolean }) => x.ok).length : 0;
        if (total === 0) {
          setCronTestFeedback({ ok: true, message: j?.message ?? "Nenhuma automação ativa pra processar." });
        } else {
          setCronTestFeedback({ ok: okCount > 0, message: `${okCount}/${total} automaç${total === 1 ? "ão" : "ões"} disparou(aram).` });
        }
        loadAutomacoes();
      }
    } catch (e) {
      setCronTestFeedback({ ok: false, message: e instanceof Error ? e.message : "Erro" });
    } finally {
      setCronTestLoading(false);
    }
  };

  // ─── Lista CRUD via modal ─────────────────────────────────────────────────
  const openCriarLista = () => {
    setEditingListaId(null);
    setEditingListaPrefill(null);
    setCriarListaModalOpen(true);
  };

  const openEditarLista = async (listaId: string) => {
    setError(null);
    try {
      const r = await fetch(`/api/telegram/listas?id=${encodeURIComponent(listaId)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao carregar lista");
      const data = j.data as { nome_lista: string; bot_id: string; groups: { chat_id: string }[] };
      setEditingListaId(listaId);
      setEditingListaPrefill({ nome_lista: data.nome_lista, chat_ids: data.groups.map((g) => g.chat_id) });
      setSelectedBotId(data.bot_id);
      setCriarListaModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleListaSaved = (saved: { id: string; nome_lista: string; groups_count: number; bot_id: string }) => {
    setCriarListaModalOpen(false);
    setEditingListaId(null);
    setEditingListaPrefill(null);
    setOk(`Lista "${saved.nome_lista}" ${editingListaId ? "atualizada" : "criada"} com ${saved.groups_count} grupo(s).`);
    setSelectedListaId(saved.id);
    loadBotsELista();
  };

  const handleDeleteLista = async (id: string) => {
    setDeletingListaId(id);
    try {
      const r = await fetch(`/api/telegram/listas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? "Erro ao excluir");
      if (selectedListaId === id) setSelectedListaId("");
      setListas((prev) => prev.filter((l) => l.id !== id));
      setOk("Lista removida.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setDeletingListaId(null);
      setListaDeleteConfirm(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section className="space-y-3">
      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 text-xs">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}
      {ok && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {ok}
        </div>
      )}

      {view === "panel" && (
        <>
          {/* Botão "Criar Nova Automação" — espelho exato do WhatsApp */}
          <button
            onClick={openNewWizard}
            className="w-full flex items-center justify-between bg-[#27272a] border border-[#2c2c32] hover:border-[#e24c30]/40 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 transition-all group gap-3 text-left"
          >
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 max-md:items-center">
              <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 group-hover:shadow-lg group-hover:shadow-[#e24c30]/15 transition-all">
                <PlusCircle className="w-4 h-4 text-[#e24c30]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">Criar Nova Automação</p>
                <p className="text-[9px] sm:text-[10px] text-[#a0a0a0] mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none max-md:hidden">
                  Configure bot, lista de grupos, conteúdo e horário passo a passo.
                </p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/10 group-hover:border-[#e24c30]/25 transition-all">
              <ChevronRight className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e24c30] transition-colors" />
            </div>
          </button>

          {/* Painel de Controle */}
          <PanelView
            loading={loading}
            automacoes={automacoes}
            filteredAutomacoes={filteredAutomacoes}
            pagedAutomacoes={pagedAutomacoes}
            activeCount={activeCount}
            panelStatusFilter={panelStatusFilter}
            setPanelStatusFilter={setPanelStatusFilter}
            panelSearch={panelSearch}
            setPanelSearch={setPanelSearch}
            panelPage={safePanelPage}
            panelTotalPages={panelTotalPages}
            panelPerPage={panelPerPage}
            setPanelPage={setPanelPage}
            cronTestLoading={cronTestLoading}
            cronTestFeedback={cronTestFeedback}
            onTestCron={handleTestCron}
            togglingId={togglingId}
            removingId={removingId}
            testingId={testingId}
            onRefresh={() => {
              loadBotsELista();
              loadAutomacoes();
            }}
            onToggle={togglePauseResume}
            onRemove={removeAutomacao}
            onTest={testarDisparo}
            onEdit={openEditWizard}
          />
        </>
      )}

      {view === "wizard" && (
        <WizardView
          step={wizardStep}
          editingId={editingId}
          bots={bots}
          listasDoBot={filteredListasDoBot}
          allListasDoBot={listasDoBot}
          listSearch={listSearch}
          setListSearch={setListSearch}
          botById={botById}
          selectedBotId={selectedBotId}
          setSelectedBotId={(id) => {
            setSelectedBotId(id);
            setSelectedListaId("");
          }}
          selectedListaId={selectedListaId}
          setSelectedListaId={setSelectedListaId}
          contentMode={contentMode}
          setContentMode={setContentMode}
          offerSource={offerSource}
          setOfferSource={setOfferSource}
          keywords={keywords}
          setKeywords={setKeywords}
          subId1={subId1}
          subId2={subId2}
          subId3={subId3}
          setSubId1={setSubId1}
          setSubId2={setSubId2}
          setSubId3={setSubId3}
          horaInicio={horaInicio}
          horaFim={horaFim}
          setHoraInicio={setHoraInicio}
          setHoraFim={setHoraFim}
          listasOfertasShopee={listasOfertasShopee}
          listasOfertasMl={listasOfertasMl}
          listasOfertasInfo={listasOfertasInfo}
          loadingShopee={loadingShopee}
          loadingMl={loadingMl}
          loadingInfo={loadingInfo}
          selectedListaShopeeId={selectedListaShopeeId}
          selectedListaMlId={selectedListaMlId}
          selectedListaInfoId={selectedListaInfoId}
          setSelectedListaShopeeId={setSelectedListaShopeeId}
          setSelectedListaMlId={setSelectedListaMlId}
          setSelectedListaInfoId={setSelectedListaInfoId}
          deletingListaId={deletingListaId}
          saving={saving}
          onClose={closeWizard}
          onBack={goBack}
          onAdvance={advanceStep}
          onFinish={handleFinish}
          onCriarLista={openCriarLista}
          onEditarLista={(id) => void openEditarLista(id)}
          onConfirmDeleteLista={(id, nome) => setListaDeleteConfirm({ id, nome })}
        />
      )}

      {/* Modal Criar/Editar Lista (Buscar Grupos do Telegram) */}
      {criarListaModalOpen && (
        <BuscarGruposTelegramModal
          bots={bots}
          initialBotId={selectedBotId || bots[0]?.id || ""}
          editingListaId={editingListaId}
          editingPrefill={editingListaPrefill}
          onClose={() => {
            setCriarListaModalOpen(false);
            setEditingListaId(null);
            setEditingListaPrefill(null);
          }}
          onSaved={handleListaSaved}
        />
      )}

      {/* Confirmar exclusão de lista */}
      {listaDeleteConfirm && (
        <ConfirmDialog
          title="Apagar lista?"
          message={
            <>
              A lista <span className="font-semibold text-white">«{listaDeleteConfirm.nome}»</span> será removida permanentemente.
              Os grupos descobertos pelo bot continuam existindo, apenas ficam sem lista. Automações que a usem deixarão de ter esta lista.
            </>
          }
          confirmLabel="Apagar lista"
          danger
          onCancel={() => setListaDeleteConfirm(null)}
          onConfirm={() => void handleDeleteLista(listaDeleteConfirm.id)}
          loading={!!deletingListaId}
        />
      )}

      {alertListaOpen && (
        <AlertModal
          title="Lista de grupos alvo"
          icon={<ListIcon className="h-5 w-5 text-[#e24c30]" />}
          message="Por favor, para continuar, selecione uma das suas listas! Se ainda não tem, clique em 'Criar nova lista'."
          onClose={() => setAlertListaOpen(false)}
        />
      )}
      {alertContentOpen && (
        <AlertModal
          title="Conteúdo incompleto"
          icon={<Hash className="h-5 w-5 text-[#e24c30]" />}
          message={alertContentMsg}
          onClose={() => setAlertContentOpen(false)}
        />
      )}
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Painel
// ═══════════════════════════════════════════════════════════════════════════════
function PanelView({
  loading,
  automacoes,
  filteredAutomacoes,
  pagedAutomacoes,
  activeCount,
  panelStatusFilter,
  setPanelStatusFilter,
  panelSearch,
  setPanelSearch,
  panelPage,
  panelTotalPages,
  panelPerPage,
  setPanelPage,
  cronTestLoading,
  cronTestFeedback,
  onTestCron,
  togglingId,
  removingId,
  testingId,
  onRefresh,
  onToggle,
  onRemove,
  onTest,
  onEdit,
}: {
  loading: boolean;
  automacoes: AutomacaoRow[];
  filteredAutomacoes: AutomacaoRow[];
  pagedAutomacoes: AutomacaoRow[];
  activeCount: number;
  panelStatusFilter: "all" | "active" | "paused";
  setPanelStatusFilter: (v: "all" | "active" | "paused") => void;
  panelSearch: string;
  setPanelSearch: (v: string) => void;
  panelPage: number;
  panelTotalPages: number;
  panelPerPage: number;
  setPanelPage: (updater: (p: number) => number) => void;
  cronTestLoading: boolean;
  cronTestFeedback: { ok: boolean; message: string } | null;
  onTestCron: () => void;
  togglingId: string | null;
  removingId: string | null;
  testingId: string | null;
  onRefresh: () => void;
  onToggle: (id: string, ativar: boolean) => void;
  onRemove: (id: string) => void;
  onTest: (id: string) => void;
  onEdit: (a: AutomacaoRow) => void;
}) {
  return (
    <section className="bg-[#27272a] border border-[#2c2c32] rounded-xl overflow-hidden">
      <div className="px-4 sm:px-5 py-3.5 border-b border-[#2c2c32]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Settings2 className="w-3.5 h-3.5 text-[#e24c30]" /> Painel de Controle
            </h2>
            <span className="text-[9px] font-bold text-[#a0a0a0] bg-[#222228] border border-[#2c2c32] px-2 py-0.5 rounded-md">
              {automacoes.length} disparos
            </span>
            <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">
              {activeCount} ativos
            </span>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por status">
              {(
                [
                  { id: "all" as const, label: "Todos" },
                  { id: "active" as const, label: "Ativos" },
                  { id: "paused" as const, label: "Parados" },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPanelStatusFilter(id)}
                  className={cn(
                    "text-[9px] font-bold px-2.5 py-1 rounded-full border transition",
                    panelStatusFilter === id
                      ? id === "active"
                        ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                        : id === "paused"
                          ? "bg-[#2c2c32] border-[#3e3e3e] text-[#d0d0d0]"
                          : "bg-[#e24c30]/15 border-[#e24c30]/35 text-[#e24c30]"
                      : "bg-transparent border-[#2c2c32] text-[#a0a0a0] hover:text-white hover:border-[#3e3e3e]"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="w-3 h-3 text-[#a0a0a0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={panelSearch}
                onChange={(e) => setPanelSearch(e.target.value)}
                placeholder="Buscar disparo..."
                className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg pl-7 pr-7 py-2 sm:py-1.5 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
              />
              {panelSearch && (
                <button
                  type="button"
                  onClick={() => setPanelSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onTestCron}
                disabled={cronTestLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-amber-400 border border-amber-400/25 bg-amber-400/5 px-3 py-2 sm:py-1.5 rounded-lg text-[9px] font-bold hover:bg-amber-400/10 disabled:opacity-40 transition"
              >
                {cronTestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-amber-400" />}
                <span className="sm:hidden">Testar</span>
                <span className="hidden sm:inline">Testar agora</span>
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="text-[#a0a0a0] hover:text-white transition p-2 sm:p-1.5 rounded-lg hover:bg-[#222228] shrink-0 disabled:opacity-40"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {cronTestFeedback && (
        <div
          className={cn(
            "mx-4 mt-3 p-3 rounded-xl border text-xs font-semibold leading-relaxed",
            cronTestFeedback.ok
              ? "bg-emerald-500/8 border-emerald-500/35 text-emerald-300"
              : "bg-red-500/8 border-red-500/35 text-red-300"
          )}
        >
          {cronTestFeedback.message}
        </div>
      )}

      <div className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-h-[120px]">
          {loading ? (
            <div className="col-span-full flex items-center justify-center gap-2 py-10 text-[#a0a0a0] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : filteredAutomacoes.length > 0 ? (
            pagedAutomacoes.map((a) => (
              <DisparoCardTelegram
                key={a.id}
                c={a}
                togglingId={togglingId}
                testingId={testingId}
                removingId={removingId}
                onToggle={onToggle}
                onRemove={onRemove}
                onEdit={() => onEdit(a)}
                onTest={onTest}
              />
            ))
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Search className="w-7 h-7 text-[#2c2c32]" />
              <p className="text-[11px] font-semibold text-[#a0a0a0]">
                {automacoes.length === 0 ? "Nenhum disparo configurado" : "Nenhum disparo encontrado"}
              </p>
              <p className="text-[9px] text-[#a0a0a0]/60">
                {automacoes.length === 0
                  ? 'Clique em "Criar Nova Automação" para começar.'
                  : "Tente outro termo ou troque o filtro."}
              </p>
            </div>
          )}
        </div>

        {!loading && filteredAutomacoes.length > 0 && (
          <nav className="mt-4 pt-4 pb-1 border-t border-[#2c2c32] lg:mt-3 lg:pt-3 px-2 sm:px-4" aria-label="Paginação do painel">
            <GeradorPaginationBar
              page={panelPage}
              totalPages={panelTotalPages}
              summary={`Mostrando ${(panelPage - 1) * panelPerPage + 1}–${Math.min(panelPage * panelPerPage, filteredAutomacoes.length)} de ${filteredAutomacoes.length} disparo${filteredAutomacoes.length !== 1 ? "s" : ""}`}
              onPrev={() => setPanelPage((p) => Math.max(1, p - 1))}
              onNext={() => setPanelPage((p) => Math.min(panelTotalPages, p + 1))}
            />
          </nav>
        )}
      </div>
    </section>
  );
}

// ─── Card de automação Telegram ────────────────────────────────────────────────
function DisparoCardTelegram({
  c,
  togglingId,
  testingId,
  removingId,
  onToggle,
  onRemove,
  onEdit,
  onTest,
}: {
  c: AutomacaoRow;
  togglingId: string | null;
  testingId: string | null;
  removingId: string | null;
  onToggle: (id: string, ativar: boolean) => void;
  onRemove: (id: string) => void;
  onEdit: () => void;
  onTest: (id: string) => void;
}) {
  const isActive = c.ativo;
  const { showShopee, showMl, showInfo } = detectPlatformFromAutomacao(c);
  const showPlatformLogos = showShopee || showMl || showInfo;
  const platformTitle =
    showShopee && showMl ? "Shopee e Mercado Livre"
      : showInfo ? "Infoprodutor"
        : showMl ? "Mercado Livre"
          : "Shopee";

  return (
    <div
      className={cn(
        "bg-[#1c1c1f] border rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-all min-w-0",
        isActive ? "border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "border-[#2c2c32] hover:border-[#3e3e3e]"
      )}
    >
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <h3 className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight line-clamp-2 flex-1 min-w-0">
          {c.listaNome}
        </h3>
        {isActive ? (
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Ativo
          </span>
        ) : (
          <span className="text-[8px] font-bold text-[#a0a0a0] bg-[#121214] border border-[#2c2c32] px-1.5 py-0.5 rounded-full shrink-0">
            Parado
          </span>
        )}
      </div>

      {/* Logos das plataformas (Shopee / ML / Infoprodutor) — espelho do card WhatsApp */}
      {showPlatformLogos && (
        <div className="flex items-center gap-1.5" title={platformTitle}>
          <Image
            src="/telegram.png"
            alt="Telegram"
            width={48}
            height={48}
            className="h-[18px] w-[18px] object-contain shrink-0"
          />
          <span className="text-[#5c5c5c] font-bold text-[9px]" aria-hidden>+</span>
          {showShopee && (
            <Image
              src="/logoshopee.png"
              alt="Shopee"
              width={48}
              height={48}
              className="h-[18px] w-[18px] object-contain shrink-0"
            />
          )}
          {showShopee && showMl && (
            <span className="text-[#5c5c5c] font-bold text-[9px]" aria-hidden>+</span>
          )}
          {showMl && (
            <Image
              src="/ml.png"
              alt="Mercado Livre"
              width={48}
              height={22}
              className="h-[18px] w-auto max-w-[40px] object-contain"
            />
          )}
          {showInfo && (
            <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
              Infoprodutor
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <Send className="w-3 h-3 text-sky-400 shrink-0" />
        <span className="text-[9px] text-[#a0a0a0] truncate">
          {c.botUsername ? `@${c.botUsername}` : c.botName || "bot"}
        </span>
      </div>

      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {c.keywords.length > 0 && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Hash className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">
              {c.keywords.slice(0, 2).join(", ")}
              {c.keywords.length > 2 ? ` +${c.keywords.length - 2}` : ""}
            </span>
          </div>
        )}
        {c.listaOfertasNome && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span className="break-words">
              Lista Shopee: <span className="text-white">{c.listaOfertasNome}</span>
            </span>
          </div>
        )}
        {c.listaOfertasMlNome && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-amber-400 shrink-0 mt-0.5" />
            <span className="break-words">
              Lista ML: <span className="text-white">{c.listaOfertasMlNome}</span>
            </span>
          </div>
        )}
        {c.listaOfertasInfoNome && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-0.5" />
            <span className="break-words">
              Lista Infoprodutor: <span className="text-white">{c.listaOfertasInfoNome}</span>
            </span>
          </div>
        )}
        {c.horarioInicio && c.horarioFim && (
          <div className="flex items-center gap-1.5 text-[9px]">
            <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-semibold">{c.horarioInicio} – {c.horarioFim}</span>
          </div>
        )}
        {c.ultimoDisparoAt && (
          <div className="flex items-center gap-1.5 text-[9px] text-[#a0a0a0]">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span>
              Último:{" "}
              <span className="text-white font-semibold">
                {new Date(c.ultimoDisparoAt).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
          </div>
        )}
        {c.proximaKeyword && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0]">
            <User className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span>
              Próx. keyword: <span className="text-white">{c.proximaKeyword}</span>
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-2 border-t border-[#2c2c32]">
        {isActive ? (
          <button
            type="button"
            onClick={() => onToggle(c.id, false)}
            disabled={togglingId === c.id}
            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-red-400 border border-red-400/15 bg-red-400/5 py-1.5 rounded-lg hover:bg-red-400/15 disabled:opacity-40 transition"
          >
            {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Pause className="w-2.5 h-2.5 fill-red-400" />}
            Pausar
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => onToggle(c.id, true)}
              disabled={togglingId === c.id}
              className="flex-1 min-w-0 flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-400 border border-emerald-500/15 bg-emerald-500/5 py-1.5 rounded-lg hover:bg-emerald-500/15 disabled:opacity-40 transition"
            >
              {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-emerald-400" />}
              Ativar
            </button>
            <button
              type="button"
              onClick={() => onTest(c.id)}
              disabled={testingId === c.id || togglingId === c.id}
              title="Disparar próximo item agora (avança o cron; ignora janela horária)"
              className="shrink-0 flex items-center justify-center p-1.5 rounded-lg border border-amber-400/30 bg-amber-400/8 text-amber-400 hover:bg-amber-400/15 disabled:opacity-40 transition"
              aria-label="Testar próximo envio"
            >
              {testingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-amber-400" strokeWidth={2} />}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onEdit}
          title="Editar automação"
          className="text-[#a0a0a0] hover:text-[#e24c30] transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-[#e24c30]/25 shrink-0"
        >
          <Pencil className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(c.id)}
          disabled={removingId === c.id}
          title="Excluir automação"
          className="text-[#a0a0a0] hover:text-red-400 transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-red-400/20 shrink-0 disabled:opacity-40"
        >
          {removingId === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Wizard
// ═══════════════════════════════════════════════════════════════════════════════
type WizardProps = {
  step: 1 | 2 | 3 | 4;
  editingId: string | null;
  bots: TelegramBot[];
  listasDoBot: ListaResumo[];
  allListasDoBot: ListaResumo[];
  listSearch: string;
  setListSearch: (v: string) => void;
  botById: Map<string, TelegramBot>;
  selectedBotId: string;
  setSelectedBotId: (v: string) => void;
  selectedListaId: string;
  setSelectedListaId: (v: string) => void;
  contentMode: ContentMode;
  setContentMode: (v: ContentMode) => void;
  offerSource: OfferSource;
  setOfferSource: (v: OfferSource) => void;
  keywords: string;
  setKeywords: (v: string) => void;
  subId1: string;
  subId2: string;
  subId3: string;
  setSubId1: (v: string) => void;
  setSubId2: (v: string) => void;
  setSubId3: (v: string) => void;
  horaInicio: string;
  horaFim: string;
  setHoraInicio: (v: string) => void;
  setHoraFim: (v: string) => void;
  listasOfertasShopee: OfertaListaItem[];
  listasOfertasMl: OfertaListaItem[];
  listasOfertasInfo: OfertaListaItem[];
  loadingShopee: boolean;
  loadingMl: boolean;
  loadingInfo: boolean;
  selectedListaShopeeId: string;
  selectedListaMlId: string;
  selectedListaInfoId: string;
  setSelectedListaShopeeId: (v: string) => void;
  setSelectedListaMlId: (v: string) => void;
  setSelectedListaInfoId: (v: string) => void;
  deletingListaId: string | null;
  saving: boolean;
  onClose: () => void;
  onBack: () => void;
  onAdvance: () => void;
  onFinish: () => void;
  onCriarLista: () => void;
  onEditarLista: (id: string) => void;
  onConfirmDeleteLista: (id: string, nome: string) => void;
};

function WizardView(p: WizardProps) {
  const stepMeta: Record<number, { title: string; description: string }> = {
    1: { title: "Selecionar Bot Telegram", description: "Selecione qual bot fará o disparo das mensagens nos grupos. Apenas bots conectados estão disponíveis." },
    2: { title: "Definir Lista de Grupos Alvo", description: `Selecione uma lista já salva ou crie uma nova buscando os grupos do bot ${p.botById.get(p.selectedBotId)?.bot_name ?? ""}.` },
    3: { title: "Configurar Conteúdo e Rastreamento", description: "Defina o que será enviado nos grupos e configure os Sub IDs para rastreamento de vendas por canal." },
    4: { title: "Definir Horário e Ativar Disparo", description: "Defina a janela diária (máximo 14 horas seguidas). A automação aparece no Painel de Controle do Telegram e só dispara dentro desse horário." },
  };

  return (
    <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col min-w-0">
      <WizardStepper currentStep={p.step} onClose={p.onClose} />

      <div className="px-4 sm:px-6 py-4 border-b border-[#2c2c32]">
        <h2 className="text-sm font-bold text-white leading-snug">{stepMeta[p.step].title}</h2>
        <p className="hidden sm:block text-[11px] text-[#a0a0a0] leading-relaxed mt-1">{stepMeta[p.step].description}</p>
      </div>

      <div className="flex-1 p-4 sm:p-6 min-w-0">
        {p.step === 1 && <StepBot {...p} />}
        {p.step === 2 && <StepLista {...p} />}
        {p.step === 3 && <StepConteudo {...p} />}
        {p.step === 4 && <StepAtivar {...p} />}
      </div>

      <div className="px-4 sm:px-6 py-4 border-t border-[#2c2c32] bg-[#191920] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-xl sm:rounded-b-2xl">
        <button
          type="button"
          onClick={p.onBack}
          disabled={p.step === 1}
          className={cn(
            "w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border",
            p.step === 1
              ? "text-[#a0a0a0]/30 border-[#2c2c32]/30 cursor-not-allowed"
              : "text-[#a0a0a0] border-[#2c2c32] hover:text-white hover:border-[#3e3e3e] bg-[#222228]"
          )}
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="hidden sm:flex items-center gap-1.5 mr-2">
            {WIZARD_STEPS.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "rounded-full transition-all",
                  s.id === p.step ? "w-4 h-1.5 bg-[#e24c30]" : s.id < p.step ? "w-1.5 h-1.5 bg-emerald-500/50" : "w-1.5 h-1.5 bg-[#2c2c32]"
                )}
              />
            ))}
          </div>
          {p.step < 4 ? (
            <button
              type="button"
              onClick={p.onAdvance}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#e24c30] hover:bg-[#c94028] text-white px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg shadow-[#e24c30]/20"
            >
              Avançar <ChevronRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={p.onFinish}
              disabled={p.saving}
              className={cn(
                "w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg group bg-[#e24c30]/10 border border-[#e24c30]/25 text-[#e24c30] hover:bg-[#e24c30] hover:text-white shadow-[#e24c30]/5",
                "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e24c30]/10 disabled:hover:text-[#e24c30] disabled:shadow-none"
              )}
            >
              {p.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : p.editingId ? <Pencil className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              {p.editingId ? "Salvar alterações" : "Ativar automação"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

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
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2 shrink-0",
                    isDone
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : isActive
                        ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                        : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]"
                  )}
                >
                  {isDone ? <CheckCheck className="w-3 h-3" /> : step.id}
                </div>
                <p
                  className={cn(
                    "text-[6px] font-bold uppercase tracking-[0.14em] text-center leading-tight whitespace-normal break-words max-w-full",
                    isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]"
                  )}
                >
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
                  <div
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border-2",
                      isDone
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : isActive
                          ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                          : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]"
                    )}
                  >
                    {isDone ? <CheckCheck className="w-3.5 h-3.5" /> : step.id}
                  </div>
                  <p
                    className={cn(
                      "text-[8px] font-bold uppercase tracking-widest whitespace-nowrap",
                      isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]"
                    )}
                  >
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
      <button
        type="button"
        onClick={onClose}
        title="Cancelar e voltar ao painel"
        className="text-[#a0a0a0] hover:text-white transition p-1.5 rounded-lg hover:bg-[#222228] shrink-0 mt-0.5"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Step 1: Bot Telegram ──────────────────────────────────────────────────────
function StepBot(p: WizardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 sm:gap-6">
      <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 flex flex-col gap-2 h-fit max-md:hidden">
        <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">💡 Sobre Bots</p>
        <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
          Cada bot Telegram é um número/conta separada. Conecte um bot em Configurações → Integração WhatsApp + Telegram.
          Múltiplos bots permitem separar campanhas.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 min-w-0">
        {p.bots.length === 0 ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
            Nenhum bot Telegram conectado.{" "}
            <a href="/configuracoes" className="underline hover:text-amber-200">
              Vá em Configurações
            </a>{" "}
            para conectar.
          </div>
        ) : (
          p.bots.map((b) => {
            const isSelected = p.selectedBotId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => p.setSelectedBotId(b.id)}
                className={cn(
                  "flex items-start sm:items-center gap-4 p-4 rounded-xl border-2 text-left transition-all min-w-0",
                  isSelected
                    ? "border-[#e24c30] bg-[#e24c30]/5 shadow-lg shadow-[#e24c30]/10"
                    : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                    isSelected ? "bg-[#e24c30]/10 border-[#e24c30]/30" : "bg-[#1c1c1f] border-[#2c2c32]"
                  )}
                >
                  <Smartphone className={cn("w-4 h-4", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-[12px] font-bold truncate", isSelected ? "text-white" : "text-[#d8d8d8]")}>
                    {b.bot_name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {b.webhook_set_at ? (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[9px] text-emerald-400 font-semibold">Conectado · @{b.bot_username}</span>
                      </>
                    ) : (
                      <span className="text-[9px] text-amber-400 font-semibold">● Webhook pendente · @{b.bot_username}</span>
                    )}
                  </div>
                </div>
                {isSelected && (
                  <div className="w-5 h-5 rounded-full bg-[#e24c30] flex items-center justify-center shrink-0">
                    <CheckCheck className="w-3 h-3 text-white" />
                  </div>
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Step 2: Lista Alvo ────────────────────────────────────────────────────────
function StepLista(p: WizardProps) {
  const selectedList = p.allListasDoBot.find((l) => l.id === p.selectedListaId);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="w-3.5 h-3.5 text-[#a0a0a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={p.listSearch}
            onChange={(e) => p.setListSearch(e.target.value)}
            placeholder="Buscar lista por nome..."
            className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg pl-8 pr-8 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
          />
          {p.listSearch && (
            <button
              type="button"
              onClick={() => p.setListSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={p.onCriarLista}
          className="w-full sm:w-auto flex items-center justify-center gap-2 shrink-0 bg-[#e24c30]/5 border border-[#e24c30]/25 hover:bg-[#e24c30]/10 hover:border-[#e24c30]/45 rounded-lg px-3.5 py-2.5 sm:py-2 transition-all group"
        >
          <div className="w-5 h-5 rounded-md bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 transition-all">
            <PlusCircle className="w-3 h-3 text-[#e24c30]" />
          </div>
          <span className="text-[10px] font-bold text-[#e24c30]">Criar nova lista</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
        {p.listasDoBot.length > 0 ? (
          p.listasDoBot.map((list) => {
            const isSelected = p.selectedListaId === list.id;
            return (
              <div
                key={list.id}
                className={cn(
                  "flex min-w-0 items-stretch gap-0 rounded-xl border-2 transition-all",
                  isSelected ? "border-[#e24c30] bg-[#e24c30]/5" : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]"
                )}
              >
                <button
                  type="button"
                  onClick={() => p.setSelectedListaId(isSelected ? "" : list.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"
                >
                  <div
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                      isSelected ? "border-[#e24c30]/30 bg-[#e24c30]/10" : "border-[#2c2c32] bg-[#1c1c1f]"
                    )}
                  >
                    <ListChecks className={cn("h-3.5 w-3.5", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[11px] font-bold", isSelected ? "text-white" : "text-[#d8d8d8]")}>
                      {list.nome_lista}
                    </p>
                    <p className="mt-0.5 truncate text-[9px] text-[#a0a0a0]">
                      {list.groups_count} grupo{list.groups_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  {isSelected ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#e24c30]" /> : null}
                </button>
                <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-[#2c2c32]/80 py-1 pl-0.5 pr-1">
                  <button
                    type="button"
                    title="Editar grupos da lista"
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onEditarLista(list.id);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0a0a0] transition hover:bg-[#e24c30]/15 hover:text-[#e24c30] disabled:opacity-40"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Apagar lista inteira"
                    disabled={p.deletingListaId === list.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      p.onConfirmDeleteLista(list.id, list.nome_lista);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0a0a0] transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
                  >
                    {p.deletingListaId === list.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Search className="w-6 h-6 text-[#2c2c32]" />
            <p className="text-[11px] font-semibold text-[#a0a0a0]">Nenhuma lista encontrada</p>
            <p className="text-[9px] text-[#a0a0a0]/60">
              {p.allListasDoBot.length === 0
                ? "Clique em \"Criar nova lista\" para começar."
                : "Tente um nome diferente."}
            </p>
          </div>
        )}
      </div>

      {selectedList && (
        <div className="flex items-start sm:items-center gap-2.5 bg-[#e24c30]/5 border border-[#e24c30]/20 rounded-lg px-4 py-2.5">
          <CheckCheck className="w-3.5 h-3.5 text-[#e24c30] shrink-0 mt-0.5 sm:mt-0" />
          <p className="text-[10px] font-semibold text-white leading-relaxed">
            <span className="text-[#e24c30]">{selectedList.nome_lista}</span> selecionada
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Conteúdo + Sub IDs ────────────────────────────────────────────────
function StepConteudo(p: WizardProps) {
  const keywordCount = p.keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      <div className="flex flex-col gap-3 min-w-0">
        <FormLabel>Tipo de Conteúdo</FormLabel>
        <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-[#2c2c32]">
          <button
            type="button"
            onClick={() => p.setContentMode("keywords")}
            className={cn(
              "flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all sm:border-r border-[#2c2c32]",
              p.contentMode === "keywords" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white"
            )}
          >
            <Hash className="w-3 h-3" /> Keywords
          </button>
          <button
            type="button"
            onClick={() => p.setContentMode("list")}
            className={cn(
              "flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 border-[#2c2c32]",
              p.contentMode === "list" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white"
            )}
          >
            <Layers className="w-3 h-3" /> Lista de Ofertas
          </button>
        </div>

        {p.contentMode === "keywords" ? (
          <div className="flex flex-col gap-1.5 min-w-0">
            <FormLabel>Keywords (uma por linha)</FormLabel>
            <textarea
              value={p.keywords}
              onChange={(e) => p.setKeywords(e.target.value)}
              placeholder={"camisa masculina\ntenis corrida\nfone bluetooth"}
              className="w-full h-[140px] bg-[#222228] border border-[#3e3e3e] rounded-xl p-3.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none resize-none leading-relaxed transition"
            />
            <p className="text-[9px] text-[#a0a0a0] leading-relaxed">
              {keywordCount} keyword{keywordCount !== 1 ? "s" : ""} · 1 produto por keyword por grupo.
            </p>
          </div>
        ) : (
          <div className="min-w-0">
            <FormLabel>Origem da lista</FormLabel>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 rounded-xl overflow-hidden border border-[#2c2c32] mb-3">
              <button
                type="button"
                onClick={() => {
                  p.setOfferSource("shopee");
                  p.setSelectedListaMlId("");
                  p.setSelectedListaInfoId("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all sm:border-r border-[#2c2c32]",
                  p.offerSource === "shopee" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white"
                )}
              >
                Shopee
              </button>
              <button
                type="button"
                onClick={() => {
                  p.setOfferSource("ml");
                  p.setSelectedListaShopeeId("");
                  p.setSelectedListaInfoId("");
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-bold transition-all border-l sm:border-l border-[#2c2c32] sm:flex-row sm:gap-2 sm:px-3",
                  p.offerSource === "ml" ? "bg-amber-500/15 text-amber-400" : "bg-[#222228] text-[#a0a0a0] hover:text-white"
                )}
              >
                <span className="text-center leading-tight">Mercado Livre</span>
                {MERCADOLIVRE_UX_COMING_SOON ? (
                  <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                    Em breve
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  p.setOfferSource("crossover");
                  p.setSelectedListaInfoId("");
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 sm:border-l border-[#2c2c32] sm:flex-row sm:gap-2 sm:px-3",
                  p.offerSource === "crossover"
                    ? "bg-gradient-to-br from-[#e24c30]/20 to-amber-500/15 text-white ring-1 ring-inset ring-amber-500/30"
                    : "bg-[#222228] text-[#a0a0a0] hover:text-white"
                )}
              >
                <span className="text-center leading-tight">Crossover</span>
                {MERCADOLIVRE_UX_COMING_SOON ? (
                  <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                    Em breve
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => {
                  p.setOfferSource("infoprodutor");
                  p.setSelectedListaShopeeId("");
                  p.setSelectedListaMlId("");
                }}
                className={cn(
                  "flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 border-l border-[#2c2c32]",
                  p.offerSource === "infoprodutor" ? "bg-emerald-500/15 text-emerald-400" : "bg-[#222228] text-[#a0a0a0] hover:text-white"
                )}
              >
                <span className="text-center leading-tight">Infoprodutor</span>
              </button>
            </div>

            {!isGruposVendaMlOfferBlocked(p.offerSource) && (
              <>
                {(p.offerSource === "shopee" || p.offerSource === "crossover") && (
                  <div className="mb-3 min-w-0">
                    <FormLabel>Lista Shopee</FormLabel>
                    {p.loadingShopee ? (
                      <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas…
                      </div>
                    ) : (
                      <MetaSearchablePicker
                        value={p.selectedListaShopeeId}
                        onChange={p.setSelectedListaShopeeId}
                        options={[
                          {
                            value: "",
                            label: "Sem lista de ofertas (usa keywords)",
                            description: "Envio por keywords em vez de produtos fixos",
                          },
                          ...p.listasOfertasShopee.map((l) => ({
                            value: l.id,
                            label: l.nome,
                            description: `${l.totalItens ?? 0} ${l.totalItens === 1 ? "item" : "itens"}`,
                          })),
                        ]}
                        modalTitle="Lista de ofertas Shopee"
                        modalDescription="Lista salva em Minha Lista de Ofertas (Shopee)."
                        searchPlaceholder="Filtrar listas…"
                        emptyButtonLabel="Escolher lista de ofertas"
                        emptyAsTag
                        emptyTagLabel="Selecionar Lista"
                        emptyOptionsMessage="Nenhuma lista cadastrada."
                        className="w-full max-w-full"
                      />
                    )}
                  </div>
                )}
                {(p.offerSource === "ml" || p.offerSource === "crossover") && (
                  <div className="mb-1 min-w-0">
                    <FormLabel>Lista Mercado Livre</FormLabel>
                    {p.loadingMl ? (
                      <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas ML…
                      </div>
                    ) : (
                      <MetaSearchablePicker
                        value={p.selectedListaMlId}
                        onChange={p.setSelectedListaMlId}
                        options={[
                          {
                            value: "",
                            label: "Selecione uma lista ML",
                            description: "Crie em Lista de Ofertas - ML",
                          },
                          ...p.listasOfertasMl.map((l) => ({
                            value: l.id,
                            label: l.nome,
                            description: `${l.totalItens ?? 0} ${l.totalItens === 1 ? "item" : "itens"}`,
                          })),
                        ]}
                        modalTitle="Lista de ofertas Mercado Livre"
                        modalDescription="Listas com links de afiliado já convertidos (página Lista de Ofertas - ML)."
                        searchPlaceholder="Filtrar listas…"
                        emptyButtonLabel="Escolher lista ML"
                        emptyAsTag
                        emptyTagLabel="Selecionar Lista ML"
                        emptyOptionsMessage="Nenhuma lista ML cadastrada."
                        className="w-full max-w-full"
                      />
                    )}
                  </div>
                )}
                {p.offerSource === "infoprodutor" && (
                  <div className="mb-1 min-w-0">
                    <FormLabel>Lista Infoprodutor</FormLabel>
                    {p.loadingInfo ? (
                      <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas…
                      </div>
                    ) : (
                      <MetaSearchablePicker
                        value={p.selectedListaInfoId}
                        onChange={p.setSelectedListaInfoId}
                        options={[
                          {
                            value: "",
                            label: "Selecione uma lista Infoprodutor",
                            description: "Crie em Infoprodutor",
                          },
                          ...p.listasOfertasInfo.map((l) => ({
                            value: l.id,
                            label: l.nome,
                            description: `${l.totalItens ?? 0} ${l.totalItens === 1 ? "item" : "itens"}`,
                          })),
                        ]}
                        modalTitle="Lista do Infoprodutor"
                        modalDescription="Listas com produtos cadastrados por você na página Infoprodutor."
                        searchPlaceholder="Filtrar listas…"
                        emptyButtonLabel="Escolher lista Infoprodutor"
                        emptyAsTag
                        emptyTagLabel="Selecionar Lista"
                        emptyOptionsMessage="Nenhuma lista cadastrada."
                        className="w-full max-w-full"
                      />
                    )}
                  </div>
                )}
              </>
            )}
            <p className="text-[9px] text-[#a0a0a0] mt-2 leading-relaxed">
              {p.offerSource === "crossover" ? (
                <>
                  <span className="text-amber-400/90 font-semibold">Crossover:</span> Shopee + ML viram uma única fila no mesmo bot.
                </>
              ) : p.offerSource === "infoprodutor" ? (
                <>
                  <span className="text-emerald-400/90 font-semibold">Infoprodutor:</span> seus produtos próprios (imagem, título, link) enviados pelo bot.
                </>
              ) : (
                <>A lista substitui as keywords: na automação, um produto por vez em rotação.</>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Sub IDs (apenas em modo keywords ou listas não-shopee) */}
      {(p.contentMode === "keywords" || p.offerSource !== "shopee") && (
        <div className="flex flex-col gap-3 min-w-0">
          <FormLabel>
            <span className="inline-flex items-center gap-1 flex-wrap">
              <Tag className="w-2.5 h-2.5" /> Sub IDs de Rastreamento
              <span className="text-[8px] normal-case tracking-normal font-normal text-[#a0a0a0] ml-1">(opcional)</span>
            </span>
          </FormLabel>
          <div className="flex flex-col gap-2">
            {[
              { label: "subId1", value: p.subId1, setter: p.setSubId1, ph: "Canal (ex: Telegram)" },
              { label: "subId2", value: p.subId2, setter: p.setSubId2, ph: "Lista (ex: Camisa Anime)" },
              { label: "subId3", value: p.subId3, setter: p.setSubId3, ph: "Campanha (ex: Natal)" },
            ].map(({ label, value, setter, ph }) => (
              <input
                key={label}
                type="text"
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={ph}
                className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg px-3 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 4: Ativar (horário + resumo) ─────────────────────────────────────────
function StepAtivar(p: WizardProps) {
  const bot = p.botById.get(p.selectedBotId);
  const lista = p.allListasDoBot.find((l) => l.id === p.selectedListaId);
  const keywordCount = p.keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).length;

  let conteudo = "";
  if (p.contentMode === "keywords") {
    conteudo = `${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}`;
  } else if (p.offerSource === "crossover") {
    conteudo = "Crossover (Shopee + Mercado Livre)";
  } else if (p.offerSource === "ml") {
    const lst = p.listasOfertasMl.find((l) => l.id === p.selectedListaMlId);
    conteudo = `Lista Mercado Livre: ${lst?.nome ?? "—"}`;
  } else if (p.offerSource === "infoprodutor") {
    const lst = p.listasOfertasInfo.find((l) => l.id === p.selectedListaInfoId);
    conteudo = `Lista Infoprodutor: ${lst?.nome ?? "—"}`;
  } else {
    const lst = p.listasOfertasShopee.find((l) => l.id === p.selectedListaShopeeId);
    conteudo = `Lista Shopee: ${lst?.nome ?? "—"}`;
  }

  const janelaErr = mensagemErroJanela(p.horaInicio, p.horaFim);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
      <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 min-w-0">
        <div className="flex flex-col gap-2 mb-4">
          <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest leading-relaxed">
            <Clock className="w-2.5 h-2.5 text-[#e24c30] shrink-0" /> Janela diária (máx. 14 h)
          </label>
          <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
            O cron só dispara entre o horário de <span className="text-white font-semibold">início</span> e <span className="text-white font-semibold">fim</span>.
            A duração não pode passar de <span className="text-[#e24c30] font-semibold">14 horas seguidas</span> (pode atravessar meia-noite).
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Início</p>
            <input
              type="time"
              value={p.horaInicio}
              onChange={(e) => p.setHoraInicio(e.target.value)}
              className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition"
            />
          </div>
          <span className="hidden sm:block text-[#a0a0a0] mt-4">→</span>
          <div className="flex-1">
            <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Fim</p>
            <input
              type="time"
              value={p.horaFim}
              onChange={(e) => p.setHoraFim(e.target.value)}
              className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition"
            />
          </div>
        </div>
        {janelaErr && (
          <p className="text-[10px] mt-3 leading-relaxed text-amber-400">{janelaErr}</p>
        )}
      </div>

      <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl min-w-0 overflow-hidden">
        <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest px-4 pt-4 mb-4">Resumo da Automação</p>
        <div className="flex flex-col gap-3 px-4 pb-4">
          {[
            { icon: <Send className="w-3.5 h-3.5 text-sky-400 shrink-0" />, label: "Bot", value: bot ? `${bot.bot_name} · @${bot.bot_username}` : "Não selecionado", warn: !bot },
            { icon: <ListChecks className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Lista", value: lista ? `${lista.nome_lista} · ${lista.groups_count} grupo(s)` : null, warn: !lista },
            { icon: <FileText className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Conteúdo", value: conteudo, warn: false },
            { icon: <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />, label: "Horário", value: p.horaInicio && p.horaFim ? `${p.horaInicio} – ${p.horaFim}` : "Defina início e fim", warn: false },
            { icon: <Send className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Envios", value: "A cada 10 minutos", warn: false },
          ].map(({ icon, label, value, warn }) => (
            <div key={label} className="flex items-start gap-3 py-2 border-b border-[#2c2c32] last:border-0 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#1c1c1f] border border-[#2c2c32] flex items-center justify-center shrink-0">{icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[8px] text-[#a0a0a0] uppercase tracking-widest font-bold">{label}</p>
                {warn ? (
                  <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Nenhum selecionado</p>
                ) : (
                  <p className="text-[10px] text-white font-semibold mt-0.5 break-words">{value}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Modal "Buscar Grupos do Telegram" (criar/editar lista)
// Mesmo visual do BuscarGruposModal do WhatsApp (max-w-lg, header/body/footer,
// tokens semânticos, picker rows, portal).
// ═══════════════════════════════════════════════════════════════════════════════

const tgFieldBase =
  "w-full rounded-xl border border-dark-border bg-dark-bg text-sm text-text-primary outline-none transition-colors focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20";
const tgSelectCls = `${tgFieldBase} py-2.5 px-3`;
const tgSearchInputCls = `${tgFieldBase} py-2.5 pl-10 pr-3 placeholder:text-text-secondary/40`;
const tgTextInputCls = `${tgFieldBase} py-2.5 px-3 placeholder:text-text-secondary/40`;

function tgPickerRowCls(selected: boolean) {
  return cn(
    "w-full text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-all flex items-start gap-2 min-w-0",
    selected
      ? "border-shopee-orange/50 bg-shopee-orange/10 text-text-primary"
      : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30"
  );
}

function BuscarGruposTelegramModal({
  bots,
  initialBotId,
  editingListaId,
  editingPrefill,
  onClose,
  onSaved,
}: {
  bots: TelegramBot[];
  initialBotId: string;
  editingListaId: string | null;
  editingPrefill: { nome_lista: string; chat_ids: string[] } | null;
  onClose: () => void;
  onSaved: (saved: { id: string; nome_lista: string; groups_count: number; bot_id: string }) => void;
}) {
  const titleId = useId();
  const isEditLista = !!editingListaId;

  const [botId, setBotId] = useState(initialBotId);
  const [grupos, setGrupos] = useState<TelegramGrupo[]>([]);
  const [loadingGrupos, setLoadingGrupos] = useState(false);
  const [jaCarregou, setJaCarregou] = useState(false);
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(
    new Set(editingPrefill?.chat_ids ?? [])
  );
  const [nomeLista, setNomeLista] = useState(editingPrefill?.nome_lista ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadGrupos = useCallback(async () => {
    if (!botId) return;
    setLoadingGrupos(true);
    setErr(null);
    try {
      const r = await fetch(`/api/telegram/grupos?bot_id=${encodeURIComponent(botId)}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao carregar grupos");
      setGrupos(Array.isArray(j.grupos) ? j.grupos : []);
      setJaCarregou(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingGrupos(false);
    }
  }, [botId]);

  // Carrega automaticamente ao abrir / trocar de bot
  useEffect(() => {
    setJaCarregou(false);
    loadGrupos();
  }, [loadGrupos]);

  // Bloquear scroll do body
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ESC pra fechar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const filteredGrupos = useMemo(() => {
    const q = groupFilter.trim().toLowerCase();
    if (!q) return grupos;
    return grupos.filter((g) => (g.group_name || "").toLowerCase().includes(q));
  }, [grupos, groupFilter]);

  const allFilteredIds = useMemo(() => filteredGrupos.map((g) => g.chat_id), [filteredGrupos]);
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedChatIds.has(id));
  const someFilteredSelected =
    !allFilteredSelected && allFilteredIds.some((id) => selectedChatIds.has(id));
  const visibleSelectedCount = allFilteredIds.filter((id) => selectedChatIds.has(id)).length;

  const toggleChat = (chatId: string) => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    const nome = nomeLista.trim();
    if (!nome) {
      setErr("Informe um nome para a lista.");
      return;
    }
    if (selectedChatIds.size === 0) {
      setErr("Selecione ao menos um grupo.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const chat_ids = Array.from(selectedChatIds);
      let r: Response;
      if (editingListaId) {
        r = await fetch("/api/telegram/listas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingListaId, nome_lista: nome, chat_ids }),
        });
      } else {
        r = await fetch("/api/telegram/listas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bot_id: botId, nome_lista: nome, chat_ids }),
        });
      }
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Erro ao salvar lista");
      onSaved({
        id: editingListaId ?? j.data?.id ?? "",
        nome_lista: nome,
        groups_count: j.data?.groups_count ?? chat_ids.length,
        bot_id: botId,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  };

  const currentBot = bots.find((b) => b.id === botId);
  const status: "open" | "close" | null = currentBot
    ? currentBot.webhook_set_at
      ? "open"
      : "close"
    : null;
  const canConfirm = selectedChatIds.size > 0 && nomeLista.trim().length > 0 && !saving;

  if (typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg max-h-[min(640px,90vh)] flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-dark-border/60 bg-dark-bg/40">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-sm font-bold text-text-primary flex items-center gap-2 pr-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 shrink-0">
                <Search className="h-4 w-4 text-shopee-orange" />
              </span>
              <span className="leading-tight">{isEditLista ? "Editar lista de grupos" : "Buscar grupos"}</span>
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-text-secondary hover:bg-dark-bg hover:text-text-primary transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 space-y-1.5">
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Bot</label>
            <select
              value={botId}
              onChange={(e) => {
                setBotId(e.target.value);
                setSelectedChatIds(new Set());
              }}
              disabled={isEditLista}
              className={cn(tgSelectCls, isEditLista && "cursor-not-allowed opacity-70")}
            >
              <option value="">Selecione um bot</option>
              {bots.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bot_name} · @{b.bot_username}
                  {b.webhook_set_at ? " · Conectado" : ""}
                </option>
              ))}
            </select>
            {loadingGrupos && bots.length > 0 && (
              <p className="text-[11px] text-text-secondary/80 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                Verificando conexão…
              </p>
            )}
            {botId && status != null && (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold",
                  status === "open"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                    : "border-amber-500/35 bg-amber-500/10 text-amber-300"
                )}
              >
                {status === "open" ? "Conectado" : "Webhook pendente"}
              </span>
            )}
          </div>

          {botId && (
            <button
              type="button"
              onClick={loadGrupos}
              disabled={loadingGrupos}
              className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-shopee-orange/45 bg-shopee-orange/10 px-4 py-2.5 text-sm font-semibold text-shopee-orange hover:bg-shopee-orange/18 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loadingGrupos ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {jaCarregou ? "Atualizando…" : "Carregando…"}
                </>
              ) : jaCarregou ? (
                <>
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  Atualizar grupos
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0" />
                  Buscar grupos do bot
                </>
              )}
            </button>
          )}
        </div>

        {/* Corpo — lista / estados */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {err && (
            <div className="shrink-0 px-4 py-2 mx-3 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 text-[12px] text-red-300">
              {err}
            </div>
          )}

          {!botId && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Selecione um <strong className="text-[#f0f0f2]">bot</strong> e use o botão de busca acima.
              </p>
            </div>
          )}

          {botId && !loadingGrupos && grupos.length === 0 && !err && jaCarregou && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Nenhum grupo descoberto pra esse bot. Adicione o bot como admin em algum grupo, mande qualquer mensagem no grupo e clique em{" "}
                <strong className="text-[#f0f0f2]">Atualizar grupos</strong>.
              </p>
            </div>
          )}

          {botId && !loadingGrupos && grupos.length === 0 && !err && !jaCarregou && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Use o botão <strong className="text-[#f0f0f2]">Buscar grupos do bot</strong> acima. Depois da primeira busca, o mesmo botão vira{" "}
                <strong className="text-[#f0f0f2]">Atualizar grupos</strong>.
              </p>
            </div>
          )}

          {grupos.length > 0 && (
            <>
              <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-dark-border/60 bg-dark-bg/40">
                <p className="text-[11px] text-text-secondary/75">
                  <span className="text-shopee-orange font-semibold">{grupos.length}</span> grupo
                  {grupos.length !== 1 ? "s" : ""} descoberto{grupos.length !== 1 ? "s" : ""} pelo bot
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Filtrar por nome do grupo…"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className={tgSearchInputCls}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className={tgPickerRowCls(allFilteredSelected)}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      {allFilteredSelected ? "Desmarcar todos (visíveis)" : "Selecionar todos (visíveis)"}
                    </span>
                    <span className="block text-[11px] text-text-secondary/55 font-normal mt-0.5">
                      {filteredGrupos.length} grupo{filteredGrupos.length !== 1 ? "s" : ""} na lista filtrada
                    </span>
                  </span>
                  {allFilteredSelected ? (
                    <CheckCheck className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" aria-hidden />
                  ) : someFilteredSelected ? (
                    <span className="text-[10px] font-semibold text-shopee-orange shrink-0">{visibleSelectedCount}</span>
                  ) : null}
                </button>

                {filteredGrupos.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-6">Nada encontrado.</p>
                ) : (
                  filteredGrupos.map((g) => {
                    const isSelected = selectedChatIds.has(g.chat_id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleChat(g.chat_id)}
                        className={tgPickerRowCls(isSelected)}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">
                            {g.group_name || <span className="italic text-text-secondary/60">sem título</span>}
                          </span>
                          <span className="block text-[11px] text-text-secondary/55 font-normal truncate mt-0.5 font-mono">
                            {g.chat_id}
                          </span>
                        </span>
                        {isSelected ? <CheckCheck className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" aria-hidden /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé */}
        <div className="shrink-0 border-t border-dark-border/60 bg-dark-bg/30 px-4 py-3 space-y-3">
          {selectedChatIds.size > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                Nome da lista
              </label>
              <input
                type="text"
                value={nomeLista}
                onChange={(e) => setNomeLista(e.target.value)}
                placeholder="Ex: Promoções Achadinhos, Ofertas diárias"
                className={tgTextInputCls}
              />
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[11px] text-text-secondary/70">
              {selectedChatIds.size > 0 ? (
                <>
                  <span className="text-shopee-orange font-semibold">{selectedChatIds.size}</span> grupo
                  {selectedChatIds.size !== 1 ? "s" : ""} selecionado{selectedChatIds.size !== 1 ? "s" : ""}
                </>
              ) : (
                "Toque em cada grupo para marcar ou desmarcar."
              )}
            </p>
            <div className="flex gap-2 justify-end shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canConfirm}
                className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(238,77,45,0.25)] transition-opacity inline-flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEditLista ? "Guardar alterações" : "Criar lista de grupo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers UI
// ═══════════════════════════════════════════════════════════════════════════════
function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
      {children}
    </label>
  );
}

function AlertModal({
  title,
  icon,
  message,
  onClose,
}: {
  title: string;
  icon: React.ReactNode;
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/65 p-4 sm:p-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[380px] rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e24c30]/25 bg-[#e24c30]/12">
            {icon}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 className="text-sm font-bold text-white leading-snug">{title}</h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8bc]">{message}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[#e24c30] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#e24c30]/25 transition hover:bg-[#c94028]"
        >
          Entendi
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
  loading,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/65 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-[400px] rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-bold text-white">{title}</h2>
        <div className="mt-2 text-[12px] leading-relaxed text-[#b8b8bc]">{message}</div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#3e3e3e] px-4 py-2.5 text-[12px] font-semibold text-[#d8d8d8] transition hover:bg-[#222228]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[12px] font-bold text-white shadow-lg transition disabled:opacity-50",
              danger ? "bg-red-600 hover:bg-red-500" : "bg-[#e24c30] hover:bg-[#c94028]"
            )}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
