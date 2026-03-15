"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  ArrowLeft,
  Loader2,
  Trash2,
  ExternalLink,
  ListChecks,
  FolderMinus,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import ConfirmModal from "@/app/components/ui/ConfirmModal";

type Lista = {
  id: string;
  nome: string;
  totalItens: number;
  createdAt?: string;
};

type Item = {
  id: string;
  listaId: string;
  imageUrl: string;
  productName: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
  converterLink: string;
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function MinhaListaOfertasPage() {
  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsByLista, setItemsByLista] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingListaId, setLoadingListaId] = useState<string | null>(null);
  const [expandedListas, setExpandedListas] = useState<Set<string>>(new Set());
  const [filterByLista, setFilterByLista] = useState<Record<string, string>>({});
  const [pageByLista, setPageByLista] = useState<Record<string, number>>({});
  const [confirmState, setConfirmState] = useState<{
    type: "deleteItem" | "emptyList" | "deleteList";
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "default";
    payload: { itemId?: string; listaId: string };
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const ITEMS_PER_PAGE = 5;

  const loadListas = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar listas");
      setListas([]);
    }
  }, []);

  const loadItems = useCallback(async (listaId: string) => {
    setLoadingListaId(listaId);
    try {
      const res = await fetch(`/api/shopee/minha-lista-ofertas?lista_id=${listaId}`);
      const json = await res.json();
      if (!res.ok) return;
      setItemsByLista((prev) => ({ ...prev, [listaId]: Array.isArray(json?.data) ? json.data : [] }));
    } catch {
      setItemsByLista((prev) => ({ ...prev, [listaId]: [] }));
    } finally {
      setLoadingListaId(null);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadListas().finally(() => setLoading(false));
  }, [loadListas]);

  useEffect(() => {
    listas.forEach((l) => loadItems(l.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas]);

  const handleDeleteItemClick = (itemId: string, listaId: string) => {
    setConfirmState({
      type: "deleteItem",
      title: "Remover produto",
      message: "Remover este produto da lista?",
      confirmLabel: "Remover",
      variant: "danger",
      payload: { itemId, listaId },
    });
  };

  const handleEmptyListClick = (listaId: string) => {
    setConfirmState({
      type: "emptyList",
      title: "Esvaziar lista",
      message: "Remover todos os produtos desta lista? A lista continuará existindo.",
      confirmLabel: "Esvaziar",
      variant: "danger",
      payload: { listaId },
    });
  };

  const handleDeleteListClick = (listaId: string) => {
    setConfirmState({
      type: "deleteList",
      title: "Apagar lista",
      message: "Apagar esta lista e todos os produtos? Não é possível desfazer.",
      confirmLabel: "Apagar",
      variant: "danger",
      payload: { listaId },
    });
  };

  const runConfirmAction = useCallback(async () => {
    if (!confirmState) return;
    const { type, payload } = confirmState;
    setConfirmLoading(true);
    try {
      if (type === "deleteItem" && payload.itemId) {
        const res = await fetch(`/api/shopee/minha-lista-ofertas?id=${payload.itemId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        setItemsByLista((prev) => ({
          ...prev,
          [payload.listaId]: (prev[payload.listaId] ?? []).filter((i) => i.id !== payload.itemId),
        }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: Math.max(0, (l.totalItens ?? 0) - 1) } : l)));
      } else if (type === "emptyList") {
        const res = await fetch(`/api/shopee/minha-lista-ofertas?lista_id=${payload.listaId}&empty=1`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao esvaziar");
        setItemsByLista((prev) => ({ ...prev, [payload.listaId]: [] }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: 0 } : l)));
      } else if (type === "deleteList") {
        const res = await fetch(`/api/shopee/minha-lista-ofertas/listas?id=${payload.listaId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao apagar lista");
        setListas((prev) => prev.filter((l) => l.id !== payload.listaId));
        setItemsByLista((prev) => {
          const next = { ...prev };
          delete next[payload.listaId];
          return next;
        });
      }
      setConfirmState(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro na ação");
    } finally {
      setConfirmLoading(false);
    }
  }, [confirmState]);

  const handleConfirmCancel = useCallback(() => {
    if (!confirmLoading) setConfirmState(null);
  }, [confirmLoading]);

  const copyLink = (link: string) => {
    navigator.clipboard.writeText(link).then(() => {}).catch(() => {});
  };

  const toggleLista = (listaId: string) => {
    setExpandedListas((prev) => {
      const next = new Set(prev);
      if (next.has(listaId)) next.delete(listaId);
      else next.add(listaId);
      return next;
    });
  };

  const getFilteredAndPaginatedItems = (listaId: string) => {
    const items = itemsByLista[listaId] ?? [];
    const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
    const filtered = filter
      ? items.filter((i) => (i.productName || "").toLowerCase().includes(filter))
      : items;
    const page = pageByLista[listaId] ?? 1;
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const from = (page - 1) * ITEMS_PER_PAGE;
    const slice = filtered.slice(from, from + ITEMS_PER_PAGE);
    return { slice, totalPages, page, total: filtered.length };
  };

  const setListaPage = (listaId: string, page: number) => {
    setPageByLista((prev) => ({ ...prev, [listaId]: page }));
  };

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/dashboard/gerador-links-shopee"
            className="p-2 rounded-lg border border-dark-border bg-dark-card text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
            title="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold">Minha Lista de Ofertas</h1>
        </div>

        <p className="text-sm text-text-secondary mb-6">
          Crie listas e adicione produtos pelo Gerador de Links Shopee. Preços vêm da Shopee (Preço = antes, Por = promoção).
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-shopee-orange" />
          </div>
        ) : listas.length === 0 ? (
          <div className="rounded-xl border border-dark-border bg-dark-card p-8 text-center text-text-secondary">
            <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium text-text-primary">Nenhuma lista ainda</p>
            <p className="text-sm mt-1">
              No Gerador de Links Shopee, use &quot;Adicionar a Minha Lista&quot; no histórico e crie ou escolha uma lista.
            </p>
            <Link
              href="/dashboard/gerador-links-shopee"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-shopee-orange text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Ir para Gerador de Links
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {listas.map((lista) => {
              const isExpanded = expandedListas.has(lista.id);
              const { slice, totalPages, page, total } = getFilteredAndPaginatedItems(lista.id);
              return (
                <li key={lista.id} className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleLista(lista.id)}
                    className="w-full p-4 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-dark-bg/50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-text-secondary flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-text-secondary flex-shrink-0" />
                      )}
                      <ShoppingBag className="h-5 w-5 text-shopee-orange flex-shrink-0" />
                      <span className="text-lg font-semibold text-text-primary">{lista.nome}</span>
                      <span className="text-sm text-text-secondary">({lista.totalItens ?? 0} itens)</span>
                    </span>
                    <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEmptyListClick(lista.id); }}
                        disabled={(itemsByLista[lista.id]?.length ?? 0) === 0}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-dark-border text-text-secondary text-xs hover:bg-amber-500/10 hover:text-amber-400 hover:border-amber-400/50 disabled:opacity-40"
                        title="Esvaziar lista"
                      >
                        <FolderMinus className="h-3.5 w-3.5" /> Esvaziar
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteListClick(lista.id); }}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-dark-border text-text-secondary text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/50"
                        title="Apagar lista"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Apagar lista
                      </button>
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-dark-border p-4">
                      {loadingListaId === lista.id ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-shopee-orange" />
                        </div>
                      ) : !itemsByLista[lista.id]?.length ? (
                        <p className="text-sm text-text-secondary py-4 text-center">Nenhum produto nesta lista.</p>
                      ) : (
                        <>
                          <div className="mb-3 flex items-center gap-2">
                            <Search className="h-4 w-4 text-text-secondary" />
                            <input
                              type="text"
                              value={filterByLista[lista.id] ?? ""}
                              onChange={(e) => {
                                setFilterByLista((prev) => ({ ...prev, [lista.id]: e.target.value }));
                                setPageByLista((prev) => ({ ...prev, [lista.id]: 1 }));
                              }}
                              placeholder="Filtrar por nome do produto..."
                              className="flex-1 px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary"
                            />
                          </div>
                          <ul className="space-y-4">
                            {slice.map((item) => (
                              <li
                                key={item.id}
                                className="flex gap-4 p-3 rounded-lg border border-dark-border bg-dark-bg"
                              >
                                {item.imageUrl ? (
                                  <img
                                    src={item.imageUrl}
                                    alt=""
                                    className="w-20 h-20 object-contain rounded-lg bg-white/5 flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-dark-card flex-shrink-0 flex items-center justify-center text-text-secondary text-xs">
                                    img
                                  </div>
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-text-primary leading-snug">
                                    ✨ {item.productName || "Produto"}
                                  </p>
                                  <p className="text-sm text-text-secondary mt-1">
                                    💰 Preço:{" "}
                                    {item.discountRate != null && item.discountRate > 0 && (
                                      <span className="text-red-400 font-medium">-{Math.round(item.discountRate)}% </span>
                                    )}
                                    <span className="text-text-secondary">🔴</span>{" "}
                                    <span className="line-through">{item.priceOriginal != null ? formatCurrency(item.priceOriginal) : "—"}</span>
                                    {" por "}
                                    <span className="text-emerald-400 font-medium">✅ {item.pricePromo != null ? formatCurrency(item.pricePromo) : "—"}</span>
                                  </p>
                                  <p className="text-sm font-medium text-text-primary mt-1">🏷️ PROMOÇÃO - CLIQUE NO LINK 👇</p>
                                  <button
                                    type="button"
                                    onClick={() => copyLink(item.converterLink)}
                                    className="text-sm text-green-500 hover:underline break-all text-left"
                                  >
                                    {item.converterLink}
                                  </button>
                                  <div className="flex items-center gap-2 mt-2">
                                    <a
                                      href={item.converterLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-shopee-orange hover:underline flex items-center gap-1"
                                    >
                                      <ExternalLink className="h-3 w-3" /> Abrir link
                                    </a>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteItemClick(item.id, lista.id)}
                                      className="text-xs text-red-400 hover:underline flex items-center gap-1 ml-auto"
                                    >
                                      <Trash2 className="h-3 w-3" /> Remover
                                    </button>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                          {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-3">
                              <span className="text-xs text-text-secondary">
                                Página {page} de {totalPages} · {total} produto(s)
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setListaPage(lista.id, Math.max(1, page - 1))}
                                  disabled={page <= 1}
                                  className="px-3 py-1.5 rounded-lg border border-dark-border text-text-secondary text-sm hover:bg-dark-bg disabled:opacity-40"
                                >
                                  Anterior
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setListaPage(lista.id, Math.min(totalPages, page + 1))}
                                  disabled={page >= totalPages}
                                  className="px-3 py-1.5 rounded-lg border border-dark-border text-text-secondary text-sm hover:bg-dark-bg disabled:opacity-40"
                                >
                                  Próxima
                                </button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {confirmState && (
          <ConfirmModal
            open={!!confirmState}
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.confirmLabel}
            cancelLabel="Cancelar"
            variant={confirmState.variant}
            loading={confirmLoading}
            onConfirm={runConfirmAction}
            onCancel={handleConfirmCancel}
          />
        )}
      </div>
    </div>
  );
}
