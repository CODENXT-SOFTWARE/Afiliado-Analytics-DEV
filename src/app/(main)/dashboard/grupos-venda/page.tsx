"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageCircle,
  Loader2,
  Trash2,
  Send,
  AlertCircle,
  Search,
  ShoppingBag,
  Clock,
  PlayCircle,
  StopCircle,
  List,
  PlusCircle,
} from "lucide-react";
import BuscarGruposModal, {
  type BuscarGruposPayload,
  type EvolutionInstanceItem,
} from "../gpl/BuscarGruposModal";

type ListaGrupos = {
  id: string;
  instanceId: string;
  nomeLista: string;
  createdAt: string;
};

type ContinuoItem = {
  id: string;
  listaId: string | null;
  listaNome: string;
  instanceId: string;
  keywords: string[];
  subId1: string;
  subId2: string;
  subId3: string;
  ativo: boolean;
  proximoIndice: number;
  ultimoDisparoAt: string | null;
  updatedAt: string;
  proximaKeyword: string | null;
};

type Instance = EvolutionInstanceItem & { id: string };

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

  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch("/api/evolution/instances");
      const data = await res.json();
      const list = Array.isArray(data.instances) ? data.instances : [];
      setInstances(
        list.map((i: { id: string; nome_instancia: string; hash?: string | null }) => ({
          id: i.id,
          nome_instancia: i.nome_instancia,
          hash: i.hash ?? null,
        }))
      );
      if (list.length > 0 && !selectedInstanceId) setSelectedInstanceId(list[0].id);
    } catch {
      setInstances([]);
    }
  }, [selectedInstanceId]);

  const loadListas = useCallback(async () => {
    setLoadingListas(true);
    try {
      const url = selectedInstanceId
        ? `/api/grupos-venda/listas?instanceId=${encodeURIComponent(selectedInstanceId)}`
        : "/api/grupos-venda/listas";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(data.data) ? data.data : []);
    } catch (e) {
      setListas([]);
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingListas(false);
    }
  }, [selectedInstanceId]);

  const loadContinuo = useCallback(async () => {
    setContinuoLoading(true);
    try {
      const res = await fetch("/api/grupos-venda/continuo");
      const data = await res.json();
      if (res.ok) setContinuoList(Array.isArray(data.data) ? data.data : []);
    } catch {
      setContinuoList([]);
    } finally {
      setContinuoLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  useEffect(() => {
    loadListas();
  }, [loadListas]);

  useEffect(() => {
    loadContinuo();
  }, [loadContinuo]);

  const handleConfirmGroups = useCallback(
    async (payload: BuscarGruposPayload) => {
      const instance = instances.find((i) => i.nome_instancia === payload.nomeInstancia);
      if (!instance) {
        setError("Instância não encontrada.");
        return;
      }
      const nomeLista = payload.nomeLista?.trim();
      if (!nomeLista) {
        setError("Informe o nome da lista.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch("/api/grupos-venda/listas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceId: instance.id,
            nomeLista,
            groups: payload.grupos.map((g) => ({ id: g.id, nome: g.nome })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao criar lista");
        setFeedback(`Lista "${data.data?.nomeLista ?? nomeLista}" criada com ${data.data?.groupsCount ?? payload.grupos.length} grupo(s).`);
        setTimeout(() => setFeedback(""), 5000);
        loadListas();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao criar lista");
      } finally {
        setSaving(false);
      }
      setModalOpen(false);
    },
    [instances, loadListas]
  );

  const handleDeleteLista = useCallback(
    async (id: string) => {
      setDeletingListaId(id);
      try {
        const res = await fetch(`/api/grupos-venda/listas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        loadListas();
        setContinuoList((prev) => prev.filter((c) => c.listaId !== id));
      } catch {
        setError("Erro ao remover lista");
      } finally {
        setDeletingListaId(null);
      }
    },
    [loadListas]
  );

  const handleDisparar = useCallback(async () => {
    if (!selectedListaId) {
      setError("Selecione uma lista de grupos.");
      return;
    }
    const kwList = keywords
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (kwList.length === 0) {
      setError("Digite ao menos uma keyword (uma por linha ou separadas por vírgula).");
      return;
    }
    setDisparando(true);
    setError(null);
    setFeedback("");
    try {
      const res = await fetch("/api/grupos-venda/disparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listaId: selectedListaId,
          keywords: kwList,
          subId1,
          subId2,
          subId3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao disparar");
      const sent = data.sent ?? 0;
      const errList = data.errors ?? [];
      setFeedback(`${sent} oferta(s) enviada(s).${errList.length > 0 ? ` ${errList.length} erro(s).` : ""}`);
      setTimeout(() => setFeedback(""), 8000);
      if (errList.length > 0)
        setError(errList.map((e: { keyword: string; error: string }) => `${e.keyword}: ${e.error}`).join("; "));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao disparar");
    } finally {
      setDisparando(false);
    }
  }, [selectedListaId, keywords, subId1, subId2, subId3]);

  const handleContinuoToggle = useCallback(
    async (configId: string, ativar: boolean) => {
      setContinuoTogglingId(configId);
      setError(null);
      try {
        if (!ativar) {
          const res = await fetch("/api/grupos-venda/continuo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: configId, ativo: false }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? "Erro");
          setFeedback("Disparo 24h pausado.");
        } else {
          const c = continuoList.find((x) => x.id === configId);
          if (!c?.listaId) throw new Error("Config sem lista");
          const res = await fetch("/api/grupos-venda/continuo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: configId,
              listaId: c.listaId,
              keywords: c.keywords,
              subId1: c.subId1,
              subId2: c.subId2,
              subId3: c.subId3,
              ativo: true,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ?? "Erro ao ativar");
          setFeedback("Disparo 24h ativado.");
        }
        setTimeout(() => setFeedback(""), 4000);
        await loadContinuo();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setContinuoTogglingId(null);
      }
    },
    [continuoList, loadContinuo]
  );

  const handleAddContinuo = useCallback(async () => {
    if (!selectedListaId) {
      setError("Selecione uma lista de grupos.");
      return;
    }
    const kwList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (kwList.length === 0) {
      setError("Digite ao menos uma keyword.");
      return;
    }
    setContinuoTogglingId("new");
    setError(null);
    try {
      const res = await fetch("/api/grupos-venda/continuo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listaId: selectedListaId,
          keywords: kwList,
          subId1,
          subId2,
          subId3,
          ativo: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro");
      setFeedback("Disparo 24h adicionado. Um produto a cada 2 min em loop.");
      setTimeout(() => setFeedback(""), 5000);
      setSelectedListaId("");
      setKeywords("");
      setSubId1("");
      setSubId2("");
      setSubId3("");
      await loadContinuo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar disparo 24h");
    } finally {
      setContinuoTogglingId(null);
    }
  }, [selectedListaId, keywords, subId1, subId2, subId3, loadContinuo]);

  const handleRemoveContinuo = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/grupos-venda/continuo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        loadContinuo();
      } catch {
        setError("Erro ao remover disparo");
      }
    },
    [loadContinuo]
  );

  /** Testar a rota do cron em dev (em produção o cron da Vercel chama sozinho a cada 2 min) */
  const handleTestCron = useCallback(async () => {
    setCronTestLoading(true);
    setCronTestResult(null);
    setError(null);
    try {
      const res = await fetch("/api/grupos-venda/cron-disparo");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCronTestResult(`Erro ${res.status}: ${data?.error ?? res.statusText}`);
        return;
      }
      const processed = data.processed ?? 0;
      const results = data.results ?? [];
      const okCount = results.filter((r: { ok?: boolean }) => r.ok).length;
      const errCount = results.filter((r: { ok?: boolean }) => !r.ok).length;
      setCronTestResult(
        `Processados: ${processed}. OK: ${okCount}${errCount > 0 ? `, erros: ${errCount}` : ""}. ${results.length ? results.map((r: { keyword?: string; ok?: boolean; error?: string }) => (r.ok ? `"${r.keyword}" enviado` : `"${r.keyword}": ${r.error}`)).join("; ") : "Nenhum disparo ativo."}`
      );
      if (processed > 0) loadContinuo();
    } catch (e) {
      setCronTestResult(`Falha: ${e instanceof Error ? e.message : "Erro ao chamar cron"}`);
    } finally {
      setCronTestLoading(false);
    }
  }, [loadContinuo]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
        <MessageCircle className="h-8 w-8 text-shopee-orange" />
        Grupos de Venda
      </h1>
      <p className="text-text-secondary text-sm">
        Crie listas de grupos (como na Calculadora GPL): busque grupos, selecione e dê um nome à lista. Depois escolha
        a lista para disparar ofertas (uma vez ou 24h em loop).
      </p>

      {/* Desktop: listas à esquerda, disparar à direita; mobile: empilhado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Listas de grupos (esquerda no desktop) */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
          <List className="h-5 w-5" />
          Listas de grupos
        </h2>
        <p className="text-text-secondary text-xs mb-3">
          Selecione a instância, clique em Buscar grupos, escolha os grupos e em <strong>CRIAR LISTA DE GRUPO</strong>{" "}
          informe o nome da lista para salvar.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select
            value={selectedInstanceId}
            onChange={(e) => setSelectedInstanceId(e.target.value)}
            className="px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm focus:outline-none focus:border-shopee-orange min-w-[200px]"
          >
            <option value="">Selecione a instância</option>
            {instances.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nome_instancia}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Search className="h-4 w-4" />
            Buscar grupos
          </button>
        </div>
        {loadingListas ? (
          <p className="text-text-secondary text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando listas...
          </p>
        ) : listas.length === 0 ? (
          <p className="text-text-secondary text-sm py-4">
            Nenhuma lista ainda. Busque grupos, selecione-os e crie uma lista com um nome.
          </p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto scrollbar-shopee pr-1">
            {listas.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-dark-border bg-dark-bg"
              >
                <span className="text-sm text-text-primary font-medium">{l.nomeLista}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-secondary">
                    {instances.find((i) => i.id === l.instanceId)?.nome_instancia ?? l.instanceId.slice(0, 8)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteLista(l.id)}
                    disabled={deletingListaId === l.id}
                    className="p-1.5 rounded text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    aria-label="Excluir lista"
                  >
                    {deletingListaId === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {saving && (
          <p className="text-sm text-text-secondary mt-2 flex items-center gap-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </p>
        )}
        {feedback && <p className="text-sm text-emerald-400 mt-2">{feedback}</p>}
        </div>

        {/* Disparar ofertas (direita no desktop) */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-3 flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          Disparar ofertas
        </h2>
        <p className="text-text-secondary text-xs mb-3">
          Escolha a lista de grupos, as keywords e os Sub IDs. Disparo uma vez ou adicione um disparo 24h (1 produto a
          cada 2 min em loop).
        </p>
        <div className="mb-4">
          <label className="block text-xs text-text-secondary mb-1">Lista de grupos</label>
          <select
            value={selectedListaId}
            onChange={(e) => setSelectedListaId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm focus:outline-none focus:border-shopee-orange"
          >
            <option value="">Selecione uma lista</option>
            {listas.map((l) => (
              <option key={l.id} value={l.id}>
                {l.nomeLista}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sub ID 1</label>
            <input
              type="text"
              value={subId1}
              onChange={(e) => setSubId1(e.target.value)}
              placeholder="Ex: grupos-venda"
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm focus:outline-none focus:border-shopee-orange"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sub ID 2</label>
            <input
              type="text"
              value={subId2}
              onChange={(e) => setSubId2(e.target.value)}
              placeholder="Ex: ofertas"
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm focus:outline-none focus:border-shopee-orange"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-1">Sub ID 3</label>
            <input
              type="text"
              value={subId3}
              onChange={(e) => setSubId3(e.target.value)}
              placeholder="Ex: n8n"
              className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm focus:outline-none focus:border-shopee-orange"
            />
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-xs text-text-secondary mb-1">Keywords (uma por linha ou separadas por vírgula)</label>
          <textarea
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="camisa masculina&#10;tenis corrida&#10;fone bluetooth"
            rows={4}
            className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange resize-y"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleDisparar}
            disabled={disparando || !selectedListaId || !keywords.trim()}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {disparando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            Disparar ofertas (uma vez)
          </button>
          <button
            type="button"
            onClick={handleAddContinuo}
            disabled={continuoTogglingId === "new" || !selectedListaId || !keywords.trim()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {continuoTogglingId === "new" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            Adicionar disparo 24h
          </button>
        </div>
        </div>
      </div>

      {/* Resumo dos disparos 24h (abaixo, largura total) */}
      <div className="bg-dark-card rounded-xl border border-dark-border p-5">
        <h2 className="text-lg font-semibold text-text-primary mb-2 flex items-center gap-2">
          <Clock className="h-5 w-5 text-shopee-orange" />
          Resumo dos disparos 24h
        </h2>
        <p className="text-text-secondary text-sm mb-4">
          Cada linha é um disparo contínuo (lista + keywords + sub IDs). Ative ou pause individualmente.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTestCron}
            disabled={cronTestLoading}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-400 text-sm font-medium hover:bg-amber-500/10 disabled:opacity-50 transition-colors"
            title="Simula a chamada que o cron da Vercel faz a cada 2 min. Use para testar em desenvolvimento."
          >
            {cronTestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Testar disparo 24h agora
          </button>
          <span className="text-xs text-text-secondary">
            (em dev: simula o cron; em produção o cron da Vercel roda a cada 2 min)
          </span>
        </div>
        {cronTestResult && (
          <p className="text-sm text-text-primary mb-4 p-3 rounded-lg bg-dark-bg border border-dark-border">
            {cronTestResult}
          </p>
        )}
        {continuoLoading ? (
          <p className="text-text-secondary text-sm flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </p>
        ) : continuoList.length === 0 ? (
          <p className="text-text-secondary text-sm py-4">Nenhum disparo 24h configurado. Use &quot;Adicionar disparo 24h&quot; acima.</p>
        ) : (
          <ul className="space-y-3">
            {continuoList.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 py-3 px-4 rounded-lg border border-dark-border bg-dark-bg"
              >
                <span className="font-medium text-text-primary">{c.listaNome}</span>
                <span className="text-xs text-text-secondary">
                  Sub IDs: {[c.subId1, c.subId2, c.subId3].filter(Boolean).join(", ") || "—"}
                </span>
                <span className="text-xs text-text-secondary truncate max-w-[180px]" title={c.keywords.join(", ")}>
                  Keywords: {c.keywords.slice(0, 2).join(", ")}{c.keywords.length > 2 ? "…" : ""}
                </span>
                {c.ultimoDisparoAt && (
                  <span className="text-xs text-text-secondary">
                    Último: {new Date(c.ultimoDisparoAt).toLocaleString("pt-BR")}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${c.ativo ? "bg-emerald-500/20 text-emerald-400" : "bg-dark-bg text-text-secondary"}`}
                >
                  {c.ativo ? <PlayCircle className="h-3 w-3" /> : <StopCircle className="h-3 w-3" />}
                  {c.ativo ? "Ativo" : "Parado"}
                </span>
                <div className="flex gap-1 ml-auto">
                  {c.ativo ? (
                    <button
                      type="button"
                      onClick={() => handleContinuoToggle(c.id, false)}
                      disabled={continuoTogglingId === c.id}
                      className="px-2 py-1 rounded text-xs border border-red-500/50 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                    >
                      {continuoTogglingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Parar"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleContinuoToggle(c.id, true)}
                      disabled={continuoTogglingId === c.id}
                      className="px-2 py-1 rounded text-xs bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {continuoTogglingId === c.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Ativar"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveContinuo(c.id)}
                    className="p-1.5 rounded text-red-400 hover:bg-red-500/10"
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-lg border border-red-500/50 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

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
