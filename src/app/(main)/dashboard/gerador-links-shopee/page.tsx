"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Link2,
  Sparkles,
  Trash2,
  Search,
  ExternalLink,
  ShoppingBag,
  Target,
  Hand,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Share2,
  Copy,
  MessageCircle,
  Download,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

type ProductOffer = {
  itemId: number;
  productName: string;
  productLink: string;
  offerLink: string;
  imageUrl: string;
  priceMin: number;
  priceMax: number;
  priceDiscountRate: number;
  sales: number;
  ratingStar: number;
  commissionRate: number;
  commission: number;
  shopName: string;
};

type HistoryEntry = {
  id: string;
  shortLink: string;
  originUrl: string;
  subId1: string;
  subId2: string;
  subId3: string;
  observation: string;
  productName: string;
  slug: string;
  imageUrl: string;
  commissionRate: number;
  commissionValue: number;
  createdAt: string;
};

function extractItemIdFromUrl(url: string): number | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  // Shopee usa "-i.SHOPID.ITEMID" ou ".i.SHOPID.ITEMID" no path (ex: ...Lançamento-i.400768211.22193883710)
  const match = trimmed.match(/[.-]i\.(\d+)\.(\d+)/);
  if (match) return parseInt(match[2], 10);
  return null;
}

function extractSlugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, "").trim();
    const withoutQuery = path.split("?")[0];
    const parts = withoutQuery.split(/[.-]i\.\d+\.\d+/);
    return (parts[0] || path || "").replace(/^-+|-+$/g, "");
  } catch {
    return "";
  }
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

export default function GeradorLinksShopeePage() {
  const [inputValue, setInputValue] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastGeneratedLink, setLastGeneratedLink] = useState("");
  const [storyCaption, setStoryCaption] = useState("");
  const [captionLoading, setCaptionLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState("");
  const [generatedStoryImage, setGeneratedStoryImage] = useState<string | null>(null);
  const [storyImageLoading, setStoryImageLoading] = useState(false);
  const [storyImageUseGenerated, setStoryImageUseGenerated] = useState(false);
  const [convertLoading, setConvertLoading] = useState(false);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOffer | null>(null);
  const [goldenProducts, setGoldenProducts] = useState<ProductOffer[]>([]);
  const [bestSellers, setBestSellers] = useState<ProductOffer[]>([]);
  const [loadingBestSellers, setLoadingBestSellers] = useState(false);
  const [bestSellerKeyword, setBestSellerKeyword] = useState("");
  const [lastBestSellerKeyword, setLastBestSellerKeyword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configCardRef = useRef<HTMLDivElement>(null);
  const handleSearchRef = useRef<(term?: string) => Promise<void>>(() => Promise.resolve());

  const checkApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/shopee");
      const data = await res.json();
      setHasApiKeys(!!data?.has_key && !!data?.shopee_app_id);
    } catch {
      setHasApiKeys(false);
    }
  }, []);

  useEffect(() => {
    checkApiKeys();
  }, [checkApiKeys]);

  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || !hasApiKeys) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      handleSearchRef.current(trimmed);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, hasApiKeys]);

  const loadHistory = useCallback(async (page: number, search?: string) => {
    setHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "4" });
      if (search?.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/shopee/link-history?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar histórico");
      setHistory(Array.isArray(json.data) ? json.data : []);
      setHistoryTotal(Number(json.total) ?? 0);
      setHistoryTotalPages(Math.max(1, Number(json.totalPages) ?? 1));
      setHistoryPage(Number(json.page) ?? 1);
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const [historySearchDebounced, setHistorySearchDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setHistorySearchDebounced(historySearch), 300);
    return () => clearTimeout(t);
  }, [historySearch]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchDebounced]);

  useEffect(() => {
    loadHistory(historyPage, historySearchDebounced);
  }, [historyPage, historySearchDebounced, loadHistory]);

  const handleSearch = useCallback(async (term?: string) => {
    const trimmed = (term ?? inputValue).trim();
    if (!trimmed) return;
    if (!hasApiKeys) return;
    setError(null);
    setSearchLoading(true);
    setProducts([]);
    setSelectedProduct(null);
    setGoldenProducts([]);
    try {
      const itemId = extractItemIdFromUrl(trimmed);
      if (Number.isFinite(itemId)) {
        const res = await fetch(`/api/shopee/product-search?itemId=${itemId}&limit=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produto");
        const list = (data?.products ?? []) as ProductOffer[];
        if (list.length > 0) {
          setSelectedProduct(list[0]);
          const name = list[0].productName?.split(/\s+/).slice(0, 4).join(" ") || "";
          if (name) {
            const similarRes = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=15`);
            const similarData = await similarRes.json();
            const similar = (similarData?.products ?? []) as ProductOffer[];
            const currentRate = list[0].commissionRate ?? 0;
            let sameNiche = similar
              .filter((p) => p.itemId !== list[0].itemId && (p.commissionRate ?? 0) >= currentRate)
              .sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
            if (sameNiche.length === 0) {
              sameNiche = similar
                .filter((p) => p.itemId !== list[0].itemId)
                .sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0))
                .slice(0, 5);
            }
            setGoldenProducts(sameNiche);
          }
        }
      } else {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(trimmed)}&limit=20`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produtos");
        setProducts((data?.products ?? []) as ProductOffer[]);
        setSelectedProduct(null);
        setGoldenProducts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao buscar");
    } finally {
      setSearchLoading(false);
    }
  }, [inputValue, hasApiKeys]);

  handleSearchRef.current = handleSearch;

  useEffect(() => {
    setGeneratedStoryImage(null);
    setStoryImageUseGenerated(false);
    setLastGeneratedLink("");
    setStoryCaption("");
  }, [selectedProduct?.itemId]);

  const handleSelectProduct = useCallback(async (product: ProductOffer) => {
    setSelectedProduct(product);
    setProducts([]);
    const name = product.productName?.split(/\s+/).slice(0, 4).join(" ") || "";
    setGoldenProducts([]);
    if (name) {
      try {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=15`);
        const data = await res.json();
        const similar = (data?.products ?? []) as ProductOffer[];
        const currentRate = product.commissionRate ?? 0;
        let sameNiche = similar
          .filter((p) => p.itemId !== product.itemId && (p.commissionRate ?? 0) >= currentRate)
          .sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
        if (sameNiche.length === 0) {
          sameNiche = similar
            .filter((p) => p.itemId !== product.itemId)
            .sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0))
            .slice(0, 5);
        }
        setGoldenProducts(sameNiche);
      } catch {
        setGoldenProducts([]);
      }
    }
  }, []);

  const handleSelectProductFromList = useCallback((product: ProductOffer) => {
    setBestSellers([]);
    handleSelectProduct(product);
  }, [handleSelectProduct]);

  const handleConvertLink = useCallback(async () => {
    const originUrl = selectedProduct?.productLink || selectedProduct?.offerLink || inputValue.trim();
    if (!originUrl) {
      setError("Selecione um produto ou informe o link.");
      return;
    }
    setError(null);
    setConvertLoading(true);
    try {
      const subIds = [subId1, subId2, subId3].map((s) => s.trim());
      const res = await fetch("/api/shopee/generate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originUrl, subIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao converter link");
      const shortLink = data?.shortLink ?? "";
      const slug = extractSlugFromUrl(originUrl);
      const postRes = await fetch("/api/shopee/link-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortLink,
          originUrl,
          subId1: subIds[0] ?? "",
          subId2: subIds[1] ?? "",
          subId3: subIds[2] ?? "",
          observation: "",
          productName: selectedProduct?.productName ?? "",
          slug,
          imageUrl: selectedProduct?.imageUrl ?? "",
          commissionRate: selectedProduct?.commissionRate ?? 0,
          commissionValue: selectedProduct?.commission ?? 0,
        }),
      });
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Erro ao salvar no histórico");
      }
      setLastGeneratedLink(shortLink);
      await loadHistory(1, historySearchDebounced);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao converter");
    } finally {
      setConvertLoading(false);
    }
  }, [selectedProduct, inputValue, subId1, subId2, subId3, historySearchDebounced, loadHistory]);

  const runSearchNow = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    handleSearch();
  }, [handleSearch]);

  const loadBestSellers = useCallback(async () => {
    const keyword = bestSellerKeyword.trim();
    if (!keyword || !hasApiKeys) return;
    setError(null);
    setLoadingBestSellers(true);
    setBestSellers([]);
    try {
      const params = new URLSearchParams({
        keyword,
        sortType: "2",
        limit: "20",
        listType: "2",
      });
      const res = await fetch(`/api/shopee/product-search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar mais vendidos");
      const list = (data?.products ?? []) as ProductOffer[];
      setBestSellers(list);
      setLastBestSellerKeyword(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao listar mais vendidos");
    } finally {
      setLoadingBestSellers(false);
    }
  }, [hasApiKeys, bestSellerKeyword]);

  const handleGenerateStoryImage = useCallback(async () => {
    if (!selectedProduct?.imageUrl) return;
    setStoryImageLoading(true);
    setGeneratedStoryImage(null);
    setStoryImageUseGenerated(false);
    try {
      const res = await fetch("/api/shopee/generate-story-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: selectedProduct.imageUrl,
          productName: selectedProduct.productName ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao gerar imagem");
      const dataUrl = data?.imageBase64
        ? `data:image/png;base64,${data.imageBase64}`
        : data?.imageUrl ?? null;
      setGeneratedStoryImage(dataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar imagem");
    } finally {
      setStoryImageLoading(false);
    }
  }, [selectedProduct]);

  const handleGenerateCaption = useCallback(async () => {
    if (!selectedProduct?.productName) return;
    setCaptionLoading(true);
    setShareFeedback("");
    try {
      const res = await fetch("/api/shopee/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName: selectedProduct.productName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao gerar legenda");
      setStoryCaption(data?.caption ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao gerar legenda");
    } finally {
      setCaptionLoading(false);
    }
  }, [selectedProduct]);

  const getSelectedImageFile = useCallback(async (): Promise<File | null> => {
    const url = storyImageUseGenerated && generatedStoryImage
      ? generatedStoryImage
      : selectedProduct?.imageUrl;
    if (!url) return null;
    try {
      let blob: Blob;
      if (url.startsWith("data:")) {
        const res = await fetch(url);
        blob = await res.blob();
      } else {
        const proxyUrl = `/api/shopee/proxy-image?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) return null;
        blob = await res.blob();
      }
      if (!blob || blob.size === 0) return null;
      const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      return new File([blob], "story-shopee.jpg", { type });
    } catch {
      return null;
    }
  }, [storyImageUseGenerated, generatedStoryImage, selectedProduct?.imageUrl]);

  const handleShareStory = useCallback(async () => {
    const link = lastGeneratedLink;
    if (!link) {
      setShareFeedback("Converte o link antes (botão \"Converter Link\") para copiar o link.");
      return;
    }
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      setShareFeedback("Não foi possível copiar o link. Copie manualmente.");
      return;
    }
    const imageFile = await getSelectedImageFile();
    const canShare = typeof navigator !== "undefined" && navigator.share;
    const canShareFiles = imageFile && (navigator as { canShare?: (x: { files?: File[] }) => boolean }).canShare?.({ files: [imageFile] });
    if (canShare && canShareFiles) {
      try {
        await navigator.share({
          files: [imageFile],
          title: "Story Shopee",
        });
        setShareFeedback("Link copiado! Escolha Instagram → a imagem vai para Stories. Cole só o link no Story (sticker \"Adicionar link\").");
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setShareFeedback("Link copiado! Usa \"Baixar imagem\" e abre o Instagram → Stories → cola o link no sticker \"Adicionar link\".");
          if (typeof window !== "undefined") window.open("https://www.instagram.com/", "_blank", "noopener");
        }
      }
    } else {
      setShareFeedback("Link copiado! Usa \"Baixar imagem\" e no Instagram Stories cola o link no sticker \"Adicionar link\".");
      if (typeof window !== "undefined") window.open("https://www.instagram.com/", "_blank", "noopener");
    }
    setTimeout(() => setShareFeedback(""), 9000);
  }, [lastGeneratedLink, getSelectedImageFile]);

  const [whatsappSharing, setWhatsappSharing] = useState(false);

  const handleShareWhatsApp = useCallback(async () => {
    if (!lastGeneratedLink) {
      setShareFeedback("Converta o link antes (botão \"Converter Link\") para compartilhar no WhatsApp.");
      return;
    }
    setWhatsappSharing(true);
    const link = lastGeneratedLink;
    const legenda = storyCaption.trim();
    let textAsCaption: string;
    if (!legenda) {
      textAsCaption = `Comprar agora: ${link}`;
    } else {
      const placeholder = /\{Link do Converter Link\}|\{link\}/i;
      if (placeholder.test(legenda)) {
        textAsCaption = legenda.replace(placeholder, link);
      } else {
        const lines = legenda.split("\n");
        const title = lines[0]?.trim() ?? "";
        const rest = lines.slice(1).join("\n").trim();
        textAsCaption = rest ? `${title}\n\nComprar agora: ${link}\n\n${rest}` : `${title}\n\nComprar agora: ${link}`;
      }
    }
    const MAX_STATUS_CHARS = 700;
    const MAX_STATUS_LINES = 10;
    const linesAll = textAsCaption.split("\n");
    const linesCut = linesAll.length > MAX_STATUS_LINES ? linesAll.slice(0, MAX_STATUS_LINES).join("\n") : textAsCaption;
    textAsCaption = linesCut.length > MAX_STATUS_CHARS ? linesCut.slice(0, MAX_STATUS_CHARS).trim() : linesCut;

    try {
      await navigator.clipboard.writeText(textAsCaption);
    } catch {
      // segue mesmo se não copiar
    }

    const imageFile = await getSelectedImageFile();
    const canShare = typeof navigator !== "undefined" && navigator.share;
    const canShareFiles = imageFile && (navigator as { canShare?: (x: { files?: File[] }) => boolean }).canShare?.({ files: [imageFile] });

    if (canShare && canShareFiles) {
      try {
        await navigator.share({
          files: [imageFile],
          title: "Story Shopee",
        });
        setShareFeedback("Legenda (com link no topo) copiada! Escolha WhatsApp → a imagem vai para Status. Cole no campo \"Adicione uma legenda\".");
      } catch (err) {
        if ((err as Error)?.name !== "AbortError") {
          setShareFeedback("Legenda copiada! Use \"Baixar imagem\" e anexe no WhatsApp; depois cole a legenda no Status ou na conversa.");
          const waUrl = `https://wa.me/?text=${encodeURIComponent(textAsCaption)}`;
          if (typeof window !== "undefined") window.open(waUrl, "_blank", "noopener");
        }
      }
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(textAsCaption)}`;
      if (typeof window !== "undefined") window.open(waUrl, "_blank", "noopener");
      setShareFeedback("Legenda copiada! Use \"Baixar imagem\" e anexe no WhatsApp; depois cole a legenda no campo \"Adicione uma legenda\".");
    }
    setTimeout(() => setShareFeedback(""), 9000);
    setWhatsappSharing(false);
  }, [lastGeneratedLink, storyCaption, getSelectedImageFile]);

  const handleDownloadStoryImage = useCallback(async () => {
    const url = storyImageUseGenerated && generatedStoryImage
      ? generatedStoryImage
      : selectedProduct?.imageUrl;
    if (!url) return;
    const isDataUrl = typeof url === "string" && url.startsWith("data:");
    try {
      if (isDataUrl) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "story-shopee.jpg";
        a.click();
      } else {
        const res = await fetch(url, { mode: "cors" });
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "story-shopee.jpg";
        a.click();
        URL.revokeObjectURL(a.href);
      }
      setShareFeedback("Imagem baixada! Anexe no WhatsApp ou no Story do Instagram.");
      setTimeout(() => setShareFeedback(""), 4000);
    } catch {
      if (!isDataUrl) {
        const a = document.createElement("a");
        a.href = url;
        a.download = "story-shopee.jpg";
        a.target = "_blank";
        a.rel = "noopener";
        a.click();
      }
      setShareFeedback("Imagem aberta em nova aba. Salve com botão direito → Salvar imagem e anexe no WhatsApp.");
      setTimeout(() => setShareFeedback(""), 5000);
    }
  }, [storyImageUseGenerated, generatedStoryImage, selectedProduct?.imageUrl]);

  const handleDeleteHistory = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/shopee/link-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Erro ao excluir");
        await loadHistory(historyPage, historySearchDebounced);
      } catch {
        //
      }
    },
    [historyPage, historySearchDebounced, loadHistory]
  );

  return (
    <div className="min-h-screen bg-dark-bg text-text-primary p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-shopee-orange mb-6 flex items-center gap-2">
          <Link2 className="h-8 w-8" />
          Gerador de Links Shopee
        </h1>

        {hasApiKeys === false && (
          <div className="mb-6 p-4 rounded-lg border border-amber-500/50 bg-amber-500/10 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">API da Shopee não configurada</p>
              <p className="text-sm text-text-secondary mt-1">
                Cadastre o App ID e a chave da API em{" "}
                <Link href="/configuracoes" className="text-shopee-orange hover:underline font-medium">
                  Configurações → Integração Shopee
                </Link>{" "}
                para usar o gerador de links.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Configurar Link */}
          <div ref={configCardRef} className="bg-dark-card rounded-xl border border-dark-border p-5">
            <h2 className="text-lg font-semibold text-text-primary mb-4">Configurar Link</h2>
            <label className="block text-sm text-text-secondary mb-1">Link Shopee ou Nome do Produto</label>
            <div className="relative mb-4">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onBlur={(e) => {
                  const next = e.relatedTarget;
                  const card = configCardRef.current;
                  if (!card) {
                    runSearchNow();
                    return;
                  }
                  try {
                    if (next == null || !card.contains(next as Node)) runSearchNow();
                  } catch {
                    runSearchNow();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearchNow();
                  }
                }}
                placeholder="Cole o link ou digite o nome do produto..."
                className="w-full px-4 py-3 rounded-lg border border-dark-border bg-dark-bg text-text-primary placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange focus:ring-1 focus:ring-shopee-orange"
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={() => setInputValue("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  aria-label="Limpar"
                >
                  ×
                </button>
              )}
            </div>
            {products.length > 0 && (
              <div className="mb-4 max-h-60 overflow-y-auto rounded-lg border border-dark-border bg-dark-bg p-2 space-y-2 scrollbar-shopee">
                {products.map((p) => (
                  <button
                    key={p.itemId}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-dark-card border border-transparent hover:border-shopee-orange/30 text-left transition-colors"
                  >
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-12 h-12 object-contain rounded bg-white/5" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-dark-card flex items-center justify-center text-text-secondary text-xs">img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{p.productName}</p>
                      <p className="text-xs text-text-secondary">
                        {formatCurrency(p.priceMin)} · Comissão: {formatCurrency(p.commission)} ({((p.commissionRate ?? 0) * 100).toFixed(1)}%) · {p.sales} vendidos
                      </p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-shopee-orange flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div>
                <label className="block text-xs text-text-secondary mb-1">Sub ID 1</label>
                <input
                  type="text"
                  value={subId1}
                  onChange={(e) => setSubId1(e.target.value)}
                  placeholder="Ex: instagram"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Sub ID 2</label>
                <input
                  type="text"
                  value={subId2}
                  onChange={(e) => setSubId2(e.target.value)}
                  placeholder="Ex: stories"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
              </div>
              <div>
                <label className="block text-xs text-text-secondary mb-1">Sub ID 3</label>
                <input
                  type="text"
                  value={subId3}
                  onChange={(e) => setSubId3(e.target.value)}
                  placeholder="Ex: campanha1"
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleSearch()}
                disabled={searchLoading || !inputValue.trim() || !hasApiKeys}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-bg border border-dark-border text-text-primary font-medium hover:border-shopee-orange hover:text-shopee-orange disabled:opacity-50 transition-colors"
              >
                {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </button>
              <button
                type="button"
                onClick={handleConvertLink}
                disabled={convertLoading || (!selectedProduct && !extractItemIdFromUrl(inputValue)) || !hasApiKeys}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {convertLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Converter Link
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-dark-border">
              <label htmlFor="best-seller-keyword" className="block text-xs text-text-secondary mb-2">
                Palavra-chave para listar os mais vendidos
              </label>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <input
                  id="best-seller-keyword"
                  type="text"
                  value={bestSellerKeyword}
                  onChange={(e) => setBestSellerKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      loadBestSellers();
                    }
                  }}
                  placeholder="Ex: Camisas, eletrônicos, moda..."
                  className="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
                />
                <button
                  type="button"
                  onClick={loadBestSellers}
                  disabled={loadingBestSellers || !bestSellerKeyword.trim() || !hasApiKeys}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-dark-bg border border-dark-border text-text-primary font-medium hover:border-emerald-500 hover:text-emerald-400 disabled:opacity-50 transition-colors"
                >
                  {loadingBestSellers ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
                  Listar os Mais Vendidos
                </button>
              </div>
            </div>
            {error && (
              <p className="mt-3 text-sm text-red-400 flex items-center gap-1">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </p>
            )}
          </div>

          {/* Visualização da Oferta */}
          <div className="bg-dark-card rounded-xl border border-dark-border p-5 overflow-hidden flex flex-col">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex-shrink-0">Visualização da Oferta</h2>
            {bestSellers.length > 0 ? (
              <div className="min-h-0 flex flex-col">
                <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1 flex-shrink-0">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  Os 20 mais vendidos para &quot;{lastBestSellerKeyword}&quot;
                </h3>
                <p className="text-xs text-text-secondary mb-3">Clique em um produto para selecionar e converter o link.</p>
                <ul className="space-y-2 max-h-[420px] overflow-y-auto overflow-x-hidden scrollbar-shopee rounded-lg border border-dark-border bg-dark-bg/30 pr-1">
                  {bestSellers.map((p) => (
                    <li key={p.itemId}>
                      <button
                        type="button"
                        onClick={() => handleSelectProductFromList(p)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg border border-dark-border hover:border-shopee-orange/50 bg-dark-bg text-left transition-colors"
                      >
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="w-12 h-12 object-contain rounded bg-white/5 flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-dark-card flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-text-primary truncate">{p.productName}</p>
                          <p className="text-xs text-text-secondary">
                            {formatCurrency(p.priceMin)} · {((p.commissionRate ?? 0) * 100).toFixed(1)}% comissão · <strong>{p.sales} vendidos</strong>
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">
                          R$ {p.commission.toFixed(2)}
                        </span>
                        <ExternalLink className="h-4 w-4 text-shopee-orange flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : selectedProduct ? (
              <div className="space-y-4">
                <div className="flex gap-4 p-3 rounded-lg border border-dark-border bg-dark-bg">
                  {selectedProduct.imageUrl ? (
                    <img src={selectedProduct.imageUrl} alt="" className="w-20 h-20 object-contain rounded bg-white/5 flex-shrink-0" />
                  ) : (
                    <div className="w-20 h-20 rounded bg-dark-card flex items-center justify-center text-text-secondary text-xs flex-shrink-0">img</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">{selectedProduct.productName}</p>
                    <p className="text-xs text-text-secondary mt-1">
                      {selectedProduct.ratingStar > 0 && `${selectedProduct.ratingStar} · `}
                      {selectedProduct.sales} vendidos
                    </p>
                    <p className="text-lg font-bold text-shopee-orange mt-1">
                      {formatCurrency(selectedProduct.priceMin)}
                      {selectedProduct.priceDiscountRate > 0 && (
                        <span className="ml-2 text-xs font-normal text-emerald-400">{Math.round(selectedProduct.priceDiscountRate * 100)}% OFF</span>
                      )}
                    </p>
                    <p className="text-sm text-emerald-400 font-medium">
                      COMISSÃO {((selectedProduct.commissionRate ?? 0) * 100).toFixed(1)}% (aprox. {formatCurrency(selectedProduct.commission)})
                    </p>
                    <p className="text-xs text-text-secondary">@{selectedProduct.shopName}</p>
                  </div>
                </div>
                {goldenProducts.length > 0 && (
                  <div className="min-h-0 flex flex-col">
                    <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1 flex-shrink-0">
                      Oportunidades de Ouro
                      <span className="text-xs font-normal text-emerald-400">Maior Comissão</span>
                    </h3>
                    <ul className="space-y-2 max-h-64 overflow-y-auto overflow-x-hidden scrollbar-shopee rounded-lg border border-dark-border bg-dark-bg/30 pr-1">
                      {goldenProducts.slice(0, 5).map((p) => (
                        <li key={p.itemId}>
                          <button
                            type="button"
                            onClick={() => handleSelectProduct(p)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg border border-dark-border hover:border-shopee-orange/50 bg-dark-bg text-left transition-colors"
                          >
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt="" className="w-10 h-10 object-contain rounded bg-white/5 flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-dark-card flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-text-primary truncate">{p.productName}</p>
                              <p className="text-xs text-text-secondary">{formatCurrency(p.priceMin)}</p>
                            </div>
                            <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">
                              {((p.commissionRate ?? 0) * 100).toFixed(1)}% (R$ {p.commission.toFixed(2)})
                            </span>
                            <ExternalLink className="h-3 w-3 text-shopee-orange flex-shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 rounded-xl border-2 border-dashed border-dark-border bg-dark-bg/50 text-center">
                <Hand className="h-14 w-14 text-shopee-orange/70 mb-3" />
                <p className="font-semibold text-text-primary">Toca aqui!</p>
                <p className="text-sm text-text-secondary mt-1 max-w-xs">
                  Digite uma palavra-chave (ex: Camisas, eletrônicos) no campo acima e clique em <strong>Listar os Mais Vendidos</strong> para ver os 20 produtos com mais vendas nessa busca. Ou use o campo principal e <strong>Buscar</strong> para buscar por link/nome. Depois selecione um produto e use &quot;Converter Link&quot;.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Preparar para Stories */}
        {selectedProduct && (
          <div className="bg-dark-card rounded-xl border border-dark-border p-5 mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-shopee-orange" />
              Preparar para Stories 
            </h2>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="flex flex-col gap-3 flex-shrink-0">
                <div className="flex flex-wrap gap-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-text-secondary font-medium">Imagem Shopee</p>
                    <button
                      type="button"
                      onClick={() => setStoryImageUseGenerated(false)}
                      className={`w-[160px] aspect-[9/16] rounded-xl overflow-hidden flex items-center justify-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card ${
                        !storyImageUseGenerated
                          ? "border-2 border-shopee-orange bg-dark-bg"
                          : "border border-dark-border bg-dark-bg hover:border-shopee-orange/60"
                      }`}
                    >
                      {selectedProduct.imageUrl ? (
                        <img
                          src={selectedProduct.imageUrl}
                          alt="Produto"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                      ) : (
                        <span className="text-text-secondary text-sm">Sem imagem</span>
                      )}
                    </button>
                    {!storyImageUseGenerated && (
                      <p className="text-xs text-shopee-orange font-medium">✓ Em uso no Story</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-text-secondary font-medium">Imagem IA</p>
                    {storyImageLoading ? (
                      <div className="w-[160px] aspect-[9/16] rounded-xl overflow-hidden border-2 border-dark-border bg-dark-bg flex items-center justify-center min-h-[284px]">
                        <div className="flex flex-col items-center justify-center gap-2 text-text-secondary">
                          <Loader2 className="h-8 w-8 animate-spin" />
                          <span className="text-xs">Gerando...</span>
                        </div>
                      </div>
                    ) : generatedStoryImage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setStoryImageUseGenerated(true)}
                          className={`w-[160px] aspect-[9/16] rounded-xl overflow-hidden flex items-center justify-center min-h-[284px] transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card ${
                            storyImageUseGenerated
                              ? "border-2 border-shopee-orange bg-dark-bg"
                              : "border border-dark-border bg-dark-bg hover:border-shopee-orange/60"
                          }`}
                        >
                          <img
                            src={generatedStoryImage}
                            alt="Story gerada"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        </button>
                        {storyImageUseGenerated && (
                          <p className="text-xs text-shopee-orange font-medium">✓ Em uso no Story</p>
                        )}
                      </>
                    ) : (
                      <div className="w-[160px] aspect-[9/16] rounded-xl border-2 border-dashed border-dark-border bg-dark-bg flex items-center justify-center min-h-[284px]">
                        <span className="text-text-secondary text-xs text-center px-2">Clique em &quot;Gerar Imagem&quot;</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleGenerateStoryImage}
                    disabled={storyImageLoading || !selectedProduct?.imageUrl}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-text-primary text-sm font-medium hover:border-shopee-orange hover:text-shopee-orange disabled:opacity-50 transition-colors"
                  >
                    {storyImageLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                    Gerar Imagem
                  </button>
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full">
                <label className="block text-sm text-text-secondary mb-1">Legenda para o Story</label>
                <textarea
                  value={storyCaption}
                  onChange={(e) => setStoryCaption(e.target.value)}
                  placeholder="Clique em &quot;Gerar legenda&quot; para criar uma legenda de venda com hashtags..."
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange resize-y scrollbar-shopee"
                />
                <p className="text-xs text-text-secondary mt-1">Status do WhatsApp: máx. 700 caracteres e 10 linhas (legenda + link). A legenda é cortada automaticamente ao compartilhar.</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button
                    type="button"
                    onClick={handleGenerateCaption}
                    disabled={captionLoading || !selectedProduct?.productName}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-shopee-orange text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {captionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Gerar legenda
                  </button>
                  <button
                    type="button"
                    onClick={handleShareStory}
                    disabled={!lastGeneratedLink}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      lastGeneratedLink
                        ? "bg-amber-500 text-dark-bg border border-amber-400 shadow-lg shadow-amber-500/30 hover:brightness-110 animate-share-pulse cursor-pointer"
                        : "bg-dark-border text-text-secondary border border-dark-border cursor-not-allowed opacity-70"
                    }`}
                  >
                    <Share2 className="h-4 w-4" />
                    Instagram
                  </button>
                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    disabled={!lastGeneratedLink || whatsappSharing}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      lastGeneratedLink && !whatsappSharing
                        ? "bg-emerald-600 text-white border border-emerald-500 hover:bg-emerald-500 cursor-pointer"
                        : "bg-dark-border text-text-secondary border border-dark-border cursor-not-allowed opacity-70"
                    }`}
                  >
                    {whatsappSharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadStoryImage}
                    disabled={!selectedProduct?.imageUrl && !generatedStoryImage}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium border border-dark-border bg-dark-bg text-text-primary hover:border-shopee-orange hover:text-shopee-orange disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Baixar imagem
                  </button>
                </div>
                {!lastGeneratedLink && (
                  <p className="mt-3 text-sm text-amber-200/90 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    Primeiro clique no Converter Link para copiar seu link customizado da oferta!
                  </p>
                )}
                {shareFeedback && (
                  <p className="mt-3 text-sm text-emerald-400 flex items-start gap-2">
                    <Copy className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    {shareFeedback}
                  </p>
                )}
                <p className="mt-2 text-xs text-text-secondary">
                  <strong>Instagram:</strong> só enviamos a imagem. O link é copiado — escolha Instagram → Stories; cole o link no sticker &quot;Adicionar link&quot;. <strong>WhatsApp:</strong> só enviamos a imagem. A legenda (com o link no topo) é copiada — escolha WhatsApp → Status ou conversa; cole no campo &quot;Adicione uma legenda&quot; ou abaixo da imagem.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Histórico de Links */}
        <div className="bg-dark-card rounded-xl border border-dark-border p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Link2 className="h-5 w-5 text-shopee-orange" />
              Histórico de Links
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar produto, link ou subid..."
                className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg border border-dark-border bg-dark-bg text-text-primary text-sm placeholder-text-secondary/60 focus:outline-none focus:border-shopee-orange"
              />
            </div>
          </div>
          {historyLoading && history.length === 0 ? (
            <p className="text-sm text-text-secondary py-6 text-center flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </p>
          ) : history.length === 0 ? (
            <p className="text-sm text-text-secondary py-6 text-center">Nenhum link gerado ainda. Use &quot;Converter Link&quot; para criar.</p>
          ) : (
            <>
              <ul className="space-y-3">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="flex flex-wrap items-start gap-3 p-3 rounded-lg border border-dark-border bg-dark-bg hover:border-dark-border"
                  >
                    {h.imageUrl ? (
                      <img src={h.imageUrl} alt="" className="w-14 h-14 object-contain rounded bg-white/5 flex-shrink-0" />
                    ) : (
                      <div className="w-14 h-14 rounded bg-dark-card flex-shrink-0 flex items-center justify-center text-text-secondary text-xs">img</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary line-clamp-2">{h.productName || "Link gerado"}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</p>
                      {(h.subId1 || h.subId2 || h.subId3) && (
                        <div className="mt-1.5 text-xs text-text-secondary space-y-0.5">
                          {h.subId1 && <p>Sub ID 1: {h.subId1}</p>}
                          {h.subId2 && <p>Sub ID 2: {h.subId2}</p>}
                          {h.subId3 && <p>Sub ID 3: {h.subId3}</p>}
                        </div>
                      )}
                      {h.observation && <p className="text-xs text-text-secondary mt-0.5">{h.observation}</p>}
                      {(h.commissionRate > 0 || h.commissionValue > 0) && (
                        <p className="text-xs text-emerald-400 font-medium mt-1">
                          Comissão {((h.commissionRate ?? 0) * 100).toFixed(1)}% · {formatCurrency(h.commissionValue ?? 0)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(h.shortLink)}
                        className="p-2 rounded-md bg-dark-card border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
                        title="Copiar link"
                      >
                        <ShoppingBag className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(h.slug || h.originUrl)}
                        className="p-2 rounded-md bg-dark-card border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
                        title="Copiar slug/código (Facebook Ads)"
                      >
                        <Target className="h-4 w-4" />
                      </button>
                      <a
                        href={h.shortLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-md bg-dark-card border border-dark-border text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/50 transition-colors"
                        title="Abrir link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteHistory(h.id)}
                        className="p-2 rounded-md bg-dark-card border border-dark-border text-text-secondary hover:text-red-400 hover:border-red-400/50 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {historyTotalPages > 1 && (
                <div className="mt-4 flex items-center justify-between border-t border-dark-border pt-4">
                  <p className="text-xs text-text-secondary">
                    Página {historyPage} de {historyTotalPages} · {historyTotal} link(s)
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      disabled={historyPage <= 1 || historyLoading}
                      className="p-2 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-shopee-orange disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Página anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
                      disabled={historyPage >= historyTotalPages || historyLoading}
                      className="p-2 rounded-md bg-dark-bg border border-dark-border text-text-secondary hover:text-shopee-orange disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label="Próxima página"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
