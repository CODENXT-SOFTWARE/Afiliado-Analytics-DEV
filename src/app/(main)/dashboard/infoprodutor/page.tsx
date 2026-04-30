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
  CreditCard,
  AlertTriangle,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Reorder } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import ConfirmModal from "@/app/components/ui/ConfirmModal";
import Toolist from "@/app/components/ui/Toolist";
import FreteCalculator from "@/app/components/frete/FreteCalculator";
import CustomCheckoutTab from "./CustomCheckoutTab";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import MpSalesDashboard from "./MpSalesDashboard";
import MpOrdersSection from "./MpOrdersSection";
import AdPerformanceTable from "./AdPerformanceTable";
import InfoprodGrupoMessagePreview from "./InfoprodGrupoMessagePreview";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProductProvider = "manual" | "mercadopago";

type Produto = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  link: string;
  price: number | null;
  priceOld: number | null;
  provider: ProductProvider;
  subid: string | null;
  allowShipping: boolean;
  allowPickup: boolean;
  allowDigital: boolean;
  allowLocalDelivery: boolean;
  shippingCost: number | null;
  localDeliveryCost: number | null;
  thankYouMessage: string;
  pesoG: number | null;
  alturaCm: number | null;
  larguraCm: number | null;
  comprimentoCm: number | null;
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
          <span className="text-[#EE4D2D] font-medium">{formatBRL(price!)}</span>
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

type TabKey = "produtos" | "vendas" | "trackeamento" | "custom-checkout";

export default function InfoprodutorPage() {
  // ─── Navegação entre abas ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>("produtos");

  // Sinal global de refresh pras seções Vendas/Trackeamento (cache invalidado ao clicar).
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [refreshingTab, setRefreshingTab] = useState(false);

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
  const [formProvider, setFormProvider] = useState<ProductProvider>("manual");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formLink, setFormLink] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPriceOld, setFormPriceOld] = useState("");
  const [formSubid, setFormSubid] = useState("");
  const [formAllowShipping, setFormAllowShipping] = useState(true);
  const [formAllowPickup, setFormAllowPickup] = useState(false);
  const [formAllowDigital, setFormAllowDigital] = useState(false);
  const [formAllowLocalDelivery, setFormAllowLocalDelivery] = useState(false);
  const [formShippingCost, setFormShippingCost] = useState("");
  const [formLocalDeliveryCost, setFormLocalDeliveryCost] = useState("");
  const [formDeliveryExpanded, setFormDeliveryExpanded] = useState(false);
  const [formPesoG, setFormPesoG] = useState("");
  const [formAlturaCm, setFormAlturaCm] = useState("");
  const [formLarguraCm, setFormLarguraCm] = useState("");
  const [formComprimentoCm, setFormComprimentoCm] = useState("");
  const [formThankYouMessage, setFormThankYouMessage] = useState("");
  /** MP: mensagem customizada no WhatsApp após compra; desligado = backend usa texto padrão. */
  const [formThankYouEnabled, setFormThankYouEnabled] = useState(false);
  const [formImagePreview, setFormImagePreview] = useState<string>("");
  const [formImageUrl, setFormImageUrl] = useState<string>("");
  const [formImageFile, setFormImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingProduto, setSavingProduto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Estado: status da conexão de pagamento ────────────────────────────────
  const [mpConnected, setMpConnected] = useState(false);
  const [mpLast4, setMpLast4] = useState<string | null>(null);

  // ─── Estado: listas ────────────────────────────────────────────────────────
  const [listas, setListas] = useState<Lista[]>([]);
  const [itemsByLista, setItemsByLista] = useState<Record<string, Item[]>>({});
  const [loadingListas, setLoadingListas] = useState(true);
  const [loadingListaId, setLoadingListaId] = useState<string | null>(null);
  const [expandedListas, setExpandedListas] = useState<Set<string>>(new Set());
  const [filterByLista, setFilterByLista] = useState<Record<string, string>>({});
  const [pageByLista, setPageByLista] = useState<Record<string, number>>({});
  const [listasPage, setListasPage] = useState(1);
  const [listaSearch, setListaSearch] = useState("");
  const LISTAS_PER_PAGE = 6;
  const ITEMS_PER_PAGE = 5;

  // ─── Estado: criação de lista ──────────────────────────────────────────────
  const [createListaOpen, setCreateListaOpen] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [savingLista, setSavingLista] = useState(false);
  const [addToListaOpen, setAddToListaOpen] = useState(false);
  const [targetListaId, setTargetListaId] = useState("");
  const [addingToLista, setAddingToLista] = useState(false);
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const saveTimeoutRef = useRef<Record<string, NodeJS.Timeout>>({});

  // ─── Estado: feedback / confirmações ───────────────────────────────────────
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>("");
  const [confirmState, setConfirmState] = useState<{
    type: "deleteProduto" | "deleteItem" | "emptyList" | "deleteList" | "refreshCheckout";
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

  const loadMpStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/mercadopago");
      if (!res.ok) return;
      const json = await res.json();
      setMpConnected(!!json?.has_credentials);
      setMpLast4(json?.secret_last4 ?? null);
    } catch {
      /* ignore — Mercado Pago é opcional */
    }
  }, []);

  useEffect(() => {
    loadProdutos();
    loadListas();
    loadMpStatus();
  }, [loadProdutos, loadListas, loadMpStatus]);

  const handleRefreshCurrentTab = useCallback(async () => {
    if (refreshingTab) return;
    setRefreshingTab(true);
    try {
      if (activeTab === "produtos") {
        await Promise.all([loadProdutos(), loadListas(), loadMpStatus()]);
        setItemsByLista({});
        setExpandedListas(new Set());
      } else {
        setRefreshSignal((s) => s + 1);
      }
    } finally {
      setRefreshingTab(false);
    }
  }, [activeTab, refreshingTab, loadProdutos, loadListas, loadMpStatus]);

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

  const handleReorder = (listaId: string, newOrder: Item[]) => {
    setItemsByLista((prev) => {
      const allItems = [...(prev[listaId] ?? [])];
      const filter = (filterByLista[listaId] ?? "").trim().toLowerCase();
      const page = pageByLista[listaId] ?? 1;

      if (filter) {
        // Se houver filtro, o reorder é complexo. 
        // Simplificamos: atualizamos apenas os itens visíveis no array original.
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
        const res = await fetch("/api/infoprodutor/minha-lista-ofertas", {
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

  // ─── Formulário: imagem ────────────────────────────────────────────────────
  const resetForm = () => {
    setFormMode("create");
    setFormEditId(null);
    setFormProvider("manual");
    setFormName("");
    setFormDescription("");
    setFormLink("");
    setFormPrice("");
    setFormPriceOld("");
    setFormSubid("");
    setFormAllowShipping(true);
    setFormAllowPickup(false);
    setFormAllowDigital(false);
    setFormAllowLocalDelivery(false);
    setFormShippingCost("");
    setFormLocalDeliveryCost("");
    setFormPesoG("");
    setFormAlturaCm("");
    setFormLarguraCm("");
    setFormComprimentoCm("");
    setFormThankYouMessage("");
    setFormThankYouEnabled(false);
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

  // Provider que abre o checkout próprio (preço editável só em create, modos
  // de entrega, SubId de rastreamento, etc.).
  const isPaidProvider = formProvider === "mercadopago";
  const isPaidEditReadOnly = isPaidProvider && formMode === "edit";

  const handleSubmitProduto = async () => {
    setError(null);
    if (!formName.trim()) {
      setError("O título do produto é obrigatório.");
      return;
    }

    const isMpCreate = formMode === "create" && formProvider === "mercadopago";

    const normalizedSubid = formSubid.trim();
    if (isMpCreate) {
      if (!mpConnected) {
        setError("Conecte sua conta Mercado Pago em Configurações antes de criar produtos.");
        return;
      }
      if (!formPrice.trim()) {
        setError("Preço é obrigatório para produtos pagos pelo Mercado Pago.");
        return;
      }
      if (normalizedSubid && (normalizedSubid.length < 2 || !/^[a-zA-Z0-9_\-.]+$/.test(normalizedSubid))) {
        setError("SubId: use 2+ caracteres com apenas letras, números, hífen, ponto e underscore.");
        return;
      }
      if (!formAllowShipping && !formAllowPickup && !formAllowDigital && !formAllowLocalDelivery) {
        setError("Marque ao menos uma opção de entrega.");
        return;
      }
      if (!formAllowDigital && formAllowShipping && !formAllowLocalDelivery && !formShippingCost.trim()) {
        setError("Informe o valor do frete (use 0 para frete grátis).");
        return;
      }
      if (formAllowLocalDelivery && !formLocalDeliveryCost.trim()) {
        setError("Informe o valor da entrega em casa (use 0 para grátis).");
        return;
      }
    } else if (formMode === "create" && !formLink.trim()) {
      setError("Informe o link de venda.");
      return;
    }

    setSavingProduto(true);
    try {
      const imageUrl = await uploadImageIfNeeded();
      const priceNum = formPrice.trim() ? Number(formPrice.replace(",", ".")) : null;
      const priceOldNum = formPriceOld.trim() ? Number(formPriceOld.replace(",", ".")) : null;

      const basePayload: Record<string, unknown> = {
        id: formEditId || undefined,
        name: formName.trim(),
        description: formDescription.trim(),
        priceOld: priceOldNum,
        imageUrl,
      };

      if (isMpCreate) {
        basePayload.provider = "mercadopago";
        basePayload.price = priceNum;
        basePayload.subid = normalizedSubid;
        const effectiveLocalDelivery = !formAllowDigital && formAllowLocalDelivery;
        const effectiveShipping = !formAllowDigital && !effectiveLocalDelivery && formAllowShipping;
        basePayload.allowShipping = effectiveShipping;
        basePayload.allowPickup = formAllowDigital ? false : formAllowPickup;
        basePayload.allowDigital = formAllowDigital;
        basePayload.allowLocalDelivery = effectiveLocalDelivery;
        basePayload.shippingCost = effectiveShipping
          ? Number((formShippingCost || "0").replace(",", "."))
          : 0;
        basePayload.localDeliveryCost = effectiveLocalDelivery
          ? Number((formLocalDeliveryCost || "0").replace(",", "."))
          : 0;
        basePayload.thankYouMessage = formThankYouEnabled ? formThankYouMessage.trim() : "";
        if (effectiveShipping) {
          const toNum = (s: string) => Number((s || "").replace(",", "."));
          basePayload.pesoG = toNum(formPesoG);
          basePayload.alturaCm = toNum(formAlturaCm);
          basePayload.larguraCm = toNum(formLarguraCm);
          basePayload.comprimentoCm = toNum(formComprimentoCm);
        }
        // link é gerado pelo nosso checkout (Bricks Mercado Pago)
      } else if (formMode === "create") {
        basePayload.provider = "manual";
        basePayload.link = formLink.trim();
        basePayload.price = priceNum;
      } else if (formProvider === "mercadopago") {
        // edit em produto Mercado Pago: subId + mensagem de agradecimento.
        basePayload.subid = normalizedSubid;
        basePayload.thankYouMessage = formThankYouEnabled ? formThankYouMessage.trim() : "";
      } else {
        // edit em produto manual
        basePayload.link = formLink.trim();
        basePayload.price = priceNum;
      }

      const res = await fetch("/api/infoprodutor/produtos", {
        method: formMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(basePayload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar produto");

      const successMsg = isMpCreate
        ? "Produto criado e adicionado ao catálogo. O link de checkout já está pronto."
        : formMode === "edit"
          ? "Produto atualizado."
          : "Produto adicionado ao catálogo.";
      setFeedback(successMsg);
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
    setFormProvider(p.provider ?? "manual");
    setFormName(p.name);
    setFormDescription(p.description ?? "");
    setFormLink(p.link);
    setFormPrice(p.price != null ? String(p.price) : "");
    setFormPriceOld(p.priceOld != null ? String(p.priceOld) : "");
    setFormSubid(p.subid ?? "");
    setFormAllowShipping(p.allowShipping);
    setFormAllowPickup(p.allowPickup);
    setFormAllowDigital(p.allowDigital ?? false);
    setFormAllowLocalDelivery(p.allowLocalDelivery ?? false);
    setFormShippingCost(p.shippingCost != null ? String(p.shippingCost) : "");
    setFormLocalDeliveryCost(p.localDeliveryCost != null ? String(p.localDeliveryCost) : "");
    setFormPesoG(p.pesoG != null ? String(p.pesoG) : "");
    setFormAlturaCm(p.alturaCm != null ? String(p.alturaCm) : "");
    setFormLarguraCm(p.larguraCm != null ? String(p.larguraCm) : "");
    setFormComprimentoCm(p.comprimentoCm != null ? String(p.comprimentoCm) : "");
    const ty = (p.thankYouMessage ?? "").trim();
    setFormThankYouMessage(p.thankYouMessage ?? "");
    setFormThankYouEnabled(ty.length > 0);
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

  const filteredListas = useMemo(() => {
    const q = listaSearch.trim().toLowerCase();
    if (!q) return listas;
    return listas.filter((l) => (l.nome ?? "").toLowerCase().includes(q));
  }, [listas, listaSearch]);

  const totalListasPages = Math.max(1, Math.ceil(filteredListas.length / LISTAS_PER_PAGE));
  const pagedListas = useMemo(() => {
    const from = (listasPage - 1) * LISTAS_PER_PAGE;
    return filteredListas.slice(from, from + LISTAS_PER_PAGE);
  }, [filteredListas, listasPage]);

  useEffect(() => {
    setListasPage((p) => Math.min(Math.max(1, p), totalListasPages));
  }, [filteredListas.length, totalListasPages]);

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
      <div className="mx-auto">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl border border-[#2c2c32] bg-[#27272a] flex items-center justify-center shrink-0">
            <ShoppingCart className="h-5 w-5 text-[#EE4D2D]" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold leading-tight">Infoprodutor</h1>

          </div>
          {/* Botão Atualizar no mobile — fica ao lado do título. No desktop, aparece ao lado das abas. */}
          <button
            type="button"
            onClick={() => void handleRefreshCurrentTab()}
            disabled={refreshingTab}
            title={
              activeTab === "produtos"
                ? "Atualizar produtos e listas"
                : "Atualizar Vendas e Trackeamento"
            }
            aria-label="Atualizar"
            className="sm:hidden relative overflow-hidden inline-flex items-center justify-center w-10 h-10 rounded-xl border border-[#2c2c32] bg-[#222228] text-[#EE4D2D] hover:bg-[#2a2a30] transition-colors shrink-0 disabled:opacity-60"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#EE4D2D]/45 to-transparent"
              style={{ animation: "infoprod-sweep 2.8s ease-in-out infinite" }}
            />
            <RefreshCw className={`relative w-4 h-4 ${refreshingTab ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Feedback / erro */}
        {feedback ? (
          <div className="mb-3 rounded-lg border border-[#2c2c32] bg-[#222228] px-3 py-2 text-[11px] text-[#ffb09e] flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-[#EE4D2D]" />
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

        {/* ═══════════════ ABAS: Produtos | Vendas | Trackeamento | Checkout ═══════════════ */}
        <div className="mb-4 flex items-center gap-3 flex-wrap">
        <div
          role="tablist"
          aria-label="Seções do Infoprodutor"
          className="flex items-center gap-1 rounded-xl border border-[#2c2c32] bg-[#222228] p-1 w-full sm:w-fit max-w-full overflow-x-auto scrollbar-thin"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "produtos"}
            onClick={() => setActiveTab("produtos")}
            aria-label="Produtos"
            title="Produtos"
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "produtos" ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
            }`}
          >
            <Package className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Produtos</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "vendas"}
            onClick={() => setActiveTab("vendas")}
            aria-label="Vendas"
            title="Vendas"
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "vendas" ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
            }`}
          >
            <ShoppingCart className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Vendas</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "trackeamento"}
            onClick={() => setActiveTab("trackeamento")}
            aria-label="Trackeamento"
            title="Trackeamento"
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "trackeamento" ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
            }`}
          >
            <CreditCard className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Trackeamento</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "custom-checkout"}
            onClick={() => setActiveTab("custom-checkout")}
            aria-label="Checkout"
            title="Checkout"
            className={`inline-flex items-center justify-center sm:justify-start gap-1.5 flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              activeTab === "custom-checkout" ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
            }`}
          >
            <ImageIcon className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden sm:inline">Checkout</span>
          </button>
        </div>

        {/* Botão global Atualizar — recarrega a aba atual (Produtos: banco; Vendas/Trackeamento: cache + refetch) */}
        <>
          <style>{`
            @keyframes infoprod-sweep {
              0% { transform: translateX(-120%) skewX(-20deg); opacity: 0; }
              20% { opacity: 1; }
              80% { opacity: 1; }
              100% { transform: translateX(320%) skewX(-20deg); opacity: 0; }
            }
          `}</style>
          <button
            type="button"
            onClick={() => void handleRefreshCurrentTab()}
            disabled={refreshingTab}
            title={
              activeTab === "produtos"
                ? "Atualizar produtos e listas"
                : "Atualizar Vendas e Trackeamento"
            }
            aria-label="Atualizar"
            className="hidden sm:inline-flex ml-auto relative overflow-hidden items-center justify-center w-10 h-10 rounded-xl border border-[#2c2c32] bg-[#222228] text-[#EE4D2D] hover:bg-[#2a2a30] transition-colors disabled:opacity-60"
          >
              <span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#EE4D2D]/45 to-transparent"
                style={{ animation: "infoprod-sweep 2.8s ease-in-out infinite" }}
              />
              <RefreshCw className={`relative w-4 h-4 ${refreshingTab ? "animate-spin" : ""}`} />
            </button>
          </>
        </div>

        {activeTab === "produtos" ? (
          <>
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
              <div className="w-10 h-10 rounded-xl bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
                <FilePlus2 className="w-5 h-5 text-[#EE4D2D]" />
              </div>
              <div className="min-w-0 text-center sm:text-left">
                <h2 className="text-sm font-bold text-[#f0f0f2]">Cadastrar novo produto</h2>
               
              </div>
            </button>
          ) : (
            <div className="bg-[#1c1c1f]">
              <div className="px-4 sm:px-5 py-3 border-b border-[#2c2c32] flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
                    {formMode === "edit" ? (
                      <Pencil className="w-4 h-4 text-[#EE4D2D]" />
                    ) : (
                      <FilePlus2 className="w-4 h-4 text-[#EE4D2D]" />
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

              {/* Toggle: Manual × Mercado Pago (apenas na criação; na edição o provider é fixo) */}
              <div className="px-4 sm:px-5 pt-3">
                <div
                  role="tablist"
                  aria-label="Tipo de cadastro"
                  className="inline-flex rounded-lg border border-[#3e3e46] bg-[#222228] p-0.5"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formProvider === "manual"}
                    disabled={formMode === "edit" || savingProduto || uploadingImage}
                    onClick={() => setFormProvider("manual")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                      formProvider === "manual"
                        ? "bg-[#EE4D2D] text-white"
                        : "text-[#c8c8ce] hover:bg-[#2f2f34]"
                    }`}
                    title={formMode === "edit" ? "Não é possível trocar o tipo em modo de edição" : undefined}
                  >
                    <FilePlus2 className="w-3 h-3" />
                    Manual
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={formProvider === "mercadopago"}
                    disabled={formMode === "edit" || savingProduto || uploadingImage}
                    onClick={() => setFormProvider("mercadopago")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:cursor-not-allowed ${
                      formProvider === "mercadopago"
                        ? "bg-[#EE4D2D] text-white"
                        : "text-[#c8c8ce] hover:bg-[#2f2f34]"
                    }`}
                    title={formMode === "edit" ? "Não é possível trocar o tipo em modo de edição" : undefined}
                  >
                    <CreditCard className="w-3 h-3" />
                    Mercado Pago
                  </button>
                </div>
                {formProvider === "mercadopago" && formMode === "create" ? (
                  mpConnected ? (
                    <p className="mt-2 text-[10px] text-[#9a9aa2] flex items-center gap-1.5">
                      <Check className="w-3 h-3 text-[#EE4D2D] max-md:hidden" />
                      Conectado{mpLast4 ? ` (…${mpLast4})` : ""} — o link de checkout será gerado automaticamente.
                    </p>
                  ) : (
                    <div className="mt-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-200 leading-relaxed">
                        Conta Mercado Pago não conectada.{" "}
                        <Link href="/configuracoes" className="underline font-semibold hover:text-amber-100">
                          Conectar em Configurações
                        </Link>
                        .
                      </p>
                    </div>
                  )
                ) : null}
                {formProvider === "mercadopago" && formMode === "edit" ? (
                  <p className="mt-2 text-[10px] text-[#9a9aa2]">
                    Produto vinculado ao Mercado Pago — preço e link de venda não são editáveis.
                  </p>
                ) : null}
              </div>

              <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[1fr_minmax(272px,340px)] xl:gap-6 xl:items-start">
              <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-[minmax(0,88px)_1fr] gap-4 md:gap-5">
                {/* Upload de imagem — compacto no desktop */}
                <div className="flex flex-col items-center md:items-stretch md:max-w-[88px] mx-auto md:mx-0 w-full max-w-[140px] md:max-w-[88px]">
                  <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5 w-full text-center md:text-left">
                    <ImageIcon className="inline w-2.5 h-2.5 mr-1" />
                    Foto
                  </label>
                  <label
                    htmlFor="infoprod-image-input"
                    className="relative block aspect-square w-full rounded-xl border-2 border-dashed border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/50 hover:bg-[#EE4D2D]/5 transition-colors cursor-pointer overflow-hidden group"
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
                      className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition"
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
                      className="w-full min-h-[80px] bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none resize-y scrollbar-thin leading-relaxed transition"
                    />
                  </div>

                  <div className="space-y-3">
                    {!isPaidProvider ? (
                      <div>
                        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                          <Link2 className="inline w-2.5 h-2.5 mr-1" /> Link de venda
                        </label>
                        <input
                          type="url"
                          value={formLink}
                          onChange={(e) => setFormLink(e.target.value)}
                          placeholder="https://pay.hotmart.com/..."
                          className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition"
                        />
                      </div>
                    ) : null}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                          <Tag className="inline w-2.5 h-2.5 mr-1" />{" "}
                          {isPaidProvider ? "Preço atual (BRL) *" : "Preço atual (opcional)"}
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={formPrice}
                          onChange={(e) => setFormPrice(e.target.value)}
                          readOnly={isPaidEditReadOnly}
                          placeholder="97,00"
                          className={`w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition ${
                            isPaidEditReadOnly ? "opacity-60 cursor-not-allowed" : ""
                          }`}
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
                          className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition"
                        />

                      </div>
                    </div>

                    {isPaidProvider ? (
                      <div>
                        <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                          <CreditCard className="inline w-2.5 h-2.5 text-[#EE4D2D]" />
                          <span>SubId InfoP</span>
                          <span className="text-[#9a9aa2] normal-case tracking-normal">(opcional)</span>
                          <Toolist
                            variant="floating"
                            wide
                            text="Usado em Trackeamento para cruzar vendas com anúncios Meta. Cole o mesmo valor no SubId InfoP do ad em ATI. Vários produtos podem compartilhar o mesmo SubId — as vendas são somadas no ad."
                          />
                        </label>
                        <input
                          type="text"
                          value={formSubid}
                          onChange={(e) => setFormSubid(e.target.value)}
                          placeholder="ex.: suplementos, whey-protein"
                          className="w-full bg-[#222228] border border-[#EE4D2D]/40 rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition"
                        />
                      </div>
                    ) : null}

                    {isPaidProvider ? (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => setFormDeliveryExpanded((v) => !v)}
                          className="w-full flex items-center justify-between gap-2 text-left px-3 py-2.5 rounded-xl border border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/40 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
                              Formas de entrega
                            </p>
                            <p className="text-[10px] text-[#9a9aa2] mt-0.5 truncate">
                              {(() => {
                                const opts: string[] = [];
                                if (formAllowDigital) opts.push("Digital");
                                else {
                                  if (formAllowShipping) opts.push("Correios");
                                  if (formAllowPickup) opts.push("Retirada");
                                  if (formAllowLocalDelivery) opts.push("Receber em casa");
                                }
                                return opts.length > 0 ? opts.join(" · ") : "Nenhuma selecionada";
                              })()}
                            </p>
                          </div>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-[#9a9aa2] shrink-0 transition-transform ${
                              formDeliveryExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                        {formDeliveryExpanded ? (
                        <>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 items-start">
                          <label className={`flex items-start gap-2 p-3 rounded-xl border transition-colors ${
                            formAllowDigital || formAllowLocalDelivery
                              ? "border-[#3e3e46] bg-[#222228] opacity-40 cursor-not-allowed"
                              : formAllowShipping
                                ? "border-[#EE4D2D]/50 bg-[#EE4D2D]/8 cursor-pointer"
                                : "border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/30 cursor-pointer"
                          }`}>
                            <input
                              type="checkbox"
                              checked={formAllowShipping && !formAllowDigital && !formAllowLocalDelivery}
                              onChange={(e) => setFormAllowShipping(e.target.checked)}
                              disabled={formMode === "edit" || formAllowDigital || formAllowLocalDelivery}
                              className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#EE4D2D] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-[#f0f0f2]">Aceita envio (Correios)</p>
                              <p className="text-[9px] text-[#9a9aa2] mt-0.5 leading-relaxed">
                                Cliente informa endereço no checkout.
                              </p>
                            </div>
                          </label>
                          <div>
                            <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1">
                              Valor do frete
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formShippingCost}
                              onChange={(e) => setFormShippingCost(e.target.value)}
                              disabled={!formAllowShipping || formAllowDigital || formAllowLocalDelivery || formMode === "edit"}
                              placeholder="0,00"
                              className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                            />
                          </div>
                        </div>
                        {formAllowShipping && !formAllowDigital && !formAllowLocalDelivery ? (
                          <div>
                            <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5">
                              Dimensões do produto{" "}
                              <span className="text-[#9a9aa2] normal-case tracking-normal">(pra cotação dinâmica)</span>
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              <div>
                                <label className="block text-[9px] text-[#9a9aa2] mb-1">Peso (g)</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formPesoG}
                                  onChange={(e) => setFormPesoG(e.target.value)}
                                  disabled={formMode === "edit"}
                                  placeholder="300"
                                  className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-2 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-[#9a9aa2] mb-1">Altura (cm)</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formAlturaCm}
                                  onChange={(e) => setFormAlturaCm(e.target.value)}
                                  disabled={formMode === "edit"}
                                  placeholder="5"
                                  className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-2 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-[#9a9aa2] mb-1">Largura (cm)</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formLarguraCm}
                                  onChange={(e) => setFormLarguraCm(e.target.value)}
                                  disabled={formMode === "edit"}
                                  placeholder="15"
                                  className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-2 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-[#9a9aa2] mb-1">Compr. (cm)</label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={formComprimentoCm}
                                  onChange={(e) => setFormComprimentoCm(e.target.value)}
                                  disabled={formMode === "edit"}
                                  placeholder="20"
                                  className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-2 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#686868] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                                />
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {formAllowShipping && !formAllowDigital && !formAllowLocalDelivery && formMode !== "edit" ? (
                          <FreteCalculator
                            onPick={(v) => setFormShippingCost(v)}
                            disabled={!formAllowShipping}
                          />
                        ) : null}
                        <label className={`flex items-start gap-2 p-3 rounded-xl border transition-colors ${
                          formAllowDigital
                            ? "border-[#3e3e46] bg-[#222228] opacity-40 cursor-not-allowed"
                            : formAllowPickup
                              ? "border-[#EE4D2D]/50 bg-[#EE4D2D]/8 cursor-pointer"
                              : "border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/30 cursor-pointer"
                        }`}>
                          <input
                            type="checkbox"
                            checked={formAllowPickup && !formAllowDigital}
                            onChange={(e) => setFormAllowPickup(e.target.checked)}
                            disabled={formMode === "edit" || formAllowDigital}
                            className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#EE4D2D] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-[#f0f0f2]">Aceita retirada na loja</p>
                            <p className="text-[9px] text-[#9a9aa2] mt-0.5 leading-relaxed">
                              Mostra o endereço da loja (de Configurações) no checkout. Não gera etiqueta.
                            </p>
                          </div>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 items-start">
                          <label className={`flex items-start gap-2 p-3 rounded-xl border transition-colors ${
                            formAllowDigital
                              ? "border-[#3e3e46] bg-[#222228] opacity-40 cursor-not-allowed"
                              : formAllowLocalDelivery
                                ? "border-[#EE4D2D]/50 bg-[#EE4D2D]/8 cursor-pointer"
                                : "border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/30 cursor-pointer"
                          }`}>
                            <input
                              type="checkbox"
                              checked={formAllowLocalDelivery && !formAllowDigital}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormAllowLocalDelivery(checked);
                                if (checked) setFormAllowShipping(false);
                                else setFormAllowShipping(true);
                              }}
                              disabled={formMode === "edit" || formAllowDigital}
                              className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#EE4D2D] shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-[#f0f0f2]">Receber em casa</p>
                              <p className="text-[9px] text-[#9a9aa2] mt-0.5 leading-relaxed">
                                Você entrega no endereço do comprador. Valor fixo (sem cálculo de frete). Não convive com Correios.
                              </p>
                            </div>
                          </label>
                          <div>
                            <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1">
                              Valor da entrega
                            </label>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formLocalDeliveryCost}
                              onChange={(e) => setFormLocalDeliveryCost(e.target.value)}
                              disabled={!formAllowLocalDelivery || formAllowDigital || formMode === "edit"}
                              placeholder="0,00"
                              className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none transition disabled:opacity-40"
                            />
                          </div>
                        </div>
                        <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${
                          formAllowDigital
                            ? "border-[#EE4D2D]/50 bg-[#EE4D2D]/8"
                            : "border-[#3e3e46] bg-[#222228] hover:border-[#EE4D2D]/30"
                        }`}>
                          <input
                            type="checkbox"
                            checked={formAllowDigital}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setFormAllowDigital(checked);
                              if (checked) {
                                setFormAllowShipping(false);
                                setFormAllowPickup(false);
                                setFormAllowLocalDelivery(false);
                              } else {
                                setFormAllowShipping(true);
                              }
                            }}
                            disabled={formMode === "edit"}
                            className="mt-0.5 w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#EE4D2D] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-[#f0f0f2]">Entrega digital (WhatsApp/E-mail)</p>
                            <p className="text-[9px] text-[#9a9aa2] mt-0.5 leading-relaxed">
                              Pra ebooks e produtos digitais. Cliente informa WhatsApp + e-mail no checkout e recebe o conteúdo por lá. Exclusivo — desmarca as demais.
                            </p>
                          </div>
                        </label>
                        {formMode === "edit" ? (
                          <p className="text-[9px] text-[#7a7a80] italic">
                            Modos de entrega não podem ser editados em produtos já criados. Remova e crie de novo se precisar alterar.
                          </p>
                        ) : null}
                        </>
                        ) : null}
                      </div>
                    ) : null}

                    {isPaidProvider ? (
                      <div className="space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Image
                                src="/whatsapp.png"
                                alt=""
                                width={20}
                                height={20}
                                className="h-5 w-5 shrink-0 object-contain"
                                aria-hidden
                              />
                              <span className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">
                                Mensagem enviada ao WhatsApp do comprador após a compra
                              </span>
                              <Toolist
                                variant="floating"
                                wide
                                text="Essa mensagem é enviada automaticamente no WhatsApp do comprador logo após a compra aprovada. Você pode incluir texto livre, emojis e links (WhatsApp torna URLs clicáveis). Com o interruptor desligado, usamos o agradecimento padrão."
                              />
                            </div>
                            <p className="text-[9px] text-[#9a9aa2] leading-relaxed">
                              {formThankYouEnabled
                                ? "Edite o texto abaixo. Salve para aplicar."
                                : "Desligado: o sistema envia a mensagem de agradecimento padrão."}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormThankYouEnabled((v) => !v)}
                            role="switch"
                            aria-checked={formThankYouEnabled}
                            className={`shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              formThankYouEnabled ? "bg-[#EE4D2D]" : "bg-[#3e3e46]"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                formThankYouEnabled ? "translate-x-4" : "translate-x-0.5"
                              }`}
                            />
                          </button>
                        </div>
                        {formThankYouEnabled ? (
                          <textarea
                            value={formThankYouMessage}
                            onChange={(e) => setFormThankYouMessage(e.target.value)}
                            placeholder={`Ex.: Olá! 🎉 Obrigado pela compra do Whey Protein!\n\nAcesse seu ebook de receitas: https://...\n\nQualquer dúvida me chama!`}
                            rows={5}
                            className="mt-1 w-full min-h-[80px] bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#EE4D2D] outline-none resize-y scrollbar-thin leading-relaxed transition"
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
              </div>
              <aside className="shrink-0 w-full max-w-md mx-auto xl:mx-0 xl:sticky xl:top-4 xl:self-start">
                <InfoprodGrupoMessagePreview
                  title={formName}
                  description={formDescription}
                  imageSrc={formImagePreview}
                  priceStr={formPrice}
                  priceOldStr={formPriceOld}
                  linkHint={formProvider === "mercadopago" ? "" : formLink}
                  isMercadoPago={formProvider === "mercadopago"}
                />
              </aside>
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
                  disabled={
                    savingProduto ||
                    uploadingImage ||
                    (formProvider === "mercadopago" && formMode === "create" && !mpConnected)
                  }
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-white text-xs font-semibold disabled:opacity-60 ${
                    formProvider === "mercadopago"
                      ? "bg-[#EE4D2D] hover:bg-[#d63d20]"
                      : "bg-[#EE4D2D] hover:bg-[#d63d20]"
                  }`}
                >
                  {savingProduto || uploadingImage ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : formMode === "edit" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : formProvider === "mercadopago" ? (
                    <CreditCard className="w-3.5 h-3.5" />
                  ) : (
                    <PlusCircle className="w-3.5 h-3.5" />
                  )}
                  {uploadingImage
                    ? "Enviando imagem…"
                    : savingProduto
                      ? formProvider === "mercadopago" && formMode === "create"
                        ? "Criando produto…"
                        : "Salvando…"
                      : formMode === "edit"
                        ? "Salvar alterações"
                        : formProvider === "mercadopago"
                          ? "Criar produto"
                          : "Adicionar ao catálogo"}
                </button>
              </div>
              </div>
            </div>
          )}
        </section>

        {!formOpen ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-6 lg:items-stretch">
        {/* ═══════════════ MEUS PRODUTOS ═══════════════ */}
        <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mb-6 lg:mb-0 flex flex-col">
          <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
                <Package className="w-3 h-3 text-[#EE4D2D]" />
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-[#EE4D2D] hover:bg-[#d63d20] text-white"
              title={selectedProdutoIds.size === 0 ? "Selecione produtos para criar uma lista" : ""}
            >
              <ListChecks className="w-3.5 h-3.5" />
              Criar lista ({selectedProdutoIds.size})
            </button>
            <button
              type="button"
              onClick={openAddToLista}
              disabled={selectedProdutoIds.size === 0 || listas.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-[#EE4D2D]/45 bg-[#EE4D2D]/10 text-[#f0f0f2] hover:bg-[#EE4D2D]/18 hover:border-[#EE4D2D]/60"
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
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2c32] bg-[#1c1c1f] text-[#f0f0f2] text-[11px] placeholder:text-[#6b6b72] outline-none focus:border-[#EE4D2D]"
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

          <div className="bg-[#1c1c1f] flex-1">
            {loadingProdutos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#EE4D2D]" />
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
                        checked ? "bg-[#EE4D2D]/8" : "hover:bg-[#222228]"
                      }`}
                    >
                      <label className="flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectProduto(p.id)}
                          className="w-4 h-4 rounded border-[#3e3e46] bg-[#222228] accent-[#EE4D2D]"
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
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-[12px] font-semibold text-[#f0f0f2] leading-snug truncate">
                            {p.name}
                          </p>
                          {p.provider === "mercadopago" ? (
                            <span
                              title="Produto pago via Mercado Pago"
                              className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-[#EE4D2D]/40 bg-[#EE4D2D]/10 text-[9px] font-bold uppercase tracking-wider text-[#ffb09e]"
                            >
                              <CreditCard className="w-2.5 h-2.5" />
                              MP
                            </span>
                          ) : null}
                          {p.provider === "mercadopago" && p.subid ? (
                            <span
                              title={`SubId InfoP: ${p.subid}`}
                              className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border border-[#3e3e46] bg-[#222228] text-[9px] font-semibold text-[#c8c8ce] font-mono"
                            >
                              #{p.subid}
                            </span>
                          ) : null}
                        </div>
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
                            className="text-[10px] text-[#EE4D2D] hover:underline flex items-center gap-1 min-w-0"
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
                          className="p-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] hover:bg-[#EE4D2D]/10 hover:text-[#EE4D2D] hover:border-[#EE4D2D]/40"
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
        <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden flex flex-col">
          <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-6 h-6 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
                <ListChecks className="w-3 h-3 text-[#EE4D2D]" />
              </div>
              <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Minhas Listas do Infoprodutor</h2>
              {!loadingListas && listas.length > 0 ? (
                <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
                  {listas.length} {listas.length === 1 ? "lista" : "listas"}
                </span>
              ) : null}
            </div>

          </div>

          {!loadingListas && listas.length > 0 ? (
            <div className="px-3 sm:px-5 py-3 border-b border-[#2c2c32] bg-[#222228] flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-[#a0a0a0] shrink-0" />
              <input
                type="text"
                value={listaSearch}
                onChange={(e) => setListaSearch(e.target.value)}
                placeholder="Filtrar por nome da lista…"
                className="flex-1 px-3 py-1.5 rounded-lg border border-[#2c2c32] bg-[#1c1c1f] text-[#f0f0f2] text-[11px] placeholder:text-[#6b6b72] outline-none focus:border-[#EE4D2D]"
              />
              {listaSearch ? (
                <button
                  type="button"
                  onClick={() => setListaSearch("")}
                  className="text-[10px] text-[#a0a0a0] hover:text-white shrink-0"
                >
                  Limpar
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto bg-[#1c1c1f] scrollbar-thin">
            {loadingListas ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#EE4D2D]" />
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
            ) : filteredListas.length === 0 ? (
              <p className="py-10 text-center text-[11px] text-[#9a9aa2]">Nenhuma lista bate com o filtro.</p>
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
                              <div className="w-8 h-8 rounded-lg border border-[#2c2c32] bg-[#27272a] flex items-center justify-center shrink-0">
                                <ShoppingCart className="h-4 w-4 text-[#EE4D2D]" />
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
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-[#EE4D2D]/10 hover:text-[#EE4D2D] hover:border-[#EE4D2D]/40 disabled:opacity-40"
                              title="Esvaziar lista"
                            >
                              <FolderMinus className="h-3.5 w-3.5" /> Esvaziar
                            </button>
                            <button
                              type="button"
                              onClick={() => askDeleteLista(lista.id)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-md border border-[#3e3e46] text-[#d2d2d2] text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 disabled:opacity-40"
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
                                <Loader2 className="h-6 w-6 animate-spin text-[#EE4D2D]" />
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
                                          <div className="w-20 h-20 rounded-lg bg-[#1c1c1f] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72] text-xs">
                                            —
                                          </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-2">
                                            <p className="text-sm font-medium text-[#f0f0f2] leading-snug">
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
                                          <InfoprodPriceLine price={item.price} priceOld={item.priceOld} />
                                          <div className="flex items-center gap-2 mt-2">
                                            <a
                                              href={item.link}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-[#EE4D2D] hover:underline flex items-center gap-1"
                                            >
                                              <ExternalLink className="h-3 w-3" /> Link
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
                                      </div>
                                    </Reorder.Item>
                                  ))}
                                </Reorder.Group>
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

                {filteredListas.length > LISTAS_PER_PAGE ? (
                  <div className="rounded-xl border border-[#2c2c32] bg-[#222228] px-3 py-3">
                    <GeradorPaginationBar
                      page={listasPage}
                      totalPages={totalListasPages}
                      summary={`Mostrando ${pagedListas.length} de ${filteredListas.length} lista(s)`}
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
        ) : null}

          </>
        ) : null}

        {activeTab === "vendas" ? (
          <>
            {/* ═══════════════ DASHBOARD DE VENDAS (Mercado Pago) ═══════════════ */}
            <MpSalesDashboard mpConnected={mpConnected} refreshSignal={refreshSignal} />

            {/* ═══════════════ PEDIDOS Mercado Pago ═══════════════ */}
            <MpOrdersSection mpConnected={mpConnected} refreshSignal={refreshSignal} />
          </>
        ) : null}

        {activeTab === "trackeamento" ? (
          <>
            {/* ═══════════════ PERFORMANCE POR AD (ATI × Mercado Pago) ═══════════════ */}
            <AdPerformanceTable refreshSignal={refreshSignal} />
          </>
        ) : null}

        {activeTab === "custom-checkout" ? (
          <>
            {/* ═══════════════ PERSONALIZAÇÃO DO CHECKOUT ═══════════════ */}
            <CustomCheckoutTab />
          </>
        ) : null}

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
                <div className="w-8 h-8 rounded-lg border border-[#2c2c32] bg-[#27272a] flex items-center justify-center shrink-0">
                  <ListChecks className="w-4 h-4 text-[#EE4D2D]" />
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
                className="w-full bg-[#222228] border border-[#3e3e46] rounded-xl px-3 py-2.5 text-sm text-[#f0f0f2] placeholder:text-[#6b6b72] focus:border-[#EE4D2D] outline-none transition"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#EE4D2D] hover:bg-[#d63d20] text-white text-xs font-semibold disabled:opacity-60"
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
