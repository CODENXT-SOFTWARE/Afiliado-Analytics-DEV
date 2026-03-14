"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Search, Loader2, MessageCircle, Users } from "lucide-react";

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
};

function normalizeStr(input?: unknown): string {
  return String(input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (payload: BuscarGruposPayload) => void;
  /** Quando true, exibe campo "Nome da lista" e botão "CRIAR LISTA DE GRUPO" */
  criarListaMode?: boolean;
  /** Instância já selecionada na página (evita selecionar de novo no modal) */
  initialInstanceId?: string;
};

export default function BuscarGruposModal({ isOpen, onClose, onConfirm, criarListaMode, initialInstanceId }: Props) {
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

  const selectedInstance = instances.find((i) => i.id === selectedInstanceId);
  const nomeInstancia = selectedInstance?.nome_instancia ?? "";
  const instanceHash = selectedInstance?.hash ?? null;

  // Carregar instâncias ao abrir o modal
  useEffect(() => {
    if (!isOpen) return;
    setGroups([]);
    setGroupsError(null);
    setGroupFilter("");
    setSelectedGroupIds(new Set());
    setNomeLista("");
    setSelectedInstanceId(initialInstanceId ?? "");
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
          // Se a página passou uma instância, manter selecionada (pode ter vindo antes da lista carregar)
          if (initialInstanceId) setSelectedInstanceId(initialInstanceId);
        }
      })
      .catch(() => setInstances([]));
  }, [isOpen, initialInstanceId]);

  // Buscar status de cada instância ao ter lista
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

  const handleInstanceChange = (id: string) => {
    setSelectedInstanceId(id);
    setGroups([]);
    setGroupsError(null);
    setSelectedGroupIds(new Set());
  };

  const handleBuscarGrupos = async () => {
    if (!nomeInstancia) return;
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
      setGroups(normalized);
    } catch (e) {
      setGroups([]);
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

  const handleConfirm = () => {
    const payload: BuscarGruposPayload = {
      grupos: selectedGroups,
      totalParticipantes: totalParticipantesSelected,
      nomeInstancia,
      hash: instanceHash,
    };
    if (criarListaMode) payload.nomeLista = nomeLista.trim() || undefined;
    onConfirm(payload);
    onClose();
  };
  const canConfirm = criarListaMode ? selectedGroupIds.size > 0 && nomeLista.trim().length > 0 : selectedGroupIds.size > 0;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#1a1a1a] border border-dark-border rounded-lg shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between shrink-0">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-shopee-orange" />
            Buscar Grupos
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-text-secondary hover:bg-dark-bg hover:text-text-primary transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Seção 1 — Instância */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Instância</label>
            <select
              value={selectedInstanceId}
              onChange={(e) => handleInstanceChange(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-dark-border bg-[#232323] text-text-primary text-sm focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange"
            >
              <option value="">Selecione uma instância</option>
              {instances.map((inst) => {
                const status = instanceStatusMap[inst.id];
                return (
                  <option key={inst.id} value={inst.id}>
                    {inst.nome_instancia}
                    {status === "open" ? " · Conectada" : status === "close" ? " · Desconectada" : ""}
                  </option>
                );
              })}
            </select>
            {statusLoading && instances.length > 0 && (
              <p className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Verificando status...
              </p>
            )}
            {instances.length > 0 && selectedInstanceId && (
              <div className="mt-2 flex flex-wrap gap-2">
                {instances.map((inst) => {
                  if (inst.id !== selectedInstanceId) return null;
                  const status = instanceStatusMap[inst.id];
                  return (
                    <span
                      key={inst.id}
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        status === "open"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : status === "close"
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-dark-bg text-text-secondary border border-dark-border"
                      }`}
                    >
                      {status === "open" ? "Conectada" : status === "close" ? "Desconectada" : "—"}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Seção 2 — Grupos */}
          <div>
            <div className="flex flex-col sm:flex-row gap-2 mb-3">
              <button
                type="button"
                onClick={handleBuscarGrupos}
                disabled={!selectedInstanceId || groupsLoading}
                className="px-4 py-2 rounded-md bg-shopee-orange text-white text-sm font-semibold hover:bg-shopee-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {groupsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                    Buscando...
                  </>
                ) : (
                  "Buscar Grupos"
                )}
              </button>
            </div>

            {!selectedInstanceId && groups.length === 0 && !groupsLoading && (
              <p className="text-sm text-text-secondary py-6 text-center border border-dashed border-dark-border rounded-lg">
                Selecione uma instância e clique em Buscar Grupos
              </p>
            )}

            {groupsError && (
              <p className="text-sm text-red-400 py-2">{groupsError}</p>
            )}

            {groups.length > 0 && (
              <>
                <p className="text-xs text-text-secondary mb-2">
                  {totalGruposResposta} grupo{totalGruposResposta !== 1 ? "s" : ""} encontrado
                  {totalGruposResposta !== 1 ? "s" : ""} · {alcanceTotalResposta.toLocaleString("pt-BR")}{" "}
                  participantes no total
                </p>
                <div className="mb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
                    <input
                      type="text"
                      placeholder="Filtrar por nome do grupo"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 rounded-md border border-dark-border bg-[#232323] text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                    />
                  </div>
                </div>
                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 border border-dark-border rounded-lg p-2 bg-[#232323]/50">
                  {filteredGroups.length === 0 ? (
                    <p className="text-sm text-text-secondary py-4 text-center">
                      Nenhum grupo corresponde ao filtro
                    </p>
                  ) : (
                    filteredGroups.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-3 py-2 px-3 rounded-md border border-dark-border bg-[#232323] hover:bg-dark-bg/80 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedGroupIds.has(g.id)}
                          onChange={() => toggleGroup(g.id)}
                          className="rounded border-dark-border text-shopee-orange focus:ring-shopee-orange"
                        />
                        <span className="flex-1 text-sm font-medium text-text-primary truncate" title={g.nome}>
                          {g.nome}
                        </span>
                        <span className="text-xs text-text-secondary shrink-0 px-2 py-0.5 rounded bg-dark-bg">
                          {g.qtdMembros.toLocaleString("pt-BR")} participantes
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </>
            )}

            {selectedInstanceId && !groupsLoading && groups.length === 0 && !groupsError && (
              <p className="text-sm text-text-secondary py-6 text-center border border-dashed border-dark-border rounded-lg">
                Nenhum grupo encontrado para esta instância
              </p>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="p-4 border-t border-dark-border shrink-0 flex flex-col gap-3">
          {criarListaMode && selectedGroupIds.size > 0 && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Nome da lista</label>
              <input
                type="text"
                value={nomeLista}
                onChange={(e) => setNomeLista(e.target.value)}
                placeholder="Ex: Vendas CN, Ofertas Diárias"
                className="w-full px-3 py-2 rounded-md border border-dark-border bg-[#232323] text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
              />
            </div>
          )}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="text-xs text-text-secondary">
              {selectedGroupIds.size > 0 ? (
                <>
                  {selectedGroupIds.size} grupo{selectedGroupIds.size !== 1 ? "s" : ""} selecionado
                  {selectedGroupIds.size !== 1 ? "s" : ""} ·{" "}
                  {totalParticipantesSelected.toLocaleString("pt-BR")} participantes selecionados
                </>
              ) : (
                "Selecione um ou mais grupos"
              )}
            </div>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="px-4 py-2 rounded-md bg-shopee-orange text-white text-sm font-semibold hover:bg-shopee-orange/90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {criarListaMode ? "CRIAR LISTA DE GRUPO" : "Confirmar Seleção"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
