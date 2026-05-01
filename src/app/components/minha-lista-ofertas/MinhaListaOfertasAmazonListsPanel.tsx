"use client";

import { useState, useEffect, useCallback, useMemo, useId, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import {
  Loader2,
  Trash2,
  ExternalLink,
  FolderMinus,
  ChevronDown,
  ChevronRight,
  Search,
  ListChecks,
  RefreshCw,
  Store,
  X,
  Pencil,
  Check,
  Copy,
  ImageIcon,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Reorder } from "framer-motion";
import { cn, IconBtn } from "@/app/components/gerador/gerador-ui-primitives";
import ConfirmModal from "@/app/components/ui/ConfirmModal";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { buildMlListaAutomationText } from "@/lib/amazon/ml-lista-automation-text";
import { useAmazonAffiliateLocalSettings } from "@/lib/amazon/use-amazon-affiliate-local-settings";

const ML_LISTA_REFRESH_CHUNK = 120;
const ITEMS_PER_PAGE = 4;
const LISTAS_PER_PAGE = 4;

type Lista = { id: string; nome: string; totalItens: number; createdAt?: string };
type Item = {
  id: string;
  listaId: string;
  imageUrl: string;
  productName: string;
  priceOriginal: number | null;
  pricePromo: number | null;
  discountRate: number | null;
  couponPercent: number | null;
  couponAmount: number | null;
  affiliateCommissionPct: number | null;
  converterLink: string;
  productPageUrl?: string;
  createdAt: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

function displayPrecoPorLista(item: Item): string {
  const por =
    effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo;
  return por != null ? formatCurrency(por) : "—";
}

function mlItemLooksIncomplete(item: Item): boolean {
  if (!item.converterLink?.trim()) return false;
  const por =
    effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo;
  const hasPrice = por != null && Number.isFinite(Number(por));
  const hasImg = !!item.imageUrl?.trim();
  const n = (item.productName || "").trim();
  if (/^Produto \(linha \d+\)$/i.test(n)) return true;
  if (/^MLBU\d{5,}$/i.test(n)) return true;
  if (!hasImg && !hasPrice) return true;
  return false;
}

function moneyInputStringFromNumber(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}

function parseMoneyInput(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function parsePercentInput(s: string): number | null {
  const t = s.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const mlInputClass =
  "w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20";
const mlModalOverlayClass =
  "fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-[2px]";
const mlModalShellClass =
  "w-full flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden";
const mlModalHeaderClass = "shrink-0 px-4 pt-4 pb-3 border-b border-dark-border/60 bg-dark-bg/40";
const mlModalFooterClass = "shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-dark-border/60 bg-dark-bg/30";
const mlFieldLabelClass =
  "block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5";

export function MinhaListaOfertasAmazonListsPanel({ className }: { className?: string }) {
  const { sessionToken: amazonSessionToken } = useAmazonAffiliateLocalSettings();

  const mlSessionBody = useMemo(() => {
    const t = amazonSessionToken.trim();
    return t ? { amazonSessionToken: t } : {};
  }, [amazonSessionToken]);

  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsByLista, setItemsByLista] = useState<Record<string, Item[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingListaId, setLoadingListaId] = useState<string | null>(null);
  const [expandedListas, setExpandedListas] = useState<Set<string>>(new Set());
  const [filterByLista, setFilterByLista] = useState<Record<string, string>>({});
  const [pageByLista, setPageByLista] = useState<Record<string, number>>({});
  const [listasPage, setListasPage] = useState(1);
  const [refreshTarget, setRefreshTarget] = useState<string | null>(null);
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<{
    type: "deleteItem" | "emptyList" | "deleteList";
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "default";
    payload: { itemId?: string; listaId: string };
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editItemModal, setEditItemModal] = useState<{ item: Item; listaId: string } | null>(null);
  const [editItemForm, setEditItemForm] = useState({
    productName: "",
    priceOriginal: "",
    pricePromo: "",
    discountRate: "",
  });
  const [savingEditItem, setSavingEditItem] = useState(false);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const editItemTitleId = useId();

  const totalListasPages = Math.max(1, Math.ceil(listas.length / LISTAS_PER_PAGE));
  const pagedListas = useMemo(() => {
    const from = (listasPage - 1) * LISTAS_PER_PAGE;
    return listas.slice(from, from + LISTAS_PER_PAGE);
  }, [listas, listasPage]);

  useEffect(() => {
    setListasPage((p) => Math.min(Math.max(1, p), totalListasPages));
  }, [listas.length, totalListasPages]);

  const loadListas = useCallback(async () => {
    try {
      const res = await fetch("/api/amazon/minha-lista-ofertas/listas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar listas");
      setListas([]);
    }
  }, []);

  const loadItems = useCallback(async (listaId: string): Promise<Item[]> => {
    setLoadingListaId(listaId);
    try {
      const res = await fetch(`/api/amazon/minha-lista-ofertas?lista_id=${listaId}`);
      const json = await res.json();
      const arr: Item[] = Array.isArray(json?.data) ? json.data : [];
      if (!res.ok) return [];
      setItemsByLista((prev) => ({ ...prev, [listaId]: arr }));
      return arr;
    } catch {
      setItemsByLista((prev) => ({ ...prev, [listaId]: [] }));
      return [];
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
    listas.forEach((l) => {
      void loadItems(l.id);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listas]);

  const handleRefreshLista = async (listaId: string) => {
    setRefreshTarget(`lista:${listaId}`);
    setError(null);
    try {
      let items = itemsByLista[listaId] ?? [];
      if (items.length === 0) items = await loadItems(listaId);
      if (items.length === 0) return;
      let uTot = 0;
      let fTot = 0;
      const allErrors: string[] = [];
      const runChunk = async (body: { listaId: string; itemIds: string[] }) => {
        const res = await fetch("/api/amazon/minha-lista-ofertas/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, ...mlSessionBody }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar");
        uTot += json?.data?.updated ?? 0;
        fTot += json?.data?.failed ?? 0;
        if (Array.isArray(json?.data?.errors)) allErrors.push(...json.data.errors);
      };
      for (let i = 0; i < items.length; i += ML_LISTA_REFRESH_CHUNK) {
        const itemIds = items.slice(i, i + ML_LISTA_REFRESH_CHUNK).map((x) => x.id);
        await runChunk({ listaId, itemIds });
      }
      await loadItems(listaId);
      if (fTot > 0 && allErrors.length > 0) {
        setError(`Atualizados: ${uTot}. Com aviso: ${fTot}. ${allErrors[0]}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar lista");
    } finally {
      setRefreshTarget(null);
    }
  };

  const handleRefreshItem = async (itemId: string, listaId: string) => {
    setRefreshTarget(`item:${itemId}`);
    setError(null);
    try {
      const res = await fetch("/api/amazon/minha-lista-ofertas/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, ...mlSessionBody }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar");
      await loadItems(listaId);
      if ((json?.data?.failed ?? 0) > 0) {
        setError(json?.data?.errors?.[0] ?? "Não foi possível atualizar este item.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar item");
    } finally {
      setRefreshTarget(null);
    }
  };

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
      message: "Remover todos os produtos desta lista?",
      confirmLabel: "Esvaziar",
      variant: "danger",
      payload: { listaId },
    });
  };

  const handleDeleteListClick = (listaId: string) => {
    setConfirmState({
      type: "deleteList",
      title: "Apagar lista",
      message: "Apagar esta lista e todos os produtos?",
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
        const res = await fetch(`/api/amazon/minha-lista-ofertas?id=${payload.itemId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        setItemsByLista((prev) => ({
          ...prev,
          [payload.listaId]: (prev[payload.listaId] ?? []).filter((i) => i.id !== payload.itemId),
        }));
        setListas((prev) =>
          prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: Math.max(0, (l.totalItens ?? 0) - 1) } : l)),
        );
      } else if (type === "emptyList") {
        const res = await fetch(
          `/api/amazon/minha-lista-ofertas?lista_id=${payload.listaId}&empty=1`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Erro ao esvaziar");
        setItemsByLista((prev) => ({ ...prev, [payload.listaId]: [] }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: 0 } : l)));
      } else if (type === "deleteList") {
        const res = await fetch(`/api/amazon/minha-lista-ofertas/listas?id=${payload.listaId}`, {
          method: "DELETE",
        });
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

  const copyItemLink = (itemId: string, link: string) => {
    void navigator.clipboard.writeText(link).then(
      () => {
        setCopiedItemId(itemId);
        setTimeout(() => setCopiedItemId((c) => (c === itemId ? null : c)), 1600);
      },
      () => {},
    );
  };

  const copyItemAutomation = (item: Item) => {
    const text = buildMlListaAutomationText({
      productName: item.productName,
      priceOriginal: item.priceOriginal,
      pricePromo: item.pricePromo,
      discountRate: item.discountRate,
      couponPercent: item.couponPercent,
      couponAmount: item.couponAmount,
      commissionPct: item.affiliateCommissionPct,
      converterLink: item.converterLink,
      formatCurrency,
    });
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopiedItemId(item.id);
        setTimeout(() => setCopiedItemId((c) => (c === item.id ? null : c)), 1600);
      },
      () => {},
    );
  };
  const toggleLista = (listaId: string) => {
    setExpandedListas((prev) => {
      const next = new Set(prev);
      if (next.has(listaId)) next.delete(listaId);
      else {
        next.add(listaId);
        if (!itemsByLista[listaId]) void loadItems(listaId);
      }
      return next;
    });
  };

  const handleReorder = (listaId: string, newOrder: Item[]) => {
    setItemsByLista((prev) => {
      const allItems = [...(prev[listaId] ?? [])];
      const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
      const page = pageByLista[listaId] ?? 1;

      if (filter) {
        const filteredIndices = allItems
          .map((item, idx) => ((item.productName || "").toLowerCase().includes(filter) ? idx : -1))
          .filter((idx) => idx !== -1);
        
        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE;
        const pageIndices = filteredIndices.slice(from, to);

        pageIndices.forEach((originalIdx, i) => {
          if (newOrder[i]) {
            allItems[originalIdx] = newOrder[i];
          }
        });
      } else {
        const from = (page - 1) * ITEMS_PER_PAGE;
        allItems.splice(from, newOrder.length, ...newOrder);
      }

      return { ...prev, [listaId]: allItems };
    });
  };

  const saveNewOrder = async (listaId: string) => {
    // Cancela qualquer salvamento pendente para esta lista
    if (saveTimeoutRef.current[listaId]) {
      clearTimeout(saveTimeoutRef.current[listaId]);
    }

    // Agenda o salvamento para 500ms a partir de agora
    saveTimeoutRef.current[listaId] = setTimeout(async () => {
      const items = itemsByLista[listaId] || [];
      if (items.length === 0) return;

      setIsSyncingOrder(true);
      try {
        const res = await fetch("/api/amazon/minha-lista-ofertas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listaId,
            itemIds: items.map((i) => i.id),
          }),
        });

        if (!res.ok) throw new Error("Erro ao salvar ordem");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao salvar nova ordem");
      } finally {
        setIsSyncingOrder(false);
        delete saveTimeoutRef.current[listaId];
      }
    }, 500);
  };

  const moveItem = (listaId: string, index: number, direction: "up" | "down") => {
    const items = [...(itemsByLista[listaId] ?? [])];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    const [removed] = items.splice(index, 1);
    items.splice(newIndex, 0, removed);
    
    setItemsByLista((prev) => ({ ...prev, [listaId]: items }));
    void saveNewOrder(listaId);
  };

  const getFilteredAndPaginatedItems = (listaId: string) => {
    const items = itemsByLista[listaId] ?? [];
    const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
    const filtered = filter ? items.filter((i) => (i.productName || "").toLowerCase().includes(filter)) : items;
    const page = pageByLista[listaId] ?? 1;
    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const from = (page - 1) * ITEMS_PER_PAGE;
    const slice = filtered.slice(from, from + ITEMS_PER_PAGE);
    return { slice, totalPages, page, total: filtered.length };
  };

  const setListaPage = (listaId: string, page: number) => {
    setPageByLista((prev) => ({ ...prev, [listaId]: page }));
  };

  const openEditItemModal = useCallback((item: Item, listaId: string) => {
    setEditItemModal({ item, listaId });
    setEditItemForm({
      productName: item.productName ?? "",
      priceOriginal: moneyInputStringFromNumber(item.priceOriginal),
      pricePromo: moneyInputStringFromNumber(
        effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo,
      ),
      discountRate:
        item.discountRate != null && Number.isFinite(item.discountRate) ? String(item.discountRate) : "",
    });
  }, []);

  const submitEditItemModal = useCallback(async () => {
    if (!editItemModal) return;
    setSavingEditItem(true);
    setError(null);
    try {
      const po = parseMoneyInput(editItemForm.priceOriginal);
      let pp = parseMoneyInput(editItemForm.pricePromo);
      const dr = parsePercentInput(editItemForm.discountRate);
      const normalized = effectiveListaOfferPromoPrice(po, pp, dr);
      if (normalized != null) pp = normalized;

      const res = await fetch("/api/amazon/minha-lista-ofertas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editItemModal.item.id,
          productName: editItemForm.productName.trim(),
          priceOriginal: po,
          pricePromo: pp,
          discountRate: dr,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      await loadItems(editItemModal.listaId);
      setEditItemModal(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar alterações");
    } finally {
      setSavingEditItem(false);
    }
  }, [editItemModal, editItemForm, loadItems]);

  useEffect(() => {
    if (!editItemModal) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || savingEditItem) return;
      setEditItemModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [editItemModal, savingEditItem]);

  return (
    <div className={cn("rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden", className)}>
      <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
            <ListChecks className="w-3 h-3 text-[#e24c30]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Minhas listas e produtos (ML)</h2>
          {listas.length > 0 && (
            <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
              {listas.length} {listas.length === 1 ? "lista" : "listas"}
            </span>
          )}
        </div>
        <Link
          href="/dashboard/minha-lista-ofertas-ml"
          className="text-[11px] font-medium text-[#e24c30] hover:underline shrink-0"
        >
          Buscar / histórico ML →
        </Link>
      </div>

      {error && (
        <div className="px-3 py-2 border-b border-[#2c2c32] bg-red-500/5 text-[11px] text-red-400 flex items-center justify-between gap-2">
          <span className="min-w-0">{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-[#a0a0a0] hover:text-white shrink-0">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      <div className="max-h-[min(70vh,720px)] overflow-y-auto bg-[#1c1c1f] scrollbar-thin">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#e24c30]" />
          </div>
        ) : listas.length === 0 ? (
          <div className="mx-auto my-8 flex max-w-sm flex-col items-center justify-center rounded-2xl px-4 py-12 text-center">
            <ListChecks className="h-12 w-12 text-[#686868] mb-3" />
            <p className="font-medium text-[#f0f0f2]">Nenhuma lista ML ainda</p>
            <p className="text-xs text-[#bebebe] mt-2 leading-relaxed">
              Crie listas e adicione ofertas na página{" "}
              <Link href="/dashboard/minha-lista-ofertas-ml" className="text-[#e24c30] font-semibold hover:underline">
                Lista de Ofertas Amazon
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-3 sm:p-5">
            <ul className="space-y-3">
              {pagedListas.map((lista) => {
                const isExpanded = expandedListas.has(lista.id);
                const { slice, totalPages, page, total } = getFilteredAndPaginatedItems(lista.id);
                const listaItemsFull = itemsByLista[lista.id] ?? [];
                const mlIncompleteCount = listaItemsFull.filter(mlItemLooksIncomplete).length;
                const mlHasIncomplete = mlIncompleteCount > 0;
                return (
                  <li key={lista.id} className="rounded-xl border border-dark-border bg-dark-card overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleLista(lista.id)}
                      className="w-full p-4 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-dark-bg/50 transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-text-secondary shrink-0" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-text-secondary shrink-0" />
                        )}
                        <Store className="h-5 w-5 text-shopee-orange shrink-0" />
                        <span className="text-lg font-semibold text-text-primary truncate">{lista.nome}</span>
                        <span className="text-sm text-text-secondary shrink-0">({lista.totalItens ?? 0} itens)</span>
                      </span>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleEmptyListClick(lista.id); }}
                          disabled={(itemsByLista[lista.id]?.length ?? 0) === 0}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-dark-border text-text-secondary text-xs hover:bg-shopee-orange/10 hover:text-shopee-orange disabled:opacity-40"
                          title="Esvaziar lista"
                        >
                          <FolderMinus className="h-3.5 w-3.5" /> Esvaziar
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteListClick(lista.id); }}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-dark-border text-text-secondary text-xs hover:bg-red-500/10 hover:text-red-400"
                          title="Apagar lista"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Apagar
                        </button>
                      </div>
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
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Search className="h-4 w-4 text-text-secondary shrink-0" />
                              <input
                                type="text"
                                value={filterByLista[lista.id] ?? ""}
                                onChange={(e) => {
                                  setFilterByLista((prev) => ({ ...prev, [lista.id]: e.target.value }));
                                  setPageByLista((prev) => ({ ...prev, [lista.id]: 1 }));
                                }}
                                placeholder="Filtrar por nome…"
                                className="flex-1 px-3 py-2 rounded-lg border border-[#2c2c32] bg-[#222228] text-[#f0f0f2] text-sm placeholder:text-[#6b6b72]"
                              />
                              <button
                                type="button"
                                onClick={() => void handleRefreshLista(lista.id)}
                                disabled={refreshTarget !== null}
                                className={cn(
                                  "shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium disabled:opacity-50",
                                  mlHasIncomplete
                                    ? "border-shopee-orange bg-shopee-orange/15 text-shopee-orange"
                                    : "border-dark-border text-text-secondary hover:border-shopee-orange/45",
                                )}
                              >
                                {refreshTarget === `lista:${lista.id}` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3.5 w-3.5" />
                                )}
                                {mlHasIncomplete ? "Atualizar erros" : "Atualizar preços"}
                              </button>
                            </div>

                            <Reorder.Group
                              axis="y"
                              values={slice}
                              onReorder={(newOrder) => handleReorder(lista.id, newOrder)}
                              className="space-y-4"
                            >
                              {slice.map((item, idx) => (
                                <Reorder.Item
                                  key={item.id}
                                  value={item}
                                  onDragEnd={() => saveNewOrder(lista.id)}
                                  whileDrag={{ 
                                    scale: 1.02, 
                                    boxShadow: "0px 10px 30px rgba(0,0,0,0.5)",
                                    zIndex: 50 
                                  }}
                                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                  className="flex gap-4 p-3 rounded-xl border border-[#2c2c32] bg-[#222228] relative group hover:border-[#3e3e46] transition-colors touch-none"
                                >
                                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#3e3e46] group-hover:text-[#6b6b72] cursor-grab active:cursor-grabbing p-1">
                                    <GripVertical className="h-4 w-4" />
                                  </div>

                                  <div className="pl-6 flex gap-4 w-full">
                                    {item.imageUrl ? (
                                      <img
                                        src={item.imageUrl}
                                        alt=""
                                        className="w-20 h-20 object-contain rounded-lg bg-white shrink-0 border border-[#2c2c32]"
                                      />
                                    ) : (
                                      <div className="w-20 h-20 rounded-lg bg-[#1c1c1f] shrink-0 flex items-center justify-center border border-[#2c2c32]">
                                        <ImageIcon className="w-6 h-6 text-[#686868]" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-text-primary leading-snug">
                                          ✨ {item.productName || "Produto"}
                                        </p>
                                        <div className="flex flex-col gap-1">
                                          <button
                                            type="button"
                                            onClick={() => moveItem(lista.id, idx, "up")}
                                            disabled={idx === 0}
                                            className="p-1 rounded bg-[#2c2c32] text-[#a0a0a0] hover:text-white disabled:opacity-30 transition-colors"
                                            title="Mover para cima"
                                          >
                                            <ArrowUp className="h-3 w-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => moveItem(lista.id, idx, "down")}
                                            disabled={idx === (itemsByLista[lista.id]?.length ?? 0) - 1}
                                            className="p-1 rounded bg-[#2c2c32] text-[#a0a0a0] hover:text-white disabled:opacity-30 transition-colors"
                                            title="Mover para baixo"
                                          >
                                            <ArrowDown className="h-3 w-3" />
                                          </button>
                                        </div>
                                      </div>
                                      <p className="text-sm text-text-secondary mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                        <span className="shrink-0">💰 Preço:</span>
                                        {item.discountRate != null && item.discountRate > 0 ? (
                                          <span className="text-red-400 font-semibold">-{Math.round(item.discountRate)}%</span>
                                        ) : null}
                                        {item.priceOriginal != null &&
                                        Number.isFinite(item.priceOriginal) &&
                                        (effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo) != null &&
                                        item.priceOriginal >
                                          (effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ?? item.pricePromo ?? 0) ? (
                                          <span className="text-[#9c9c9c] line-through">
                                            🔴 {formatCurrency(item.priceOriginal)}
                                          </span>
                                        ) : null}
                                        <span className="text-text-secondary">por</span>
                                        <span className="text-emerald-400 font-bold">✅ {displayPrecoPorLista(item)}</span>
                                      </p>
                                      {item.couponPercent != null && item.couponPercent > 0 ? (
                                        <p className="text-xs text-amber-300 mt-1 flex items-center gap-1.5">
                                          <span>🎟️</span>
                                          <span className="font-semibold">Cupom de {Math.round(item.couponPercent)}%</span>
                                          <span className="text-[#9c9c9c]">no checkout</span>
                                        </p>
                                      ) : item.couponAmount != null && item.couponAmount > 0 ? (
                                        <p className="text-xs text-amber-300 mt-1 flex items-center gap-1.5">
                                          <span>🎟️</span>
                                          <span className="font-semibold">Cupom de {formatCurrency(item.couponAmount)}</span>
                                          <span className="text-[#9c9c9c]">no checkout</span>
                                        </p>
                                      ) : null}
                                      {item.affiliateCommissionPct != null && item.affiliateCommissionPct > 0 ? (
                                        (() => {
                                          const promo =
                                            effectiveListaOfferPromoPrice(item.priceOriginal, item.pricePromo, item.discountRate) ??
                                            item.pricePromo;
                                          const comm =
                                            promo != null && Number.isFinite(promo)
                                              ? Math.round(promo * (item.affiliateCommissionPct / 100) * 100) / 100
                                              : null;
                                          return comm != null ? (
                                            <p className="text-xs text-emerald-300 mt-1 flex items-center gap-1.5">
                                              <span>💸</span>
                                              <span className="font-semibold">Comissão Amazon: {item.affiliateCommissionPct.toFixed(1).replace(/\.0$/, "")}%</span>
                                              <span className="text-emerald-400">· {formatCurrency(comm)}</span>
                                            </p>
                                          ) : null;
                                        })()
                                      ) : null}
                                      <p className="text-[11px] text-text-secondary mt-1.5 flex items-start gap-1.5">
                                        <span className="shrink-0">🏷️</span>
                                        <span className="text-[#bebebe]">PROMOÇÃO - CLIQUE NO LINK 👇</span>
                                      </p>
                                      {item.converterLink ? (
                                        <p className="text-[11px] text-emerald-400 mt-0.5 break-all font-mono leading-tight">
                                          {item.converterLink}
                                        </p>
                                      ) : null}
                                      <div className="flex flex-wrap items-center gap-1 mt-2">
                                        <IconBtn
                                          title={copiedItemId === item.id ? "Copiado!" : "Copiar link"}
                                          active={copiedItemId === item.id}
                                          onClick={() => copyItemLink(item.id, item.converterLink)}
                                        >
                                          {copiedItemId === item.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                        </IconBtn>
                                        <button
                                          type="button"
                                          onClick={() => copyItemAutomation(item)}
                                          className="text-[10px] font-semibold px-2 py-1 rounded-md border border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 transition"
                                        >
                                          Copiar texto grupo
                                        </button>
                                        <IconBtn
                                          title="Abrir"
                                          onClick={() => window.open(item.converterLink, "_blank", "noopener,noreferrer")}
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                        </IconBtn>
                                        <button
                                          type="button"
                                          onClick={() => void handleRefreshItem(item.id, lista.id)}
                                          disabled={refreshTarget !== null}
                                          className={cn(
                                            "text-[11px] flex items-center gap-1 disabled:opacity-50 ml-1 px-2 py-1 rounded-md border",
                                            mlItemLooksIncomplete(item)
                                              ? "border-[#e24c30]/40 text-[#e24c30] bg-[#e24c30]/10"
                                              : "border-[#2c2c32] text-[#a0a0a0] hover:text-[#e24c30]",
                                          )}
                                        >
                                          {refreshTarget === `item:${item.id}` ? (
                                            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                          ) : (
                                            <RefreshCw className="h-3 w-3 shrink-0" />
                                          )}
                                          {mlItemLooksIncomplete(item) ? "Atualizar erro" : "Atualizar"}
                                        </button>
                                        <span className="ml-auto flex items-center gap-0.5 shrink-0">
                                          <IconBtn title="Editar" onClick={() => openEditItemModal(item, lista.id)}>
                                            <Pencil className="w-3.5 h-3.5" />
                                          </IconBtn>
                                          <IconBtn title="Remover" danger onClick={() => handleDeleteItemClick(item.id, lista.id)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </IconBtn>
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </Reorder.Item>
                              ))}
                            </Reorder.Group>

                            {totalPages > 1 && (
                              <GeradorPaginationBar
                                className="mt-4 border-t border-dark-border pt-3"
                                page={page}
                                totalPages={totalPages}
                                summary={`Mostrando ${slice.length} de ${total} produto(s)`}
                                onPrev={() => setListaPage(lista.id, Math.max(1, page - 1))}
                                onNext={() => setListaPage(lista.id, Math.min(totalPages, page + 1))}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {listas.length > 0 && (
              <div className="rounded-xl border border-[#2c2c32] bg-[#222228] px-3 py-3">
                <GeradorPaginationBar
                  page={listasPage}
                  totalPages={totalListasPages}
                  summary={`Mostrando ${pagedListas.length} de ${listas.length} lista(s)`}
                  onPrev={() => setListasPage((p) => Math.max(1, p - 1))}
                  onNext={() => setListasPage((p) => Math.min(totalListasPages, p + 1))}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {editItemModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className={mlModalOverlayClass}
              role="presentation"
              onClick={() => {
                if (!savingEditItem) setEditItemModal(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={editItemTitleId}
                className={`${mlModalShellClass} max-w-md max-h-[min(90vh,640px)]`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`${mlModalHeaderClass} flex items-start justify-between gap-3`}>
                  <div className="min-w-0">
                    <h2 id={editItemTitleId} className="text-sm font-bold text-text-primary flex items-center gap-2">
                      <Pencil className="h-4 w-4 text-shopee-orange" />
                      Editar produto
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!savingEditItem) setEditItemModal(null);
                    }}
                    className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-dark-bg"
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <label className={mlFieldLabelClass} htmlFor="ml-panel-edit-name">
                      Nome
                    </label>
                    <input
                      id="ml-panel-edit-name"
                      value={editItemForm.productName}
                      onChange={(e) => setEditItemForm((f) => ({ ...f, productName: e.target.value }))}
                      className={mlInputClass}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={mlFieldLabelClass}>Preço original</label>
                      <input
                        inputMode="decimal"
                        value={editItemForm.priceOriginal}
                        onChange={(e) => setEditItemForm((f) => ({ ...f, priceOriginal: e.target.value }))}
                        className={mlInputClass}
                      />
                    </div>
                    <div>
                      <label className={mlFieldLabelClass}>Preço final</label>
                      <input
                        inputMode="decimal"
                        value={editItemForm.pricePromo}
                        onChange={(e) => setEditItemForm((f) => ({ ...f, pricePromo: e.target.value }))}
                        className={mlInputClass}
                      />
                    </div>
                  </div>
                  <div className="sm:max-w-[200px]">
                    <label className={mlFieldLabelClass}>Desconto %</label>
                    <input
                      inputMode="decimal"
                      value={editItemForm.discountRate}
                      onChange={(e) => setEditItemForm((f) => ({ ...f, discountRate: e.target.value }))}
                      className={mlInputClass}
                    />
                  </div>
                </div>
                <div className={mlModalFooterClass}>
                  <button
                    type="button"
                    onClick={() => !savingEditItem && setEditItemModal(null)}
                    className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void submitEditItemModal()}
                    disabled={savingEditItem}
                    className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {savingEditItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Salvar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

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
  );
}
