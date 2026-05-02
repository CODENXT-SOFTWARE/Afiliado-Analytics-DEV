"use client";

import { useState, useEffect, useCallback, useMemo, useId, useRef, Fragment } from "react";
import Papa from "papaparse";
import { createPortal } from "react-dom";
import Link from "next/link";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import {
  Loader2,
  Trash2,
  ExternalLink,
  Search,
  ArrowLeft,
  ListChecks,
  Link2,
  Columns2,
  X,
  Plus,
  Upload,
  FileDown,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ImageIcon,
  MousePointer2,
  Zap,
  ListPlus,
} from "lucide-react";
import {
  cn,
  ColHeader,
  FieldGroup,
  GeradorShellScrollbarStyle,
  IconBtn,
} from "@/app/components/gerador/gerador-ui-primitives";
import { GeradorAddToListModal } from "@/app/components/gerador/GeradorAddToListModal";
import type { MlSiteSearchProduct } from "@/lib/amazon/site-search";
import { ML_LISTA_CATEGORY_OPTIONS } from "@/lib/amazon/ml-lista-category-slugs";
import Toolist from "@/app/components/ui/Toolist";
import { extractAsinFromUrl, looksLikeAmazonProductUrl } from "@/lib/amazon/extract-asin";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { useAmazonAffiliateLocalSettings } from "@/lib/amazon/use-amazon-affiliate-local-settings";
import { AMAZON_UX_COMING_SOON } from "@/lib/amazon-ux-coming-soon";
import MlEmBreveSplash from "@/app/components/amazon/AmazonEmptyStub";
import ProFeatureGate from "../ProFeatureGate";

type Lista = { id: string; nome: string; totalItens: number; createdAt?: string };

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }).format(value);
}

const MAX_BULK_PAIRS = 60;

type MlMobileTab = "config" | "produto" | "historico";

const ML_MOBILE_STEPS: { id: MlMobileTab; label: string }[] = [
  { id: "config", label: "Configurar" },
  { id: "produto", label: "Produto" },
  { id: "historico", label: "Histórico" },
];

type MlHistoryEntry = {
  id: string;
  shortLink: string;
  originUrl: string;
  productName: string;
  imageUrl: string;
  itemId: string;
  pricePromo: number | null;
  priceOriginal: number | null;
  discountRate: number | null;
  couponPercent: number | null;
  couponAmount: number | null;
  affiliateCommissionPct: number | null;
  createdAt: string;
};

const ML_HISTORY_PAGE_SIZE = 4;
const ML_SEARCH_PAGE_SIZE = 4;
const ML_SIMILAR_PAGE_SIZE = 4;

function fmtMlDisc(r: number) {
  return `${Math.round(r)}% OFF`;
}

/** Títulos placeholder do SERP (ex.: "Anúncio MLB123") — não listar no painel de resultados. */
function isMlAnuncioPlaceholderTitle(productName: string): boolean {
  return /^Anúncio\b/i.test(productName.trim());
}

/** Primeiras palavras do título para buscar ofertas semelhantes no ML. */
function mlSimilarSearchQueryFromProductName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1)
    .slice(0, 5);
  return parts.join(" ").trim();
}

function MlOfferRowCard({
  p,
  onPick,
  selected,
  compact,
}: {
  p: MlSiteSearchProduct;
  onPick: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  const hasOriginal =
    p.priceOriginal != null && p.price != null && p.priceOriginal > p.price;
  const couponPct = p.couponPercent ?? null;
  const couponAmt = p.couponAmount ?? null;
  const hasCoupon = (couponPct != null && couponPct > 0) || (couponAmt != null && couponAmt > 0);
  const couponLabel = couponPct != null && couponPct > 0
    ? `Cupom ${Math.round(couponPct)}%`
    : couponAmt != null && couponAmt > 0
      ? `Cupom ${formatCurrency(couponAmt)}`
      : null;
  const primePct = p.primeDiscountPercent ?? null;
  const hasPrime = primePct != null && primePct > 0;

  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "w-full rounded-xl transition text-left group flex flex-wrap items-start gap-x-3 gap-y-2 min-[420px]:flex-nowrap min-[420px]:items-center",
        compact ? "px-2.5 py-2.5" : "px-3 py-3",
        selected
          ? "border border-[#e24c30] bg-[#3B2B2B]"
          : "bg-[#1c1c1f] border border-[#2c2c32] hover:border-[#e24c30]/30 hover:bg-[#232328]",
      )}
    >
      <div
        className={cn(
          "rounded-lg shrink-0 border border-[#2c2c32] overflow-hidden bg-[#232328]",
          compact ? "w-10 h-10 min-[360px]:w-11 min-[360px]:h-11" : "w-12 h-12 min-[360px]:w-14 min-[360px]:h-14",
        )}
      >
        {p.imageUrl ? (
          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-[#686868]" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p
          className={cn(
            "font-semibold text-[#f0f0f2] leading-[1.35] pr-1",
            compact ? "text-[12px] line-clamp-2 min-[420px]:line-clamp-2" : "text-[13px] min-[360px]:text-xs line-clamp-2",
          )}
        >
          {p.productName}
        </p>
        <div className="flex items-center gap-x-2 gap-y-1.5 mt-2 flex-wrap">
          {p.price != null ? (
            <span className={cn("font-bold text-[#e24c30]", compact ? "text-[10px]" : "text-[11px] min-[360px]:text-xs")}>
              {formatCurrency(p.price)}
            </span>
          ) : null}
          {hasOriginal ? (
            <span
              className={cn(
                "text-[#9c9c9c] line-through whitespace-nowrap",
                compact ? "text-[9px]" : "text-[10px]",
              )}
            >
              {formatCurrency(p.priceOriginal as number)}
            </span>
          ) : null}
          {p.discountRate != null && p.discountRate > 0 ? (
            <span
              className={cn(
                "font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-px rounded-md border border-emerald-500/15 whitespace-nowrap",
                compact ? "text-[9px]" : "text-[10px]",
              )}
            >
              {fmtMlDisc(p.discountRate)}
            </span>
          ) : null}
          {hasCoupon && couponLabel ? (
            <span
              className={cn(
                "font-bold text-amber-300 bg-amber-500/10 px-1.5 py-px rounded-md border border-amber-500/20 whitespace-nowrap",
                compact ? "text-[9px]" : "text-[10px]",
              )}
              title="Cupom disponível na página do produto"
            >
              {couponLabel}
            </span>
          ) : null}
          {hasPrime ? (
            <span
              className={cn(
                "font-bold text-sky-300 bg-sky-500/10 px-1.5 py-px rounded-md border border-sky-500/20 whitespace-nowrap",
                compact ? "text-[9px]" : "text-[10px]",
              )}
              title="Desconto exclusivo Amazon Prime"
            >
              Prime {Math.round(primePct as number)}%
            </span>
          ) : null}
          <span className={cn("text-[#9c9c9c] whitespace-nowrap font-mono", compact ? "text-[9px]" : "text-[10px]")}>
            {p.itemId}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "flex items-center justify-end gap-3 shrink-0",
          compact
            ? "w-full pl-[52px] pt-2 mt-1 border-t border-[#2c2c32] min-[420px]:w-auto min-[420px]:pl-0 min-[420px]:pt-0 min-[420px]:mt-0 min-[420px]:border-t-0"
            : "w-full pl-[60px] min-[360px]:pl-[68px] pt-2 mt-1 border-t border-[#2c2c32] min-[420px]:w-auto min-[420px]:pl-0 min-[420px]:pt-0 min-[420px]:mt-0 min-[420px]:border-t-0",
        )}
      >
        <ExternalLink
          className={cn(
            "text-[#e24c30] shrink-0 opacity-100 min-[420px]:opacity-50 min-[420px]:group-hover:opacity-100 transition-opacity",
            compact ? "w-3 h-3" : "w-3.5 h-3.5",
          )}
          aria-hidden
        />
      </div>
    </button>
  );
}

function MlHistoryActions({
  inList,
  copiedId,
  onCopy,
  onOpen,
  onAddToList,
  onDelete,
}: {
  inList: boolean;
  copiedId: boolean;
  onCopy: () => void;
  onOpen: () => void;
  onAddToList: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <IconBtn onClick={onCopy} title={copiedId ? "Copiado!" : "Copiar"} active={copiedId}>
        {copiedId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </IconBtn>
      <IconBtn onClick={onOpen} title="Abrir">
        <ExternalLink className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn onClick={onAddToList} title={inList ? "Já está em alguma lista" : "Adicionar à lista"} active={inList}>
        <ListPlus className="w-3.5 h-3.5" />
      </IconBtn>
      <IconBtn onClick={onDelete} title="Excluir" danger>
        <Trash2 className="w-3.5 h-3.5" />
      </IconBtn>
    </>
  );
}

/** Inputs alinhados ao gerador Shopee (#1c1c1f / #e24c30) */
const gInp =
  "w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-xl px-3 py-2.5 text-xs text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] focus:ring-1 focus:ring-[#e24c30]/15 outline-none transition";
const gTa = `${gInp} min-h-[140px] font-mono sm:text-xs`;
const gBtnPrimary =
  "inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-xl bg-[#e24c30] text-sm font-semibold text-white hover:bg-[#c94028] disabled:opacity-40 shadow-lg shadow-[#e24c30]/20 transition";
const gBtnSecondary =
  "inline-flex items-center justify-center gap-2 min-h-10 px-4 rounded-xl bg-[#1c1c1f] border border-[#3e3e3e] text-[12px] font-semibold text-[#d2d2d2] hover:text-[#f0f0f2] hover:border-[#585858] disabled:opacity-40 transition";

const labelClass = "block text-xs font-medium text-text-secondary mb-1.5";

/** Formulários “Colar em lote” / “Um produto por vez” — alinhado ao SectionBox (Meta / padrão do app) */
const mlSectionHeadClass =
  "flex flex-wrap items-center gap-2 border-l-2 border-shopee-orange/60 pl-2 -ml-px";
const mlSectionTitleClass =
  "text-xs font-semibold text-text-primary uppercase tracking-wide";
const mlFieldLabelClass =
  "block text-xs font-semibold text-text-secondary uppercase tracking-wide mb-1.5";
const mlFieldLabelInlineClass =
  "text-xs font-semibold text-text-secondary uppercase tracking-wide shrink-0";
const mlModalOverlayClass =
  "fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/70 backdrop-blur-[2px]";
const mlModalShellClass =
  "w-full flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden";
const mlModalHeaderClass = "shrink-0 px-4 pt-4 pb-3 border-b border-dark-border/60 bg-dark-bg/40";
const mlModalSearchInputClass =
  "w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20";
const mlModalListScrollClass = "flex-1 min-h-0 overflow-y-auto p-3 scrollbar-thin space-y-2";
const mlModalFooterClass = "shrink-0 flex justify-end gap-2 px-4 py-3 border-t border-dark-border/60 bg-dark-bg/30";
const mlPickerRowClass = (selected: boolean) =>
  `w-full text-left rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
    selected
      ? "border-shopee-orange/50 bg-shopee-orange/10 text-text-primary"
      : "border-dark-border/60 bg-dark-bg/30 text-text-secondary hover:border-shopee-orange/30"
  }`;

function normalizeMlModalSearch(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function linesFromTextarea(s: string): string[] {
  return s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

function looksLikeBulkHeaderRow(cols: string[]): boolean {
  const a = (cols[0] ?? "").trim();
  if (/^https?:\/\//i.test(a)) return false;
  const hint = cols.map((c) => String(c ?? "").toLowerCase()).join(" ");
  return /\b(url|produto|an[uú]ncio|link|afiliado|meli|coluna)\b/i.test(hint);
}

function parseBulkCsvRows(rows: string[][]): { product: string; affiliate: string }[] {
  let data = rows.filter((r) => r.some((c) => String(c ?? "").trim()));
  if (data.length && looksLikeBulkHeaderRow(data[0].map((c) => String(c ?? "")))) {
    data = data.slice(1);
  }
  const pairs: { product: string; affiliate: string }[] = [];
  for (const r of data) {
    const product = String(r[0] ?? "").trim();
    const affiliate = String(r[1] ?? "").trim();
    if (product && affiliate) pairs.push({ product, affiliate });
  }
  return pairs;
}

function isHttpUrlLine(line: string): boolean {
  return /^https?:\/\//i.test(line.trim());
}

/** Linha é link curto de afiliado (não confundir com URL de produto ML). */
function isMeliLaHttpLine(line: string): boolean {
  const t = line.trim();
  if (!/^https?:\/\//i.test(t)) return false;
  try {
    const h = new URL(t).hostname.toLowerCase();
    return h === "amazon.com.br" || h === "www.amazon.com.br";
  } catch {
    return false;
  }
}

/**
 * Um único bloco: todas as URLs de produto primeiro, depois todas as amazon.com.br (sem precisar linha em branco).
 */
function splitBulkTxtUrlsIntoProductsAndAffiliates(lines: string[]): { products: string[]; affiliates: string[] } | null {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  const idx = trimmed.findIndex(isMeliLaHttpLine);
  if (idx <= 0) return null;
  const products = trimmed.slice(0, idx).filter((l) => !isMeliLaHttpLine(l));
  const affiliates = trimmed.slice(idx).filter(isMeliLaHttpLine);
  if (products.length === 0 || affiliates.length === 0) return null;
  return { products, affiliates };
}

/** Formato alternativo em TXT (um único bloco): TAB ou `;` entre URL do produto e amazon.com.br na mesma linha. */
function parseTxtLineToPair(line: string): { product: string; affiliate: string } | null {
  const t = line.trim();
  if (!t || t.startsWith("#")) return null;
  let product: string;
  let affiliate: string;
  if (t.includes("\t")) {
    const idx = t.indexOf("\t");
    product = t.slice(0, idx).trim();
    affiliate = t.slice(idx + 1).trim();
  } else if (t.includes(";")) {
    const idx = t.indexOf(";");
    product = t.slice(0, idx).trim();
    affiliate = t.slice(idx + 1).trim();
  } else {
    return null;
  }
  if (!product || !affiliate) return null;
  return { product, affiliate };
}

/**
 * TXT: (1) dois blocos separados por linha em branco — só linhas que começam com http(s), comentários # ignorados;
 * (2) um bloco só — produtos ML primeiro, depois amazon.com.br na ordem (linha em branco entre blocos é opcional);
 * (3) TAB ou `;` na mesma linha.
 */
function parseBulkNotepadContent(text: string): { product: string; affiliate: string }[] {
  const rawLines = text.split(/\r?\n/);
  const blocks: string[][] = [[]];
  for (const line of rawLines) {
    if (line.trim() === "") {
      if (blocks[blocks.length - 1].length > 0) blocks.push([]);
    } else {
      blocks[blocks.length - 1].push(line);
    }
  }

  const dataBlocks = blocks
    .map((b) =>
      b
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith("#") && isHttpUrlLine(l)),
    )
    .filter((b) => b.length > 0);

  if (dataBlocks.length >= 2) {
    const products = dataBlocks[0];
    const affiliates = dataBlocks[1];
    const n = Math.min(products.length, affiliates.length);
    return Array.from({ length: n }, (_, i) => ({
      product: products[i],
      affiliate: affiliates[i],
    }));
  }

  if (dataBlocks.length === 1) {
    const split = splitBulkTxtUrlsIntoProductsAndAffiliates(dataBlocks[0]);
    if (split) {
      const n = Math.min(split.products.length, split.affiliates.length);
      return Array.from({ length: n }, (_, i) => ({
        product: split.products[i],
        affiliate: split.affiliates[i],
      }));
    }
  }

  const pairs: { product: string; affiliate: string }[] = [];
  for (const line of dataBlocks[0] ?? []) {
    const p = parseTxtLineToPair(line);
    if (p) pairs.push(p);
  }
  return pairs;
}

function pairsToBulkTextareas(pairs: { product: string; affiliate: string }[]): {
  products: string;
  affiliates: string;
} {
  return {
    products: pairs.map((p) => p.product).join("\n"),
    affiliates: pairs.map((p) => p.affiliate).join("\n"),
  };
}

function triggerUtf8Download(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

function downloadMlBulkTemplateCsv() {
  const body =
    "URL do produto (coluna A);Link de afiliado amazon.com.br (coluna B)\r\n" +
    "https://www.Amazon.com.br/SEU_ANUNCIO;https://amazon.com.br/SEU_LINK\r\n";
  triggerUtf8Download("modelo-lote-ml.csv", body);
}

function downloadMlBulkTemplateTxt() {
  const body =
    "# Afiliado Analytics — modelo lote Amazon\r\n" +
    "# Linhas com # no início são ignoradas.\r\n" +
    "# ACIMA: uma URL http(s) de produto por linha. ABAIXO: um https://amazon.com.br/… por linha (mesma ordem).\r\n" +
    "# Linha em branco entre as duas listas é opcional.\r\n" +
    "\r\n" +
    "#https://www.Amazon.com.br/exemplo-produto\r\n" +
    "https://www.Amazon.com.br/SEU_PRODUTO_1\r\n" +
    "https://www.Amazon.com.br/SEU_PRODUTO_2\r\n" +
    "\r\n" +
    "#https://amazon.com.br/exemplo\r\n" +
    "https://amazon.com.br/SEU_LINK_1\r\n" +
    "https://amazon.com.br/SEU_LINK_2\r\n";
  triggerUtf8Download("modelo-lote-ml.txt", body);
}

function isMeliLaShort(u: string): boolean {
  try {
    const h = new URL(u.trim()).hostname.toLowerCase();
    return h === "amazon.com.br" || h === "www.amazon.com.br";
  } catch {
    return false;
  }
}

/** Quando o resolve do ML falha, deriva um título legível da URL. */
function fallbackNameFromProductUrl(url: string, lineIndex: number): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "";
    let base = decodeURIComponent(seg).replace(/\+/g, " ");
    base = base.replace(/-/g, " ").replace(/_/g, " ");
    base = base.replace(/\bMLB-?\d+\s*/gi, "").trim();
    if (base.length > 3) return base.slice(0, 150);
  } catch {
    /* ignore */
  }
  return `Produto (linha ${lineIndex + 1})`;
}

export default function MinhaListaOfertasMlPage() {
  return (
    <ProFeatureGate feature="amazon">
      <MinhaListaOfertasMlPageInner />
    </ProFeatureGate>
  );
}

function MinhaListaOfertasMlPageInner() {
  const [listas, setListas] = useState<Lista[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [criandoLista, setCriandoLista] = useState(false);
  const [listasMenuModalOpen, setListasMenuModalOpen] = useState(false);
  const [criarListaModalOpen, setCriarListaModalOpen] = useState(false);
  const [criarListaModalPurpose, setCriarListaModalPurpose] = useState<"menu" | "bulkNewList">("menu");
  const [nomeListaCriar, setNomeListaCriar] = useState("");
  const [selecionarListaModalOpen, setSelecionarListaModalOpen] = useState(false);
  const [listaPickerQuery, setListaPickerQuery] = useState("");
  const [listaPickerDraftId, setListaPickerDraftId] = useState("");
  const [mobileTab, setMobileTab] = useState<MlMobileTab>("produto");
  const listasMenuTitleId = useId();
  const criarListaTitleId = useId();
  const ondeSalvarTitleId = useId();

  const [addListaId, setAddListaId] = useState("");
  const [affiliateLink, setAffiliateLink] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [discountRate, setDiscountRate] = useState("");
  const [salvandoItem, setSalvandoItem] = useState(false);

  const [bulkProductUrls, setBulkProductUrls] = useState("");
  const [bulkAffiliateUrls, setBulkAffiliateUrls] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  /** Só erros de importação — sucesso não mostra aviso (evita ruído visual). */
  const [bulkImportWarn, setBulkImportWarn] = useState<string | null>(null);

  const { sessionToken: amazonSessionToken, affiliateTag: mlAffiliateTag } = useAmazonAffiliateLocalSettings();

  const mlSessionBody = useMemo(() => {
    const t = amazonSessionToken.trim();
    return t ? { amazonSessionToken: t } : {};
  }, [amazonSessionToken]);

  const [mlSearchQuery, setMlSearchQuery] = useState("");
  const [mlSearchLoading, setMlSearchLoading] = useState(false);
  /** Filtro "Só ofertas": quando ativo, só lista produtos com cupom ou desconto. */
  const [onlyDeals, setOnlyDeals] = useState(false);

  // Carrega preferência do toggle do localStorage no mount.
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.localStorage.getItem("aa_amazon_only_deals") === "1") {
        setOnlyDeals(true);
      }
    } catch {
      /* ignora indisponibilidade do localStorage */
    }
  }, []);

  // Persiste a cada mudança.
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("aa_amazon_only_deals", onlyDeals ? "1" : "0");
      }
    } catch {
      /* ignora */
    }
  }, [onlyDeals]);
  const [mlListSourceLabel, setMlListSourceLabel] = useState<string | null>(null);
  const [mlSearchResults, setMlSearchResults] = useState<MlSiteSearchProduct[]>([]);
  const [mlSearchPage, setMlSearchPage] = useState(1);
  const [selectedMlProduct, setSelectedMlProduct] = useState<MlSiteSearchProduct | null>(null);
  const [mlSearchFocusMode, setMlSearchFocusMode] = useState(false);
  const [mlSimilarProducts, setMlSimilarProducts] = useState<MlSiteSearchProduct[]>([]);
  const [mlSimilarLoading, setMlSimilarLoading] = useState(false);
  const [mlGoldenSimilarPage, setMlGoldenSimilarPage] = useState(1);
  const [mlConvertLoading, setMlConvertLoading] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [categoryPickerQuery, setCategoryPickerQuery] = useState("");
  const [categoryDraftSlug, setCategoryDraftSlug] = useState<string | null>(null);
  const mlCategoryPickerTitleId = useId();
  const mlSearchSeq = useRef(0);

  const [mlHistory, setMlHistory] = useState<MlHistoryEntry[]>([]);
  const [mlHistorySearch, setMlHistorySearch] = useState("");
  const [mlHistorySearchDebounced, setMlHistorySearchDebounced] = useState("");
  const [mlHistoryPage, setMlHistoryPage] = useState(1);
  const [mlHistoryTotal, setMlHistoryTotal] = useState(0);
  const [mlHistoryTotalPages, setMlHistoryTotalPages] = useState(1);
  const [mlHistoryLoading, setMlHistoryLoading] = useState(false);

  const [mlAddToListModal, setMlAddToListModal] = useState<{ open: boolean; entries: MlHistoryEntry[] }>({
    open: false,
    entries: [],
  });
  const [mlHistModalListaId, setMlHistModalListaId] = useState<string | null>(null);
  const [mlHistModalNovaLista, setMlHistModalNovaLista] = useState("");
  const [mlAddToListLoading, setMlAddToListLoading] = useState(false);
  const [mlAddToListFeedback, setMlAddToListFeedback] = useState<string | null>(null);
  const [linksInMlOfferList, setLinksInMlOfferList] = useState<Set<string>>(new Set());
  const [selectedMlHistoryMap, setSelectedMlHistoryMap] = useState<Record<string, MlHistoryEntry>>({});
  const [copiedMlHistoryId, setCopiedMlHistoryId] = useState<string | null>(null);

  const applyBulkPairs = useCallback((pairs: { product: string; affiliate: string }[]) => {
    if (pairs.length === 0) {
      setBulkImportWarn(
        "Nenhum par válido: CSV com colunas A/B; ou TXT com URLs de produto e depois amazon.com.br; ou TAB/; na mesma linha.",
      );
      return;
    }
    if (pairs.length > MAX_BULK_PAIRS) {
      setBulkImportWarn(null);
      setError(`Máximo de ${MAX_BULK_PAIRS} linhas por vez. O arquivo tem ${pairs.length}.`);
      return;
    }
    setError(null);
    setBulkImportWarn(null);
    const { products, affiliates } = pairsToBulkTextareas(pairs);
    setBulkProductUrls(products);
    setBulkAffiliateUrls(affiliates);
  }, []);

  const onBulkFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setBulkImportWarn(null);

      const name = file.name.toLowerCase();
      const isCsv = name.endsWith(".csv") || file.type === "text/csv";
      const isTxt = name.endsWith(".txt") || name.endsWith(".tsv") || file.type === "text/plain";

      if (isCsv) {
        Papa.parse(file, {
          complete: (results) => {
            const rows = (results.data as unknown[][]).map((row) =>
              (Array.isArray(row) ? row : []).map((c) => String(c ?? ""))
            );
            applyBulkPairs(parseBulkCsvRows(rows));
          },
          error: (err) => {
            setBulkImportWarn(`Erro ao ler CSV: ${err.message}`);
          },
          skipEmptyLines: "greedy",
        });
      } else if (isTxt) {
        const reader = new FileReader();
        reader.onload = () => {
          const text = String(reader.result ?? "");
          applyBulkPairs(parseBulkNotepadContent(text));
        };
        reader.onerror = () =>
          setBulkImportWarn("Não foi possível ler o arquivo.");
        reader.readAsText(file, "UTF-8");
      } else {
        setBulkImportWarn("Use um arquivo .csv (planilha) ou .txt / .tsv (bloco de notas).");
      }
    },
    [applyBulkPairs]
  );

  const bulkProductLines = useMemo(() => linesFromTextarea(bulkProductUrls), [bulkProductUrls]);
  const bulkAffiliateLines = useMemo(() => linesFromTextarea(bulkAffiliateUrls), [bulkAffiliateUrls]);
  const bulkPairMatch =
    bulkProductLines.length > 0 &&
    bulkAffiliateLines.length > 0 &&
    bulkProductLines.length === bulkAffiliateLines.length;

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

  const loadMlHistory = useCallback(async (page: number, search?: string) => {
    setMlHistoryLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(ML_HISTORY_PAGE_SIZE) });
      if (search?.trim()) params.set("search", search.trim());
      const res = await fetch(`/api/amazon/link-history?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar histórico");
      setMlHistory(Array.isArray(json.data) ? json.data : []);
      setMlHistoryTotal(Number(json.total) ?? 0);
      setMlHistoryTotalPages(Math.max(1, Number(json.totalPages) ?? 1));
      setMlHistoryPage(Number(json.page) ?? 1);
    } catch {
      setMlHistory([]);
    } finally {
      setMlHistoryLoading(false);
    }
  }, []);

  const loadLinksInMlOfferList = useCallback(async () => {
    try {
      const res = await fetch("/api/amazon/minha-lista-ofertas");
      const json = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(json?.data) ? json.data : [];
      setLinksInMlOfferList(
        new Set(list.map((o: { converterLink?: string }) => (o.converterLink ?? "").trim()).filter(Boolean)),
      );
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMlHistorySearchDebounced(mlHistorySearch), 300);
    return () => clearTimeout(t);
  }, [mlHistorySearch]);

  useEffect(() => {
    setMlHistoryPage(1);
  }, [mlHistorySearchDebounced]);

  useEffect(() => {
    void loadMlHistory(mlHistoryPage, mlHistorySearchDebounced);
  }, [mlHistoryPage, mlHistorySearchDebounced, loadMlHistory]);

  useEffect(() => {
    void loadLinksInMlOfferList();
  }, [loadLinksInMlOfferList]);

  const mlSearchResultsVisible = useMemo(
    () => mlSearchResults.filter((p) => !isMlAnuncioPlaceholderTitle(p.productName)),
    [mlSearchResults],
  );

  const mlSearchTotalPages = Math.max(1, Math.ceil(mlSearchResultsVisible.length / ML_SEARCH_PAGE_SIZE));
  const pagedMlSearchResults = useMemo(() => {
    const from = (mlSearchPage - 1) * ML_SEARCH_PAGE_SIZE;
    return mlSearchResultsVisible.slice(from, from + ML_SEARCH_PAGE_SIZE);
  }, [mlSearchResultsVisible, mlSearchPage]);

  useEffect(() => {
    setMlSearchPage(1);
  }, [mlSearchResults]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(mlSearchResultsVisible.length / ML_SEARCH_PAGE_SIZE));
    setMlSearchPage((p) => Math.min(p, tp));
  }, [mlSearchResultsVisible.length]);

  const mlGoldenSimilarTotalPages = Math.max(1, Math.ceil(mlSimilarProducts.length / ML_SIMILAR_PAGE_SIZE));
  const pagedMlGoldenSimilar = useMemo(() => {
    const from = (mlGoldenSimilarPage - 1) * ML_SIMILAR_PAGE_SIZE;
    return mlSimilarProducts.slice(from, from + ML_SIMILAR_PAGE_SIZE);
  }, [mlSimilarProducts, mlGoldenSimilarPage]);

  useEffect(() => {
    setMlGoldenSimilarPage(1);
  }, [selectedMlProduct?.itemId, selectedMlProduct?.productLink]);

  const goProdutoOnMobile = useCallback(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(max-width: 1023px)").matches) setMobileTab("produto");
  }, []);

  const runMlSearchFromString = useCallback(
    async (rawInput: string) => {
      const raw = rawInput.trim();
      if (!raw) {
        setMlSearchResults([]);
        setMlListSourceLabel(null);
        return;
      }
      if (!amazonSessionToken.trim()) return;

      const seq = ++mlSearchSeq.current;
      setMlSearchLoading(true);
    setError(null);
      setSelectedMlProduct(null);
      setMlSearchFocusMode(false);
      setMlSimilarProducts([]);
      setMlListSourceLabel(null);
      try {
        if (looksLikeAmazonProductUrl(raw) || extractAsinFromUrl(raw)) {
          const res = await fetch("/api/amazon/resolve-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productUrl: raw, ...mlSessionBody }),
          });
          const j = await res.json();
          if (!res.ok) throw new Error(j?.error ?? "Não foi possível abrir este anúncio.");
          const d = j.data as Record<string, unknown>;
          const permalink = String(d.permalink ?? "").trim() || raw;
          if (seq !== mlSearchSeq.current) return;
          setMlSearchResults([
            {
              itemId: String(d.resolvedId ?? "").trim() || "—",
              productName: String(d.productName ?? "Produto"),
              productLink: permalink,
              imageUrl: String(d.imageUrl ?? ""),
              price: d.pricePromo != null ? Number(d.pricePromo) : null,
              priceOriginal: d.priceOriginal != null ? Number(d.priceOriginal) : null,
              discountRate: d.discountRate != null ? Number(d.discountRate) : null,
              currencyId: String(d.currencyId ?? "BRL") || "BRL",
            },
          ]);
          goProdutoOnMobile();
          return;
        }
        const res = await fetch("/api/amazon/product-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            q: raw,
            limit: 30,
            onlyDeals,
            amazonSessionToken: amazonSessionToken.trim(),
          }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? "Erro na busca");
        if (seq !== mlSearchSeq.current) return;
        const list = Array.isArray(j.products) ? j.products : [];
        setMlSearchResults(list);
        if (list.length === 0 && typeof j.message === "string" && j.message.trim()) {
          setError(j.message.trim());
        }
        goProdutoOnMobile();
      } catch (e) {
        if (seq === mlSearchSeq.current) {
          setMlSearchResults([]);
          setError(e instanceof Error ? e.message : "Erro na busca");
        }
      } finally {
        if (seq === mlSearchSeq.current) setMlSearchLoading(false);
      }
    },
    [amazonSessionToken, mlSessionBody, goProdutoOnMobile, onlyDeals],
  );

  const handleMlSearch = useCallback(() => {
    const raw = mlSearchQuery.trim();
    if (!raw) {
      setError("Digite o nome do produto ou cole a URL do anúncio.");
      return;
    }
    if (!amazonSessionToken.trim()) {
      setError("Configure o token da extensão em Minha Conta → Amazon Afiliados.");
      return;
    }
    void runMlSearchFromString(mlSearchQuery);
  }, [mlSearchQuery, amazonSessionToken, runMlSearchFromString]);

  // Re-dispara a busca quando o toggle "Só ofertas" muda (com query ativa).
  useEffect(() => {
    const q = mlSearchQuery.trim();
    if (!q) return;
    if (!amazonSessionToken.trim()) return;
    const id = setTimeout(() => {
      void runMlSearchFromString(mlSearchQuery);
    }, 450);
    return () => clearTimeout(id);
  }, [mlSearchQuery, amazonSessionToken, runMlSearchFromString]);

  useEffect(() => {
    if (mlSearchQuery.trim()) return;
    mlSearchSeq.current += 1;
    setMlSearchResults([]);
    setMlListSourceLabel(null);
    setSelectedMlProduct(null);
    setMlSearchFocusMode(false);
    setMlSimilarProducts([]);
    setMlSearchLoading(false);
  }, [mlSearchQuery]);

  const handleMlCategorySearch = useCallback(
    async (slug: string, label: string) => {
      setCategoryPickerOpen(false);
      setCategoryPickerQuery("");
      if (!amazonSessionToken.trim()) {
        setError("Configure o token da extensão em Minha Conta → Amazon Afiliados.");
        return;
      }
      const seq = ++mlSearchSeq.current;
      setMlSearchLoading(true);
      setError(null);
      setSelectedMlProduct(null);
      setMlSearchFocusMode(false);
      setMlSimilarProducts([]);
      setMlListSourceLabel(label);
      try {
        const res = await fetch("/api/amazon/product-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categoria: slug, limit: 30, amazonSessionToken: amazonSessionToken.trim() }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(j?.error ?? "Erro na busca");
        if (seq !== mlSearchSeq.current) return;
        const list = Array.isArray(j.products) ? j.products : [];
        setMlSearchResults(list);
        if (list.length === 0 && typeof j.message === "string" && j.message.trim()) {
          setError(j.message.trim());
        }
        goProdutoOnMobile();
      } catch (e) {
        if (seq === mlSearchSeq.current) {
          setMlSearchResults([]);
          setMlListSourceLabel(null);
          setError(e instanceof Error ? e.message : "Erro na busca");
        }
      } finally {
        if (seq === mlSearchSeq.current) setMlSearchLoading(false);
      }
    },
    [amazonSessionToken, goProdutoOnMobile],
  );

  const confirmCategoryPicker = useCallback(() => {
    if (!categoryDraftSlug || mlSearchLoading) return;
    const opt = ML_LISTA_CATEGORY_OPTIONS.find((o) => o.slug === categoryDraftSlug);
    if (!opt) return;
    void handleMlCategorySearch(opt.slug, opt.label);
  }, [categoryDraftSlug, mlSearchLoading, handleMlCategorySearch]);

  const resetMlMainPanel = useCallback(() => {
    setMlSearchQuery("");
  }, []);

  const canMlConvert = !!selectedMlProduct && !!amazonSessionToken.trim() && !!mlAffiliateTag.trim();

  const handleMlProductSelect = useCallback(
    async (p: MlSiteSearchProduct) => {
      setSelectedMlProduct(p);
      setMlSearchFocusMode(true);
      setMlGoldenSimilarPage(1);
      const token = amazonSessionToken.trim();
      if (!token) {
        setMlSimilarProducts([]);
        return;
      }
      const q = mlSimilarSearchQueryFromProductName(p.productName);
      if (!q || q.length < 2) {
        setMlSimilarProducts([]);
        return;
      }
      setMlSimilarLoading(true);
      setMlSimilarProducts([]);
      try {
        const res = await fetch("/api/amazon/product-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, limit: 24, amazonSessionToken: token }),
        });
        const j = await res.json();
        if (!res.ok) throw new Error(typeof j?.error === "string" ? j.error : "");
        const list = (Array.isArray(j.products) ? j.products : []) as MlSiteSearchProduct[];
        const norm = (x: MlSiteSearchProduct) =>
          `${x.itemId}-${(x.productLink || "").split("#")[0].split("?")[0].toLowerCase()}`;
        const cur = norm(p);
        setMlSimilarProducts(list.filter((x) => norm(x) !== cur).slice(0, 20));
      } catch {
        setMlSimilarProducts([]);
      } finally {
        setMlSimilarLoading(false);
      }
    },
    [amazonSessionToken],
  );

  const handleMlConvertAndHistory = useCallback(async () => {
    if (!selectedMlProduct) return;
    if (!amazonSessionToken.trim()) {
      setError("Configure o token em Minha Conta → Amazon Afiliados.");
      return;
    }
    const tag = mlAffiliateTag.trim();
    if (!tag) {
      setError("Configure a etiqueta em uso em Minha Conta → Amazon Afiliados (a mesma do linkbuilder).");
      return;
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(tag)) {
      setError("Etiqueta inválida: use só letras, números, _ ou - (ex.: cake9265169).");
      return;
    }
    setMlConvertLoading(true);
    setError(null);
    try {
      const gen = await fetch("/api/amazon/generate-affiliate-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amazonSessionToken: amazonSessionToken.trim(),
          affiliateTag: tag,
          productPageUrl: selectedMlProduct.productLink,
        }),
      });
      const gj = await gen.json();
      if (!gen.ok) throw new Error(gj?.error ?? "Erro ao gerar amazon.com.br");

      const shortLink = String(gj?.shortLink ?? "").trim();
      const hist = await fetch("/api/amazon/link-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shortLink,
          originUrl: selectedMlProduct.productLink,
          productName: selectedMlProduct.productName,
          imageUrl: selectedMlProduct.imageUrl,
          itemId: selectedMlProduct.itemId,
          pricePromo: selectedMlProduct.price,
          priceOriginal: selectedMlProduct.priceOriginal,
          discountRate: selectedMlProduct.discountRate,
          couponPercent: selectedMlProduct.couponPercent ?? null,
          couponAmount: selectedMlProduct.couponAmount ?? null,
          affiliateCommissionPct: selectedMlProduct.affiliateCommissionPct ?? null,
        }),
      });
      const hj = await hist.json();
      if (!hist.ok) throw new Error(hj?.error ?? "Erro ao salvar no histórico");

      setSelectedMlProduct(null);
      setMobileTab("historico");
      setMlHistoryPage(1);
      await loadMlHistory(1, mlHistorySearchDebounced);
      void loadLinksInMlOfferList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao converter");
    } finally {
      setMlConvertLoading(false);
    }
  }, [
    selectedMlProduct,
    amazonSessionToken,
    mlAffiliateTag,
    loadMlHistory,
    mlHistorySearchDebounced,
    loadLinksInMlOfferList,
  ]);

  const handleDeleteMlHistory = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/amazon/link-history?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Erro ao excluir");
        setSelectedMlHistoryMap((prev) => {
          if (!prev[id]) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
        await loadMlHistory(mlHistoryPage, mlHistorySearchDebounced);
      } catch {
        /* ignore */
      }
    },
    [mlHistoryPage, mlHistorySearchDebounced, loadMlHistory],
  );

  const openMlAddToListModal = useCallback((entries: MlHistoryEntry[]) => {
    if (entries.length === 0) return;
    setMlAddToListModal({ open: true, entries });
    setMlHistModalListaId(null);
    setMlHistModalNovaLista("");
  }, []);

  const closeMlAddToListModal = useCallback(() => {
    setMlAddToListModal({ open: false, entries: [] });
    setMlHistModalListaId(null);
    setMlHistModalNovaLista("");
  }, []);

  const toggleMlHistorySelect = useCallback((h: MlHistoryEntry) => {
    setSelectedMlHistoryMap((prev) => {
      const next = { ...prev };
      if (next[h.id]) delete next[h.id];
      else next[h.id] = h;
      return next;
    });
  }, []);

  const allMlHistoryIds = mlHistory.map((h) => h.id);
  const selectedMlHistoryCount = Object.keys(selectedMlHistoryMap).length;
  const allMlHistorySelected =
    allMlHistoryIds.length > 0 && allMlHistoryIds.every((id) => Boolean(selectedMlHistoryMap[id]));
  const someMlHistorySelected = selectedMlHistoryCount > 0;

  const toggleAllMlHistory = useCallback(() => {
    setSelectedMlHistoryMap((prev) => {
      const next = { ...prev };
      if (allMlHistorySelected) {
        allMlHistoryIds.forEach((id) => {
          delete next[id];
        });
      } else {
        mlHistory.forEach((h) => {
          next[h.id] = h;
        });
      }
      return next;
    });
  }, [allMlHistoryIds, allMlHistorySelected, mlHistory]);

  const confirmMlAddToList = useCallback(async () => {
    const entries = mlAddToListModal.entries;
    if (!entries.length) return;
    if (!mlHistModalListaId && !mlHistModalNovaLista.trim()) {
      setMlAddToListFeedback("Selecione uma lista ou crie uma nova.");
      return;
    }
    setMlAddToListLoading(true);
    setMlAddToListFeedback(null);
    try {
      let targetListaId = mlHistModalListaId;
      if (!targetListaId && mlHistModalNovaLista.trim()) {
        const createRes = await fetch("/api/amazon/minha-lista-ofertas/listas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome: mlHistModalNovaLista.trim() }),
        });
        const createJson = await createRes.json();
        if (!createRes.ok) throw new Error(createJson?.error ?? "Erro ao criar lista");
        targetListaId = createJson?.data?.id ?? null;
        await loadListas();
      }
      if (!targetListaId) throw new Error("Selecione ou crie uma lista.");

      let added = 0;
      for (const entry of entries) {
        const res = await fetch("/api/amazon/minha-lista-ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listaId: targetListaId,
            converterLink: entry.shortLink,
            productPageUrl: entry.originUrl,
            productName: entry.productName,
            imageUrl: entry.imageUrl,
            priceOriginal: entry.priceOriginal,
            pricePromo: entry.pricePromo,
            discountRate: entry.discountRate,
            couponPercent: entry.couponPercent,
            couponAmount: entry.couponAmount,
            affiliateCommissionPct: entry.affiliateCommissionPct,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? "Erro ao adicionar");
        }
        setLinksInMlOfferList((prev) => new Set(prev).add(entry.shortLink));
        added++;
      }
      setMlAddToListModal({ open: false, entries: [] });
      setSelectedMlHistoryMap((prev) => {
        const next = { ...prev };
        entries.forEach((e) => {
          delete next[e.id];
        });
        return next;
      });
      setMlAddToListFeedback(added === 1 ? "Adicionado à lista!" : `${added} produtos adicionados!`);
      setTimeout(() => setMlAddToListFeedback(null), 3000);
    } catch (e) {
      setMlAddToListFeedback(e instanceof Error ? e.message : "Erro ao adicionar");
    } finally {
      setMlAddToListLoading(false);
    }
  }, [mlAddToListModal.entries, mlHistModalListaId, mlHistModalNovaLista, loadListas]);

  useEffect(() => {
    setError(null);
    void loadListas();
  }, [loadListas]);

  useEffect(() => {
    if (listas.length > 0 && !addListaId) setAddListaId(listas[0].id);
  }, [listas, addListaId]);

  const closeCategoryPicker = useCallback(() => {
    setCategoryPickerOpen(false);
    setCategoryPickerQuery("");
  }, []);

  useEffect(() => {
    const anyOpen =
      listasMenuModalOpen ||
      selecionarListaModalOpen ||
      criarListaModalOpen ||
      mlAddToListModal.open ||
      categoryPickerOpen;
    if (!anyOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (mlAddToListModal.open && !mlAddToListLoading) {
        setMlAddToListModal({ open: false, entries: [] });
        setMlHistModalListaId(null);
        setMlHistModalNovaLista("");
      } else if (criarListaModalOpen && !criandoLista && !bulkSaving) setCriarListaModalOpen(false);
      else if (selecionarListaModalOpen) setSelecionarListaModalOpen(false);
      else if (categoryPickerOpen && !mlSearchLoading) closeCategoryPicker();
      else if (listasMenuModalOpen) setListasMenuModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [
    listasMenuModalOpen,
    selecionarListaModalOpen,
    criarListaModalOpen,
    criandoLista,
    bulkSaving,
    mlAddToListModal.open,
    mlAddToListLoading,
    categoryPickerOpen,
    mlSearchLoading,
    closeCategoryPicker,
  ]);

  useEffect(() => {
    if (!bulkSaving) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [bulkSaving]);

  const selectedLista = useMemo(() => listas.find((l) => l.id === addListaId), [listas, addListaId]);

  const listasFiltradasPicker = useMemo(() => {
    const q = listaPickerQuery.trim().toLowerCase();
    if (!q) return listas;
    return listas.filter((l) => l.nome.toLowerCase().includes(q));
  }, [listas, listaPickerQuery]);

  const categoriasFiltradasPicker = useMemo(() => {
    const q = normalizeMlModalSearch(categoryPickerQuery);
    if (!q) return ML_LISTA_CATEGORY_OPTIONS;
    return ML_LISTA_CATEGORY_OPTIONS.filter((c) => {
      const label = normalizeMlModalSearch(c.label);
      const slug = c.slug.toLowerCase();
      return label.includes(q) || slug.includes(q);
    });
  }, [categoryPickerQuery]);

  const resolveRowMeta = useCallback(async (
    row: { productUrl: string | null; affiliateUrl: string },
  ): Promise<{ nome: string; img: string; po: number | null; pp: number | null; dr: number | null }> => {
    let nome = "";
    let img = "";
    let po: number | null = null;
    let pp: number | null = null;
    let dr: number | null = null;
    const apply = (d: Record<string, unknown> | undefined) => {
      if (!d) return;
      if (d.productName) nome = String(d.productName);
      if (d.imageUrl) img = String(d.imageUrl);
      if (d.priceOriginal != null) po = Number(d.priceOriginal);
      if (d.pricePromo != null) pp = Number(d.pricePromo);
      if (d.discountRate != null) dr = Number(d.discountRate);
    };
    const callResolve = async (body: Record<string, string>) => {
      const resMeta = await fetch("/api/amazon/resolve-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, ...mlSessionBody }),
      });
      const jsonMeta = await resMeta.json();
      if (resMeta.ok && jsonMeta?.data) apply(jsonMeta.data as Record<string, unknown>);
    };
    const p = row.productUrl?.trim() ?? "";
    const a = row.affiliateUrl?.trim() ?? "";
    try {
      if (p && (looksLikeAmazonProductUrl(p) || !!extractAsinFromUrl(p))) {
        await callResolve({ productUrl: p });
      }
      if (!nome && a && (looksLikeAmazonProductUrl(a) || !!extractAsinFromUrl(a))) {
        await callResolve({ productUrl: a });
      }
      /* Igual a “Um produto por vez”: amazon.com.br resolve no servidor com affiliateUrl (expand do redirect). */
      if ((!nome.trim() || !img.trim()) && isMeliLaShort(a)) {
        await callResolve({ affiliateUrl: a });
      }
      if ((!nome.trim() || !img.trim()) && isMeliLaShort(p)) {
        await callResolve({ affiliateUrl: p });
      }
    } catch {
      /* mantém fallback de nome abaixo */
    }
    return { nome, img, po, pp, dr };
  }, [mlSessionBody]);

  const runBulkRows = useCallback(
    async (listaIdTarget: string, rows: { productUrl: string; affiliateUrl: string }[]) => {
      for (let i = 0; i < rows.length; i++) {
        const { productUrl: pUrl, affiliateUrl: aff } = rows[i];
        const metaRow = await resolveRowMeta(rows[i]);
        let nome = metaRow.nome;
        const img = metaRow.img;
        const po = metaRow.po;
        let pp = metaRow.pp;
        const dr = metaRow.dr;
        if (!nome && pUrl) nome = fallbackNameFromProductUrl(pUrl, i);
        if (!nome) nome = `Produto (linha ${i + 1})`;
        const adj = effectiveListaOfferPromoPrice(po, pp, dr);
        if (adj != null) pp = adj;
        const res = await fetch("/api/amazon/minha-lista-ofertas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listaId: listaIdTarget,
            converterLink: aff,
            productPageUrl: pUrl.trim(),
            productName: nome,
            imageUrl: img,
            priceOriginal: po != null && Number.isFinite(po) ? po : null,
            pricePromo: pp != null && Number.isFinite(pp) ? pp : null,
            discountRate: dr != null && Number.isFinite(dr) ? dr : null,
          }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? `Falha na linha ${i + 1} (${nome.slice(0, 36)}…).`);
        }
        setBulkProgress({ done: i + 1, total: rows.length });
      }
      await loadListas();
      setBulkProductUrls("");
      setBulkAffiliateUrls("");
      setBulkProgress(null);
      void loadLinksInMlOfferList();
    },
    [resolveRowMeta, loadListas, loadLinksInMlOfferList],
  );

  const openCriarListaFromMenu = () => {
    setListasMenuModalOpen(false);
    setCriarListaModalPurpose("menu");
    setNomeListaCriar("");
    setCriarListaModalOpen(true);
  };

  const openOndeSalvarFromMenu = () => {
    setListasMenuModalOpen(false);
    setListaPickerQuery("");
    setListaPickerDraftId(addListaId || listas[0]?.id || "");
    setSelecionarListaModalOpen(true);
  };

  const confirmListaPicker = () => {
    if (listaPickerDraftId) setAddListaId(listaPickerDraftId);
    setSelecionarListaModalOpen(false);
    setListaPickerQuery("");
  };

  const closeListaPicker = () => {
    setSelecionarListaModalOpen(false);
    setListaPickerQuery("");
  };

  const submitCriarListaModal = async () => {
    const purpose = criarListaModalPurpose;
    const nomeDefault =
      purpose === "bulkNewList" ? `Lista ML ${new Date().toLocaleDateString("pt-BR")}` : "Nova lista ML";
    const nome = nomeListaCriar.trim() || nomeDefault;
    setCriandoLista(true);
    setError(null);
    try {
      if (purpose === "bulkNewList") {
        const products = linesFromTextarea(bulkProductUrls);
        const affiliates = linesFromTextarea(bulkAffiliateUrls);
        if (products.length === 0) {
          setError("Cole pelo menos uma URL de produto antes de criar a lista e importar.");
          return;
        }
        if (products.length !== affiliates.length) {
          setError(
            `As duas caixas precisam ter o mesmo número de linhas. Produtos: ${products.length}, afiliados: ${affiliates.length}.`,
          );
          return;
        }
        if (products.length > MAX_BULK_PAIRS) {
          setError(`Máximo de ${MAX_BULK_PAIRS} linhas por vez.`);
          return;
        }
      }

      const res = await fetch("/api/amazon/minha-lista-ofertas/listas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar lista");
      const row = json.data;
      if (!row?.id) throw new Error("Lista criada sem identificador.");

      setListas((prev) => [{ id: row.id, nome: row.nome, totalItens: 0, createdAt: row.createdAt }, ...prev]);
      setAddListaId(row.id);
      setCriarListaModalOpen(false);
      setNomeListaCriar("");

      if (purpose === "bulkNewList") {
        const products = linesFromTextarea(bulkProductUrls);
        const affiliates = linesFromTextarea(bulkAffiliateUrls);
        const rows = products.map((productUrl, i) => ({ productUrl, affiliateUrl: affiliates[i] }));
        setBulkSaving(true);
        setBulkProgress({ done: 0, total: rows.length });
        setError(null);
        try {
          await runBulkRows(row.id, rows);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Erro ao salvar em lote");
          setBulkProgress(null);
        } finally {
          setBulkSaving(false);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar lista");
    } finally {
      setCriandoLista(false);
    }
  };

  const runBulkSaveSelected = async () => {
    const products = linesFromTextarea(bulkProductUrls);
    const affiliates = linesFromTextarea(bulkAffiliateUrls);
    if (products.length === 0) {
      setError("Cole pelo menos uma URL de página de produto do Amazon (uma por linha).");
      return;
    }
    if (products.length !== affiliates.length) {
      setError(
        `As duas caixas precisam ter o mesmo número de linhas. Produtos: ${products.length}, links de afiliado: ${affiliates.length}.`,
      );
      return;
    }
    const rows = products.map((productUrl, i) => ({ productUrl, affiliateUrl: affiliates[i] }));
    if (rows.length > MAX_BULK_PAIRS) {
      setError(`Máximo de ${MAX_BULK_PAIRS} linhas por vez. Faça em duas etapas.`);
      return;
    }
    if (!addListaId) {
      setError("Escolha uma lista em Configurar → Onde salvar.");
      return;
    }

    setBulkSaving(true);
    setBulkProgress({ done: 0, total: rows.length });
    setError(null);
    try {
      await runBulkRows(addListaId, rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar em lote");
      setBulkProgress(null);
    } finally {
      setBulkSaving(false);
    }
  };

  const openBulkNewListModal = () => {
    const products = linesFromTextarea(bulkProductUrls);
    const affiliates = linesFromTextarea(bulkAffiliateUrls);
    if (products.length === 0) {
      setError("Cole pelo menos uma URL de produto antes de criar lista e importar.");
      return;
    }
    if (products.length !== affiliates.length) {
      setError(
        `As duas caixas precisam ter o mesmo número de linhas. Produtos: ${products.length}, afiliados: ${affiliates.length}.`,
      );
      return;
    }
    if (products.length > MAX_BULK_PAIRS) {
      setError(`Máximo de ${MAX_BULK_PAIRS} linhas por vez.`);
      return;
    }
    setError(null);
    setCriarListaModalPurpose("bulkNewList");
    setNomeListaCriar("");
    setCriarListaModalOpen(true);
  };

  const handleAdicionarItem = async () => {
    if (!addListaId) {
      setError("Escolha uma lista em Configurar → Onde salvar.");
      return;
    }
    const linkAfiliado = affiliateLink.trim();
    if (!linkAfiliado) {
      setError("Cole o link de afiliado (amazon.com.br) gerado no programa de afiliados do Amazon.");
      return;
    }

    const pTrim = productUrl.trim();
    const urlProduto =
      (pTrim && (looksLikeAmazonProductUrl(pTrim) || !!extractAsinFromUrl(pTrim)) ? pTrim : "") ||
      (linkAfiliado && (looksLikeAmazonProductUrl(linkAfiliado) || !!extractAsinFromUrl(linkAfiliado))
        ? linkAfiliado
        : "");

    setSalvandoItem(true);
    setError(null);

    let nome = "";
    let img = "";
    let po: number | null = null;
    let pp: number | null = null;
    let dr: number | null = null;

    const aplicarMeta = (d: Record<string, unknown> | undefined) => {
      if (!d) return;
      if (d.productName) nome = String(d.productName);
      if (d.imageUrl) img = String(d.imageUrl);
      if (d.priceOriginal != null) po = Number(d.priceOriginal);
      if (d.pricePromo != null) pp = Number(d.pricePromo);
      if (d.discountRate != null) dr = Number(d.discountRate);
    };

    try {
      if (urlProduto) {
        const resMeta = await fetch("/api/amazon/resolve-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productUrl: urlProduto, ...mlSessionBody }),
        });
        const jsonMeta = await resMeta.json();
        if (!resMeta.ok) {
          throw new Error(
            jsonMeta?.error ??
              "Não foi possível buscar o anúncio. Confira a URL (MLB) ou o link amazon.com.br.",
          );
        }
        aplicarMeta(jsonMeta.data as Record<string, unknown>);
      } else if (isMeliLaShort(linkAfiliado)) {
        const resMeta = await fetch("/api/amazon/resolve-item", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ affiliateUrl: linkAfiliado, ...mlSessionBody }),
        });
        const jsonMeta = await resMeta.json();
        if (!resMeta.ok) {
          throw new Error(
            jsonMeta?.error ??
              "Não foi possível abrir o link amazon.com.br. Cole a URL da página do produto ou confira o link.",
          );
        }
        aplicarMeta(jsonMeta.data as Record<string, unknown>);
      } else {
        throw new Error(
          "Cole a URL da página do produto (com MLB) ou use um link amazon.com.br para buscar nome, foto e preços automaticamente.",
        );
      }

      const userDrRaw = discountRate.trim();
      if (userDrRaw) {
        const u = Number(userDrRaw.replace(",", "."));
        if (Number.isFinite(u) && u > 0) dr = u;
      }

      if (!nome) {
        nome = urlProduto ? fallbackNameFromProductUrl(urlProduto, 0) : "Produto";
      }

      const promoAjustado = effectiveListaOfferPromoPrice(po, pp, dr);
      if (promoAjustado != null) pp = promoAjustado;

      const res = await fetch("/api/amazon/minha-lista-ofertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listaId: addListaId,
          converterLink: linkAfiliado,
          productPageUrl: urlProduto.trim(),
          productName: nome,
          imageUrl: img,
          priceOriginal: po != null && Number.isFinite(po) ? po : null,
          pricePromo: pp != null && Number.isFinite(pp) ? pp : null,
          discountRate: dr != null && Number.isFinite(dr) ? dr : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao salvar");
      await loadListas();
      setAffiliateLink("");
      setProductUrl("");
      setDiscountRate("");
      void loadLinksInMlOfferList();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvandoItem(false);
    }
  };

  if (AMAZON_UX_COMING_SOON) {
    return (
      <div className="min-h-[calc(100vh-8rem)] bg-dark-bg text-text-primary flex flex-col items-center justify-center p-4 md:p-8">
        <MlEmBreveSplash showBack />
      </div>
    );
  }

  return (
    <div className="bg-[#1c1c1f] border border-[#2c2c32] text-[#f0f0f2] flex flex-col rounded-xl overflow-hidden overflow-x-hidden w-full max-w-[100vw]">
      <GeradorShellScrollbarStyle />

      <header className="sticky top-0 z-30 h-12 bg-[#27272a] flex items-center justify-between px-3 sm:px-4 border-b border-[#2c2c32] gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link
            href="/dashboard/grupos-venda"
            className="w-8 h-8 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center text-[#a0a0a0] hover:text-[#e24c30] hover:border-[#e24c30]/35 shrink-0"
            title="Grupos de Venda"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-8 h-8 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/30 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="/amazonlogo.webp" alt="" className="w-6 h-6 object-contain" />
          </div>
          <div className="min-w-0">
            <span className="text-[13px] sm:text-sm font-bold tracking-tight text-[#f0f0f2] truncate block">
              Lista de Ofertas Amazon
            </span>
        </div>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[9px] sm:text-[10px] font-bold shrink-0",
            amazonSessionToken.trim() && mlAffiliateTag.trim()
              ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/25"
              : "text-amber-400 bg-amber-500/10 border-amber-500/25",
          )}
        >
          <CheckCircle2 className="w-3 h-3" />
          <span className="hidden min-[360px]:inline">
            {amazonSessionToken.trim() && mlAffiliateTag.trim()
              ? "Token conectado"
              : !amazonSessionToken.trim() && !mlAffiliateTag.trim()
                ? "Amazon não configurada"
                : !amazonSessionToken.trim()
                  ? "Sem token Amazon"
                  : "Sem etiqueta"}
          </span>
          <span className="min-[360px]:hidden">Amazon</span>
        </div>
      </header>

      {(!amazonSessionToken.trim() || !mlAffiliateTag.trim()) && (
        <div className="px-3 sm:px-4 py-3 border-b border-amber-500/35 bg-amber-950/35 text-[11px] text-amber-100/95 leading-relaxed flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 light:border-orange-200/80 light:bg-orange-100/70 light:text-amber-950">
          <p className="min-w-0">
            Instale a extensão do Afiliado Analytics e salve a <span className="font-semibold">etiqueta</span> e o{" "}
            <span className="font-semibold">token</span> em Minha Conta para buscar e converter na Amazon.
          </p>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href="https://codenxt.online/extensao"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-amber-500/25 hover:bg-amber-500/35 border border-amber-400/40 px-3 py-1.5 text-[11px] font-semibold text-amber-50 no-underline transition light:bg-orange-200/90 light:hover:bg-orange-200 light:border-orange-300/70 light:text-amber-950"
            >
              Baixar extensão
            </a>
            <Link
              href="/configuracoes"
              className="inline-flex items-center justify-center rounded-lg bg-[#222228] hover:bg-[#2a2a30] border border-[#3e3e46] px-3 py-1.5 text-[11px] font-semibold text-[#f0f0f2] no-underline transition light:bg-white light:hover:bg-orange-50 light:border-orange-200/90 light:text-zinc-800"
            >
              Minha Conta
            </Link>
          </div>
        </div>
      )}

        {error && (
        <div className="px-3 sm:px-4 py-2.5 border-b border-[#2c2c32] bg-red-500/5 flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          <p className="text-[11px] text-red-400 flex-1">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[#a0a0a0] hover:text-white shrink-0"
            aria-label="Fechar aviso"
          >
            <X className="w-3 h-3" />
          </button>
          </div>
        )}

      <nav
        className="lg:hidden sticky top-12 z-20 border-b border-[#2c2c32] px-3 py-3 bg-[#1c1c1f] shadow-[0_4px_20px_rgba(0,0,0,0.25)]"
        aria-label="Seções da lista Amazon"
      >
        <div className="flex items-center justify-center w-full max-w-lg mx-auto px-2 py-1 gap-0">
          {ML_MOBILE_STEPS.map((step, idx) => {
            const active = mobileTab === step.id;
            return (
              <Fragment key={step.id}>
                {idx > 0 && (
                  <div
                    className="h-px flex-1 min-w-[8px] max-w-[40px] sm:max-w-[56px] mx-1 sm:mx-2 bg-[#2c2c32] self-center shrink"
                    aria-hidden
                  />
                )}
                <button
                  type="button"
                  onClick={() => setMobileTab(step.id)}
                  aria-current={active ? "step" : undefined}
                  className="shrink-0 rounded-full outline-none transition-transform active:scale-95 focus-visible:ring-2 focus-visible:ring-[#e24c30]/55 mx-1"
                >
                  <span
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold border-2 transition-all",
                      active
                        ? "bg-[#e24c30] border-[#e24c30] text-white shadow-[0_0_12px_rgba(226,76,48,0.4)]"
                        : "bg-[#1e1e24] border-[#35353d] text-[#8b8b96]",
                    )}
                  >
                    {idx + 1}
                  </span>
                </button>
              </Fragment>
            );
          })}
        </div>
        <p className="text-center text-[10px] text-[#9a9aa2] mt-2">
          {ML_MOBILE_STEPS.find((s) => s.id === mobileTab)?.label}
        </p>
      </nav>

      <div className="flex items-stretch border-b border-[#2c2c32]">
        <aside
          className={cn(
            "w-full lg:w-60 lg:shrink-0 border-r border-[#2c2c32] bg-[#27272a] flex flex-col min-w-0 min-h-0",
            mobileTab === "config" ? "flex" : "hidden lg:flex",
          )}
        >
          <ColHeader
            step={1}
            active
            label="Configurar Link"
            tooltip="Busca por link ou nome (atualiza sozinha ao digitar). Categorias pela lupa. Converter gera amazon.com.br e salva no histórico — etiqueta e token em Minha Conta."
          />
          <div className="p-4 flex flex-col gap-4">
            <FieldGroup
              label="Link ou nome do produto"
              tooltip="Cole a URL do anúncio ou digite o nome; a busca dispara automaticamente após uma pausa na digitação."
            >
              <div className="relative">
                <input
                  value={mlSearchQuery}
                  onChange={(e) => setMlSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleMlSearch();
                  }}
                  placeholder="Cole o link ou nome…"
                  spellCheck={false}
                  className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-xl px-3 py-2.5 pr-9 text-xs text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30]/50 outline-none transition"
                />
                {mlSearchLoading ? (
                  <Loader2
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-[#e24c30]/70"
                    aria-hidden
                  />
                ) : null}
              </div>
            </FieldGroup>

            <button
              type="button"
              role="switch"
              aria-checked={onlyDeals}
              onClick={() => setOnlyDeals((v) => !v)}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2 rounded-xl border transition text-left",
                onlyDeals
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-[#3e3e3e] bg-[#1c1c1f] hover:border-[#585858]",
              )}
              title="Quando ativo, mostra só produtos com cupom da Amazon ou preço com desconto."
            >
              <span
                className={cn(
                  "relative inline-flex shrink-0 h-4 w-7 rounded-full transition-colors",
                  onlyDeals ? "bg-amber-500/70" : "bg-[#3e3e3e]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white transition-transform",
                    onlyDeals ? "translate-x-3" : "translate-x-0",
                  )}
                />
              </span>
              <span className="flex-1 min-w-0">
                <span className={cn("block text-[9px] font-semibold", onlyDeals ? "text-amber-300" : "text-[#d2d2d2]")}>
                  Só com Cupom ou Desconto
                </span>
                
              </span>
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleMlSearch()}
                disabled={mlSearchLoading || !mlSearchQuery.trim() || !amazonSessionToken.trim()}
                className="flex w-full items-center justify-center gap-1.5 bg-[#1c1c1f] border border-[#3e3e3e] text-[#d2d2d2] rounded-xl py-2.5 text-[11px] font-semibold hover:text-[#f0f0f2] hover:border-[#585858] disabled:opacity-40 transition min-h-[42px]"
              >
                {mlSearchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                Buscar
              </button>
              <button
                type="button"
                onClick={() => void handleMlConvertAndHistory()}
                disabled={mlConvertLoading || !canMlConvert}
                title={
                  !selectedMlProduct
                    ? "Selecione um produto na área Produto."
                    : !amazonSessionToken.trim()
                      ? "Configure o token em Minha Conta."
                      : !mlAffiliateTag.trim()
                        ? "Configure a etiqueta em Minha Conta."
                        : undefined
                }
                className="hidden lg:flex w-full items-center justify-center gap-1.5 bg-[#e24c30] text-white rounded-xl py-2.5 text-[11px] font-semibold hover:bg-[#c94028] disabled:opacity-40 transition shadow-lg shadow-[#e24c30]/20 min-h-[42px]"
              >
                {mlConvertLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Converter
              </button>
            </div>

            <button
              type="button"
              onClick={() => void handleMlConvertAndHistory()}
              disabled={mlConvertLoading || !canMlConvert}
              title={
                !selectedMlProduct
                  ? "Selecione um produto na área Produto."
                  : !amazonSessionToken.trim()
                    ? "Configure o token em Minha Conta."
                    : !mlAffiliateTag.trim()
                      ? "Configure a etiqueta em Minha Conta."
                      : undefined
              }
              className="lg:hidden flex w-full items-center justify-center gap-1.5 bg-[#e24c30] text-white rounded-xl py-2.5 text-[11px] font-semibold hover:bg-[#c94028] disabled:opacity-40 transition shadow-lg shadow-[#e24c30]/20 min-h-[42px]"
            >
              {mlConvertLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Converter
            </button>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-[#2c2c32]" />
              <span className="text-[9px] text-[#888888] uppercase tracking-widest font-medium whitespace-nowrap">
                ou explore
              </span>
              <div className="flex-1 h-px bg-[#2c2c32]" />
            </div>

            <FieldGroup
              label="Categoria"
              tooltip="Abre um painel com categorias do Amazon; ao escolher uma, listamos produtos dessa categoria."
            >
              <button
                type="button"
                onClick={() => {
                  setCategoryPickerQuery("");
                  const match = ML_LISTA_CATEGORY_OPTIONS.find((o) => o.label === mlListSourceLabel);
                  setCategoryDraftSlug(match?.slug ?? null);
                  setCategoryPickerOpen(true);
                }}
                disabled={!amazonSessionToken.trim() || mlSearchLoading}
                title={!amazonSessionToken.trim() ? "Configure o token em Minha Conta." : undefined}
                className="flex w-full items-center justify-center gap-2 bg-[#1c1c1f] border border-[#3e3e3e] text-[#d2d2d2] rounded-xl py-2.5 px-3 text-[11px] font-semibold hover:text-[#f0f0f2] hover:border-[#585858] disabled:opacity-40 transition min-h-[42px]"
              >
                <Search className="w-3.5 h-3.5 text-[#e24c30]/90 shrink-0" aria-hidden />
                <span className="truncate">{mlListSourceLabel ?? "Escolher categoria"}</span>
              </button>
            </FieldGroup>

       
          </div>
        </aside>

        <main
          className={cn(
            "flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto bg-[#1c1c1f] w-full",
            mobileTab === "produto" ? "flex" : "hidden lg:flex",
          )}
        >
          <div className="z-10 lg:sticky lg:top-0 lg:z-20 bg-[#1c1c1f] w-full shrink-0">
            <ColHeader
              step={2}
              active={
                mlSearchLoading ||
                mlSearchResults.length > 0 ||
                !!selectedMlProduct ||
                mlSearchFocusMode
              }
              label={
                mlSearchResultsVisible.length > 0 && !(selectedMlProduct && mlSearchFocusMode)
                  ? "Resultados da Busca"
                  : "Produto"
              }
              tooltip={
                mlSearchResultsVisible.length > 0 && !(selectedMlProduct && mlSearchFocusMode)
                  ? "Resultados da pesquisa. Clique em um produto para selecioná-lo."
                  : "Resultados da busca ou da categoria. Toque em um item para ver ofertas semelhantes; use Converter na barra lateral."
              }
              right={
                mlSearchLoading ||
                mlSearchResults.length > 0 ||
                !!selectedMlProduct ||
                mlSearchFocusMode ? (
                  <IconBtn onClick={resetMlMainPanel} title="Limpar busca e seleção">
                    <X className="w-3 h-3" />
                  </IconBtn>
                ) : undefined
              }
            />
          </div>

          {mlSearchLoading && mlSearchResults.length === 0 && !selectedMlProduct && !mlSearchFocusMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 w-full min-w-0 min-h-[min(70vh,560px)] text-[#a0a0a0] text-sm">
              <Loader2 className="w-6 h-6 animate-spin text-[#e24c30] shrink-0" aria-hidden />
              <span>Buscando…</span>
            </div>
          ) : null}

          {!mlSearchLoading &&
          mlSearchResults.length === 0 &&
          !selectedMlProduct &&
          !mlSearchFocusMode ? (
            <div className="flex flex-col items-center px-4 pt-6 pb-8 sm:pt-8 sm:pb-10 w-full min-w-0">
              <div className="dash flex flex-col items-center justify-center py-8 sm:py-10 rounded-2xl w-full max-w-sm text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center mb-4">
                  <MousePointer2 className="w-7 h-7 text-[#e24c30]" />
                </div>
                <h3 className="text-base font-bold text-[#f0f0f2] mb-2">Pronto para começar!</h3>
                <p className="text-xs text-[#bebebe] leading-relaxed max-w-[200px]">
                  Cole um link ou nome na barra lateral, ou escolha uma categoria na lupa.
                </p>
              </div>
            </div>
          ) : null}

          {!mlSearchLoading &&
          mlSearchResults.length > 0 &&
          mlSearchResultsVisible.length === 0 &&
          !selectedMlProduct &&
          !mlSearchFocusMode ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-12 w-full min-w-0 min-h-[min(50vh,400px)] text-center">
              <p className="text-sm text-[#d2d2d2] max-w-xs">
                Nenhum resultado para exibir: ocultamos itens cujo título começa por Anúncio (placeholder do ML).
              </p>
            </div>
          ) : null}

          {(mlSearchResultsVisible.length > 0 ||
            (selectedMlProduct && mlSearchFocusMode) ||
            (selectedMlProduct && !mlSearchFocusMode)) ? (
            <>
          {!mlSearchLoading && selectedMlProduct && mlSearchFocusMode ? (
            <div className="p-4 sm:p-5 flex flex-col gap-5 w-full min-w-0">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[10px] text-[#9a9aa2]">Produto em destaque</p>
                {mlSearchResultsVisible.length > 0 ? (
              <button
                type="button"
                    onClick={() => setMlSearchFocusMode(false)}
                    className="text-[10px] font-semibold text-[#e24c30] hover:underline"
              >
                    Voltar aos {mlSearchResultsVisible.length} resultado(s)
              </button>
                ) : null}
              </div>
              <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-3 sm:p-4 flex gap-3 items-start w-full min-w-0">
                <div className="w-[76px] h-[76px] rounded-lg bg-white shrink-0 border border-[#2c2c32] overflow-hidden p-1 flex items-center justify-center">
                  {selectedMlProduct.imageUrl ? (
                    <img
                      src={selectedMlProduct.imageUrl}
                      alt=""
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <ImageIcon className="w-7 h-7 text-[#686868]" />
            )}
          </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-[#f0f0f2] leading-snug line-clamp-2">{selectedMlProduct.productName}</p>
                  <p className="text-[10px] text-[#a0a0a0] mt-1">Amazon · {selectedMlProduct.itemId}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    {selectedMlProduct.price != null ? (
                      <span className="text-[18px] font-bold text-[#e24c30] leading-none">
                        {formatCurrency(selectedMlProduct.price)}
                      </span>
                    ) : null}
                    {selectedMlProduct.priceOriginal != null &&
                    selectedMlProduct.price != null &&
                    selectedMlProduct.priceOriginal > selectedMlProduct.price ? (
                      <span className="text-[10px] text-[#9c9c9c] line-through">
                        {formatCurrency(selectedMlProduct.priceOriginal)}
                      </span>
                    ) : null}
                    {selectedMlProduct.discountRate != null && selectedMlProduct.discountRate > 0 ? (
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                        {fmtMlDisc(selectedMlProduct.discountRate)}
                      </span>
                    ) : null}
                    {selectedMlProduct.couponPercent != null && selectedMlProduct.couponPercent > 0 ? (
                      <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Cupom {Math.round(selectedMlProduct.couponPercent)}%
                      </span>
                    ) : selectedMlProduct.couponAmount != null && selectedMlProduct.couponAmount > 0 ? (
                      <span className="text-[9px] font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        Cupom {formatCurrency(selectedMlProduct.couponAmount)}
                      </span>
                    ) : null}
                    {selectedMlProduct.primeDiscountPercent != null && selectedMlProduct.primeDiscountPercent > 0 ? (
                      <span className="text-[9px] font-bold text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-md border border-sky-500/20">
                        Prime {Math.round(selectedMlProduct.primeDiscountPercent)}%
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {mlSimilarLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-[#a0a0a0] text-xs">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando ofertas semelhantes…
                </div>
              ) : null}

              {!mlSimilarLoading && mlSimilarProducts.length > 0 ? (
                <div className="pt-1 w-full min-w-0">
                  <h3 className="text-[11px] font-bold text-[#f0f0f2] uppercase tracking-widest">Ofertas semelhantes</h3>
                  <p className="text-[9px] text-[#9a9aa2] mt-0.5">Com base nas primeiras palavras do nome do produto.</p>
                  <div className="mt-3 w-full rounded-xl border border-[#2c2c32] bg-[#222228] p-3 flex flex-col gap-2 min-w-0">
                    {pagedMlGoldenSimilar.map((sp) => (
                      <MlOfferRowCard
                        key={`${sp.itemId}-${sp.productLink}`}
                        p={sp}
                        onPick={() => void handleMlProductSelect(sp)}
                        compact
                      />
                    ))}
                    {mlGoldenSimilarTotalPages > 1 ? (
                      <GeradorPaginationBar
                        className="pt-2 px-1 border-t border-[#2c2c32] mt-1"
                        page={mlGoldenSimilarPage}
                        totalPages={mlGoldenSimilarTotalPages}
                        summary={`Página ${mlGoldenSimilarPage} de ${mlGoldenSimilarTotalPages}`}
                        onPrev={() => setMlGoldenSimilarPage((x) => Math.max(1, x - 1))}
                        onNext={() => setMlGoldenSimilarPage((x) => Math.min(mlGoldenSimilarTotalPages, x + 1))}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
            </div>
          ) : null}

          {!mlSearchLoading && mlSearchResultsVisible.length > 0 && !(selectedMlProduct && mlSearchFocusMode) ? (
            <div className="px-4 pb-4 pt-0 flex flex-col gap-2 w-full min-w-0">
              <p className="text-[10px] text-[#a0a0a0] px-0.5 pt-1">
                {mlSearchResultsVisible.length} produto{mlSearchResultsVisible.length !== 1 ? "s" : ""} encontrado
                {mlSearchResultsVisible.length !== 1 ? "s" : ""} - clique para selecionar
              </p>
              {pagedMlSearchResults.map((p) => {
                const sel =
                  selectedMlProduct?.itemId === p.itemId && selectedMlProduct?.productLink === p.productLink;
                return (
                  <MlOfferRowCard
                    key={`${p.itemId}-${p.productLink}`}
                    p={p}
                    onPick={() => void handleMlProductSelect(p)}
                    selected={sel}
                  />
                );
              })}
              {mlSearchTotalPages > 1 ? (
                <GeradorPaginationBar
                  className="pt-2 px-1 border-t border-[#2c2c32] mt-1"
                  page={mlSearchPage}
                  totalPages={mlSearchTotalPages}
                  summary={`Página ${mlSearchPage} de ${mlSearchTotalPages}`}
                  onPrev={() => setMlSearchPage((x) => Math.max(1, x - 1))}
                  onNext={() => setMlSearchPage((x) => Math.min(mlSearchTotalPages, x + 1))}
                />
              ) : null}
            </div>
          ) : null}

            </>
            ) : null}

        <div className="hidden w-full min-w-0" aria-hidden>
        <section className={cn("rounded-xl border border-[#2c2c32] bg-[#222228] p-4 space-y-4", "hidden")}>
          <div className={mlSectionHeadClass}>
            <Columns2 className="h-3.5 w-3.5 text-[#e24c30]/80 shrink-0" />
            <h2 className={mlSectionTitleClass}>Colar em lote</h2>
            <Toolist
              variant="below"
              wide
              text={`Linha 1 do bloco de produtos alinha com linha 1 dos links amazon.com.br (como no gerador do ML). Máximo ${MAX_BULK_PAIRS} pares por vez.`}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 pt-1">
            <div className="min-w-0">
              <label className={mlFieldLabelClass}>URLs dos produtos</label>
              <textarea
                value={bulkProductUrls}
                onChange={(e) => {
                  setBulkImportWarn(null);
                  setBulkProductUrls(e.target.value);
                }}
                spellCheck={false}
                placeholder={
                  "https://produto.Amazon.com.br/MLB-…\nhttps://www.Amazon.com.br/…/p/MLB…"
                }
                className={gTa}
              />
            </div>
            <div className="min-w-0">
              <label className={mlFieldLabelClass}>Links de afiliado </label>
              <textarea
                value={bulkAffiliateUrls}
                onChange={(e) => {
                  setBulkImportWarn(null);
                  setBulkAffiliateUrls(e.target.value);
                }}
                spellCheck={false}
                placeholder={"https://amazon.com.br/…\nhttps://amazon.com.br/…"}
                className={gTa}
              />
            </div>
          </div>

          <div className="rounded-xl border border-[#2c2c32] bg-[#1c1c1f] px-3 py-3 space-y-2">
            <p className="text-[10px] font-bold text-[#d8d8d8] uppercase tracking-widest">
              Planilha ou bloco de notas
            </p>
        
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={bulkFileInputRef}
                type="file"
                accept=".csv,.txt,.tsv,text/csv,text/plain"
                className="sr-only"
                onChange={onBulkFileSelected}
              />
              <button
                type="button"
                onClick={() => bulkFileInputRef.current?.click()}
                className={cn(gBtnSecondary, "text-[11px] py-2 min-h-9")}
              >
                <Upload className="h-3.5 w-3.5 shrink-0 text-[#e24c30]" aria-hidden />
                Dados
              </button>
              <button
                type="button"
                onClick={downloadMlBulkTemplateCsv}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-shopee-orange hover:text-shopee-orange/85 hover:underline py-2"
              >
                <FileDown className="h-3.5 w-3.5 shrink-0 text-shopee-orange" aria-hidden />
                (CSV)
              </button>
              <button
                type="button"
                onClick={downloadMlBulkTemplateTxt}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-shopee-orange hover:text-shopee-orange/85 hover:underline py-2"
              >
                <FileDown className="h-3.5 w-3.5 shrink-0 text-shopee-orange" aria-hidden />
                (TXT)
              </button>
            </div>
            {bulkImportWarn ? (
              <p className="text-xs text-shopee-orange/95 leading-relaxed">{bulkImportWarn}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={
                bulkProductLines.length > 0 || bulkAffiliateLines.length > 0
                  ? bulkPairMatch
                    ? "text-text-secondary"
                    : "text-shopee-orange/90"
                  : "text-text-secondary"
              }
            >
              {bulkProductLines.length} URL(s) de produto · {bulkAffiliateLines.length} link(s) de afiliado
              {!bulkPairMatch &&
              (bulkProductLines.length > 0 || bulkAffiliateLines.length > 0)
                ? " — ajuste para o mesmo número de linhas nos dois blocos"
                : ""}
            </span>
          </div>
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-3 border-t border-[#2c2c32]">
            <button
              type="button"
              onClick={runBulkSaveSelected}
              disabled={bulkSaving || !bulkPairMatch || !addListaId}
              title={
                !addListaId
                  ? "Crie uma lista pelo histórico (Adicionar à lista) ou use Criar lista e importar no lote."
                  : undefined
              }
              className={gBtnPrimary}
            >
              Adicionar à lista
            </button>
            <button
              type="button"
              onClick={openBulkNewListModal}
              disabled={bulkSaving || !bulkPairMatch}
              title="Abre um popup para nomear a lista; se deixar em branco, usamos um nome com a data."
              className={gBtnSecondary}
            >
              Criar lista e importar
            </button>
          </div>
        </section>

        <section className={cn("rounded-xl border border-[#2c2c32] bg-[#222228] p-4 space-y-4", "hidden")}>
          <div className={mlSectionHeadClass}>
            <Link2 className="h-3.5 w-3.5 text-[#e24c30]/80 shrink-0" aria-hidden />
            <h3 className={mlSectionTitleClass}>Um produto por vez</h3>
            <Toolist
              variant="below"
              wide
              text="Ao salvar, o app busca nome, imagem e preços (URL do anúncio ou amazon.com.br). Desconto % é opcional."
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <label className={mlFieldLabelInlineClass} htmlFor="ml-product-url">
                    URL do anúncio (recomendado)
                  </label>
                  <Toolist
                    variant="floating"
                    wide
                  text="Se não colar aqui, use um link amazon.com.br no campo abaixo."
                  />
                </div>
                <input
                  id="ml-product-url"
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="Página do produto com MLB na URL"
                className={gInp}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={mlFieldLabelClass} htmlFor="ml-affiliate-link">
                  Link de afiliado (obrigatório)
                </label>
                <input
                  id="ml-affiliate-link"
                  value={affiliateLink}
                  onChange={(e) => setAffiliateLink(e.target.value)}
                placeholder="https://amazon.com.br/…"
                className={gInp}
                />
              </div>
              <div className="sm:col-span-2 sm:max-w-xs">
                <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                  <label className={mlFieldLabelInlineClass} htmlFor="ml-discount">
                    Desconto % (opcional)
                  </label>
                  <Toolist
                    variant="floating"
                  text="Se preencher, recalcula o preço em destaque a partir do original."
                  />
                </div>
                <input
                  id="ml-discount"
                  value={discountRate}
                  onChange={(e) => setDiscountRate(e.target.value)}
                  placeholder="Ex.: 10"
                className={gInp}
                />
              </div>
            <div className="sm:col-span-2 pt-2 border-t border-[#2c2c32]">
                <button
                  type="button"
                  onClick={() => void handleAdicionarItem()}
                  disabled={salvandoItem || !addListaId}
                title={
                  !addListaId
                    ? "Crie uma lista pelo histórico ou importe em lote com nova lista."
                    : undefined
                }
                className={`${gBtnPrimary} h-11 px-6 w-full sm:w-auto`}
                >
                  {salvandoItem ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Salvar na lista
                </button>
              </div>
            </div>
        </section>
        </div>
        </main>
          </div>

      <section
        className={cn(
          "border-t border-[#2c2c32] bg-[#27272a]",
          mobileTab === "historico" ? "block" : "hidden lg:block",
        )}
      >
        <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-6 h-6 rounded-lg bg-[#e24c30]/15 border border-[#e24c30]/25 flex items-center justify-center shrink-0">
              <Link2 className="w-3 h-3 text-[#e24c30]" />
          </div>
            <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Histórico de links Amazon</h2>
            {mlHistoryTotal > 0 ? (
              <span className="text-[9px] text-[#bebebe] bg-[#232328] px-1.5 py-px rounded-full border border-[#3e3e3e] shrink-0">
                {mlHistoryTotal} {mlHistoryTotal === 1 ? "link" : "links"}
              </span>
            ) : null}
          </div>
          <div className="relative w-full sm:w-56 group/search">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#e24c30]/55 group-focus-within/search:text-[#e24c30] transition-colors" />
            <input
              value={mlHistorySearch}
              onChange={(e) => setMlHistorySearch(e.target.value)}
              placeholder="Buscar produto, amazon.com.br…"
              className="w-full sm:w-56 bg-[#18181c] border border-[#e24c30]/20 rounded-xl py-2 pl-8 pr-3 text-xs text-[#f0f0f2] placeholder:text-[#7a7a82] shadow-inner shadow-black/20 outline-none transition-all hover:border-[#e24c30]/35 focus:border-[#e24c30] focus:ring-2 focus:ring-[#e24c30]/25 focus:bg-[#1c1c20]"
            />
          </div>
        </div>

        <div className="px-3 sm:px-5 py-2.5 border-b border-[#2c2c32] bg-[#1c1c1f] flex flex-row flex-wrap items-center justify-between gap-2 lg:gap-3">
          <label
            className="flex items-center gap-2 cursor-pointer select-none group shrink-0"
            aria-label={
              someMlHistorySelected
                ? `${selectedMlHistoryCount} selecionados`
                : "Selecionar todos do histórico"
            }
          >
            <div
              role="checkbox"
              aria-checked={allMlHistorySelected ? true : someMlHistorySelected ? "mixed" : false}
              tabIndex={0}
              onClick={toggleAllMlHistory}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  toggleAllMlHistory();
                }
              }}
              className={cn(
                "w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]",
                allMlHistorySelected
                  ? "bg-[#e24c30] border-[#e24c30] shadow-[0_0_12px_rgba(226,76,48,0.35)]"
                  : someMlHistorySelected
                    ? "bg-[#e24c30]/18 border-[#e24c30] ring-1 ring-inset ring-[#e24c30]/30"
                    : "bg-[#141418] border-[#3f3f46] group-hover:border-[#e24c30]/45 group-hover:bg-[#e24c30]/5",
              )}
            >
              {someMlHistorySelected && !allMlHistorySelected ? (
                <span className="w-2 h-1 rounded-[2px] bg-[#e24c30]" />
              ) : null}
            </div>
            <span className="hidden lg:inline text-[11px] font-medium text-[#bebebe] group-hover:text-[#e0e0e0] transition">
              {someMlHistorySelected
                ? `${selectedMlHistoryCount} selecionado${selectedMlHistoryCount > 1 ? "s" : ""}`
                : "Selecionar todos"}
                      </span>
          </label>
          <div
            className={cn(
              "flex items-center justify-end gap-1.5 flex-nowrap shrink-0 transition-opacity duration-200",
              someMlHistorySelected ? "flex opacity-100" : "hidden",
            )}
          >
                          <button
                            type="button"
              onClick={() => setSelectedMlHistoryMap({})}
              className="flex items-center justify-center gap-1.5 text-[11px] text-[#a0a0a0] hover:text-[#f0f0f2] font-medium transition bg-[#222228] border border-[#2c2c32] rounded-lg p-2.5 lg:p-0 lg:bg-transparent lg:border-0"
            >
              <X className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              <span className="hidden lg:inline">Limpar</span>
                          </button>
                        <button
                          type="button"
              onClick={() => openMlAddToListModal(Object.values(selectedMlHistoryMap))}
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 bg-emerald-500/8 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-lg p-2.5 lg:px-2.5 lg:py-1 transition"
            >
              <ListPlus className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Adicionar à lista ({selectedMlHistoryCount})</span>
                        </button>
                        <button
                          type="button"
              onClick={async () => {
                const ids = Object.keys(selectedMlHistoryMap);
                for (const id of ids) await handleDeleteMlHistory(id);
                setSelectedMlHistoryMap({});
              }}
              className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-red-400 hover:text-red-300 bg-red-500/8 hover:bg-red-500/15 border border-red-500/20 rounded-lg p-2.5 lg:px-2.5 lg:py-1 transition"
            >
              <Trash2 className="w-4 h-4 lg:w-3 lg:h-3 shrink-0" />
              <span className="hidden lg:inline whitespace-nowrap">Excluir {selectedMlHistoryCount}</span>
                        </button>
                          </div>
        </div>

        {mlAddToListFeedback ? (
          <div
            className={cn(
              "mx-3 sm:mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg border text-[11px]",
              mlAddToListFeedback.includes("Selecione") || mlAddToListFeedback.toLowerCase().includes("erro")
                ? "bg-amber-500/8 border-amber-500/20 text-amber-400"
                : "bg-emerald-500/8 border-emerald-500/20 text-emerald-400",
            )}
          >
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> {mlAddToListFeedback}
          </div>
        ) : null}

        <div className="divide-y divide-[#2c2c32] max-h-[min(70vh,720px)] overflow-y-auto scrollbar-ref bg-[#1c1c1f]">
          {mlHistoryLoading && mlHistory.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-[#a0a0a0] text-sm">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : mlHistory.length === 0 ? (
            <div className="px-3 sm:px-5 py-10 text-center text-[#a0a0a0] text-[12px] bg-[#17171a]">
              Nenhum link no histórico. Use <span className="text-[#f0f0f2] font-medium">Buscar</span> e{" "}
              <span className="text-[#f0f0f2] font-medium">Converter</span>.
            </div>
          ) : (
            mlHistory.map((h) => {
              const inList = linksInMlOfferList.has(h.shortLink ?? "");
              const isSelected = Boolean(selectedMlHistoryMap[h.id]);
              const isCopied = copiedMlHistoryId === h.id;
              return (
                <div
                  key={h.id}
                  onClick={() => toggleMlHistorySelect(h)}
                  className={cn(
                    "px-3 sm:px-5 py-3.5 border-l-[3px] transition cursor-pointer",
                    isSelected
                      ? "bg-[#e24c30]/10 border-l-[#e24c30] hover:bg-[#e24c30]/15"
                      : "border-l-transparent hover:bg-[#252528]",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      role="checkbox"
                      aria-checked={isSelected}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMlHistorySelect(h);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleMlHistorySelect(h);
                        }
                      }}
                      className={cn(
                        "w-4 h-4 rounded-md border shrink-0 cursor-pointer mt-0.5 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/45",
                        isSelected
                          ? "bg-[#e24c30] border-[#e24c30] shadow-[0_0_10px_rgba(226,76,48,0.28)]"
                          : "border-[#3f3f46] bg-[#141418] hover:border-[#e24c30]/45",
                      )}
                    />
                    <div className="w-10 h-10 rounded-lg shrink-0 border border-[#2c2c32] overflow-hidden bg-[#232328]">
                      {h.imageUrl ? (
                        <img src={h.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-4 h-4 text-[#686868]" />
                        </div>
                      )}
                            </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#f0f0f2] line-clamp-2">{h.productName || "Link"}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[9px] text-[#a0a0a0]">
                          {new Date(h.createdAt).toLocaleDateString("pt-BR")}
                        </span>
                        {h.pricePromo != null ? (
                          <span className="text-[9px] font-semibold text-[#e24c30]">{formatCurrency(h.pricePromo)}</span>
                        ) : null}
                      </div>
                      <p className="text-[10px] text-[#e24c30] font-mono break-all mt-1 line-clamp-2">{h.shortLink}</p>
                      <div
                        className="flex items-center gap-1 shrink-0 mt-2 min-[560px]:hidden"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MlHistoryActions
                          inList={inList}
                          copiedId={isCopied}
                          onCopy={() => {
                            void navigator.clipboard.writeText(h.shortLink);
                            setCopiedMlHistoryId(h.id);
                            setTimeout(
                              () => setCopiedMlHistoryId((c) => (c === h.id ? null : c)),
                              1500,
                            );
                          }}
                          onOpen={() =>
                            window.open(
                              (h.originUrl && h.originUrl.trim()) || h.shortLink,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          onAddToList={() => openMlAddToListModal([h])}
                          onDelete={() => void handleDeleteMlHistory(h.id)}
                        />
                                    </div>
                    </div>
                    <div
                      className="hidden min-[560px]:flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MlHistoryActions
                        inList={inList}
                        copiedId={isCopied}
                        onCopy={() => {
                          void navigator.clipboard.writeText(h.shortLink);
                          setCopiedMlHistoryId(h.id);
                          setTimeout(
                            () => setCopiedMlHistoryId((c) => (c === h.id ? null : c)),
                            1500,
                          );
                        }}
                        onOpen={() => window.open(h.shortLink, "_blank", "noopener,noreferrer")}
                        onAddToList={() => openMlAddToListModal([h])}
                        onDelete={() => void handleDeleteMlHistory(h.id)}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {(mlHistoryTotal > 0 || mlHistoryLoading) && (
          <div className="px-3 sm:px-5 py-3.5 border-t border-[#2c2c32] bg-[#1c1c1f]">
            <GeradorPaginationBar
              page={mlHistoryPage}
              totalPages={mlHistoryTotalPages}
              loading={mlHistoryLoading}
              summary={`Mostrando ${mlHistory.length} de ${mlHistoryTotal} links`}
              onPrev={() => setMlHistoryPage((p) => Math.max(1, p - 1))}
              onNext={() => setMlHistoryPage((p) => Math.min(mlHistoryTotalPages, p + 1))}
            />
          </div>
        )}
      </section>

        {categoryPickerOpen && typeof document !== "undefined"
          ? createPortal(
              <div className={mlModalOverlayClass} role="presentation" onClick={closeCategoryPicker}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={mlCategoryPickerTitleId}
                  className={`${mlModalShellClass} max-w-lg max-h-[min(520px,85vh)]`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`${mlModalHeaderClass} flex items-start justify-between gap-3`}>
                    <div className="min-w-0 flex-1">
                      <h2
                        id={mlCategoryPickerTitleId}
                        className="text-sm font-bold text-text-primary flex items-center gap-2"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 shrink-0">
                          <Search className="h-4 w-4 text-shopee-orange" />
                                      </span>
                        Categorias
                      </h2>
                      <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">
                        Lista do Amazon; ao confirmar, carregamos produtos dessa categoria.
                      </p>
                      <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                        <input
                          type="search"
                          autoFocus
                          value={categoryPickerQuery}
                          onChange={(e) => setCategoryPickerQuery(e.target.value)}
                          placeholder="Filtrar categorias…"
                          className={mlModalSearchInputClass}
                          disabled={mlSearchLoading}
                        />
                      </div>
                    </div>
                                    <button
                                      type="button"
                      aria-label="Fechar"
                      onClick={closeCategoryPicker}
                      disabled={mlSearchLoading}
                      className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-dark-bg shrink-0 disabled:opacity-40"
                    >
                      <X className="h-5 w-5" />
                                    </button>
                  </div>
                  <div className={mlModalListScrollClass}>
                    {categoriasFiltradasPicker.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8 px-4">Nada encontrado.</p>
                    ) : (
                      categoriasFiltradasPicker.map((c) => {
                        const selected = categoryDraftSlug === c.slug;
                        return (
                                      <button
                            key={c.slug}
                                        type="button"
                            disabled={mlSearchLoading}
                            onClick={() => setCategoryDraftSlug(c.slug)}
                            className={mlPickerRowClass(selected)}
                          >
                            <span className="block truncate font-medium">{c.label}</span>
                            <span className="block text-[11px] text-text-secondary/55 font-normal truncate mt-0.5">
                              {c.slug}
                                        </span>
                                      </button>
                        );
                      })
                    )}
                  </div>
                  <div className={mlModalFooterClass}>
                                        <button
                                          type="button"
                      onClick={closeCategoryPicker}
                      disabled={mlSearchLoading}
                      className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors disabled:opacity-50"
                    >
                      Cancelar
                                        </button>
                                        <button
                                          type="button"
                      onClick={confirmCategoryPicker}
                      disabled={!categoryDraftSlug || mlSearchLoading}
                      className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.25)] disabled:opacity-50"
                    >
                      Confirmar
                                        </button>
                                    </div>
                                  </div>
              </div>,
              document.body,
            )
          : null}

        {bulkSaving && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-[2px] px-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="ml-bulk-loading-warn"
                aria-describedby="ml-bulk-loading-desc"
              >
                <div className="w-full max-w-md flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-shopee-orange/30 bg-shopee-orange/10">
                    <p
                      id="ml-bulk-loading-warn"
                      className="text-sm font-semibold text-shopee-orange text-center leading-snug"
                    >
                      Não saia da página até carregar todos seus produtos
                    </p>
                  </div>
                  <div className="px-6 py-5 flex items-center gap-5">
                    <div className="shrink-0 h-12 w-12 rounded-xl bg-shopee-orange/10 flex items-center justify-center border border-shopee-orange/20">
                      <Loader2 className="h-5 w-5 text-shopee-orange animate-spin" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary text-sm leading-snug">Adicionando à lista…</p>
                      <p id="ml-bulk-loading-desc" className="text-sm text-text-secondary mt-1 leading-snug">
                        {bulkProgress
                          ? `${bulkProgress.done} de ${bulkProgress.total} produto(s) — consultando o Amazon`
                          : "Preparando…"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {listasMenuModalOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                className={mlModalOverlayClass}
                role="presentation"
                onClick={() => setListasMenuModalOpen(false)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={listasMenuTitleId}
                  className="w-full max-w-md flex flex-col rounded-2xl border border-dark-border bg-dark-card shadow-2xl overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={mlModalHeaderClass}>
                    <h2
                      id={listasMenuTitleId}
                      className="text-sm font-bold text-text-primary flex items-center gap-2"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25">
                        <ListChecks className="h-4 w-4 text-shopee-orange" />
                      </span>
                      Listas
                    </h2>
                    <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">
                      Crie uma lista vazia ou escolha em qual lista salvar (importação em lote e cadastro avulso).
                    </p>
                  </div>
                  <div className="p-3 space-y-2">
                    <button
                      type="button"
                      onClick={openCriarListaFromMenu}
                      className="w-full text-left rounded-lg border border-dark-border/60 bg-dark-bg/30 px-3 py-2.5 text-sm transition-all hover:border-shopee-orange/30 flex items-start gap-3"
                    >
                      <Plus className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" />
                      <span className="min-w-0">
                        <span className="block font-medium text-text-primary">Criar lista</span>
                        <span className="block text-[11px] text-text-secondary/55 font-normal mt-0.5">
                          Nova lista para preencher depois
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={openOndeSalvarFromMenu}
                      className="w-full text-left rounded-lg border border-dark-border/60 bg-dark-bg/30 px-3 py-2.5 text-sm transition-all hover:border-shopee-orange/30 flex items-start gap-3"
                    >
                      <Search className="h-4 w-4 text-shopee-orange shrink-0 mt-0.5" />
                      <span className="min-w-0">
                        <span className="block font-medium text-text-primary">Onde salvar</span>
                        <span className="block text-[11px] text-text-secondary/55 font-normal mt-0.5">
                          Buscar e selecionar uma lista existente
                        </span>
                      </span>
                    </button>
                  </div>
                  <div className={mlModalFooterClass}>
                    <button
                      type="button"
                      onClick={() => setListasMenuModalOpen(false)}
                      className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {criarListaModalOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                className={mlModalOverlayClass}
                role="presentation"
                onClick={() => {
                  if (!criandoLista && !bulkSaving) setCriarListaModalOpen(false);
                }}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={criarListaTitleId}
                  className={`${mlModalShellClass} max-w-md`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`${mlModalHeaderClass} flex items-start justify-between gap-3`}>
                    <div className="min-w-0">
                      <h2
                        id={criarListaTitleId}
                        className="text-sm font-bold text-text-primary flex items-center gap-2"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 shrink-0">
                          <Plus className="h-4 w-4 text-shopee-orange" />
                        </span>
                        <span className="leading-tight">
                          {criarListaModalPurpose === "bulkNewList" ? "Criar lista e importar" : "Nova lista"}
                        </span>
                      </h2>
                      <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">
                        {criarListaModalPurpose === "bulkNewList"
                          ? "Nome opcional — se vazio, usamos a data de hoje."
                          : "Nome opcional — padrão “Nova lista ML”."}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      disabled={criandoLista || bulkSaving}
                      onClick={() => setCriarListaModalOpen(false)}
                      className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-dark-bg disabled:opacity-40 shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="px-4 pb-4">
                    <label className={labelClass} htmlFor="ml-criar-lista-nome">
                      Nome
                    </label>
                    <input
                      id="ml-criar-lista-nome"
                      value={nomeListaCriar}
                      onChange={(e) => setNomeListaCriar(e.target.value)}
                      placeholder={
                        criarListaModalPurpose === "bulkNewList" ? "Opcional — usa data se vazio" : "Opcional — Nova lista ML"
                      }
                      disabled={criandoLista || bulkSaving}
                      className="w-full rounded-xl border border-dark-border bg-dark-bg py-2.5 px-3 text-sm text-text-primary placeholder:text-text-secondary/40 focus:outline-none focus:border-shopee-orange/60 focus:ring-1 focus:ring-shopee-orange/20 disabled:opacity-50"
                      autoFocus
                    />
                  </div>
                  <div className={mlModalFooterClass}>
                    <button
                      type="button"
                      disabled={criandoLista || bulkSaving}
                      onClick={() => setCriarListaModalOpen(false)}
                      className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void submitCriarListaModal()}
                      disabled={criandoLista || bulkSaving}
                      className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.25)] disabled:opacity-50 inline-flex items-center justify-center gap-2"
                    >
                      {criandoLista || bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {criarListaModalPurpose === "bulkNewList" ? "Criar e importar" : "Criar lista"}
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        {selecionarListaModalOpen && typeof document !== "undefined"
          ? createPortal(
              <div className={mlModalOverlayClass} role="presentation" onClick={closeListaPicker}>
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby={ondeSalvarTitleId}
                  className={`${mlModalShellClass} max-w-lg max-h-[min(520px,85vh)]`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`${mlModalHeaderClass} flex items-start justify-between gap-3`}>
                    <div className="min-w-0 flex-1">
                      <h2
                        id={ondeSalvarTitleId}
                        className="text-sm font-bold text-text-primary flex items-center gap-2"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 shrink-0">
                          <Search className="h-4 w-4 text-shopee-orange" />
                        </span>
                        Onde salvar
                      </h2>
                      <p className="text-[11px] text-text-secondary/75 mt-1.5 leading-relaxed">
                        Busque pelo nome da lista e confirme para usar no lote e no cadastro avulso.
                      </p>
                      <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-secondary/45 pointer-events-none" />
                        <input
                          type="search"
                          value={listaPickerQuery}
                          onChange={(e) => setListaPickerQuery(e.target.value)}
                          placeholder="Filtrar listas…"
                          className={mlModalSearchInputClass}
                          autoFocus
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Fechar"
                      onClick={closeListaPicker}
                      className="p-1.5 rounded-xl text-text-secondary hover:text-text-primary hover:bg-dark-bg shrink-0"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className={mlModalListScrollClass}>
                    {listas.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8 px-4">
                        Nenhuma lista ainda. Em Configurar, use Gerenciar listas → Criar lista.
                      </p>
                    ) : listasFiltradasPicker.length === 0 ? (
                      <p className="text-sm text-text-secondary text-center py-8 px-4">Nada encontrado.</p>
                    ) : (
                      listasFiltradasPicker.map((l) => {
                        const selected = listaPickerDraftId === l.id;
                        return (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() => setListaPickerDraftId(l.id)}
                            className={mlPickerRowClass(selected)}
                          >
                            <span className="block truncate font-medium">{l.nome}</span>
                            <span className="block text-[11px] text-text-secondary/55 font-normal truncate mt-0.5 tabular-nums">
                              {l.totalItens ?? 0} itens
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div className={mlModalFooterClass}>
                    <button
                      type="button"
                      onClick={closeListaPicker}
                      className="rounded-xl border border-dark-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={confirmListaPicker}
                      disabled={listas.length === 0 || !listaPickerDraftId}
                      className="rounded-xl bg-shopee-orange px-4 py-2 text-sm font-semibold text-white hover:opacity-90 shadow-[0_2px_12px_rgba(238,77,45,0.25)] disabled:opacity-50"
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}

        <GeradorAddToListModal
          open={mlAddToListModal.open}
          onClose={closeMlAddToListModal}
          lists={listas.map((l) => ({ id: l.id, nome: l.nome, totalItens: l.totalItens ?? 0 }))}
          newListName={mlHistModalNovaLista}
          setNewListName={setMlHistModalNovaLista}
          activeListId={mlHistModalListaId}
          setActiveListId={setMlHistModalListaId}
          onCreate={async () => {
            if (!mlHistModalNovaLista.trim()) return;
            try {
              const res = await fetch("/api/amazon/minha-lista-ofertas/listas", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome: mlHistModalNovaLista.trim() }),
              });
              const json = await res.json();
              if (res.ok && json?.data?.id) {
                setMlHistModalListaId(json.data.id);
                await loadListas();
                setMlHistModalNovaLista("");
              }
            } catch {
              /* ignore */
            }
          }}
          onConfirm={() => void confirmMlAddToList()}
          canConfirm={!!mlHistModalListaId && mlAddToListModal.entries.length > 0}
          pendingCount={mlAddToListModal.entries.length}
          loading={mlAddToListLoading}
        />
    </div>
  );
}
