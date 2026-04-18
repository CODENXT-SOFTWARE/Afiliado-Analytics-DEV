"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  Loader2,
  Trash2,
  ExternalLink,
  ListChecks,
  FolderMinus,
  ChevronDown,
  ChevronRight,
  Search,
  X,
  PlusCircle,
  Upload,
  Image as ImageIcon,
  Check,
  Pencil,
  Package,
  Tag,
  Link2,
  AlignLeft,
  FilePlus2,
  ListPlus,
} from "lucide-react";
import ConfirmModal from "@/app/components/ui/ConfirmModal";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";

// ─── Types ─────────────────────────────────────────────────────────────────────
type Produto = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  price: number | null;
  priceOld: number | null;
  createdAt: string;
};

type Lista = {
  id: string;
  nome: string;
  totalItens: number;
  createdAt?: string;
};

type Item = {
  id: string;
  listaId: string;
  produtoId: string | null;
  productName: string;
  description: string;
  imageUrl: string;
  link: string;
  price: number | null;
  priceOld: number | null;
  createdAt: string;
};

// ─── Utils ─────────────────────────────────────────────────────────────────────
function formatBRL(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

/** Linha de preço “de / por” com preço antigo riscado em vermelho + 📉 */
function InfoprodPriceLine({
  price,
  priceOld,
  size = "sm",
}: {
  price: number | null;
  priceOld?: number | null;
  size?: "sm" | "md";
}) {
  const hasPor = price != null && price > 0;
  const hasDe = priceOld != null && priceOld > 0;
  if (!hasPor && !hasDe) return null;
  const textBase = size === "sm" ? "text-[10px] text-[#9a9aa2]" : "text-sm text-[#9a9aa2]";
  return (
    <p className={`${textBase} mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5`}>
      <span aria-hidden>💰</span>
      {hasDe ? (
        <>
          <span>De:</span>
          <span className="text-red-400 line-through font-medium">{formatBRL(priceOld!)}</span>
          <span className="text-red-400/90" aria-hidden title="Preço anterior">
            📉
          </span>
        </>
      ) : null}
      {hasPor ? (
        <>
          <span>Por:</span>
          <span className="text-emerald-400 font-medium">{formatBRL(price!)}</span>
        </>
      ) : null}
    </p>
  );
}

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export default function InfoprodutorPage() {
  // ─── Estado: catálogo de produtos ──────────────────────────────────────────
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loadingProdutos, setLoadingProdutos] = useState(true);
  const [selectedProdutoIds, setSelectedProdutoIds] = useState<Set<string>>(new Set());
  const [produtoSearch, setProdutoSearch] = useState("");
  const [produtoPage, setProdutoPage] = useState(1);
  const PRODUTOS_PER_PAGE = 5;

  // ─── Estado: formulário de novo produto ────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [formEditId, setFormEditId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPriceOld, setFormPriceOld] = useState("");
  const [formImagePreview, setFormImagePreview] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduto, setSavingProduto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Estado: listas ────────────────────────────────────────────────────────
  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsByLista, setItemsByLista] = useState<Record<string, Item[]>>({});
  const [loadingListas, setLoadingListas] = useState(true);
  const [loadingListaId, setLoadingListaId] = useState<string | null>(null);
  const [expandedListas, setExpandedListas] = useState<Set<string>>(new Set());
  const [filterByLista, setFilterByLista] = useState<Record<string, string>>({});
  const [pageByLista, setPageByLista] = useState<Record<string, number>>({});
  const [listasPage, setListasPage] = useState(1);
  const LISTAS_PER_PAGE = 4;
  const ITEMS_PER_PAGE = 5;

  // ─── Estado: criação de lista ──────────────────────────────────────────────
  const [createListaOpen, setCreateListaOpen] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [savingLista, setSavingLista] = useState(false);
  const [addToListaOpen, setAddToListaOpen] = useState(false);
  const [targetListaId, setTargetListaId] = useState("");
  const [addingToLista, setAddingToLista] = useState(false);

  // ─── Estado: feedback / confirmações ───────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [confirmState, setConfirmState] = useState<{
    type: "deleteProduto" | "deleteItem" | "emptyList" | "deleteList";
    title: string;
    message: string;
    confirmLabel: string;
    variant: "danger" | "default";
    payload: { produtoId?: string; itemId?: string; listaId?: string };
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // ─── Carregamento ──────────────────────────────────────────────────────────
  const loadProdutos = useCallback(async () => {
    setLoadingProdutos(true);
    try {
      const res = await fetch("/api/infoprodutor/produtos");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar produtos");
      setProdutos(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar produtos");
      setProdutos([]);
    } finally {
      setLoadingProdutos(false);
    }
  }, []);

  const loadListas = useCallback(async () => {
    setLoadingListas(true);
    try {
      const res = await fetch("/api/infoprodutor/minha-lista-ofertas/listas");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar listas");
      setListas([]);
    } finally {
      setLoadingListas(false);
    }
  }, []);

  const loadItems = useCallback(async (listaId: string) => {
    setLoadingListaId(listaId);
    try {
      const res = await fetch(`/api/infoprodutor/minha-lista-ofertas?lista_id=${listaId}`);
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
    loadProdutos();
    loadListas();
  }, [loadProdutos, loadListas]);

  const toggleLista = (listaId: string) => {
    setExpandedListas((prev) => {
      const next = new Set(prev);
      if (next.has(listaId)) next.delete(listaId);
      else {
        next.add(listaId);
        if (!itemsByLista[listaId]) loadItems(listaId);
      }
      return next;
    });
  };

  // ─── Formulário: imagem ────────────────────────────────────────────────────
  const resetForm = () => {
    setFormMode("create");
    setFormEditId(null);
    setFormName("");
    setFormDescription("");
    setFormLink("");
    setFormPrice("");
    setFormPriceOld("");
    setFormImagePreview("");
    setFormImageUrl("");
    setFormImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = (f: File | null) => {
    setError(null);
    if (!f) {
      setFormImageFile(null);
      setFormImagePreview("");
      return;
    }
    if (!ALLOWED_TYPES.has(f.type)) {
      setError("Use uma imagem PNG, JPEG, WebP ou GIF.");
      return;
    }
    if (f.size > MAX_UPLOAD_BYTES) {
      setError("Imagem muito grande (máx 5MB).");
      return;
    }
    setFormImageFile(f);
    const reader = new FileReader();
    reader.onload = () => {
      setFormImagePreview(String(reader.result ?? ""));
    };
    reader.readAsDataURL(f);
  };

  const uploadImageIfNeeded = async (): Promise<string> => {
    if (!formImageFile) return formImageUrl || "";
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append("file", formImageFile);
      const res = await fetch("/api/infoprodutor/produtos/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao enviar imagem");
      return String(json?.url ?? "");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmitProduto = async () => {
    setError(null);
    if (!formName.trim()) {
      setError("O título do produto é obrigatório.");
      return;
    }
    if (!formLink.trim()) {
      setError("Informe o link de venda.");
      return;
    }
    setSavingProduto(true);
    try {
      const imageUrl = await uploadImageIfNeeded();
      const payload = {
        id: formEditId || undefined,
        name: formName.trim(),
        description: formDescription.trim(),
        link: formLink.trim(),
        price: formPrice.trim() ? Number(formPrice.replace(",", ".")) : null,
        priceOld: formPriceOld.trim() ? Number(formPriceOld.replace(",", ".")) : null,
        imageUrl,
      };

      const res = await fetch("/api/infoprodutor/produtos", {
        method: formMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar produto");

      setFeedback(formMode === "edit" ? "Produto atualizado." : "Produto adicionado ao catálogo.");
      setTimeout(() => setFeedback(""), 4000);
      resetForm();
      setFormOpen(false);
      loadProdutos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar produto");
    } finally {
      setSavingProduto(false);
    }
  };

  const handleEditProduto = (p: Produto) => {
    setFormMode("edit");
    setFormEditId(p.id);
    setFormName(p.name);
    setFormDescription(p.description ?? "");
    setFormLink(p.link);
    setFormPrice(p.price != null ? String(p.price) : "");
    setFormPriceOld(p.priceOld != null ? String(p.priceOld) : "");
    setFormImageUrl(p.imageUrl ?? "");
    setFormImagePreview(p.imageUrl ?? "");
    setFormImageFile(null);
    setFormOpen(true);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Seleção + criação de lista ─────────────────────────────────────────────
  const toggleSelectProduto = (id: string) => {
    setSelectedProdutoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisibleProdutos = () => {
    setSelectedProdutoIds((prev) => {
      const next = new Set(prev);
      pagedProdutos.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => setSelectedProdutoIds(new Set());

  const openCreateLista = () => {
    if (selectedProdutoIds.size === 0) {
      setError("Selecione ao menos um produto para criar a lista.");
      return;
    }
    setError(null);
    setNovaListaNome("");
    setCreateListaOpen(true);
  };

  const handleCreateLista = async () => {
    const nome = novaListaNome.trim();
    if (!nome) {
      setError("Dê um nome para a lista.");
      return;
    }
    setSavingLista(true);
    try {
      const res = await fetch("/api/infoprodutor/minha-lista-ofertas/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome, produtosIds: Array.from(selectedProdutoIds) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar lista");

      setFeedback(`Lista "${json?.data?.nome ?? nome}" criada com ${json?.data?.totalItens ?? 0} produto(s).`);
      setTimeout(() => setFeedback(""), 5000);
      setCreateListaOpen(false);
      clearSelection();
      loadListas();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar lista");
    } finally {
      setSavingLista(false);
    }
  };

  const openAddToLista = () => {
    if (selectedProdutoIds.size === 0) {
      setError("Selecione ao menos um produto para adicionar à lista.");
      return;
    }
    if (listas.length === 0) {
      setError("Crie uma lista primeiro (botão Criar lista).");
      return;
    }
    setError(null);
    setTargetListaId((prev) => (prev && listas.some((l) => l.id === prev) ? prev : listas[0]?.id ?? ""));
    setAddToListaOpen(true);
  };

  const handleAddToLista = async (listaIdParam?: string) => {
    const listaId = (listaIdParam ?? targetListaId).trim();
    if (!listaId) {
      setError("Escolha uma lista.");
      return;
    }
    setAddingToLista(true);
    setError(null);
    try {
      const resItems = await fetch(`/api/infoprodutor/minha-lista-ofertas?lista_id=${encodeURIComponent(listaId)}`);
      const jsonItems = await resItems.json();
      if (!resItems.ok) throw new Error(jsonItems?.error ?? "Erro ao carregar itens da lista");
      const rawItems: Item[] = Array.isArray(jsonItems?.data) ? jsonItems.data : [];
      const existing = new Set(
        rawItems.map((i) => i.produtoId).filter((id): id is string => Boolean(id)),
      );
      const toAdd = Array.from(selectedProdutoIds).filter((id) => !existing.has(id));
      if (toAdd.length === 0) {
        setError("Todos os produtos selecionados já estão nesta lista.");
        setAddingToLista(false);
        return;
      }
      const results = await Promise.all(
        toAdd.map((produtoId) =>
          fetch("/api/infoprodutor/minha-lista-ofertas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ listaId, produtoId }),
          }).then(async (r) => {
            const j = await r.json().catch(() => ({}));
            return { ok: r.ok, error: j?.error as string | undefined };
          }),
        ),
      );
      const failed = results.find((r) => !r.ok);
      if (failed) throw new Error(failed.error ?? "Erro ao adicionar produto(s)");

      const listaNome = listas.find((l) => l.id === listaId)?.nome ?? "lista";
      setFeedback(`${toAdd.length} produto(s) adicionado(s) à "${listaNome}".`);
      setTimeout(() => setFeedback(""), 5000);
      setAddToListaOpen(false);
      clearSelection();
      await loadListas();
      await loadItems(listaId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar à lista");
    } finally {
      setAddingToLista(false);
    }
  };

  // ─── Ações destrutivas ─────────────────────────────────────────────────────
  const askDeleteProduto = (produtoId: string, nome: string) => {
    setConfirmState({
      type: "deleteProduto",
      title: "Remover produto",
      message: `Remover "${nome}" do catálogo? Os itens já copiados em listas permanecerão.`,
      confirmLabel: "Remover",
      variant: "danger",
      payload: { produtoId },
    });
  };
  const askDeleteItem = (itemId: string, listaId: string) => {
    setConfirmState({
      type: "deleteItem",
      title: "Remover da lista",
      message: "Remover este produto da lista?",
      confirmLabel: "Remover",
      variant: "danger",
      payload: { itemId, listaId },
    });
  };
  const askEmptyLista = (listaId: string) => {
    setConfirmState({
      type: "emptyList",
      title: "Esvaziar lista",
      message: "Remover todos os produtos desta lista? A lista continuará existindo.",
      confirmLabel: "Esvaziar",
      variant: "danger",
      payload: { listaId },
    });
  };
  const askDeleteLista = (listaId: string) => {
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
      if (type === "deleteProduto" && payload.produtoId) {
        const res = await fetch(`/api/infoprodutor/produtos?id=${payload.produtoId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover produto");
        setProdutos((prev) => prev.filter((p) => p.id !== payload.produtoId));
        setSelectedProdutoIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.produtoId!);
          return next;
        });
      } else if (type === "deleteItem" && payload.itemId && payload.listaId) {
        const res = await fetch(`/api/infoprodutor/minha-lista-ofertas?id=${payload.itemId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao remover");
        setItemsByLista((prev) => ({
          ...prev,
          [payload.listaId!]: (prev[payload.listaId!] ?? []).filter((i) => i.id !== payload.itemId),
        }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: Math.max(0, (l.totalItens ?? 0) - 1) } : l)));
      } else if (type === "emptyList" && payload.listaId) {
        const res = await fetch(`/api/infoprodutor/minha-lista-ofertas?lista_id=${payload.listaId}&empty=1`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao esvaziar");
        setItemsByLista((prev) => ({ ...prev, [payload.listaId!]: [] }));
        setListas((prev) => prev.map((l) => (l.id === payload.listaId ? { ...l, totalItens: 0 } : l)));
      } else if (type === "deleteList" && payload.listaId) {
        const res = await fetch(`/api/infoprodutor/minha-lista-ofertas/listas?id=${payload.listaId}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao apagar lista");
        setListas((prev) => prev.filter((l) => l.id !== payload.listaId));
        setItemsByLista((prev) => {
          const next = { ...prev };
          delete next[payload.listaId!];
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

  // ─── Derivados / paginação ─────────────────────────────────────────────────
  const filteredProdutos = useMemo(() => {
    const q = produtoSearch.trim().toLowerCase();
    if (!q) return produtos;
    return produtos.filter((p) => p.name.toLowerCase().includes(q));
  }, [produtos, produtoSearch]);

  const totalProdutosPages = Math.max(1, Math.ceil(filteredProdutos.length / PRODUTOS_PER_PAGE));
  const safeProdutoPage = Math.min(produtoPage, totalProdutosPages);
  const pagedProdutos = useMemo(() => {
    const from = (safeProdutoPage - 1) * PRODUTOS_PER_PAGE;
    return filteredProdutos.slice(from, from + PRODUTOS_PER_PAGE);
  }, [filteredProdutos, safeProdutoPage]);

  useEffect(() => {
    setProdutoPage((p) => Math.min(Math.max(1, p), totalProdutosPages));
  }, [filteredProdutos.length, totalProdutosPages]);

  const totalListasPages = Math.max(1, Math.ceil(listas.length / LISTAS_PER_PAGE));
  const pagedListas = useMemo(() => {
    const from = (listasPage - 1) * LISTAS_PER_PAGE;
    return listas.slice(from, from + LISTAS_PER_PAGE);
  }, [listas, listasPage]);

  useEffect(() => {
    setListasPage((p) => Math.min(Math.max(1, p), totalListasPages));
  }, [listas.length, totalListasPages]);

  const listaDestinoPickerOptions = useMemo(
    () =>
      listas.map((l) => ({
        value: l.id,
        label: l.nome,
        description: `${l.totalItens ?? 0} ${(l.totalItens ?? 0) === 1 ? "item" : "itens"}`,
      })),
    [listas],
  );

  const getItemsPaged = (listaId: string) => {
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

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl border border-[#e24c30]/35 bg-[#e24c30]/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="h-5 w-5 text-[#e24c30]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight">Infoprodutor</h1>
            
          </div>
        </div>

        {/* Feedback / erro */}
        {feedback ? (
          <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-300 flex items-center gap-2">
            <Check className="w-3.5 h-3.5" />
            <span className="min-w-0">{feedback}</span>
          </div>
        ) : null}
        {error ? (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-300 flex items-center justify-between gap-2">
            <span className="min-w-0">{error}</span>
            <button type="button" onClick={() => setError(null)} aria-label="Fechar" className="text-red-200 hover:text-white shrink-0">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : null}

        {/* ═══════════════ FORMULÁRIO DE PRODUTO (topo: CTA abre o painel, sem dropdown) ═══════════════ */}
        <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mb-6">
          {!formOpen ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              className="w-full px-4 sm:px-6 py-5 flex items-center justify-center gap-3 bg-[#222228] hover:bg-[#2a2a30] transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
                <FilePlus2 className="w-5 h-5 text-[#e24c30]" />
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <h2 className="text-sm font-bold text-[#f0f0f2]">Cadastrar novo produto</h2>
               
              </div>
            </button>
          ) : (
            <div className="bg-[#1c1c1f]">
              <div className="px-4 sm:px-5 py-3 border-b border-[#2c2c32] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
                    {formMode === "edit" ? (
                      <Pencil className="w-4 h-4 text-[#e24c30]" />
                    ) : (
                      <FilePlus2 className="w-4 h-4 text-[#e24c30]" />
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-[#f0f0f2] truncate">
                    {formMode === "edit" ? "Editar produto" : "Novo produto"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setFormOpen(false);
                  }}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3e3e46] text-[11px] text-[#d2d2d2] hover:bg-[#2f2f34] hover:text-white transition-colors"
                  disabled={savingProduto || uploadingImage}
                >
                  <X className="w-3.5 h-3.5" />
                  Fechar
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,88px)_1fr] gap-4 md:gap-5">
                {/* Upload de imagem — compacto no desktop */}
                <div className="flex flex-col items-center md:items-stretch md:max-w-[88px] mx-auto md:mx-0 w-full max-w-[140px] md:max-w-[88px]">
                  <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5 w-full text-center md:text-left">
                    <ImageIcon className="inline w-2.5 h-2.5 mr-1" />
                    Foto
                  </label>
                  <label
                    htmlFor="infoprod-image-input"
                    className="relative block aspect-square w-full rounded-xl border-2 border-dashed border-[#3e3e46] bg-[#222228] hover:border-[#e24c30]/50 hover:bg-[#e24c30]/5 transition-colors cursor-pointer overflow-hidden group"
                  >
                    {formImagePreview ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={formImagePreview}
                          alt="Pré-visualização"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                          <span className="text-white text-[10px] font-semibold opacity-0 group-hover:opacity-100">
                            Trocar imagem
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full gap-1.5 text-[#a0a0a0] p-2 text-center">
                        <Upload className="w-5 h-5" />
                        <span className="text-[10px] font-medium">Clique para enviar</span>
                        
                      </div>
                    )}
                    <input
                      ref={fileInputRef}
                      id="infoprod-image-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  {formImagePreview ? (
                    <button
                      type="button"
                      onClick={() => {
                        setFormImageFile(null);
                        setFormImagePreview("");
                        setFormImageUrl("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="mt-1.5 w-full text-[10px] text-[#a0a0a0] hover:text-red-400 flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Remover
                    </button>
                  ) : null}
                </div>

                {/* Campos de texto */}
                <div className="space-y-3 min-w-0">
                  <div>
                    <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                      <Package className="inline w-2.5 h-2.5 mr-1" /> Título do produto
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="Ex.: Método de Venda Direta (R$ 97)"
                      className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                      <AlignLeft className="inline w-2.5 h-2.5 mr-1" /> Descrição (opcional)
                    </label>
                    <textarea
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Apresente os benefícios — será a legenda enviada ao WhatsApp."
                      className="w-full min-h-[80px] bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none resize-y scrollbar-thin leading-relaxed transition"
                    />
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                        <Link2 className="inline w-2.5 h-2.5 mr-1" /> Link de venda
                      </label>
                      <input
                        type="url"
                        value={formLink}
                        onChange={(e) => setFormLink(e.target.value)}
                        placeholder="https://pay.hotmart.com/..."
                        className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                          <Tag className="inline w-2.5 h-2.5 mr-1" /> Preço atual (opcional)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value)}
                          placeholder="97,00"
                          className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                          <Tag className="inline w-2.5 h-2.5 mr-1" /> Preço antigo (opcional)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formPriceOld}
                          onChange={(e) => setFormPriceOld(e.target.value)}
                          placeholder="197,00"
                          className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                        />
                     
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2c2c32]">
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setFormOpen(false);
                  }}
                  className="px-3 py-2 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#2f2f34]"
                  disabled={savingProduto || uploadingImage}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSubmitProduto}
                  disabled={savingProduto || uploadingImage}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#e24c30] hover:bg-[#c94028] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {savingProduto || uploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : formMode === "edit" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  {uploadingImage
                    ? "Enviando imagem…"
                    : savingProduto
                      ? "Salvando…"
                      : formMode === "edit"
                        ? "Salvar alterações"
                        : "Adicionar ao catálogo"}
                </button>
              </div>
              </div>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 lg:items-start">
        {/* ═══════════════ MEUS PRODUTOS ═══════════════ */}
        <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mb-6 lg:mb-0">
          <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
                <Package className="w-3 h-3 text-[#e24c30]" />
              </div>
              <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Meus Produtos</h2>
              <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
                {produtos.length}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-end">
            <button
              type="button"
              onClick={openCreateLista}
              disabled={selectedProdutoIds.size === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#e24c30] hover:bg-[#c94028] text-white"
              title={selectedProdutoIds.size === 0 ? "Selecione produtos para criar uma lista" : ""}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Criar lista ({selectedProdutoIds.size})
            </button>
            <button
              type="button"
              onClick={openAddToLista}
              disabled={selectedProdutoIds.size === 0 || listas.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[#e24c30]/45 bg-[#e24c30]/10 text-[#f0f0f2] hover:bg-[#e24c30]/18 hover:border-[#e24c30]/60"
              title={
                selectedProdutoIds.size === 0
                  ? "Selecione produtos para adicionar a uma lista"
                  : listas.length === 0
                    ? "Crie uma lista primeiro (Criar lista)"
                    : "Adicionar produtos selecionados a uma lista existente"
              }
            >
              <ListPlus className="w-3.5 h-3.5" />
              Adicionar à lista
            </button>
            </div>
          </div>

          <div className="px-3 sm:px-5 py-3 border-b border-[#2c2c32] bg-[#222228] flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Search className="h-3.5 w-3.5 text-[#a0a0a0] shrink-0" />
              <input
                type="text"
                value={produtoSearch}
                onChange={(e) => setProdutoSearch(e.target.value)}
                placeholder="Filtrar por nome do produto…"
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2c32] bg-[#1c1c1f] text-[#f0f0f2] text-[11px] placeholder:text-[#6b6b72] outline-none focus:border-[#e24c30]"
              />
            </div>
            {pagedProdutos.length > 0 ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={selectAllVisibleProdutos}
                  className="text-[10px] text-[#a0a0a0] hover:text-white"
                >
                  Selecionar página
                </button>
                {selectedProdutoIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="text-[10px] text-[#a0a0a0] hover:text-white"
                  >
                    Limpar ({selectedProdutoIds.size})
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="bg-[#1c1c1f]">
            {loadingProdutos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#e24c30]" />
              </div>
            ) : produtos.length === 0 ? (
              <div className="mx-auto my-8 flex max-w-sm flex-col items-center justify-center rounded-2xl px-4 py-10 text-center">
                <Package className="h-10 w-10 text-[#686868] mb-3" />
                <p className="font-medium text-[#f0f0f2] text-sm">Nenhum produto ainda</p>
                <p className="text-[11px] text-[#bebebe] mt-2 leading-relaxed">
                  Cadastre o primeiro produto acima para começar a montar listas.
                </p>
              </div>
            ) : filteredProdutos.length === 0 ? (
              <p className="py-8 text-center text-[11px] text-[#9a9aa2]">
                Nenhum produto bate com o filtro.
              </p>
            ) : (
              <ul className="divide-y divide-[#2c2c32]">
                {pagedProdutos.map((p) => {
                  const checked = selectedProdutoIds.has(p.id);
                  return (
                    <li
                      key={p.id}
                      className={`flex items-center gap-3 px-3 sm:px-5 py-3 transition-colors ${
                        checked ? "bg-[#e24c30]/8" : "hover:bg-[#222228]"
                      }`}
                    >
                      <label className="flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectProduto(p.id)}
                          className="w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#e24c30]"
                        />
                      </label>

                      {p.imageUrl ? (
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-white shrink-0 border border-[#2c2c32]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-[#222228] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72]">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-semibold text-[#f0f0f2] leading-snug truncate">
                          {p.name}
                        </p>
                        {p.description ? (
                          <p className="text-[10px] text-[#9a9aa2] leading-snug truncate mt-0.5">
                            {p.description}
                          </p>
                        ) : null}
                        <div className="flex flex-col gap-1 mt-1 min-w-0">
                          <InfoprodPriceLine price={p.price} priceOld={p.priceOld} size="sm" />
                          <a
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-[#e24c30] hover:underline flex items-center gap-1 min-w-0"
                            title={p.link}
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate max-w-[220px]">{p.link}</span>
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEditProduto(p)}
                          className="p-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] hover:bg-[#e24c30]/10 hover:text-[#e24c30] hover:border-[#e24c30]/40"
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => askDeleteProduto(p.id, p.name)}
                          className="p-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                          title="Remover do catálogo"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {filteredProdutos.length > PRODUTOS_PER_PAGE ? (
            <div className="px-3 py-3 border-t border-[#2c2c32] bg-[#222228]">
              <GeradorPaginationBar
                page={safeProdutoPage}
                totalPages={totalProdutosPages}
                summary={`Mostrando ${pagedProdutos.length} de ${filteredProdutos.length} produto(s)`}
                onPrev={() => setProdutoPage((p) => Math.max(1, p - 1))}
                onNext={() => setProdutoPage((p) => Math.min(totalProdutosPages, p + 1))}
              />
            </div>
          ) : null}
        </section>

        {/* ═══════════════ MINHAS LISTAS ═══════════════ */}
        <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden">
          <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
                <ListChecks className="w-3 h-3 text-[#e24c30]" />
              </div>
              <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Minhas Listas do Infoprodutor</h2>
              {!loadingListas && listas.length > 0 ? (
                <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
                  {listas.length} {listas.length === 1 ? "lista" : "listas"}
                </span>
              ) : null}
            </div>
         
          </div>

          <div className="max-h-[min(70vh,720px)] overflow-y-auto bg-[#1c1c1f] scrollbar-thin">
            {loadingListas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#e24c30]" />
              </div>
            ) : listas.length === 0 ? (
              <div className="mx-auto my-8 flex max-w-sm flex-col items-center justify-center rounded-2xl px-4 py-12 text-center">
                <ListChecks className="h-12 w-12 text-[#686868] mb-3" />
                <p className="font-medium text-[#f0f0f2]">Nenhuma lista ainda</p>
                <p className="text-xs text-[#bebebe] mt-2 leading-relaxed">
                  Selecione produtos em <strong>Meus Produtos</strong> e use <strong>Criar lista</strong> para uma lista nova, ou{" "}
                  <strong>Adicionar à lista</strong> para copiar às listas que você já tem.
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-3 sm:p-5">
                <ul className="space-y-3">
                  {pagedListas.map((lista) => {
                    const isExpanded = expandedListas.has(lista.id);
                    const { slice, totalPages, page, total } = getItemsPaged(lista.id);
                    return (
                      <li key={lista.id} className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden">
                        <div className="flex flex-wrap items-stretch gap-0">
                          <button
                            type="button"
                            onClick={() => toggleLista(lista.id)}
                            className="flex-1 min-w-0 p-4 flex flex-wrap items-center justify-between gap-2 text-left hover:bg-[#2f2f34]/80 transition-colors"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-[#a0a0a0] shrink-0" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-[#a0a0a0] shrink-0" />
                              )}
                              <div className="w-8 h-8 rounded-lg border border-[#e24c30]/35 bg-[#e24c30]/10 flex items-center justify-center shrink-0">
                                <ShoppingCart className="h-4 w-4 text-[#e24c30]" />
                              </div>
                              <span className="text-sm font-bold uppercase tracking-wide text-[#f0f0f2] truncate">
                                {lista.nome}
                              </span>
                              <span className="text-sm text-[#9a9aa2] shrink-0">
                                ({lista.totalItens ?? 0} itens)
                              </span>
                            </span>
                          </button>
                          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end px-4 py-4 pl-0 sm:pl-2 border-t border-[#2c2c32] sm:border-t-0 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={() => askEmptyLista(lista.id)}
                              disabled={(itemsByLista[lista.id]?.length ?? lista.totalItens ?? 0) === 0}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#e24c30]/10 hover:text-[#e24c30] hover:border-[#e24c30]/40 disabled:opacity-40"
                              title="Esvaziar lista"
                            >
                              <FolderMinus className="h-3.5 w-3.5" /> Esvaziar
                            </button>
                            <button
                              type="button"
                              onClick={() => askDeleteLista(lista.id)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30"
                              title="Apagar lista"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Apagar
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-[#2c2c32] p-4 bg-[#1c1c1f]">
                            {loadingListaId === lista.id ? (
                              <div className="flex justify-center py-6">
                                <Loader2 className="h-6 w-6 animate-spin text-[#e24c30]" />
                              </div>
                            ) : !itemsByLista[lista.id]?.length ? (
                              <p className="text-sm text-[#9a9aa2] py-4 text-center">
                                Nenhum produto nesta lista.
                              </p>
                            ) : (
                              <>
                                <div className="mb-3 flex items-center gap-2">
                                  <Search className="h-4 w-4 text-[#a0a0a0] shrink-0" />
                                  <input
                                    type="text"
                                    value={filterByLista[lista.id] ?? ""}
                                    onChange={(e) => {
                                      setFilterByLista((prev) => ({ ...prev, [lista.id]: e.target.value }));
                                      setPageByLista((prev) => ({ ...prev, [lista.id]: 1 }));
                                    }}
                                    placeholder="Filtrar por nome do produto..."
                                    className="flex-1 px-3 py-2 rounded-lg border border-[#2c2c32] bg-[#222228] text-[#f0f0f2] text-sm placeholder:text-[#6b6b72]"
                                  />
                                </div>
                                <ul className="space-y-4">
                                  {slice.map((item) => (
                                    <li
                                      key={item.id}
                                      className="flex gap-4 p-3 rounded-xl border border-[#2c2c32] bg-[#222228]"
                                    >
                                      {item.imageUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={item.imageUrl}
                                          alt=""
                                          className="w-20 h-20 object-cover rounded-lg bg-white shrink-0 border border-[#2c2c32]"
                                        />
                                      ) : (
                                        <div className="w-20 h-20 rounded-lg bg-[#1c1c1f] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72]">
                                          <ImageIcon className="w-5 h-5" />
                                        </div>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-[#f0f0f2] leading-snug">
                                          ✨ {item.productName || "Produto"}
                                        </p>
                                        {item.description ? (
                                          <p className="text-[11px] text-[#9a9aa2] leading-snug mt-1 whitespace-pre-wrap break-words line-clamp-3">
                                            {item.description}
                                          </p>
                                        ) : null}
                                        <InfoprodPriceLine price={item.price} priceOld={item.priceOld} size="md" />
                                        <p className="text-sm font-medium text-[#f0f0f2] mt-1">
                                          🛒 GARANTA O SEU - CLIQUE NO LINK 👇
                                        </p>
                                        <a
                                          href={item.link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm text-emerald-400 hover:underline break-all text-left"
                                        >
                                          {item.link}
                                        </a>
                                        <div className="flex items-center gap-2 mt-2">
                                          <a
                                            href={item.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-[#e24c30] hover:underline flex items-center gap-1"
                                          >
                                            <ExternalLink className="h-3 w-3" /> Abrir link
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => askDeleteItem(item.id, lista.id)}
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
                                  <GeradorPaginationBar
                                    className="mt-4 border-t border-[#2c2c32] pt-3"
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

                {listas.length > LISTAS_PER_PAGE ? (
                  <div className="rounded-xl border border-[#2c2c32] bg-[#222228] px-3 py-3">
                    <GeradorPaginationBar
                      page={listasPage}
                      totalPages={totalListasPages}
                      summary={`Mostrando ${pagedListas.length} de ${listas.length} lista(s)`}
                      onPrev={() => setListasPage((p) => Math.max(1, p - 1))}
                      onNext={() => setListasPage((p) => Math.min(totalListasPages, p + 1))}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </section>
        </div>

        {/* Modal: criar lista */}
        {createListaOpen ? (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => (savingLista ? null : setCreateListaOpen(false))}
          >
            <div
              className="w-full max-w-sm rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] shadow-2xl p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg border border-[#e24c30]/35 bg-[#e24c30]/10 flex items-center justify-center shrink-0">
                  <ListChecks className="w-4 h-4 text-[#e24c30]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#f0f0f2]">Criar nova lista</h3>
                  <p className="text-[10px] text-[#a0a0a0]">
                    {selectedProdutoIds.size} produto(s) selecionado(s) serão copiados para a lista.
                  </p>
                </div>
              </div>

              <label className="block text-[10px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                Nome da lista
              </label>
              <input
                type="text"
                value={novaListaNome}
                onChange={(e) => setNovaListaNome(e.target.value)}
                placeholder="Ex.: Meus Infoprodutos - Curso de Vendas"
                autoFocus
                disabled={savingLista}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateLista();
                  if (e.key === "Escape" && !savingLista) setCreateListaOpen(false);
                }}
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-sm text-[#f0f0f2] placeholder:text-[#6b6b72] focus:border-[#e24c30] outline-none transition"
              />

              <div className="flex items-center justify-end gap-2 mt-5">
                <button
                  type="button"
                  onClick={() => setCreateListaOpen(false)}
                  disabled={savingLista}
                  className="px-3 py-2 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#2f2f34]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateLista}
                  disabled={savingLista || !novaListaNome.trim()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#e24c30] hover:bg-[#c94028] text-white text-xs font-semibold disabled:opacity-60"
                >
                  {savingLista ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {savingLista ? "Criando…" : "Criar lista"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Abre direto o modal com busca + lista (igual Página do Facebook), sem passo extra de “select” */}
        {addToListaOpen ? (
          <MetaSearchablePicker
            hideTrigger
            modalOpen={addToListaOpen}
            onModalOpenChange={(o) => {
              if (!o) setAddToListaOpen(false);
            }}
            value={targetListaId}
            onChange={(listId) => {
              setTargetListaId(listId);
              void handleAddToLista(listId);
            }}
            options={listaDestinoPickerOptions}
            modalTitle="Lista de destino"
            modalDescription={`${selectedProdutoIds.size} produto(s) selecionado(s) serão copiados (snapshot). Itens que já estão na lista são ignorados.`}
            searchPlaceholder="Filtrar listas…"
            emptyButtonLabel="Buscar e selecionar lista"
            emptyAsTag
            emptyTagLabel="Selecionar lista"
            emptyOptionsMessage="Nenhuma lista cadastrada."
            disabled={addingToLista}
          />
        ) : null}

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
