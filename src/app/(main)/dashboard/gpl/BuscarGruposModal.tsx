"use client";

import { useState, useEffect, useMemo, useId, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2, Check, RefreshCw } from "lucide-react";

/** Cache em memória (sessão da aba): evita novo GET ao reabrir o modal / criar outra lista na mesma instância. */
const gruposPorInstanciaCache = new Map<string, WhatsAppGroupItem[]>();

function cn(...c: (string | false | undefined | null)[]) {
  return c.filter(Boolean).join(" ");
}

export type EvolutionInstanceItem = {
  id: string;
  nome_instancia: string;
  hash: string | null;
};

export type WhatsAppGroupItem = {
  id: string;
  nome: string;
  qtdMembros: number;
};

export type BuscarGruposPayload = {
  grupos: WhatsAppGroupItem[];
  totalParticipantes: number;
  nomeInstancia: string;
  hash: string | null;
  /** Nome da lista ao criar lista de grupo (Grupos de Venda) */
  nomeLista?: string;
  /** Quando definido, o painel Grupos de Venda faz PATCH em vez de POST */
  listaId?: string;
};

/** Grupos da API + grupos só na lista guardada (ainda não na resposta da Evolution). */
function mergeListaSeedWithCache(apiList: WhatsAppGroupItem[], seed: WhatsAppGroupItem[]): WhatsAppGroupItem[] {
  const seen = new Set(apiList.map((g) => g.id));
  const out = [...apiList];
  for (const s of seed) {
    if (!seen.has(s.id)) {
      out.push({ id: s.id, nome: s.nome, qtdMembros: s.qtdMembros || 0 });
      seen.add(s.id);
    }
  }
  return out;
}

function normalizeStr(input?: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Alinhado ao MetaSearchablePicker (Lista de ofertas / criar campanha Meta) */
const metaFieldBase =
  "w-full rounded-xl border border-dark-border bg-dark-bg text-sm text-text-primary outline-none transition-colors focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20";
const metaSelectCls = `${metaFieldBase} py-2.5 px-3`;
const metaSearchInputCls = `${metaFieldBase} py-2.5 pl-10 pr-3 placeholder:text-text-secondary/40`;
const metaTextInputCls = `${metaFieldBase} py-2.5 px-3 placeholder:text-text-secondary/40`;

/** Linha selecionável igual ao modal do picker */
function pickerRowCls(selected: boolean) {
  return cn(
    "w-full text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-all flex items-start gap-2 min-w-0",
    selected
      ? "border-shopee-orange/50 bg-shopee-orange/10 text-text-primary"
      : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30",
  );
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: BuscarGruposPayload) => void;
  /** Quando true, exibe campo "Nome da lista" e botão "CRIAR LISTA DE GRUPO" */
  criarListaMode?: boolean;
  /** Instância já selecionada na página (evita selecionar de novo no modal) */
  initialInstanceId?: string;
  /** Editar lista existente (Grupos de Venda): bloqueia troca de instância e envia `listaId` no payload */
  listaIdEdicao?: string | null;
  /** Preenchimento ao abrir em modo edição */
  listaNomeInicial?: string;
  gruposListaInicial?: WhatsAppGroupItem[] | null;
};

export default function BuscarGruposModal({
  isOpen,
  onClose,
  onConfirm,
  criarListaMode,
  initialInstanceId,
  listaIdEdicao,
  listaNomeInicial,
  gruposListaInicial,
}: Props) {
  const titleId = useId();
  const [instances, setInstances] = useState<EvolutionInstanceItem[]>([]);
  const [instanceStatusMap, setInstanceStatusMap] = useState<Record<string, "open" | "close" | null>>({});
  const [statusLoading, setStatusLoading] = useState(false);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [groups, setGroups] = useState<WhatsAppGroupItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [groupsError, setGroupsError] = useState<string | null>(null);
  const [groupFilter, setGroupFilter] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [nomeLista, setNomeLista] = useState("");
  const [lastFetchedInstanceId, setLastFetchedInstanceId] = useState("");
  const selectedInstanceIdRef = useRef(selectedInstanceId);
  selectedInstanceIdRef.current = selectedInstanceId;
  const seedMergeRef = useRef<WhatsAppGroupItem[]>([]);

  const isEditLista = Boolean(listaIdEdicao?.trim());

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId);
  const nomeInstancia = selectedInstance?.nome_instancia ?? "";
  const instanceHash = selectedInstance?.hash ?? null;

  useEffect(() => {
    if (!isOpen) return;
    setGroupsError(null);
    setGroupFilter("");
    const presetId = (initialInstanceId ?? "").trim();
    setSelectedInstanceId(presetId);

    if (isEditLista && gruposListaInicial && gruposListaInicial.length > 0) {
      seedMergeRef.current = gruposListaInicial;
      setNomeLista((listaNomeInicial ?? "").trim());
      setSelectedGroupIds(new Set(gruposListaInicial.map((g) => g.id)));
      const cached = presetId && gruposPorInstanciaCache.has(presetId) ? gruposPorInstanciaCache.get(presetId)! : [];
      setGroups(mergeListaSeedWithCache(cached, gruposListaInicial));
      setLastFetchedInstanceId(cached.length > 0 ? presetId : "");
    } else {
      seedMergeRef.current = [];
      setSelectedGroupIds(new Set());
      setNomeLista("");
      if (presetId && gruposPorInstanciaCache.has(presetId)) {
        setGroups(gruposPorInstanciaCache.get(presetId)!);
        setLastFetchedInstanceId(presetId);
      } else {
        setGroups([]);
        setLastFetchedInstanceId("");
      }
    }
    fetch("/api/evolution/instances")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.instances)) {
          setInstances(
            data.instances.map((i: { id: string; nome_instancia: string; hash?: string | null }) => ({
              id: i.id,
              nome_instancia: i.nome_instancia,
              hash: i.hash ?? null,
            }))
          );
          if (initialInstanceId) setSelectedInstanceId(initialInstanceId);
        }
      })
      .catch(() => setInstances([]));
  }, [isOpen, initialInstanceId, isEditLista, listaNomeInicial, gruposListaInicial]);

  useEffect(() => {
    if (!isOpen || instances.length === 0) return;
    setStatusLoading(true);
    const map: Record<string, "open" | "close" | null> = {};
    const promises = instances.map((inst) =>
      fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "verificar_status",
          nomeInstancia: inst.nome_instancia,
          hash: inst.hash ?? undefined,
        }),
      })
        .then((r) => r.json())
        .then((json) => {
          const connected = json?.status === "open" || json?.conectado === true;
          map[inst.id] = connected ? "open" : "close";
        })
        .catch(() => {
          map[inst.id] = null;
        })
    );
    Promise.all(promises).then(() => {
      setInstanceStatusMap((prev) => ({ ...prev, ...map }));
      setStatusLoading(false);
    });
  }, [isOpen, instances.length]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  const handleInstanceChange = (id: string) => {
    if (isEditLista) return;
    setSelectedInstanceId(id);
    setGroupsError(null);
    setSelectedGroupIds(new Set());
    seedMergeRef.current = [];
    if (id && gruposPorInstanciaCache.has(id)) {
      setGroups(gruposPorInstanciaCache.get(id)!);
      setLastFetchedInstanceId(id);
    } else {
      setGroups([]);
      setLastFetchedInstanceId("");
    }
  };

  const handleBuscarGrupos = async () => {
    if (!nomeInstancia) return;
    const instanceIdWhenFetching = selectedInstanceId;
    setGroupsLoading(true);
    setGroupsError(null);
    try {
      const res = await fetch("/api/evolution/n8n-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoAcao: "buscar_grupo",
          nomeInstancia,
          hash: instanceHash ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Falha ao buscar grupos");
      const lista = json?.grupos ?? [];
      const normalized: WhatsAppGroupItem[] = lista.map(
        (g: {
          id?: string;
          nome?: string;
          subject?: string;
          name?: string;
          qtdMembros?: number;
          size?: number;
          participants?: unknown[];
        }) => ({
          id: String(g.id ?? ""),
          nome: String(g.nome ?? g.subject ?? g.name ?? "Sem nome"),
          qtdMembros: Number(
            g.qtdMembros ?? g.size ?? (Array.isArray(g.participants) ? g.participants.length : 0)
          ),
        })
      );
      if (selectedInstanceIdRef.current !== instanceIdWhenFetching) return;
      const seed = seedMergeRef.current;
      const merged = seed.length > 0 ? mergeListaSeedWithCache(normalized, seed) : normalized;
      gruposPorInstanciaCache.set(instanceIdWhenFetching, merged);
      setGroups(merged);
      setGroupFilter("");
      setLastFetchedInstanceId(instanceIdWhenFetching);
    } catch (e) {
      if (selectedInstanceIdRef.current !== instanceIdWhenFetching) return;
      const cached = gruposPorInstanciaCache.get(instanceIdWhenFetching);
      setGroups(cached ?? []);
      setGroupsError(e instanceof Error ? e.message : "Erro ao buscar grupos");
    } finally {
      setGroupsLoading(false);
    }
  };

  const filteredGroups = useMemo(() => {
    if (!groupFilter.trim()) return groups;
    const q = normalizeStr(groupFilter);
    return groups.filter((g) => normalizeStr(g.nome).includes(q));
  }, [groups, groupFilter]);

  const visibleSelectedCount = useMemo(
    () => filteredGroups.filter((g) => selectedGroupIds.has(g.id)).length,
    [filteredGroups, selectedGroupIds],
  );

  const selectedGroups = useMemo(
    () => groups.filter((g) => selectedGroupIds.has(g.id)),
    [groups, selectedGroupIds]
  );
  const totalParticipantesSelected = selectedGroups.reduce((acc, g) => acc + g.qtdMembros, 0);
  const totalGruposResposta = groups.length;
  const alcanceTotalResposta = groups.reduce((acc, g) => acc + g.qtdMembros, 0);

  const toggleGroup = (id: string) => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = useCallback(() => {
    const payload: BuscarGruposPayload = {
      grupos: selectedGroups,
      totalParticipantes: totalParticipantesSelected,
      nomeInstancia,
      hash: instanceHash,
    };
    if (criarListaMode) payload.nomeLista = nomeLista.trim() || undefined;
    if (listaIdEdicao?.trim()) payload.listaId = listaIdEdicao.trim();
    onConfirm(payload);
    onClose();
  }, [
    selectedGroups,
    totalParticipantesSelected,
    nomeInstancia,
    instanceHash,
    criarListaMode,
    nomeLista,
    listaIdEdicao,
    onConfirm,
    onClose,
  ]);

  const canConfirm = criarListaMode || isEditLista
    ? selectedGroupIds.size > 0 && nomeLista.trim().length > 0
    : selectedGroupIds.size > 0;

  const jaCarregouNestaInstancia =
    !!selectedInstanceId && lastFetchedInstanceId === selectedInstanceId;

  const allFilteredIds = filteredGroups.map((g) => g.id);
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedGroupIds.has(id));
  const someFilteredSelected = allFilteredIds.some((id) => selectedGroupIds.has(id));

  const toggleAllFiltered = () => {
    setSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        allFilteredIds.forEach((id) => next.delete(id));
      } else {
        allFilteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  if (!isOpen || typeof document === "undefined") return null;

  const status = selectedInstanceId ? instanceStatusMap[selectedInstanceId] : null;

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
        {/* Cabeçalho — mesmo padrão visual do MetaSearchablePicker (Lista de ofertas) */}
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
            <label className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">Instância</label>
            <select
              value={selectedInstanceId}
              onChange={(e) => handleInstanceChange(e.target.value)}
              disabled={isEditLista}
              className={cn(metaSelectCls, isEditLista && "cursor-not-allowed opacity-70")}
            >
              <option value="">Selecione uma instância</option>
              {instances.map((inst) => {
                const st = instanceStatusMap[inst.id];
                return (
                  <option key={inst.id} value={inst.id}>
                    {inst.nome_instancia}
                    {st === "open" ? " · Conectada" : st === "close" ? " · Desconectada" : ""}
                  </option>
                );
              })}
            </select>
            {statusLoading && instances.length > 0 && (
              <p className="text-[11px] text-text-secondary/80 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                Verificando conexão…
              </p>
            )}
            {selectedInstanceId && status != null && (
              <span
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold ${
                  status === "open"
                    ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400"
                    : status === "close"
                      ? "border-red-500/35 bg-red-500/10 text-red-400"
                      : "border-dark-border bg-dark-bg/50 text-text-secondary"
                }`}
              >
                {status === "open" ? "Conectada" : status === "close" ? "Desconectada" : "Status indisponível"}
              </span>
            )}
          </div>

          {selectedInstanceId && (
            <button
              type="button"
              onClick={handleBuscarGrupos}
              disabled={groupsLoading}
              className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-shopee-orange/45 bg-shopee-orange/10 px-4 py-2.5 text-sm font-semibold text-shopee-orange hover:bg-shopee-orange/18 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {groupsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  {jaCarregouNestaInstancia ? "Atualizando…" : "Buscando grupos…"}
                </>
              ) : jaCarregouNestaInstancia ? (
                <>
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  Atualizar grupos
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0" />
                  Buscar grupos na instância
                </>
              )}
            </button>
          )}
        </div>

        {/* Corpo — lista / estados */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {groupsError && (
            <div className="shrink-0 px-4 py-2 mx-3 mt-3 rounded-xl border border-red-500/30 bg-red-500/10 text-[12px] text-red-300">
              {groupsError}
            </div>
          )}

          {!selectedInstanceId && groups.length === 0 && !groupsLoading && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Selecione uma <strong className="text-[#f0f0f2]">instância</strong> e use o botão de busca acima.
              </p>
            </div>
          )}

          {selectedInstanceId && !groupsLoading && groups.length === 0 && !groupsError && lastFetchedInstanceId === selectedInstanceId && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Nenhum grupo retornado. Verifique a conexão ou escolha outra instância para buscar de novo.
              </p>
            </div>
          )}

          {selectedInstanceId && !groupsLoading && groups.length === 0 && !groupsError && lastFetchedInstanceId !== selectedInstanceId && (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-[12px] text-[#a0a0a0] text-center max-w-xs leading-relaxed border border-dashed border-[#2c2c32] rounded-2xl px-4 py-8 bg-[#17171a]">
                Use o botão <strong className="text-[#f0f0f2]">Buscar grupos na instância</strong> acima. Depois da primeira busca, o mesmo botão vira{" "}
                <strong className="text-[#f0f0f2]">Atualizar grupos</strong> (lista fica em cache nesta aba).
              </p>
            </div>
          )}

          {groups.length > 0 && (
            <>
              <div className="shrink-0 px-4 pt-3 pb-2 space-y-2 border-b border-dark-border/60 bg-dark-bg/40">
                <p className="text-[11px] text-text-secondary/75">
                  <span className="text-shopee-orange font-semibold">{totalGruposResposta}</span> grupo
                  {totalGruposResposta !== 1 ? "s" : ""} ·{" "}
                  <span className="text-text-primary font-medium">{alcanceTotalResposta.toLocaleString("pt-BR")}</span>{" "}
                  participantes no total
                </p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                  <input
                    type="search"
                    placeholder="Filtrar por nome do grupo…"
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className={metaSearchInputCls}
                  />
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-3 scrollbar-shopee space-y-2">
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className={pickerRowCls(allFilteredSelected)}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">
                      {allFilteredSelected ? "Desmarcar todos (visíveis)" : "Selecionar todos (visíveis)"}
                    </span>
                    <span className="block text-[11px] text-text-secondary/55 font-normal mt-0.5">
                      {filteredGroups.length} grupo{filteredGroups.length !== 1 ? "s" : ""} na lista filtrada
                    </span>
                  </span>
                  {allFilteredSelected ? (
                    <Check className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" aria-hidden />
                  ) : someFilteredSelected ? (
                    <span className="text-[10px] font-semibold text-shopee-orange shrink-0">{visibleSelectedCount}</span>
                  ) : null}
                </button>

                {filteredGroups.length === 0 ? (
                  <p className="text-sm text-text-secondary text-center py-6">Nada encontrado.</p>
                ) : (
                  filteredGroups.map((g) => {
                    const isSelected = selectedGroupIds.has(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className={pickerRowCls(isSelected)}
                      >
                        <span className="flex-1 min-w-0">
                          <span className="block truncate">{g.nome}</span>
                          <span className="block text-[11px] text-text-secondary/55 font-normal truncate mt-0.5">
                            {g.qtdMembros.toLocaleString("pt-BR")} participantes
                          </span>
                        </span>
                        {isSelected ? <Check className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" aria-hidden /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Rodapé — padrão Meta */}
        <div className="shrink-0 border-t border-dark-border/60 bg-dark-bg/30 px-4 py-3 space-y-3">
          {(criarListaMode || isEditLista) && selectedGroupIds.size > 0 && (
            <div>
              <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-1.5">
                Nome da lista
              </label>
              <input
                type="text"
                value={nomeLista}
                onChange={(e) => setNomeLista(e.target.value)}
                placeholder="Ex: Vendas CN, Ofertas diárias"
                className={metaTextInputCls}
              />
            </div>
          )}

          <div className="space-y-3">
            <p className="text-[11px] text-text-secondary/70">
              {selectedGroupIds.size > 0 ? (
                <>
                  <span className="text-shopee-orange font-semibold">{selectedGroupIds.size}</span> grupo
                  {selectedGroupIds.size !== 1 ? "s" : ""} ·{" "}
                  <span className="text-text-primary font-medium">
                    {totalParticipantesSelected.toLocaleString("pt-BR")}
                  </span>{" "}
                  participantes
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
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_2px_12px_rgba(238,77,45,0.25)] transition-opacity"
              >
                {isEditLista ? "Guardar alterações" : criarListaMode ? "Criar lista de grupo" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
