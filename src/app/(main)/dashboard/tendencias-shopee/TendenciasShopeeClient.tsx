"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  AlertTriangle,
  ArrowLeft,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Flame,
  LayoutGrid,
  Link2,
  ListPlus,
  Loader2,
  Percent,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Store,
  Tag,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import Toolist from "@/app/components/ui/Toolist";
import { EscalaveisHero } from "./EscalaveisHero";
import { LinkHistorySection } from "./LinkHistorySection";
import { MetricsCharts } from "./MetricsCharts";
import { MontarListaWizard } from "./MontarListaWizard";
import { ShoiaListsSection } from "./ShoiaListsSection";
import { AddToListModal, ConvertLinkModal, type ProductSummary } from "./TendenciasModals";
import { WelcomeVideoOverlay } from "./WelcomeVideoOverlay";

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

/** Paginação responsiva: 4 cards/página em desktop (lg:1024+), 2 em mobile. */
function useResponsivePageSize(): number {
  const [size, setSize] = useState(4);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => setSize(mql.matches ? 4 : 2);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);
  return size;
}

type TrendProduct = {
  itemId: number;
  productName: string;
  imageUrl: string | null;
  price: number | null;
  priceMin: number | null;
  priceMax: number | null;
  sales: number;
  commissionRate: number | null;
  ratingStar: number | null;
  productLink: string | null;
  shopName: string | null;
  categoryIds: number[];
  score: number;
  isViral: boolean;
  rankPosition: number | null;
  discountRate: number;
  sparkline: number[];
};

type ApiResponse = {
  fetchedAt: string | null;
  stagnant: boolean;
  products: TrendProduct[];
  stats: {
    total: number;
    viralCount: number;
    avgScore: number;
    totalSalesAggregate: number;
    avgCommission: number;
    hottestCategoryId: number | null;
    topShop: string | null;
  };
  categoriesAvailable: { categoryId: number; count: number; name: string | null }[];
};

type ShopAgg = {
  shopName: string;
  imageUrl: string | null;
  productCount: number;
  totalSales: number;
  avgScore: number;
  avgCommission: number | null;
  viralCount: number;
};

type TabKey = "shoia" | "metrics" | "score" | "sales" | "commission" | "flash" | "category" | "shops";

type Lista = { id: string; nome: string };

const POLL_INTERVAL_MS = 5_000;

function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(v);
}

function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

function formatRelative(iso: string | null): string {
  if (!iso) return "nunca";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 5_000) return "agora mesmo";
  if (ms < 60_000) return `há ${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `há ${Math.round(ms / 60_000)} min`;
  return `há ${Math.round(ms / 3_600_000)}h`;
}

function useCountUp(target: number) {
  const [display, setDisplay] = useState(target);
  const prevRef = useRef(target);
  useEffect(() => {
    const start = prevRef.current;
    const delta = target - start;
    if (delta === 0) return;
    const startedAt = performance.now();
    const duration = 600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return display;
}

export default function TendenciasShopeeClient({
  hasShopeeCredentials,
  userEmail,
}: {
  hasShopeeCredentials: boolean;
  userEmail: string;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("shoia");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);

  const [listas, setListas] = useState<Lista[]>([]);
  const [listasLoading, setListasLoading] = useState(false);

  // Lojas
  const [shops, setShops] = useState<ShopAgg[]>([]);
  const [selectedShop, setSelectedShop] = useState<string | null>(null);
  const [selectedShopImage, setSelectedShopImage] = useState<string | null>(null);
  const [shopProducts, setShopProducts] = useState<TrendProduct[]>([]);
  const [shopProductsLoading, setShopProductsLoading] = useState(false);

  // Modal de detalhes
  const [selectedProduct, setSelectedProduct] = useState<TrendProduct | null>(null);

  // Popup do produto clicado na pizza "Top produtos por score" (aba Métricas).
  // Renderiza o mesmo <ProductCard> da aba Score num overlay.
  const [productFromChart, setProductFromChart] = useState<TrendProduct | null>(null);

  // Modais de ação (Converter link / Adicionar à lista) — substituem os
  // botões "diretos" do card pra dar a UX que o usuário pediu (toggle SubID).
  const [productForConvert, setProductForConvert] = useState<TrendProduct | null>(null);
  const [productForAddList, setProductForAddList] = useState<TrendProduct | null>(null);

  // Bumper que força o LinkHistorySection a refazer fetch quando geramos
  // um link novo (via converter OU adicionar à lista).
  const [linkHistoryRefresh, setLinkHistoryRefresh] = useState(0);

  // Wizard "Montar Lista com IA" — só visível na aba Sho.IA.
  const [wizardOpen, setWizardOpen] = useState(false);

  // Paginação responsiva (4 desktop / 2 mobile).
  const pageSize = useResponsivePageSize();
  const [productsPage, setProductsPage] = useState(1);
  // Reset da página quando troca aba, categoria ou filtro de busca.
  useEffect(() => {
    setProductsPage(1);
  }, [tab, activeCategoryId, filter, pageSize]);

  const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  // Polling principal: produtos + stats da aba selecionada.
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({ tab, limit: "60" });
      if (tab === "category" && activeCategoryId != null) {
        params.set("categoryId", String(activeCategoryId));
      }
      // Se a aba é "shops", chamamos o /products só pra stats — produtos vêm
      // do endpoint de lojas.
      const fetchTab = tab === "shops" ? "score" : tab;
      params.set("tab", fetchTab);
      const res = await fetch(`/api/shopee-trends?${params}`, { cache: "no-store" });
      const json = (await res.json()) as ApiResponse | { error?: string };
      if (!res.ok || ("error" in json && json.error)) {
        setError("error" in json ? (json.error ?? "Erro") : `HTTP ${res.status}`);
        return;
      }
      setData(json as ApiResponse);
      setError(null);
      setHeartbeatPulse(true);
      setTimeout(() => setHeartbeatPulse(false), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao consultar API");
    } finally {
      setLoading(false);
    }
  }, [tab, activeCategoryId]);

  // Fetch das lojas (atualiza junto com o snapshot principal).
  const fetchShops = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee-trends/shops?limit=20", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { shops?: ShopAgg[] };
      setShops(json.shops ?? []);
    } catch {
      /* ignora — lojas é nice-to-have */
    }
  }, []);

  useEffect(() => {
    void fetchData();
    void fetchShops();
    const interval = setInterval(() => {
      void fetchData();
      void fetchShops();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData, fetchShops]);

  // Listas Shopee do usuário pra dropdown.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setListasLoading(true);
        const res = await fetch("/api/shopee/minha-lista-ofertas/listas", { cache: "no-store" });
        if (!alive || !res.ok) return;
        const json = (await res.json()) as { data?: Array<{ id: string; nome: string }> };
        setListas(json.data ?? []);
      } catch {
        /* ignora */
      } finally {
        if (alive) setListasLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Quando o usuário abre uma loja, fetch dos produtos dela + imagem.
  useEffect(() => {
    if (!selectedShop) {
      setShopProducts([]);
      setSelectedShopImage(null);
      return;
    }
    let alive = true;
    (async () => {
      setShopProductsLoading(true);
      try {
        const res = await fetch(
          `/api/shopee-trends/shops?shopName=${encodeURIComponent(selectedShop)}`,
          { cache: "no-store" },
        );
        if (!alive || !res.ok) return;
        const json = (await res.json()) as { products?: TrendProduct[]; imageUrl?: string | null };
        setShopProducts(json.products ?? []);
        setSelectedShopImage(json.imageUrl ?? null);
      } catch {
        if (alive) {
          setShopProducts([]);
          setSelectedShopImage(null);
        }
      } finally {
        if (alive) setShopProductsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [selectedShop]);

  // Insights dinâmicos no console IA. O nome da categoria quente vem
  // resolvido pelo server (lookup no shopee_category_directory).
  const hottestCategoryName = useMemo(() => {
    if (!data?.stats.hottestCategoryId) return null;
    return (
      data.categoriesAvailable.find((c) => c.categoryId === data.stats.hottestCategoryId)?.name ?? null
    );
  }, [data?.stats.hottestCategoryId, data?.categoriesAvailable]);

  const filteredProducts = useMemo(() => {
    if (!data?.products) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data.products;
    return data.products.filter((p) =>
      `${p.productName} ${p.shopName ?? ""}`.toLowerCase().includes(q),
    );
  }, [data?.products, filter]);

  // Categorias disponíveis no snapshot atual. Nome vem resolvido do server;
  // se vier null (categoria que ainda não caiu no diretório), mostramos como
  // "Categoria #ID" pra não esconder a opção.
  const categoriesForUI = useMemo(() => {
    if (!data?.categoriesAvailable.length) return [];
    return data.categoriesAvailable
      .map((c) => ({
        categoryId: c.categoryId,
        count: c.count,
        name: c.name ?? `Categoria #${c.categoryId}`,
      }))
      .slice(0, 20);
  }, [data?.categoriesAvailable]);

  const hottestCategoryThreshold = useMemo(() => {
    if (categoriesForUI.length === 0) return 0;
    const counts = categoriesForUI.map((c) => c.count);
    const median = counts.sort((a, b) => a - b)[Math.floor(counts.length / 2)] ?? 0;
    return Math.max(median * 1.5, 3);
  }, [categoriesForUI]);

  // Os "handlers" agora só abrem os modais — toda a lógica de geração de link
  // e adição à lista vive nos componentes <ConvertLinkModal> e <AddToListModal>,
  // que conhecem o toggle de SubID e disparam refresh do histórico.
  const openConvertModal = useCallback((p: TrendProduct) => {
    setProductForConvert(p);
  }, []);

  const openAddListModal = useCallback((p: TrendProduct) => {
    setProductForAddList(p);
  }, []);

  // Refetch das listas Shopee quando o usuário cria uma nova dentro do modal.
  const refetchListas = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: Array<{ id: string; nome: string; totalItens?: number }> };
      setListas(json.data ?? []);
    } catch {
      /* ignora */
    }
  }, []);

  // Quando um link é gerado (em qualquer modal), bumpa o signal pra que o
  // LinkHistorySection refaça o fetch e mostre o item recém-criado.
  const bumpLinkHistory = useCallback(() => {
    setLinkHistoryRefresh((n) => n + 1);
  }, []);

  if (!hasShopeeCredentials) {
    return (
      <div className="bg-dark-bg light:bg-zinc-50 min-h-[calc(100vh-4rem)]">
        <div className="container mx-auto px-4 py-8">
          <PageHeader />
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center max-w-2xl mx-auto">
            <Settings2 className="w-10 h-10 text-amber-300 light:text-amber-600 mx-auto mb-3" />
            <h2 className="text-base font-bold text-amber-100 light:text-amber-900">
              Conecte sua conta Shopee primeiro
            </h2>
            <p className="mt-2 text-sm text-amber-200/90 light:text-amber-800 leading-relaxed">
              Configure suas credenciais Shopee Affiliate em Configurações → Integração Shopee
              pra gerar links afiliados.
            </p>
            <Link
              href="/configuracoes"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-md bg-amber-500 text-amber-950 font-semibold text-sm hover:bg-amber-400 transition"
            >
              Ir para Configurações <ExternalLink className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stats = data?.stats ?? {
    total: 0, viralCount: 0, avgScore: 0,
    totalSalesAggregate: 0, avgCommission: 0,
    hottestCategoryId: null, topShop: null,
  };

  return (
    <div className="bg-dark-bg light:bg-zinc-50 min-h-[calc(100vh-4rem)] relative">
      {/* Overlay de boas-vindas (1x/dia, posição absoluta dentro da página
          — não cobre header/sidebar/footer da layout) */}
      <WelcomeVideoOverlay />

      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-4">
        <PageHeader />

        <AiConsole
          heartbeatPulse={heartbeatPulse}
          stagnant={data?.stagnant ?? true}
          fetchedAt={data?.fetchedAt ?? null}
        />

        <TabsBar
          tab={tab}
          onChange={(t) => {
            setTab(t);
            if (t === "category" && activeCategoryId == null && categoriesForUI.length > 0) {
              setActiveCategoryId(categoriesForUI[0].categoryId);
            }
          }}
          flashCount={data?.products.filter((p) => p.discountRate >= 0.3).length ?? 0}
          categoriesCount={categoriesForUI.length}
        />

        {tab === "category" ? (
          <CategoryPicker
            categories={categoriesForUI}
            active={activeCategoryId}
            onChange={setActiveCategoryId}
            hotThreshold={hottestCategoryThreshold}
          />
        ) : null}

        {/* Filtro busca + force refresh — só nas abas de produtos */}
        {tab !== "shops" && tab !== "shoia" && tab !== "metrics" ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#1c1c1f] light:bg-white px-3 py-1.5">
              <Search className="w-3.5 h-3.5 text-[#7a7a80] light:text-zinc-500" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filtrar por produto ou loja..."
                className="flex-1 bg-transparent outline-none text-[12px] text-text-primary placeholder:text-[#6b6b72] light:placeholder:text-zinc-400"
              />
            </div>
            <button
              type="button"
              onClick={() => { void fetchData(); void fetchShops(); }}
              className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] font-semibold text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </button>
          </div>
        ) : null}

        {feedback ? (
          <div
            className={`rounded-lg border px-3 py-2 text-[11px] ${
              feedback.kind === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 light:text-emerald-800 light:bg-emerald-50 light:border-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300 light:text-red-800 light:bg-red-50 light:border-red-300"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        {error ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 light:bg-red-50 light:border-red-300 px-3 py-2 flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-red-300 light:text-red-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-300 light:text-red-800">{error}</p>
          </div>
        ) : null}

        {/* Conteúdo trocando com fade entre abas */}
        <AnimatePresence mode="wait">
          {tab === "shoia" ? (
            <motion.div
              key="shoia"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <EscalaveisHero
                userEmail={userEmail}
                products={data?.products ?? []}
                onAddToList={openAddListModal}
                onConvert={openConvertModal}
              />
            </motion.div>
          ) : tab === "metrics" ? (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <MetricsDashboard
                stats={stats}
                hottestCategoryName={hottestCategoryName}
                fetchedAt={data?.fetchedAt ?? null}
                onShopClick={setSelectedShop}
              />
              <MetricsCharts
                products={data?.products ?? []}
                categories={data?.categoriesAvailable ?? []}
                onProductClick={setProductFromChart}
              />
            </motion.div>
          ) : tab === "shops" ? (
            <motion.div
              key="shops"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <ShopsList shops={shops} onSelect={setSelectedShop} />
            </motion.div>
          ) : (
            <motion.div
              key={`products-${tab}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              {loading && !data ? (
                <div className="mt-6 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-[#ee4d2d]" />
                </div>
              ) : null}

              {data && filteredProducts.length === 0 ? (
                <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white p-8 text-center">
                  <p className="text-[12px] text-[#9a9aa2] light:text-zinc-500">
                    {tab === "flash"
                      ? "Nenhum produto em oferta relâmpago detectada agora. Próxima varredura em 1h."
                      : tab === "category"
                        ? "Nenhum produto nessa categoria no snapshot atual."
                        : "Nenhum produto correspondente. Limpe o filtro ou aguarde."}
                  </p>
                </div>
              ) : null}

              <ProductGrid
                products={filteredProducts}
                pageSize={pageSize}
                page={productsPage}
                onPageChange={setProductsPage}
                onConvert={openConvertModal}
                onAddToList={openAddListModal}
                onClickDetails={(p) => setSelectedProduct(p)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Aba Sho.IA: CTA do wizard + listas geradas pela IA.
            Aba Métricas: nada extra (gráficos já cobrem o espaço).
            Demais abas: Links Gerados fixo no rodapé (mesmo do Gerador). */}
        {tab === "shoia" ? (
          <>
            <MontarListaCTA onClick={() => setWizardOpen(true)} />
            <ShoiaListsSection refreshSignal={linkHistoryRefresh} />
          </>
        ) : tab === "metrics" ? null : (
          <LinkHistorySection refreshSignal={linkHistoryRefresh} />
        )}

        {/* Wizard "Montar Lista com IA" */}
        <MontarListaWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          categories={categoriesForUI}
          onSaved={() => {
            // Força refresh dos Links Gerados (a lista cria várias entradas
            // no histórico, então quando voltar pra outra aba já aparece).
            setLinkHistoryRefresh((n) => n + 1);
          }}
        />

        {/* Drawer da loja */}
        <ShopDrawer
          open={Boolean(selectedShop)}
          shopName={selectedShop}
          shopImageUrl={selectedShopImage}
          products={shopProducts}
          loading={shopProductsLoading}
          onClose={() => setSelectedShop(null)}
          onConvert={openConvertModal}
          onAddToList={openAddListModal}
          onClickDetails={(p) => setSelectedProduct(p)}
        />

        {/* Modal de detalhes do produto */}
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onConvert={openConvertModal}
        />

        {/* Popup do produto clicado num gráfico (mesmo card da aba Score) */}
        <AnimatePresence>
          {productFromChart ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setProductFromChart(null)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="w-full max-w-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <ProductCard
                  product={productFromChart}
                  onConvert={openConvertModal}
                  onAddToList={openAddListModal}
                  onClickDetails={() => {
                    setSelectedProduct(productFromChart);
                    setProductFromChart(null);
                  }}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* Modais de Convert e Add to List (compartilhados pra qualquer card) */}
        <ConvertLinkModal
          product={productForConvert ? toProductSummary(productForConvert) : null}
          onClose={() => setProductForConvert(null)}
          onConverted={bumpLinkHistory}
        />
        <AddToListModal
          product={productForAddList ? toProductSummary(productForAddList) : null}
          listas={listas}
          onClose={() => setProductForAddList(null)}
          onAdded={() => {
            bumpLinkHistory();
            setFeedback({ kind: "ok", text: "Adicionado à lista ✓" });
            setTimeout(() => setFeedback(null), 3000);
          }}
          onListsRefetch={refetchListas}
        />
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 49% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .animate-blink { animation: blink 1s steps(2) infinite; }

        @keyframes hot-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(238, 77, 45, 0.45); }
          50% { box-shadow: 0 0 0 6px rgba(238, 77, 45, 0); }
        }
        .animate-hot-pulse { animation: hot-pulse 2s ease-in-out infinite; }

        @keyframes light-sweep {
          0% { transform: translateX(-150%) skewX(-20deg); }
          100% { transform: translateX(250%) skewX(-20deg); }
        }
        .light-sweep::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 50%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          pointer-events: none;
          animation: light-sweep 2.6s ease-in-out infinite;
        }

        @keyframes shoia-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        :global(.animate-shoia-float) {
          animation: shoia-float 2.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/** Mascote correndo: alterna duas frames a cada 1s pra dar a sensação de
 *  que a Sho.IA está "trabalhando" caçando produtos. */
function RunningShoIcon() {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % 2), 1000);
    return () => clearInterval(id);
  }, []);
  const src = frame === 0 ? "/tendencias/shocorrendo1.png" : "/tendencias/shocorrendo2.png";
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      aria-hidden
      className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0"
    />
  );
}

function PageHeader() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary font-heading flex items-center gap-2">
          <RunningShoIcon />
          Tendências Shopee
          <Toolist
            variant="below"
            wide
            text="Os produtos que mais vendem na Shopee agora — atualizando em tempo real."
          />
        </h1>
      </div>
      <Link
        href="/dashboard"
        className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-[#ee4d2d] hover:opacity-90"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>
    </div>
  );
}

function AiConsole({
  heartbeatPulse,
  stagnant,
  fetchedAt,
}: {
  heartbeatPulse: boolean;
  stagnant: boolean;
  fetchedAt: string | null;
}) {
  return (
    <div className="rounded-xl border border-[#2c2c32] bg-[#101015] light:border-zinc-200 light:bg-white overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2">
        {/* Label "IA · Análise contínua" some no mobile pra liberar espaço —
            o status à direita já comunica que algo está vivo. */}
        <span className="hidden sm:inline-flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#ee4d2d] animate-pulse" />
          <span className="text-[10px] uppercase tracking-widest font-bold text-[#ee4d2d]">
            IA · Análise contínua
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-[10px] text-text-secondary light:text-zinc-600 sm:ml-auto">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full transition-all ${
              heartbeatPulse
                ? "bg-emerald-400 scale-150 shadow-[0_0_12px_#34d399]"
                : "bg-emerald-500/60"
            }`}
          />
          {stagnant ? "Snapshot pausado" : "Monitorando em tempo real"} · atualizado {formatRelative(fetchedAt)}
        </span>
      </div>
    </div>
  );
}

function MetricsDashboard({
  stats,
  hottestCategoryName,
  fetchedAt,
  onShopClick,
}: {
  stats: ApiResponse["stats"];
  hottestCategoryName: string | null;
  fetchedAt: string | null;
  onShopClick?: (shopName: string) => void;
}) {
  return (
    <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white p-4">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="w-4 h-4 text-[#7cd0f7] light:text-cyan-600" />
        <h2 className="text-[11px] uppercase tracking-widest font-bold text-text-secondary light:text-zinc-600">
          Métricas do mercado · estudo
        </h2>
        <span className="ml-auto text-[10px] text-[#7a7a80] light:text-zinc-500">
          snapshot {formatRelative(fetchedAt)}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile icon={<TrendingUp className="w-4 h-4 text-emerald-400 light:text-emerald-600" />} label="Produtos no top" value={stats.total} />
        <MetricTile icon={<Flame className="w-4 h-4 text-orange-400 light:text-orange-600" />} label="Em alta agora" value={stats.viralCount} accent="orange" />
        <MetricTile icon={<Award className="w-4 h-4 text-[#7cd0f7] light:text-cyan-600" />} label="Score médio" value={stats.avgScore} suffix="/100" />
        <MetricTile icon={<Receipt className="w-4 h-4 text-fuchsia-400 light:text-fuchsia-600" />} label="Vendas agregadas" value={stats.totalSalesAggregate} compact />
        <MetricTile icon={<Percent className="w-4 h-4 text-amber-400 light:text-amber-600" />} label="Comissão média" value={stats.avgCommission} suffix="%" decimal />
        <MetricTile
          icon={<LayoutGrid className="w-4 h-4 text-violet-400 light:text-violet-600" />}
          label="Categoria quente"
          textValue={hottestCategoryName ?? "—"}
        />
      </div>
      {stats.topShop ? (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-text-secondary light:text-zinc-600">
          <Store className="w-3.5 h-3.5 text-[#7cd0f7] light:text-cyan-600" />
          <span>Loja com mais vendas em 1 hora:</span>
          <button
            type="button"
            onClick={() => stats.topShop && onShopClick?.(stats.topShop)}
            disabled={!onShopClick}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[#ee4d2d] font-semibold hover:bg-[#ee4d2d]/20 transition-colors disabled:opacity-60"
            title="Ver produtos dessa loja"
          >
            {stats.topShop}
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MetricTile({
  icon,
  label,
  value,
  textValue,
  suffix,
  decimal,
  compact,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  textValue?: string;
  suffix?: string;
  decimal?: boolean;
  compact?: boolean;
  accent?: "orange";
}) {
  const animated = useCountUp(value ?? 0);
  const accentBorder = accent === "orange" ? "border-orange-500/25" : "border-[#2c2c32] light:border-zinc-200";
  const display = textValue
    ? textValue
    : decimal
      ? animated.toFixed(1)
      : compact && animated >= 1000
        ? `${(animated / 1000).toFixed(1)}k`
        : formatInt(animated);
  return (
    <div className={`rounded-lg border ${accentBorder} bg-[#222228] light:bg-zinc-50 p-2.5`}>
      <div className="flex items-center gap-1.5 text-[9px] font-semibold text-[#9a9aa2] light:text-zinc-500 uppercase tracking-wider">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 text-base font-bold text-text-primary light:text-zinc-900 leading-tight truncate">
        {display}
        {suffix && !textValue ? <span className="text-[9px] text-[#9a9aa2] light:text-zinc-500 ml-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

function TabsBar({
  tab,
  onChange,
  flashCount,
  categoriesCount,
}: {
  tab: TabKey;
  onChange: (t: TabKey) => void;
  flashCount: number;
  categoriesCount: number;
}) {
  const tabs: { key: TabKey; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "shoia", label: "Sho.IA", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: "metrics", label: "Métricas", icon: <BarChart3 className="w-3.5 h-3.5" /> },
    { key: "score", label: "Score", icon: <Award className="w-3.5 h-3.5" /> },
    { key: "sales", label: "Mais vendidos", icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { key: "commission", label: "Maior comissão", icon: <Percent className="w-3.5 h-3.5" /> },
    { key: "flash", label: "Oferta Relâmpago", icon: <Zap className="w-3.5 h-3.5" />, badge: flashCount },
    { key: "category", label: "Por Categoria", icon: <Tag className="w-3.5 h-3.5" />, badge: categoriesCount },
  ];

  // Mobile: índice atual + handlers de prev/next pra navegar com setas.
  const currentIdx = tabs.findIndex((t) => t.key === tab);
  const prevTab = currentIdx > 0 ? tabs[currentIdx - 1] : null;
  const nextTab = currentIdx < tabs.length - 1 ? tabs[currentIdx + 1] : null;
  const activeTab = tabs[currentIdx] ?? tabs[0];

  return (
    <>
      {/* Desktop: lista horizontal completa (>= sm) */}
      <div className="hidden sm:flex gap-1.5 flex-wrap pb-1 -mx-1 px-1">
        {tabs.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-all ${
                active
                  ? "border-[#ee4d2d] bg-[#ee4d2d] text-white shadow-[0_0_12px_rgba(238,77,45,0.3)]"
                  : "border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              }`}
            >
              {t.icon}
              {t.label}
              {t.badge != null && t.badge > 0 ? (
                <span
                  className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-[#3e3e46] light:bg-zinc-200 text-[#c8c8ce] light:text-zinc-700"
                  }`}
                >
                  {t.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Mobile: aba ativa central + setas < > (visual igual ao "Filtrar" /
          "Atualizar" — neutro). Aba ativa só ganha um destaque sutil de borda
          laranja pra sinalizar seleção sem ficar berrante. */}
      <div className="flex sm:hidden items-center gap-2">
        <button
          type="button"
          onClick={() => prevTab && onChange(prevTab.key)}
          disabled={!prevTab}
          aria-label="Aba anterior"
          className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#ee4d2d]/60 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 text-[11px] font-semibold">
          <span className="text-[#ee4d2d]">{activeTab.icon}</span>
          {activeTab.label}
          {activeTab.badge != null && activeTab.badge > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold bg-[#3e3e46] light:bg-zinc-200 text-[#c8c8ce] light:text-zinc-700">
              {activeTab.badge}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => nextTab && onChange(nextTab.key)}
          disabled={!nextTab}
          aria-label="Próxima aba"
          className="inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}

function CategoryPicker({
  categories,
  active,
  onChange,
  hotThreshold,
}: {
  categories: Array<{ categoryId: number; name: string; count: number }>;
  active: number | null;
  onChange: (id: number) => void;
  hotThreshold: number;
}) {
  if (categories.length === 0) {
    return (
      <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500 px-2">
        Aguardando próxima varredura pra mapear categorias.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {categories.map((c) => {
        const isActive = active === c.categoryId;
        const isHot = c.count >= hotThreshold;
        return (
          <button
            key={c.categoryId}
            type="button"
            onClick={() => onChange(c.categoryId)}
            className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-semibold transition-colors ${
              isActive
                ? "border-[#7cd0f7] bg-[#7cd0f7]/10 text-[#7cd0f7] light:text-cyan-700 light:bg-cyan-50 light:border-cyan-400"
                : "border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
            } ${isHot && !isActive ? "animate-hot-pulse" : ""}`}
          >
            {isHot ? <Flame className="w-2.5 h-2.5 text-[#ee4d2d]" /> : null}
            {c.name}
            <span className="text-[9px] opacity-70">({c.count})</span>
          </button>
        );
      })}
    </div>
  );
}

function ShopsList({
  shops,
  onSelect,
}: {
  shops: ShopAgg[];
  onSelect: (shopName: string) => void;
}) {
  if (shops.length === 0) {
    return (
      <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white p-8 text-center">
        <p className="text-[12px] text-[#9a9aa2] light:text-zinc-500">
          Nenhuma loja agregada ainda. Aguarde a próxima varredura.
        </p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {shops.map((s, idx) => (
        <button
          key={s.shopName}
          type="button"
          onClick={() => onSelect(s.shopName)}
          className="group text-left rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white p-4 hover:border-[#7cd0f7] hover:bg-[#7cd0f7]/5 light:hover:bg-cyan-50 transition-all"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              <ShopAvatar imageUrl={s.imageUrl} shopName={s.shopName} size={36} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-text-primary light:text-zinc-900 truncate" title={s.shopName}>
                  {s.shopName}
                </p>
                <p className="text-[9px] text-[#7a7a80] light:text-zinc-500 font-mono">#{idx + 1}</p>
              </div>
            </div>
            {s.viralCount > 0 ? (
              <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#ee4d2d] text-[9px] font-bold text-white">
                <Flame className="w-2.5 h-2.5" />
                {s.viralCount} viral{s.viralCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3 text-[10px]">
            <div>
              <p className="text-[8px] text-[#9a9aa2] light:text-zinc-500 uppercase tracking-wider">Produtos</p>
              <p className="text-text-primary light:text-zinc-900 font-bold tabular-nums">{s.productCount}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#9a9aa2] light:text-zinc-500 uppercase tracking-wider">Vendas</p>
              <p className="text-emerald-400 light:text-emerald-700 font-bold tabular-nums">{formatInt(s.totalSales)}</p>
            </div>
            <div>
              <p className="text-[8px] text-[#9a9aa2] light:text-zinc-500 uppercase tracking-wider">Score</p>
              <p className="text-[#7cd0f7] light:text-cyan-700 font-bold tabular-nums">{s.avgScore}</p>
            </div>
          </div>
          {s.avgCommission != null ? (
            <p className="mt-2 text-[9px] text-[#9a9aa2] light:text-zinc-500">
              Comissão média: <span className="text-amber-400 light:text-amber-700 font-semibold">{s.avgCommission.toFixed(1)}%</span>
            </p>
          ) : null}
          <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-[#7cd0f7] light:text-cyan-700 group-hover:translate-x-0.5 transition-transform">
            Ver produtos da loja <ExternalLink className="w-3 h-3" />
          </div>
        </button>
      ))}
    </div>
  );
}

function ShopDrawer({
  open,
  shopName,
  shopImageUrl,
  products,
  loading,
  onClose,
  onConvert,
  onAddToList,
  onClickDetails,
}: {
  open: boolean;
  shopName: string | null;
  shopImageUrl: string | null;
  products: TrendProduct[];
  loading: boolean;
  onClose: () => void;
  onConvert: (p: TrendProduct) => void;
  onAddToList: (p: TrendProduct) => void;
  onClickDetails: (p: TrendProduct) => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex justify-end"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="w-full max-w-3xl h-full bg-[#18181b] light:bg-zinc-50 border-l border-[#2c2c32] light:border-zinc-200 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white flex items-center gap-3">
              <ShopAvatar imageUrl={shopImageUrl} shopName={shopName} size={40} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[14px] font-bold text-text-primary light:text-zinc-900 truncate">
                  {shopName ?? "—"}
                </h2>
                <p className="text-[10px] text-[#7a7a80] light:text-zinc-500">
                  {products.length} produto{products.length === 1 ? "" : "s"} no top
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[#7cd0f7]" />
                </div>
              ) : products.length === 0 ? (
                <p className="text-[12px] text-center text-[#9a9aa2] light:text-zinc-500 py-12">
                  Sem produtos dessa loja no snapshot atual.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {products.map((p) => (
                    <ProductCard
                      key={p.itemId}
                      product={p}
                      onConvert={onConvert}
                      onAddToList={onAddToList}
                      onClickDetails={() => onClickDetails(p)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function ProductDetailModal({
  product,
  onClose,
  onConvert,
}: {
  product: TrendProduct | null;
  onClose: () => void;
  onConvert: (p: TrendProduct) => void;
}) {

  const sparklineData = useMemo(() => {
    if (!product) return null;
    const raw = product.sparkline ?? [];
    const points = raw.length > 1 ? raw : [product.score, product.score];
    return {
      labels: points.map((_, i) => i),
      datasets: [
        {
          data: points,
          borderColor: product.isViral ? "#ee4d2d" : "#7cd0f7",
          backgroundColor: product.isViral ? "rgba(238,77,45,0.20)" : "rgba(124,208,247,0.20)",
          borderWidth: 2,
          tension: 0.4,
          pointRadius: 0,
          fill: true,
        },
      ],
    };
  }, [product]);

  const sparklineOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
      scales: {
        x: { display: false, grid: { display: false }, ticks: { display: false } },
        y: { display: false, grid: { display: false }, ticks: { display: false } },
      },
      animation: { duration: 250 },
      elements: { point: { radius: 0 } },
    }),
    [],
  );

  return (
    <AnimatePresence>
      {product ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-2xl rounded-2xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#7cd0f7] light:text-cyan-600" />
              <h2 className="text-[13px] font-bold text-text-primary light:text-zinc-900">
                Detalhes do produto
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="ml-auto p-1 rounded-md text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                {product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={product.imageUrl}
                    alt={product.productName}
                    className="w-32 h-32 rounded-lg object-cover bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 shrink-0"
                  />
                ) : null}
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-text-primary light:text-zinc-900 leading-snug">
                    {product.productName}
                  </p>
                  {product.shopName ? (
                    <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500 mt-1">
                      <Store className="w-3 h-3 inline mr-1" />
                      {product.shopName}
                    </p>
                  ) : null}
                  <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                    {product.priceMin != null && product.priceMax != null && product.priceMin !== product.priceMax ? (
                      <span className="text-[14px] font-bold text-emerald-400 light:text-emerald-700 tabular-nums">
                        {formatBRL(product.priceMin)} – {formatBRL(product.priceMax)}
                      </span>
                    ) : (
                      <span className="text-[14px] font-bold text-emerald-400 light:text-emerald-700 tabular-nums">
                        {formatBRL(product.price ?? product.priceMin)}
                      </span>
                    )}
                    {product.discountRate >= 0.3 ? (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-amber-950 text-[9px] font-bold">
                        <Zap className="w-2.5 h-2.5" />
                        -{Math.round(product.discountRate * 100)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <DetailStat label="Score" value={product.score} suffix="/100" highlight={product.isViral} />
                <DetailStat label="Vendas" value={product.sales} />
                <DetailStat
                  label="Comissão"
                  textValue={product.commissionRate != null ? `${(product.commissionRate * 100).toFixed(1)}%` : "—"}
                />
                <DetailStat
                  label="Rating"
                  textValue={product.ratingStar != null ? `${product.ratingStar.toFixed(1)}★` : "—"}
                />
              </div>

              {/* Sparkline grande */}
              {sparklineData ? (
                <div className="rounded-lg border border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50 p-3">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-[#9a9aa2] light:text-zinc-500 mb-2">
                    Score nas últimas 24h
                  </p>
                  <div className="w-full h-28">
                    <Line data={sparklineData} options={sparklineOptions as never} />
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    onConvert(product);
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[11px] font-semibold text-[#ee4d2d] hover:bg-[#ee4d2d]/20"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Converter link afiliado
                </button>
                {product.productLink ? (
                  <a
                    href={product.productLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[11px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir na Shopee
                  </a>
                ) : null}
              </div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function DetailStat({
  label,
  value,
  textValue,
  suffix,
  highlight,
}: {
  label: string;
  value?: number;
  textValue?: string;
  suffix?: string;
  highlight?: boolean;
}) {
  const display = textValue ?? formatInt(value ?? 0);
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        highlight
          ? "border-[#ee4d2d]/40 bg-[#ee4d2d]/10"
          : "border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50"
      }`}
    >
      <p className="text-[8px] uppercase tracking-wider font-bold text-[#9a9aa2] light:text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-[14px] font-bold tabular-nums leading-none ${highlight ? "text-[#ee4d2d]" : "text-text-primary light:text-zinc-900"}`}>
        {display}
        {suffix ? <span className="text-[9px] text-[#9a9aa2] light:text-zinc-500 ml-0.5">{suffix}</span> : null}
      </p>
    </div>
  );
}

function ProductCard({
  product,
  onConvert,
  onAddToList,
  onClickDetails,
}: {
  product: TrendProduct;
  onConvert: (p: TrendProduct) => void;
  onAddToList: (p: TrendProduct) => void;
  onClickDetails: () => void;
}) {
  const sparklineData = useMemo(() => {
    const raw = product.sparkline ?? [];
    const points = raw.length > 1 ? raw : [product.score, product.score];
    return {
      labels: points.map((_, i) => i),
      datasets: [
        {
          data: points,
          borderColor: product.isViral ? "#ee4d2d" : "#7cd0f7",
          backgroundColor: product.isViral ? "rgba(238,77,45,0.16)" : "rgba(124,208,247,0.16)",
          borderWidth: 1.6,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: true,
        },
      ],
    };
  }, [product.sparkline, product.score, product.isViral]);

  const sparklineOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
        datalabels: { display: false },
      },
      scales: {
        x: { display: false, grid: { display: false }, ticks: { display: false } },
        y: { display: false, grid: { display: false }, ticks: { display: false } },
      },
      animation: { duration: 250 },
      elements: { point: { radius: 0 } },
    }),
    [],
  );

  const priceLabel = (() => {
    if (product.priceMin != null && product.priceMax != null && product.priceMin !== product.priceMax) {
      return `${formatBRL(product.priceMin)} – ${formatBRL(product.priceMax)}`;
    }
    return formatBRL(product.price ?? product.priceMin);
  })();

  return (
    <div
      className={`relative rounded-xl border p-3 transition-all hover:translate-y-[-1px] flex flex-col ${
        product.isViral
          ? "border-[#ee4d2d]/40 bg-gradient-to-br from-[#1c1c1f] via-[#211517] to-[#1c1c1f] light:from-orange-50 light:via-white light:to-orange-50 light:border-orange-300 shadow-[0_0_24px_rgba(238,77,45,0.08)]"
          : "border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        {product.isViral ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#ee4d2d] text-[9px] font-bold uppercase tracking-wider text-white">
            <Flame className="w-2.5 h-2.5" />
            Viral
          </span>
        ) : (
          <span className="text-[9px] text-[#7a7a80] light:text-zinc-400 font-mono">
            #{product.rankPosition ?? "—"}
          </span>
        )}
        <ScoreBadge score={product.score} />
      </div>

      <button
        type="button"
        onClick={onClickDetails}
        className="flex flex-col gap-2 flex-1 text-left group"
      >
        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-[#222228] light:bg-zinc-100 border border-[#2c2c32] light:border-zinc-200 group-hover:border-[#7cd0f7]/40 transition-colors">
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.productName}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
          ) : null}
          {product.discountRate >= 0.3 ? (
            <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-500 text-amber-950 text-[9px] font-bold">
              <Zap className="w-2.5 h-2.5" />
              -{Math.round(product.discountRate * 100)}%
            </span>
          ) : null}
        </div>

        <p className="text-[11px] font-semibold text-text-primary light:text-zinc-900 line-clamp-2 leading-snug group-hover:text-[#ee4d2d] transition-colors">
          {product.productName}
        </p>

        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[9px] text-[#9a9aa2] light:text-zinc-500">
          {product.shopName ? (
            <span className="truncate max-w-[120px]" title={product.shopName}>{product.shopName}</span>
          ) : null}
          {product.ratingStar != null ? (
            <span className="inline-flex items-center gap-0.5">
              <Star className="w-2 h-2 text-amber-400 fill-amber-400" />
              {product.ratingStar.toFixed(1)}
            </span>
          ) : null}
          <span>· {formatInt(product.sales)}</span>
        </div>

        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[12px] font-bold text-emerald-400 light:text-emerald-700 tabular-nums">{priceLabel}</span>
          {product.commissionRate != null ? (
            <span className="text-[9px] text-[#7cd0f7] light:text-cyan-700 font-semibold">
              {(product.commissionRate * 100).toFixed(1)}% comissão
            </span>
          ) : null}
        </div>

        <div className="w-full h-8 mt-auto">
          <Line data={sparklineData} options={sparklineOptions as never} />
        </div>
      </button>

      <div className="mt-2 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onConvert(product); }}
          className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-[#ee4d2d]/40 bg-[#ee4d2d]/10 text-[10px] font-semibold text-[#ee4d2d] hover:bg-[#ee4d2d]/20"
        >
          <Copy className="w-3 h-3" />
          Converter link
        </button>
        <div className="flex gap-1.5">
          {product.productLink ? (
            <a
              href={product.productLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[10px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
              title="Ver na Shopee"
            >
              <ExternalLink className="w-3 h-3" />
              Shopee
            </a>
          ) : null}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddToList(product); }}
            className="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] light:border-zinc-300 bg-[#222228] light:bg-white text-[10px] text-[#c8c8ce] light:text-zinc-700 hover:bg-[#2f2f34] light:hover:bg-zinc-100"
            title="Adicionar à lista"
          >
            <ListPlus className="w-3 h-3" />
            Lista
          </button>
        </div>
      </div>
    </div>
  );
}

/** Adapta TrendProduct → ProductSummary (subset usado pelos modais). */
function toProductSummary(p: TrendProduct): ProductSummary {
  return {
    itemId: p.itemId,
    productName: p.productName,
    imageUrl: p.imageUrl,
    price: p.price,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
  };
}

/** Grid com paginação responsiva (4 desktop / 2 mobile). */
function ProductGrid({
  products,
  pageSize,
  page,
  onPageChange,
  onConvert,
  onAddToList,
  onClickDetails,
}: {
  products: TrendProduct[];
  pageSize: number;
  page: number;
  onPageChange: (p: number) => void;
  onConvert: (p: TrendProduct) => void;
  onAddToList: (p: TrendProduct) => void;
  onClickDetails: (p: TrendProduct) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const visible = products.slice(start, start + pageSize);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {visible.map((p) => (
          <ProductCard
            key={p.itemId}
            product={p}
            onConvert={onConvert}
            onAddToList={onAddToList}
            onClickDetails={() => onClickDetails(p)}
          />
        ))}
      </div>
      {totalPages > 1 ? (
        <GeradorPaginationBar
          page={safePage}
          totalPages={totalPages}
          onPrev={() => onPageChange(Math.max(1, safePage - 1))}
          onNext={() => onPageChange(Math.min(totalPages, safePage + 1))}
          summary={`Mostrando ${visible.length} de ${products.length}`}
        />
      ) : null}
    </div>
  );
}

const DEFAULT_SHOP_AVATAR_SRC = "/tendencias/ShoIA.png";

function ShopAvatar({
  imageUrl,
  shopName,
  size = 36,
}: {
  imageUrl: string | null | undefined;
  shopName: string | null | undefined;
  size?: number;
}) {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const px = `${size}px`;
  const trimmed = imageUrl?.trim() ?? "";
  const useRemote = Boolean(trimmed) && !remoteFailed;
  const src = useRemote ? trimmed : DEFAULT_SHOP_AVATAR_SRC;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={shopName ?? "Loja"}
      className={`rounded-lg shrink-0 border border-[#2c2c32] light:border-zinc-200 ${
        useRemote
          ? "object-cover bg-[#222228] light:bg-zinc-100"
          : "object-contain bg-[#f8f8f8]/5 light:bg-zinc-100 p-0.5"
      }`}
      style={{ width: px, height: px }}
      loading="lazy"
      onError={() => {
        if (useRemote) setRemoteFailed(true);
      }}
    />
  );
}

/** CTA grande na aba Sho.IA: abre o wizard "Montar Lista com IA".
 *  Mascote em absolute sobressaindo no topo (parece que está "saindo" do
 *  botão), light-sweep contínuo, gradient laranja. */
function MontarListaCTA({ onClick }: { onClick: () => void }) {
  return (
    // Wrapper relative permite a imagem sobressair além dos limites do botão.
    // Padding-top extra acomoda a parte da imagem que fica acima.
    <div className="relative pt-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/tendencias/listaShoo.png"
        alt="Sho.IA"
        aria-hidden
        className="pointer-events-none absolute -top-2 left-3 sm:left-5 w-20 h-20 sm:w-24 sm:h-24 z-10 drop-shadow-[0_6px_18px_rgba(0,0,0,0.4)] transition-transform hover:scale-110"
      />
      <button
        type="button"
        onClick={onClick}
        className="group light-sweep relative w-full flex items-center gap-4 overflow-hidden rounded-2xl border border-[#ee4d2d] bg-gradient-to-r from-[#ee4d2d] via-[#ff6b3d] to-[#ee4d2d] pl-24 sm:pl-32 pr-5 py-4 sm:py-5 text-left shadow-[0_0_20px_rgba(238,77,45,0.25)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_0_28px_rgba(238,77,45,0.4)]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/85">
            Recurso Sho.IA
          </p>
          <h2 className="text-base sm:text-lg font-black text-white leading-tight flex items-center gap-1.5">
            MONTAR LISTA COM IA
            {/* Trigger laranja escuro com ícone branco — fica visível no fundo
                laranja claro do botão, mantendo o tema. */}
            <span
              onClick={(e) => e.stopPropagation()}
              className="[&_.toolist-trigger]:bg-[#d8431c] [&_.toolist-trigger]:border [&_.toolist-trigger]:border-white/50"
            >
              <Toolist
                variant="below"
                wide
                text="Escolha uma categoria → Sho.IA seleciona até 50 produtos campeões → você ganha uma lista pronta com seus links afiliados."
                iconClassName="text-white"
              />
            </span>
          </h2>
        </div>
        <div className="hidden sm:inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/15 text-white shrink-0 group-hover:translate-x-1 transition-transform">
          <ArrowLeft className="w-4 h-4 rotate-180" />
        </div>
      </button>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "from-[#ee4d2d] to-[#ff7a55] shadow-[0_0_8px_rgba(238,77,45,0.4)]"
      : score >= 50
        ? "from-[#0ea5e9] to-[#7cd0f7]"
        : "from-zinc-500 to-zinc-400";
  return (
    <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br ${tone}`}>
      <div className="text-center leading-none">
        <p className="text-[12px] font-black text-white tabular-nums">{score}</p>
        <p className="text-[7px] text-white/80 uppercase tracking-wider mt-0.5">Score</p>
      </div>
    </div>
  );
}
