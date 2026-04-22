"use client";

import {
  useState, useEffect, useCallback, useRef, Fragment,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  Link as LinkIcon, Search, TrendingUp, MousePointer2,
  Copy, ExternalLink, Trash2, ChevronRight,
  CheckCircle2, X, Hash, Zap, ListPlus,
  Plus, Info, Loader2, AlertCircle, ImageIcon, Check,
} from "lucide-react";
import Link from "next/link";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import { extractShopeeItemIdFromInput, isShopeeShortLinkInput } from "@/lib/shopee-extract-item-id";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ProductOffer = {
  itemId: number; productName: string; productLink: string; offerLink: string;
  imageUrl: string; priceMin: number; priceMax: number; priceDiscountRate: number;
  sales: number; ratingStar: number; commissionRate: number; commission: number; shopName: string;
};
type HistoryEntry = {
  id: string; shortLink: string; originUrl: string; subId1: string; subId2: string;
  subId3: string; observation: string; productName: string; slug: string; imageUrl: string;
  commissionRate: number; commissionValue: number; priceShopee: number | null;
  priceShopeeOriginal: number | null; priceShopeeDiscountRate: number | null; createdAt: string;
};
type MobileTab = "config" | "produto" | "historico";

const MOBILE_SECTION_STEPS: { id: MobileTab; label: string }[] = [
  { id: "config", label: "Configurar" },
  { id: "produto", label: "Produto" },
  { id: "historico", label: "Histórico" },
];

// ─── Utils ──────────────────────────────────────────────────────────────────────
function cn(...c: (string | false | undefined | null)[]) { return c.filter(Boolean).join(" "); }

function extractItemIdFromUrl(url: string): number | null {
  return extractShopeeItemIdFromInput(url);
}
function extractSlugFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\/+/, "").trim();
    const withoutQuery = path.split("?")[0];
    const parts = withoutQuery.split(/[.-]i\.\d+\.\d+/);
    return (parts[0] || path || "").replace(/^-+|-+$/g, "");
  } catch { return ""; }
}
function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}
function fmtDisc(r: number) { return `${(r * 100).toFixed(0)}% OFF`; }

const MSG_SUPORTE_GERADOR_SHOPEE = "Entre em contato com o suporte!";

/** Falhas da API (ex.: erro 10000 da Shopee) → texto fixo; mantém mensagens que o usuário pode resolver. */
function mensagemErroGeradorShopeeParaUsuario(apiMessage: string): string {
  const m = apiMessage.trim();
  if (!m) return MSG_SUPORTE_GERADOR_SHOPEE;
  if (m.includes("Chaves da Shopee não configuradas")) return m;
  if (m.toLowerCase().includes("shopee") && m.toLowerCase().includes("não configuradas")) return m;
  if (m === "Unauthorized" || m === "Não autorizado") return m;
  if (m.includes("originUrl é obrigatório")) return m;
  if (m.includes("Informe keyword, itemId ou categoryId")) return m;
  return MSG_SUPORTE_GERADOR_SHOPEE;
}

// ─── InfoTooltip (portal) ───────────────────────────────────────────────────────
function InfoTooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const iconRef = useRef<HTMLSpanElement>(null);
  function handleMouseEnter() {
    if (!iconRef.current) return;
    const r = iconRef.current.getBoundingClientRect();
    setPos({ top: r.top, left: r.left + r.width / 2 });
    setVisible(true);
  }
  return (
    <>
      <span ref={iconRef} onMouseEnter={handleMouseEnter} onMouseLeave={() => setVisible(false)} className="inline-flex items-center ml-0.5 cursor-help shrink-0">
        <Info className="w-3 h-3 text-[#686868] hover:text-[#b0b0b0] transition" />
      </span>
      {visible && createPortal(
        <span style={{ position: "fixed", top: pos.top - 8, left: pos.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
          className="pointer-events-none w-max max-w-[200px] bg-[#232328] border border-[#3e3e3e] text-[11px] text-[#d8d8d8] font-normal normal-case tracking-normal px-3 py-2 rounded-xl shadow-2xl whitespace-normal leading-relaxed text-center">
          {text}
        </span>, document.body
      )}
    </>
  );
}

// ─── Helper UI ──────────────────────────────────────────────────────────────────
function StepBadge({ n, active }: { n: number; active?: boolean }) {
  return (
    <span className={cn("w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0 transition",
      active ? "bg-[#e24c30] text-white shadow-md shadow-[#e24c30]/30" : "bg-[#323232] text-[#a0a0a0]")}>
      {n}
    </span>
  );
}
function ColHeader({ step, active, label, icon, right, tooltip }: {
  step?: number; active?: boolean; label: string; icon?: ReactNode; right?: ReactNode; tooltip?: string;
}) {
  return (
    <div className="h-11 flex items-center justify-between gap-2 px-4 border-b border-[#2c2c32] bg-[#27272a] min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        {step != null && <StepBadge n={step} active={active} />}
        {icon}
        <span className="text-xs font-bold text-[#f0f0f2] truncate">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
function FieldGroup({ label, icon, children, tooltip }: { label: string; icon?: ReactNode; children: ReactNode; tooltip?: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest flex items-center gap-1">
        {icon}{label}{tooltip && <InfoTooltip text={tooltip} />}
      </label>
      {children}
    </div>
  );
}
function IconBtn({ children, onClick, title, danger, active }: {
  children: ReactNode; onClick: () => void; title?: string; danger?: boolean; active?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} title={title}
      className={cn("w-6 h-6 rounded-md bg-[#222228] border flex items-center justify-center transition shrink-0",
        active ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-400/40"
          : danger ? "text-[#a0a0a0] border-[#2c2c32] hover:text-red-400 hover:border-red-400/25"
            : "text-[#a0a0a0] border-[#2c2c32] hover:text-[#f0f0f2] hover:border-[#4c4c52]")}>
      {children}
    </button>
  );
}

// ─── MostSoldCard ───────────────────────────────────────────────────────────────
function MostSoldCard({ product, onClick, compact = false, selected = false }: {
  product: ProductOffer; onClick: () => void; compact?: boolean; selected?: boolean;
}) {
  return (
    <button onClick={onClick}
      className={cn("w-full rounded-xl transition text-left group flex flex-wrap items-start gap-x-3 gap-y-2 min-[420px]:flex-nowrap min-[420px]:items-center",
        compact ? "px-2.5 py-2.5" : "px-3 py-3",
        selected ? "border border-[#e24c30] bg-[#3B2B2B]" : "bg-[#1c1c1f] border border-[#2c2c32] hover:border-[#e24c30]/30 hover:bg-[#232328]")}>
      <div className={cn("rounded-lg shrink-0 border border-[#2c2c32] overflow-hidden bg-[#232328]",
        compact ? "w-10 h-10 min-[360px]:w-11 min-[360px]:h-11" : "w-12 h-12 min-[360px]:w-14 min-[360px]:h-14")}>
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.productName} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-[#686868]" /></div>}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn("font-semibold text-[#f0f0f2] leading-[1.35] pr-1",
          compact ? "text-[12px] line-clamp-2 min-[420px]:line-clamp-1" : "text-[13px] min-[360px]:text-xs line-clamp-2 min-[420px]:line-clamp-1")}>
          {product.productName}
        </p>
        <div className="flex items-center gap-x-2 gap-y-1.5 mt-2 flex-wrap">
          <span className={cn("font-bold text-[#e24c30]", compact ? "text-[10px]" : "text-[11px] min-[360px]:text-xs")}>
            {formatCurrency(product.priceMin)}
          </span>
          {product.priceDiscountRate > 0 && (
            <span className={cn("font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-px rounded-md border border-emerald-500/15 whitespace-nowrap",
              compact ? "text-[9px]" : "text-[10px]")}>
              {fmtDisc(product.priceDiscountRate)}
            </span>
          )}
          <span className={cn("text-[#d8d8d8] whitespace-nowrap", compact ? "text-[9px]" : "text-[10px]")}>
            {product.sales.toLocaleString("pt-BR")} vendidos
          </span>
        </div>
      </div>
      <div className={cn("flex items-start justify-between gap-3 shrink-0 min-[420px]:items-center min-[420px]:justify-start",
        compact
          ? "w-full pl-[52px] pt-2 mt-1 border-t border-[#2c2c32] min-[420px]:w-auto min-[420px]:pl-0 min-[420px]:pt-0 min-[420px]:mt-0 min-[420px]:border-t-0"
          : "w-full pl-[60px] min-[360px]:pl-[68px] pt-2 mt-1 border-t border-[#2c2c32] min-[420px]:w-auto min-[420px]:pl-0 min-[420px]:pt-0 min-[420px]:mt-0 min-[420px]:border-t-0")}>
        <div className="text-left min-[420px]:text-right">
          <p className={cn("font-bold text-emerald-400 leading-none", compact ? "text-[13px]" : "text-[15px] min-[360px]:text-sm")}>
            {formatCurrency(product.commission)}
          </p>
          <p className={cn("text-[#bebebe] mt-2", compact ? "text-[9px]" : "text-[10px]")}>
            {((product.commissionRate ?? 0) * 100).toFixed(1)}% comissão
          </p>
        </div>
        <ExternalLink className={cn("text-[#e24c30] shrink-0 opacity-100 min-[420px]:opacity-50 min-[420px]:group-hover:opacity-100 transition-opacity mt-0.5 min-[420px]:mt-0",
          compact ? "w-3 h-3" : "w-3.5 h-3.5")} />
      </div>
    </button>
  );
}

// ─── HistoryActions ─────────────────────────────────────────────────────────────
function HistoryActions({ inList, copiedId, onCopy, onOpen, onAddToList, onDelete }: {
  inList: boolean; copiedId: boolean; onCopy: () => void; onOpen: () => void; onAddToList: () => void; onDelete: () => void;
}) {
  return (
    <>
      <IconBtn onClick={onCopy} title={copiedId ? "Copiado!" : "Copiar"} active={copiedId}>
        {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </IconBtn>
      <IconBtn onClick={onOpen} title="Abrir"><ExternalLink className="w-3.5 h-3.5" /></IconBtn>
      <IconBtn onClick={onAddToList} title={inList ? "Adicionado à lista" : "Adicionar à lista"} active={inList}>
        <ListPlus className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn onClick={onDelete} title="Excluir" danger><Trash2 className="w-3.5 h-3.5" /></IconBtn>
    </>
  );
}

// ─── ListModal ──────────────────────────────────────────────────────────────────
function ListModal({ open, onClose, lists, newListName, setNewListName, activeListId, setActiveListId,
  onCreate, onConfirm, canConfirm, pendingCount, loading }: {
    open: boolean; onClose: () => void;
    lists: { id: string; nome: string; totalItens: number }[];
    newListName: string; setNewListName: Dispatch<SetStateAction<string>>;
    activeListId: string | null; setActiveListId: Dispatch<SetStateAction<string | null>>;
    onCreate: () => void; onConfirm: () => void; canConfirm: boolean; pendingCount: number; loading?: boolean;
  }) {
  if (!open) return null;
  const hasTypedName = newListName.trim().length > 0;
  const selectedList = lists.find((l) => l.id === activeListId);
  return (
    <div className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-[2px] p-3 sm:p-4 flex items-center justify-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] max-h-[calc(100vh-24px)] sm:max-h-none rounded-[22px] border border-[#2c2c32] bg-[#1b1b1f] shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-5 pt-4 pb-3 border-b border-[#2c2c32] bg-[#18181b]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-[#e24c30]/12 border border-[#e24c30]/20 flex items-center justify-center shrink-0">
                <ListPlus className="w-4 h-4 text-[#e24c30]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-[15px] sm:text-[16px] font-bold text-[#f0f0f2] truncate">Adicionar à lista</h3>
                <p className="text-[11px] text-[#9c9ca5] mt-0.5">{pendingCount} {pendingCount === 1 ? "link selecionado" : "links selecionados"}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-[#bdbdc3] hover:text-white hover:bg-white/5 transition shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="px-4 sm:px-5 py-4 flex flex-col gap-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-bold text-[#d8d8d8] uppercase tracking-widest">Criar nova lista</label>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input value={newListName} onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && hasTypedName) onCreate(); }}
                placeholder="Ex: achados do dia"
                className="flex-1 bg-[#222228] border border-[#2c2c32] rounded-xl px-3.5 py-2.5 text-[12px] text-[#f0f0f2] placeholder:text-[#7d7d86] focus:border-[#e24c30]/60 outline-none transition" />
              <button onClick={onCreate} disabled={!hasTypedName}
                className={cn("h-[42px] w-full sm:w-auto px-4 rounded-xl text-[12px] font-semibold transition flex items-center justify-center gap-2 shrink-0",
                  hasTypedName ? "bg-[#232328] border border-[#3a3a42] text-[#f0f0f2] hover:border-[#e24c30]/45 hover:text-white"
                    : "bg-[#202025] border border-[#2a2a30] text-[#6f6f78] cursor-not-allowed")}>
                <Plus className="w-4 h-4" /> Criar
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[10px] font-bold text-[#d8d8d8] uppercase tracking-widest">Escolher lista</label>
              <span className="text-[10px] text-[#8e8e96]">{lists.length} {lists.length === 1 ? "lista" : "listas"}</span>
            </div>
            {lists.length > 0 ? (
              <div className="rounded-2xl border border-[#2c2c32] bg-[#222228] p-2 max-h-[220px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
                {lists.map((list) => {
                  const sel = activeListId === list.id;
                  return (
                    <button key={list.id} onClick={() => setActiveListId(list.id)}
                      className={cn("w-full rounded-xl px-3.5 py-3 flex items-start sm:items-center justify-between gap-3 text-left transition mb-2 last:mb-0 border flex-wrap sm:flex-nowrap",
                        sel ? "bg-[#2a1d1a] border-[#e24c30]/35" : "bg-[#202025] border-[#2c2c32] hover:bg-[#25252b] hover:border-[#3a3a42]")}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition",
                          sel ? "border-[#e24c30] bg-[#e24c30]" : "border-[#5a5a63]")}>
                          {sel && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <div className="min-w-0">
                          <p className={cn("text-[13px] font-semibold truncate", sel ? "text-[#ff7a5b]" : "text-[#f0f0f2]")}>{list.nome}</p>
                          <p className="text-[10px] text-[#9d9da5] mt-0.5">{list.totalItens} {list.totalItens === 1 ? "item" : "itens"}</p>
                        </div>
                      </div>
                      {sel && <span className="text-[10px] font-semibold text-[#ffd2c8] bg-[#e24c30]/10 border border-[#e24c30]/15 px-2 py-1 rounded-full shrink-0">Ativa</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-[#2c2c32] bg-[#222228] px-4 py-8 text-center">
                <p className="text-[13px] font-medium text-[#e1e1e5]">Nenhuma lista criada</p>
                <p className="text-[11px] text-[#96969f] mt-1">Crie uma lista acima para continuar.</p>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] text-[#9a9aa2] truncate">{selectedList ? `Destino: ${selectedList.nome}` : "Selecione uma lista"}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:items-center shrink-0">
              <button onClick={onClose} className="h-[40px] px-3.5 rounded-xl border border-[#34343b] text-[12px] font-semibold text-[#d7d7dc] hover:text-white hover:border-[#4a4a52] transition">
                Cancelar
              </button>
              <button onClick={onConfirm} disabled={!canConfirm || loading}
                className={cn("h-[40px] px-4 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-2 transition",
                  canConfirm && !loading ? "bg-[#e24c30] text-white hover:bg-[#c94028] shadow-md shadow-[#e24c30]/20"
                    : "bg-[#8f442f] text-white/70 cursor-not-allowed")}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ListPlus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function GeradorLinksShopeePage() {
  const [inputValue, setInputValue] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [lastGeneratedLink, setLastGeneratedLink] = useState("");
  const [convertLoading, setConvertLoading] = useState(false);
  const [products, setProducts] = useState<ProductOffer[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOffer | null>(null);
  const [goldenProducts, setGoldenProducts] = useState<ProductOffer[]>([]);
  const [bestSellers, setBestSellers] = useState<ProductOffer[]>([]);
  const [loadingBestSellers, setLoadingBestSellers] = useState(false);
  const [bestSellerKeyword, setBestSellerKeyword] = useState("");
  const [lastBestSellerKeyword, setLastBestSellerKeyword] = useState("");
  const [bestSellerPage, setBestSellerPage] = useState(1);
  const BEST_SELLERS_PER_PAGE = 6;
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [addToListFeedback, setAddToListFeedback] = useState<string | null>(null);
  const [linksInOfferList, setLinksInOfferList] = useState<Set<string>>(new Set());
  const [addToListModal, setAddToListModal] = useState<{ open: boolean; entries: HistoryEntry[] }>({ open: false, entries: [] });
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [copiedHistoryId, setCopiedHistoryId] = useState<string | null>(null);
  const [listasOfertas, setListasOfertas] = useState<{ id: string; nome: string; totalItens: number }[]>([]);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [selectedListaId, setSelectedListaId] = useState<string | null>(null);
  const [addToListLoading, setAddToListLoading] = useState(false);
  /** Carrega do servidor todos os itens selecionados (várias páginas do histórico) antes de abrir o modal. */
  const [historyBulkSelectionLoading, setHistoryBulkSelectionLoading] = useState(false);
  const [hasApiKeys, setHasApiKeys] = useState<boolean | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("config");
  /** Busca automática (debounce/blur) só a partir de lg — no mobile só via botão Buscar */
  const [isLgDesktop, setIsLgDesktop] = useState(false);

  const [searchResultsPage, setSearchResultsPage] = useState(1);
  const SEARCH_RESULTS_PER_PAGE = 4;
  const [goldenSimilarPage, setGoldenSimilarPage] = useState(1);
  const GOLDEN_SIMILAR_PER_PAGE = 4;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configCardRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLElement>(null);
  const selectingProductRef = useRef(false);
  const handleSearchRef = useRef<(term?: string) => Promise<void>>(() => Promise.resolve());

  // Prioridade: produto selecionado > resultados da busca por texto > mais vendidos > vazio
  const panelState = selectedProduct
    ? "selected"
    : products.length > 0
      ? "searchResults"
      : bestSellers.length > 0
        ? "mostSold"
        : "empty";
  const totalPages = Math.ceil(bestSellers.length / BEST_SELLERS_PER_PAGE);
  const searchTotalPages = Math.ceil(products.length / SEARCH_RESULTS_PER_PAGE);
  const pagedSearchResults = products.slice((searchResultsPage - 1) * SEARCH_RESULTS_PER_PAGE, searchResultsPage * SEARCH_RESULTS_PER_PAGE);
  const goldenSimilarTotalPages = Math.max(1, Math.ceil(goldenProducts.length / GOLDEN_SIMILAR_PER_PAGE));
  const pagedGoldenSimilar = goldenProducts.slice(
    (goldenSimilarPage - 1) * GOLDEN_SIMILAR_PER_PAGE,
    goldenSimilarPage * GOLDEN_SIMILAR_PER_PAGE
  );

  const checkApiKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/shopee");
      const data = await res.json();
      setHasApiKeys(!!data?.has_key && !!data?.shopee_app_id);
    } catch { setHasApiKeys(false); }
  }, []);
  useEffect(() => { checkApiKeys(); }, [checkApiKeys]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsLgDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!isLgDesktop) return;
    const trimmed = inputValue.trim();
    if (!trimmed || !hasApiKeys) return;
    if (isShopeeShortLinkInput(trimmed)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { debounceRef.current = null; handleSearchRef.current(trimmed); }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue, hasApiKeys, isLgDesktop]);

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
    } catch { setHistory([]); } finally { setHistoryLoading(false); }
  }, []);

  const [historySearchDebounced, setHistorySearchDebounced] = useState("");
  useEffect(() => { const t = setTimeout(() => setHistorySearchDebounced(historySearch), 300); return () => clearTimeout(t); }, [historySearch]);
  useEffect(() => { setHistoryPage(1); }, [historySearchDebounced]);
  useEffect(() => { loadHistory(historyPage, historySearchDebounced); }, [historyPage, historySearchDebounced, loadHistory]);

  useEffect(() => {
    setGoldenSimilarPage(1);
  }, [selectedProduct?.itemId, goldenProducts.length]);

  const loadLinksInOfferList = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas");
      const json = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(json?.data) ? json.data : [];
      setLinksInOfferList(new Set(list.map((o: { converterLink?: string }) => (o.converterLink ?? "").trim()).filter(Boolean)));
    } catch { /**/ }
  }, []);
  useEffect(() => { loadLinksInOfferList(); }, [loadLinksInOfferList]);

  const handleSearch = useCallback(async (term?: string) => {
    const trimmed = (term ?? inputValue).trim();
    if (!trimmed || !hasApiKeys) return;
    setError(null); setSearchLoading(true);
    setProducts([]); setSelectedProduct(null); setGoldenProducts([]); setBestSellers([]);
    try {
      let effective = trimmed;
      let itemId = extractItemIdFromUrl(effective);
      if (!Number.isFinite(itemId) && isShopeeShortLinkInput(effective)) {
        const resolveRes = await fetch(
          `/api/shopee/resolve-short-link?url=${encodeURIComponent(effective)}`,
        );
        const resolveData = await resolveRes.json().catch(() => ({}));
        if (!resolveRes.ok) {
          throw new Error(
            resolveData?.error ??
            "Não foi possível abrir o link curto da Shopee. Abra no navegador e cole o link do topo.",
          );
        }
        if (resolveData?.finalUrl) effective = String(resolveData.finalUrl);
        if (Number.isFinite(Number(resolveData?.itemId))) {
          itemId = Number(resolveData.itemId);
        } else {
          itemId = extractItemIdFromUrl(effective);
        }
      }
      if (Number.isFinite(itemId)) {
        const res = await fetch(`/api/shopee/product-search?itemId=${itemId}&limit=1`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produto");
        const list = (data?.products ?? []) as ProductOffer[];
        if (list.length > 0) {
          setSelectedProduct(list[0]);
          setMobileTab("produto");
          const name = list[0].productName?.split(/\s+/).slice(0, 4).join(" ") || "";
          if (name) {
            const similarRes = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=20`);
            const similarData = await similarRes.json();
            const similar = (similarData?.products ?? []) as ProductOffer[];
            const currentRate = list[0].commissionRate ?? 0;
            let sameNiche = similar.filter((p) => p.itemId !== list[0].itemId && (p.commissionRate ?? 0) >= currentRate).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
            if (sameNiche.length === 0) sameNiche = similar.filter((p) => p.itemId !== list[0].itemId).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0)).slice(0, 20);
            else sameNiche = sameNiche.slice(0, 20);
            setGoldenProducts(sameNiche);
          }
        }
      } else {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(trimmed)}&limit=20`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar produtos");
        setProducts((data?.products ?? []) as ProductOffer[]);
        setSelectedProduct(null); setGoldenProducts([]);
        setSearchResultsPage(1);
        setMobileTab("produto");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao buscar";
      setError(mensagemErroGeradorShopeeParaUsuario(msg));
    }
    finally { setSearchLoading(false); }
  }, [inputValue, hasApiKeys]);
  handleSearchRef.current = handleSearch;

  useEffect(() => { setLastGeneratedLink(""); }, [selectedProduct?.itemId]);

  const handleSelectProduct = useCallback(async (product: ProductOffer) => {
    selectingProductRef.current = true;
    setTimeout(() => { selectingProductRef.current = false; }, 200);
    setSelectedProduct(product); setProducts([]);
    setMobileTab("produto");
    window.scrollTo({ top: 0, behavior: "instant" });
    const name = product.productName?.split(/\s+/).slice(0, 4).join(" ") || "";
    setGoldenProducts([]);
    if (name) {
      try {
        const res = await fetch(`/api/shopee/product-search?keyword=${encodeURIComponent(name)}&limit=20`);
        const data = await res.json();
        const similar = (data?.products ?? []) as ProductOffer[];
        const currentRate = product.commissionRate ?? 0;
        let sameNiche = similar.filter((p) => p.itemId !== product.itemId && (p.commissionRate ?? 0) >= currentRate).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0));
        if (sameNiche.length === 0) sameNiche = similar.filter((p) => p.itemId !== product.itemId).sort((a, b) => (b.commissionRate ?? 0) - (a.commissionRate ?? 0)).slice(0, 20);
        else sameNiche = sameNiche.slice(0, 20);
        setGoldenProducts(sameNiche);
      } catch { setGoldenProducts([]); }
    }
  }, []);

  const handleConvertLink = useCallback(async () => {
    const originUrl = selectedProduct?.productLink || selectedProduct?.offerLink || inputValue.trim();
    if (!originUrl) { setError("Selecione um produto ou informe o link."); return; }
    setError(null); setConvertLoading(true);
    try {
      const subIds = [subId1, subId2, subId3].map((s) => s.trim());
      const res = await fetch("/api/shopee/generate-link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ originUrl, subIds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao converter link");
      const shortLink = data?.shortLink ?? "";
      const slug = extractSlugFromUrl(originUrl);
      const rate = selectedProduct?.priceDiscountRate ?? 0;
      const priceMin = selectedProduct?.priceMin ?? 0;
      const priceMax = selectedProduct?.priceMax ?? 0;
      const pricePromo = priceMin;
      const priceOriginal = rate > 0 && rate < 100 && priceMin > 0 ? Math.round((priceMin / (1 - rate / 100)) * 100) / 100 : priceMax > 0 ? priceMax : null;
      const postRes = await fetch("/api/shopee/link-history", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shortLink, originUrl, subId1: subIds[0] ?? "", subId2: subIds[1] ?? "", subId3: subIds[2] ?? "", observation: "", productName: selectedProduct?.productName ?? "", slug, imageUrl: selectedProduct?.imageUrl ?? "", commissionRate: selectedProduct?.commissionRate ?? 0, commissionValue: selectedProduct?.commission ?? 0, priceShopee: pricePromo || null, priceShopeeOriginal: priceOriginal, priceShopeeDiscountRate: rate || null }),
      });
      if (!postRes.ok) { const err = await postRes.json().catch(() => ({})); throw new Error(err?.error ?? "Erro ao salvar no histórico"); }
      setLastGeneratedLink(shortLink);
      setMobileTab("historico");
      await loadHistory(1, historySearchDebounced);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao converter";
      setError(mensagemErroGeradorShopeeParaUsuario(msg));
    }
    finally { setConvertLoading(false); }
  }, [selectedProduct, inputValue, subId1, subId2, subId3, historySearchDebounced, loadHistory]);

  const runSearchNow = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    handleSearch();
  }, [handleSearch]);

  const loadBestSellers = useCallback(async () => {
    const keyword = bestSellerKeyword.trim();
    if (!keyword || !hasApiKeys) return;
    setError(null); setLoadingBestSellers(true);
    setBestSellers([]); setProducts([]); setSelectedProduct(null); setGoldenProducts([]);
    try {
      const params = new URLSearchParams({ keyword, sortType: "2", limit: "20", listType: "2" });
      const res = await fetch(`/api/shopee/product-search?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao buscar mais vendidos");
      setBestSellers((data?.products ?? []) as ProductOffer[]);
      setLastBestSellerKeyword(keyword);
      setBestSellerPage(1);
      setMobileTab("produto");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao listar mais vendidos";
      setError(mensagemErroGeradorShopeeParaUsuario(msg));
    }
    finally { setLoadingBestSellers(false); }
  }, [hasApiKeys, bestSellerKeyword]);

  const handleDeleteHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/shopee/link-history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      await loadHistory(historyPage, historySearchDebounced);
    } catch { /**/ }
  }, [historyPage, historySearchDebounced, loadHistory]);

  const openAddToListModal = useCallback((entriesToAdd: HistoryEntry[]) => {
    if (entriesToAdd.length === 0) return;
    setAddToListModal({ open: true, entries: entriesToAdd });
    setSelectedListaId(null); setNovaListaNome("");
  }, []);

  const openAddToListModalFromHistorySelection = useCallback(async () => {
    const ids = Array.from(selectedHistoryIds);
    if (ids.length === 0) return;
    setHistoryBulkSelectionLoading(true);
    setAddToListFeedback(null);
    try {
      const params = new URLSearchParams({ ids: ids.join(",") });
      const res = await fetch(`/api/shopee/link-history?${params}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar itens selecionados");
      const list = (json?.data ?? []) as HistoryEntry[];
      if (list.length === 0) {
        setAddToListFeedback("Nenhum item encontrado para a seleção.");
        setTimeout(() => setAddToListFeedback(null), 3500);
        return;
      }
      if (list.length < ids.length) {
        setAddToListFeedback(
          `${list.length} de ${ids.length} encontrados (alguns podem ter sido excluídos).`,
        );
        setTimeout(() => setAddToListFeedback(null), 4000);
      }
      openAddToListModal(list);
    } catch (e) {
      setAddToListFeedback(e instanceof Error ? e.message : "Erro ao carregar seleção");
      setTimeout(() => setAddToListFeedback(null), 4000);
    } finally {
      setHistoryBulkSelectionLoading(false);
    }
  }, [selectedHistoryIds, openAddToListModal]);

  const toggleHistorySelect = useCallback((id: string) => {
    setSelectedHistoryIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);

  const allHistoryIds = history.map((h) => h.id);
  const allSelected = allHistoryIds.length > 0 && allHistoryIds.every((id) => selectedHistoryIds.has(id));
  const someSelected = selectedHistoryIds.size > 0;
  function toggleAll() {
    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (allSelected) { allHistoryIds.forEach((id) => next.delete(id)); }
      else { allHistoryIds.forEach((id) => next.add(id)); }
      return next;
    });
  }

  const loadListasOfertas = useCallback(async () => {
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas");
      const json = await res.json();
      if (!res.ok) return;
      setListasOfertas(Array.isArray(json?.data) ? json.data : []);
    } catch { setListasOfertas([]); }
  }, []);
  useEffect(() => { if (addToListModal.open) loadListasOfertas(); }, [addToListModal.open, loadListasOfertas]);

  const confirmAddToList = useCallback(async () => {
    const entries = addToListModal.entries;
    if (!entries.length) return;
    if (!selectedListaId && !novaListaNome.trim()) { setAddToListFeedback("Selecione uma lista ou crie uma nova."); return; }
    setAddToListLoading(true); setAddToListFeedback(null);
    try {
      let targetListaId = selectedListaId;
      if (!targetListaId && novaListaNome.trim()) {
        const createRes = await fetch("/api/shopee/minha-lista-ofertas/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novaListaNome.trim() }) });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson?.error ?? "Erro ao criar lista");
        targetListaId = createJson?.data?.id;
        await loadListasOfertas();
      }
      if (!targetListaId) throw new Error("Selecione ou crie uma lista.");
      let added = 0;
      for (const entry of entries) {
        const res = await fetch("/api/shopee/minha-lista-ofertas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ listaId: targetListaId, imageUrl: entry.imageUrl ?? "", productName: entry.productName ?? "", converterLink: entry.shortLink ?? "", priceOriginal: entry.priceShopeeOriginal ?? undefined, pricePromo: entry.priceShopee ?? undefined, discountRate: entry.priceShopeeDiscountRate ?? undefined }) });
        if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data?.error ?? "Erro ao adicionar"); }
        setLinksInOfferList((prev) => new Set(prev).add(entry.shortLink ?? ""));
        added++;
      }
      setAddToListModal({ open: false, entries: [] });
      setSelectedHistoryIds((prev) => { const next = new Set(prev); entries.forEach((e) => next.delete(e.id)); return next; });
      setAddToListFeedback(added === 1 ? "Adicionado à lista!" : `${added} produtos adicionados!`);
      setTimeout(() => setAddToListFeedback(null), 3000);
    } catch (e) { setAddToListFeedback(e instanceof Error ? e.message : "Erro ao adicionar"); }
    finally { setAddToListLoading(false); }
  }, [addToListModal.entries, selectedListaId, novaListaNome, loadListasOfertas]);

  const closeAddToListModal = useCallback(() => {
    setAddToListModal({ open: false, entries: [] }); setSelectedListaId(null); setNovaListaNome("");
  }, []);

  const canConvert = !convertLoading && (!!selectedProduct || !!extractItemIdFromUrl(inputValue)) && !!hasApiKeys;

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div className="bg-[#1c1c1f] border border-[#2c2c32] text-[#f0f0f2] flex flex-col rounded-xl overflow-hidden overflow-x-hidden">
      <style jsx>{`
        .dash { background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='14' ry='14' stroke='%232c2c32' stroke-width='2' stroke-dasharray='7%2c 7' stroke-linecap='square'/%3e%3c/svg%3e"); }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3e3e3e; border-radius: 999px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #e24c30; }
        /* Barra estilo referência: trilho escuro, thumb cinza claro */
        .scrollbar-ref::-webkit-scrollbar { width: 6px; height: 6px; }
        .scrollbar-ref::-webkit-scrollbar-track { background: #222228; border-radius: 999px; }
        .scrollbar-ref::-webkit-scrollbar-thumb { background: #9a9aa3; border-radius: 999px; }
        .scrollbar-ref::-webkit-scrollbar-thumb:hover { background: #b8b8c0; }
        .scrollbar-ref { scrollbar-width: thin; scrollbar-color: #9a9aa3 #222228; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 h-12 bg-[#27272a] flex items-center justify-between px-3 sm:px-5 border-b border-[#2c2c32]  gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/30 flex items-center justify-center shrink-0">
            <LinkIcon className="w-3.5 h-3.5 text-[#e24c30]" />
          </div>
          <span className="text-[13px] sm:text-sm font-bold tracking-tight text-[#f0f0f2] truncate">Gerador de Links Shopee</span>
        </div>
        <div className={cn("flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-bold shrink-0",
          hasApiKeys ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
            : hasApiKeys === false ? "text-amber-400 bg-amber-500/10 border-amber-500/25"
              : "text-[#a0a0a0] bg-[#222228] border-[#2c2c32]")}>
          <CheckCircle2 className="w-3 h-3" />
          <span className="hidden min-[360px]:inline">{hasApiKeys ? "API conectada" : hasApiKeys === false ? "API não config." : "Verificando..."}</span>
          <span className="min-[360px]:hidden">API</span>
        </div>
      </header>

      {/* Avisos */}
      {hasApiKeys === false && (
        <div className="px-3 sm:px-5 py-2.5 border-b border-[#2c2c32] bg-amber-500/5 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-[11px] text-amber-300 flex-1">API da Shopee não configurada.</p>
          <Link href="/configuracoes" className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg hover:bg-amber-500/20 transition shrink-0">Configurar →</Link>
        </div>
      )}
      {error && (
        <div className="px-3 sm:px-5 py-2.5 border-b border-[#2c2c32] bg-red-500/5 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] text-red-400 flex-1 truncate">{error}</p>
          <button onClick={() => setError(null)} className="text-[#a0a0a0] hover:text-white shrink-0"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Mobile: stepper no topo (estilo Meta — sem barra fixa no rodapé) */}
      <nav
        className="lg:hidden sticky top-12 z-20 border-b border-[#2c2c32] px-3 py-3 shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        aria-label="Seções do gerador"
      >
        <div className="flex items-center justify-center w-full max-w-lg mx-auto px-2 sm:px-6 py-1 gap-0">
          {MOBILE_SECTION_STEPS.map((step, idx) => {
            const active = mobileTab === step.id;
            return (
              <Fragment key={step.id}>
                {idx > 0 && (
                  <div className="h-px flex-1 min-w-[20px] max-w-[80px] mx-3 sm:mx-5 bg-[#2c2c32] self-center shrink" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={() => setMobileTab(step.id)}
                  aria-label={step.label}
                  aria-current={active ? "step" : undefined}
                  className="shrink-0 rounded-full outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-[#e24c30]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#222228] mx-1"
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold border-2 transition-all",
                      active
                        ? "bg-[#e24c30] border-[#e24c30] text-white shadow-[0_0_12px_rgba(226,76,48,0.4)]"
                        : "bg-[#1e1e24] border-[#35353d] text-[#8b8b96]"
                    )}
                  >
                    {idx + 1}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
      </nav>

      {/* Layout aside + main */}
      <div className="flex items-start border-b border-[#2c2c32]">
        {/* Aside: Configurar */}
        <aside ref={configCardRef}
          className={cn("w-full lg:w-60 lg:shrink-0 border-r border-[#2c2c32] bg-[#27272a] lg:flex flex-col min-w-0",
            mobileTab === "config" ? "flex" : "hidden")}>
          <ColHeader
            step={1}
            active
            label="Configurar Link"
            tooltip="Painel principal de configuração. Informe o produto e os Sub IDs para que o sistema gere seu link de afiliado rastreável."
            right={
              <button
                onClick={() => setMobileTab("historico")}
                className="lg:hidden flex items-center gap-1.5 px-3 py-1.5 bg-[#e24c30] text-white text-[10px] font-black rounded-lg shadow-md shadow-[#e24c30]/20 active:translate-y-0.5 transition-all"
              >
                MEUS LINKS
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            }
          />
          <div className="p-4 flex flex-col gap-4">
            <FieldGroup label="Link ou nome do produto" tooltip="Cole o link direto de um produto da Shopee ou digite o nome para busca.">
              <div className="relative">
                <input value={inputValue} onChange={(e) => setInputValue(e.target.value)}
                  onBlur={(e) => {
                    if (!isLgDesktop) return;
                    if (selectingProductRef.current) return;
                    const next = e.relatedTarget;
                    const card = configCardRef.current;
                    const mainEl = mainContentRef.current;
                    if (!card) { runSearchNow(); return; }
                    try {
                      const insideConfig = card.contains(next as Node);
                      const insideMain = mainEl?.contains(next as Node) ?? false;
                      if (next == null || (!insideConfig && !insideMain)) runSearchNow();
                    } catch { runSearchNow(); }
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    runSearchNow();
                  }}
                  placeholder="Cole o link ou nome..."
                  className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-xl px-3 py-2.5 pr-9 text-xs text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] focus:ring-1 focus:ring-[#e24c30]/15 outline-none transition" />
                {searchLoading
                  ? <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[#e24c30]" />
                  : inputValue
                    ? <button onClick={() => setInputValue("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-[#f0f0f2] transition w-7 h-7 flex items-center justify-center"><X className="w-3 h-3" /></button>
                    : null}
              </div>
            </FieldGroup>

            <FieldGroup label="Sub IDs" icon={<Hash className="w-2.5 h-2.5" />} tooltip="Identificadores de rastreamento para saber de qual canal vieram seus cliques e vendas.">
              <div className="flex flex-col gap-1.5">
                {[{ val: subId1, set: setSubId1, ph: "customizado" }, { val: subId2, set: setSubId2, ph: "natal" }, { val: subId3, set: setSubId3, ph: "campanha1" }].map((s, i) => (
                  <div key={i} className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[8px] font-bold text-[#e24c30]/70 pointer-events-none">{i + 1}</span>
                    <input value={s.val} onChange={(e) => s.set(e.target.value)} placeholder={s.ph}
                      className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg pl-5 pr-3 py-2 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30]/50 outline-none transition" />
                  </div>
                ))}
              </div>
            </FieldGroup>

            <div className="grid grid-cols-1 gap-2">
              <button onClick={runSearchNow} disabled={searchLoading || !inputValue.trim() || !hasApiKeys}
                className="flex w-full items-center justify-center gap-1.5 bg-transparent border border-[#e24c30] text-[#e24c30] rounded-xl py-2.5 text-[11px] font-semibold hover:text-[#e24c30] hover:border-[#e24c30]/70 hover:bg-[#e24c30]/5 disabled:opacity-40 transition min-h-[42px]">
                {searchLoading ? <Loader2 className="w-3 h-3 animate-spin text-[#e24c30]" /> : <Search className="w-3 h-3 text-[#e24c30]" />} Buscar
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#2c2c32]" />
              <span className="text-[9px] text-[#888888] uppercase tracking-widest font-medium whitespace-nowrap">ou explore</span>
              <div className="flex-1 h-px bg-[#2c2c32]" />
            </div>

            <FieldGroup label="Produtos mais vendidos" icon={<TrendingUp className="w-2.5 h-2.5" />} tooltip="Pesquise e liste os produtos com maior volume de vendas na Shopee.">
              <div className="flex flex-col gap-2">
                <input value={bestSellerKeyword} onChange={(e) => setBestSellerKeyword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); loadBestSellers(); } }}
                  placeholder="Ex: camisas, fones..."
                  className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-xl px-3 py-2.5 text-xs text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30]/50 outline-none transition" />
                <button onClick={loadBestSellers} disabled={loadingBestSellers || !bestSellerKeyword.trim() || !hasApiKeys}
                  className="flex cursor-pointer items-center justify-center gap-1.5 bg-[#e24c30]/20 border border-[#e24c30]/40 text-white hover:bg-orange-800 rounded-xl py-2 text-[11px] font-semibold hover:bg-[#e24c30]/20 hover:border-[#e24c30]/70 disabled:opacity-40 transition min-h-[42px]">
                  {loadingBestSellers ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />} Listar os mais vendidos
                </button>
              </div>
            </FieldGroup>
          </div>
        </aside>

        {/* Main: Produto / Mais vendidos */}
        <main ref={mainContentRef} className={cn("flex-1 flex flex-col min-w-0 w-full", mobileTab === "produto" ? "flex" : "hidden lg:flex")}>
          <div className="z-10 lg:sticky lg:top-12 lg:z-20">
            <ColHeader step={2} active={panelState !== "empty"}
              label={panelState === "mostSold" ? "Mais Vendidos" : panelState === "searchResults" ? "Resultados da Busca" : "Produto"}
              tooltip={panelState === "mostSold" ? "Lista dos produtos mais vendidos. Clique para selecionar e gerar link."
                : panelState === "searchResults" ? "Resultados da pesquisa. Clique em um produto para selecioná-lo." : undefined}
              right={panelState !== "empty" ? (
                <IconBtn onClick={() => { setBestSellers([]); setSelectedProduct(null); setProducts([]); setGoldenProducts([]); }}><X className="w-3 h-3" /></IconBtn>
              ) : undefined} />
          </div>

          {panelState === "empty" && (
            <div className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
              <div className="dash flex flex-col items-center justify-center py-12 sm:py-16 rounded-2xl w-full max-w-sm text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center mb-4">
                  <MousePointer2 className="w-7 h-7 text-[#e24c30]" />
                </div>
                <h3 className="text-base font-bold text-[#f0f0f2] mb-2">Pronto para começar!</h3>
                <p className="text-xs text-[#bebebe] leading-relaxed max-w-[200px]">Cole um link ou explore os mais vendidos na barra lateral.</p>
              </div>
            </div>
          )}

          {panelState === "searchResults" && (
            <div className="p-4 flex flex-col gap-2 w-full min-w-0">
              <p className="text-[10px] text-[#a0a0a0] pb-1 px-0.5">
                {products.length} produto{products.length !== 1 ? "s" : ""} encontrado{products.length !== 1 ? "s" : ""} · clique para selecionar
              </p>
              {pagedSearchResults.map((p) => (
                <MostSoldCard key={p.itemId} product={p} onClick={() => handleSelectProduct(p)} compact={false} selected={selectedProduct?.itemId === p.itemId} />
              ))}
              {searchTotalPages > 1 && (
                <GeradorPaginationBar
                  className="pt-2 px-1 border-t border-[#2c2c32] mt-1"
                  page={searchResultsPage}
                  totalPages={searchTotalPages}
                  onPrev={() => setSearchResultsPage((p) => Math.max(1, p - 1))}
                  onNext={() => setSearchResultsPage((p) => Math.min(searchTotalPages, p + 1))}
                />
              )}
            </div>
          )}

          {panelState === "mostSold" && (
            <div className="p-4 flex flex-col gap-2 w-full min-w-0">
              <p className="text-[10px] text-[#a0a0a0] pb-1 px-0.5">
                {bestSellers.length} produto{bestSellers.length !== 1 ? "s" : ""} · &quot;{lastBestSellerKeyword}&quot; · clique para selecionar
              </p>
              {bestSellers.slice((bestSellerPage - 1) * BEST_SELLERS_PER_PAGE, bestSellerPage * BEST_SELLERS_PER_PAGE).map((p) => (
                <MostSoldCard key={p.itemId} product={p} onClick={() => handleSelectProduct(p)} compact={false} selected={selectedProduct?.itemId === p.itemId} />
              ))}
              {totalPages > 1 && (
                <GeradorPaginationBar
                  className="pt-2 px-1 border-t border-[#2c2c32] mt-1"
                  page={bestSellerPage}
                  totalPages={totalPages}
                  onPrev={() => setBestSellerPage((p) => Math.max(1, p - 1))}
                  onNext={() => setBestSellerPage((p) => Math.min(totalPages, p + 1))}
                />
              )}
            </div>
          )}

          {panelState === "selected" && selectedProduct && (
            <div className="p-4 sm:p-5 flex flex-col gap-5 w-full min-w-0 max-w-none">
              <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-3 sm:p-4 flex gap-3 items-start w-full min-w-0">
                <div className="w-[76px] h-[76px] rounded-lg bg-white shrink-0 border border-[#2c2c32] overflow-hidden p-1 flex items-center justify-center">
                  {selectedProduct.imageUrl ? <img src={selectedProduct.imageUrl} alt="Produto" className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-7 h-7 text-[#686868]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#f0f0f2] leading-snug line-clamp-2">{selectedProduct.productName}</p>
                  <p className="text-[10px] text-[#a0a0a0] mt-1">@{selectedProduct.shopName} · {selectedProduct.sales} vendidos{selectedProduct.ratingStar > 0 ? ` · ${"⭐".repeat(Math.round(Math.min(selectedProduct.ratingStar, 5)))}` : ""}</p>
                  <div className="flex items-center justify-between gap-3 mt-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[18px] font-bold text-[#e24c30] leading-none">{formatCurrency(selectedProduct.priceMin)}</span>
                      {selectedProduct.priceDiscountRate > 0 && (
                        <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">{fmtDisc(selectedProduct.priceDiscountRate)}</span>
                      )}
                    </div>
                    <p className="w-full min-[520px]:w-auto text-[11px] font-semibold text-emerald-400 whitespace-normal break-words min-[520px]:whitespace-nowrap">
                      {((selectedProduct.commissionRate ?? 0) * 100).toFixed(1)}% comissão · {formatCurrency(selectedProduct.commission)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Converter: Agora em ambos Mobile e Desktop, abaixo do produto pesquisado */}
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 w-full min-w-0">
                <button type="button" onClick={handleConvertLink} disabled={!canConvert}
                  className="w-full lg:w-auto lg:px-8 flex items-center justify-center gap-2 bg-[#e24c30] text-white rounded-xl py-2.5 text-[12px] font-semibold hover:bg-[#c94028] disabled:opacity-40 transition shadow-lg shadow-[#e24c30]/20 shrink-0">
                  {convertLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} 
                  Converter link
                </button>
                
                {lastGeneratedLink && (
                  <div className="hidden lg:flex items-center gap-2 text-amber-300 text-[11px] font-bold animate-in fade-in slide-in-from-left-3 duration-500">
                    <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <span>Pronto! O link já está disponível em &quot;Links Gerados&quot;.</span>
                  </div>
                )}
              </div>

              {goldenProducts.length > 0 && (
                <div className="pt-1 w-full min-w-0">
                  <h3 className="text-[11px] font-bold text-[#f0f0f2] uppercase tracking-widest">Ofertas semelhantes</h3>
                  <div className="mt-3 w-full rounded-xl border border-[#2c2c32] bg-[#222228] p-3 flex flex-col gap-2 min-w-0">
                    {pagedGoldenSimilar.map((p) => (
                      <MostSoldCard key={`sim-${p.itemId}`} product={p} onClick={() => handleSelectProduct(p)} compact />
                    ))}
                    {goldenSimilarTotalPages > 1 && (
                      <GeradorPaginationBar
                        className="pt-2 mt-1 border-t border-[#2c2c32]"
                        page={goldenSimilarPage}
                        totalPages={goldenSimilarTotalPages}
                        onPrev={() => setGoldenSimilarPage((p) => Math.max(1, p - 1))}
                        onNext={() => setGoldenSimilarPage((p) => Math.min(goldenSimilarTotalPages, p + 1))}
                      />
                    )}
                  </div>
                </div>
              )}

              </div>
          )}
        </main>
      </div>

      {/* Histórico */}
      <section className={cn("border-t border-[#2c2c32] bg-[#27272a]", mobileTab === "historico" ? "block" : "hidden lg:block")}>
        <div className="lg:hidden px-3 sm:px-5 pt-4">
          <button
            onClick={() => setMobileTab("config")}
            className="w-full flex items-center justify-center gap-2 bg-[#e24c30] text-white text-[11px] font-extrabold rounded-xl py-3 shadow-lg shadow-[#e24c30]/20 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            CRIAR NOVO LINK
          </button>
        </div>

        <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
              <LinkIcon className="w-3 h-3 text-[#e24c30]" />
            </div>
            <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Links Gerados</h2>
            {historyTotal > 0 && (
              <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">{historyTotal} links</span>
            )}
          </div>
          <div className="relative w-full sm:w-56 group/search">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#e24c30]/55 group-focus-within/search:text-[#e24c30] transition-colors" />
            <input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Buscar produto, sub ID..."
              className="w-full sm:w-56 bg-[#18181c] border border-[#e24c30]/20 rounded-xl py-2 pl-8 pr-3 text-xs text-[#f0f0f2] placeholder:text-[#7a7a82] shadow-inner shadow-black/20 outline-none transition-all hover:border-[#e24c30]/35 focus:border-[#e24c30] focus:ring-2 focus:ring-[#e24c30]/25 focus:bg-[#1c1c20]" />
          </div>
        </div>

        <div className="px-3 sm:px-5 py-2.5 border-b border-[#2c2c32] bg-[#1c1c1f] flex flex-row flex-wrap items-center justify-between gap-2 lg:gap-3">
          <label
            className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
            aria-label={someSelected ? `${selectedHistoryIds.size} selecionados — toque para alterar seleção` : "Selecionar todos do histórico"}
          >
            <div
              role="checkbox"
              aria-checked={allSelected ? true : someSelected ? "mixed" : false}
              tabIndex={0}
              onClick={toggleAll}
              onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggleAll(); } }}
              className={cn("w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]",
                allSelected ? "bg-[#e24c30] border-[#e24c30] shadow-[0_0_12px_rgba(226,76,48,0.35)]"
                  : someSelected ? "bg-[#e24c30]/18 border-[#e24c30] ring-1 ring-inset ring-[#e24c30]/30"
                    : "bg-[#141418] border-[#3f3f46] group-hover:border-[#e24c30]/45 group-hover:bg-[#e24c30]/5")}>
              {someSelected && !allSelected && <span className="w-2 h-1 rounded-[2px] bg-[#e24c30]" />}
            </div>
            <span className="hidden lg:inline text-[11px] font-medium text-[#bebebe] group-hover:text-[#e0e0e0] transition">
              {someSelected ? `${selectedHistoryIds.size} selecionado${selectedHistoryIds.size > 1 ? "s" : ""}` : "Selecionar todos"}
            </span>
            {someSelected && (
              <span className="lg:hidden text-xs font-bold text-[#f0f0f2] tabular-nums min-w-[1.1rem]" aria-hidden>
                {selectedHistoryIds.size}
              </span>
            )}
          </label>
          <div className={cn("flex items-center justify-end gap-1.5 flex-nowrap shrink-0 transition-opacity duration-200",
            someSelected ? "flex opacity-100" : "hidden")}
          >
            <button
              type="button"
              onClick={() => setSelectedHistoryIds(new Set())}
              title="Limpar seleção"
              aria-label="Limpar seleção"
              className="flex items-center justify-center gap-1.5 text-[11px] text-[#a0a0a0] hover:text-[#f0f0f2] font-medium transition bg-[#222228] border border-[#2c2c32] rounded-lg p-2.5 lg:p-0 lg:bg-transparent lg:border-0 lg:rounded-none lg:px-0 lg:py-0 lg:hover:text-[#bebebe]"
            >
              <X className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              <span className="hidden lg:inline">Limpar</span>
            </button>
            <button
              type="button"
              onClick={() => void openAddToListModalFromHistorySelection()}
              disabled={historyBulkSelectionLoading}
              title={`Adicionar ${selectedHistoryIds.size} à lista`}
              aria-label={`Adicionar ${selectedHistoryIds.size} à lista de ofertas`}
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/35 p-2.5 lg:px-2.5 lg:py-1 rounded-lg transition disabled:opacity-50 disabled:pointer-events-none"
            >
              {historyBulkSelectionLoading ? (
                <Loader2 className="w-4 h-4 lg:w-3 lg:h-3 shrink-0 animate-spin" />
              ) : (
                <ListPlus className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              )}
              <span className="hidden lg:inline whitespace-nowrap">Adicionar à lista ({selectedHistoryIds.size})</span>
            </button>
            <button
              type="button"
              onClick={async () => { const ids = Array.from(selectedHistoryIds); for (const id of ids) await handleDeleteHistory(id); setSelectedHistoryIds(new Set()); }}
              title={`Excluir ${selectedHistoryIds.size}`}
              aria-label={`Excluir ${selectedHistoryIds.size} do histórico`}
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 hover:border-red-500/35 p-2.5 lg:px-2.5 lg:py-1 rounded-lg transition"
            >
              <Trash2 className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Excluir {selectedHistoryIds.size}</span>
            </button>
          </div>
        </div>

        {addToListFeedback && (
          <div className={cn("mx-3 sm:mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px]",
            addToListFeedback.includes("Selecione") || addToListFeedback.toLowerCase().includes("erro")
              ? "bg-amber-500/8 border-amber-500/20 text-amber-400"
              : "bg-emerald-500/8 border-emerald-500/20 text-emerald-400")}>
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {addToListFeedback}
          </div>
        )}

        <div className="divide-y divide-[#2c2c32] max-h-[min(70vh,720px)] overflow-y-auto scrollbar-ref bg-[#1c1c1f]">
          {historyLoading && history.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[#a0a0a0] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : history.length === 0 ? (
            <div className="px-3 sm:px-5 py-10 text-center text-[#a0a0a0] text-[12px] bg-[#17171a]">Nenhum link encontrado.</div>
          ) : (
            history.map((h) => {
              const inList = linksInOfferList.has(h.shortLink ?? "");
              const isSelected = selectedHistoryIds.has(h.id);
              const isCopied = copiedHistoryId === h.id;
              return (
                <div key={h.id} onClick={() => toggleHistorySelect(h.id)}
                  className={cn(
                    "px-3 sm:px-5 py-3.5 border-l-[3px] transition cursor-pointer",
                    isSelected
                      ? "bg-[#e24c30]/10 border-l-[#e24c30] hover:bg-[#e24c30]/15"
                      : "border-l-transparent hover:bg-[#1c1c1f]"
                  )}>
                  <div className="flex items-start gap-3">
                    <span
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toggleHistorySelect(h.id); }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") { e.preventDefault(); e.stopPropagation(); toggleHistorySelect(h.id); }
                      }}
                      className={cn(
                        "w-4 h-4 rounded-md border shrink-0 cursor-pointer mt-0.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#222228]",
                        isSelected
                          ? "bg-[#e24c30] border-[#e24c30] shadow-[0_0_10px_rgba(226,76,48,0.28)]"
                          : "border-[#3f3f46] bg-[#141418] hover:border-[#e24c30]/45 hover:bg-[#e24c30]/10"
                      )}
                    />
                    <div className="w-10 h-10 rounded-lg shrink-0 border border-[#2c2c32] overflow-hidden bg-[#232328]">
                      {h.imageUrl ? <img src={h.imageUrl} alt="Produto" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="w-4 h-4 text-[#686868]" /></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#f0f0f2] truncate line-clamp-2 min-[380px]:line-clamp-none">{h.productName || "Link gerado"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] text-[#a0a0a0]">{new Date(h.createdAt).toLocaleDateString("pt-BR")}</span>
                        {h.subId1 && <span className="text-[9px] font-mono text-[#d2d2d2] bg-[#232328] px-1.5 py-px rounded border border-[#3e3e3e]">#{h.subId1}</span>}
                        {(h.commissionRate > 0 || h.commissionValue > 0) && (
                          <span className="text-[9px] font-semibold text-emerald-400">Comissão {((h.commissionRate ?? 0) * 100).toFixed(1)}% · {formatCurrency(h.commissionValue ?? 0)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 mt-2 min-[560px]:hidden" onClick={(e) => e.stopPropagation()}>
                        <HistoryActions inList={inList} copiedId={isCopied}
                          onCopy={() => { void navigator.clipboard.writeText(h.shortLink); setCopiedHistoryId(h.id); setTimeout(() => setCopiedHistoryId((c) => c === h.id ? null : c), 1500); }}
                          onOpen={() => window.open(h.shortLink, "_blank", "noopener,noreferrer")}
                          onAddToList={() => openAddToListModal([h])}
                          onDelete={() => handleDeleteHistory(h.id)} />
                      </div>
                    </div>
                    <div className="hidden min-[560px]:flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <HistoryActions inList={inList} copiedId={isCopied}
                        onCopy={() => { void navigator.clipboard.writeText(h.shortLink); setCopiedHistoryId(h.id); setTimeout(() => setCopiedHistoryId((c) => c === h.id ? null : c), 1500); }}
                        onOpen={() => window.open(h.shortLink, "_blank", "noopener,noreferrer")}
                        onAddToList={() => openAddToListModal([h])}
                        onDelete={() => handleDeleteHistory(h.id)} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {(historyTotal > 0 || historyLoading) && (
          <div className="px-3 sm:px-5 py-3.5 border-t border-[#2c2c32] bg-[#1c1c1f]">
            <GeradorPaginationBar
              page={historyPage}
              totalPages={historyTotalPages}
              loading={historyLoading}
              summary={`Mostrando ${history.length} de ${historyTotal} links`}
              onPrev={() => setHistoryPage((p) => Math.max(1, p - 1))}
              onNext={() => setHistoryPage((p) => Math.min(historyTotalPages, p + 1))}
            />
          </div>
        )}
      </section>

      {/* Modal Adicionar à Lista */}
      <ListModal open={addToListModal.open} onClose={closeAddToListModal}
        lists={listasOfertas} newListName={novaListaNome} setNewListName={setNovaListaNome}
        activeListId={selectedListaId} setActiveListId={setSelectedListaId}
        onCreate={async () => {
          if (!novaListaNome.trim()) return;
          try {
            const res = await fetch("/api/shopee/minha-lista-ofertas/listas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome: novaListaNome.trim() }) });
            const json = await res.json();
            if (res.ok && json?.data?.id) { setSelectedListaId(json.data.id); await loadListasOfertas(); setNovaListaNome(""); }
          } catch { /**/ }
        }}
        onConfirm={confirmAddToList}
        canConfirm={!!selectedListaId && addToListModal.entries.length > 0}
        pendingCount={addToListModal.entries.length}
        loading={addToListLoading} />
    </div>
  );
}
