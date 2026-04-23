"use client";

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  TrendingUp,
  AlertCircle,
  Rocket,
  Settings,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Link2,
  DollarSign,
  Wallet,
  BarChart3,
  ShoppingBag,
  Target,
  MousePointerClick,
  MessageCircle,
  Search,
  CheckCircle,
  Pencil,
  Trash2,
  CopyPlus,
  Plus,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  CreditCard,
  PauseCircle,
} from "lucide-react";

const ATI_CAMPAIGNS_PER_PAGE = 6;
import type { ATICreativeRow } from "@/lib/ati/types";
import type { ATIDashboardSessionPayload } from "@/lib/ati/session-cache";
import {
  readAtiSessionCache,
  writeAtiSessionCache,
} from "@/lib/ati/session-cache";
import type { MetricLevel } from "@/lib/ati/types";
import {
  canValidateCreative,
  getCreativeDiagnosis,
  getCreativeStatus,
  getLevelCpcMeta,
  getLevelClickDiscrepancy,
} from "@/lib/ati/rules";
import { META_CREATE_CAMPAIGN_OBJECTIVES, META_CAMPAIGN_OBJECTIVES } from "@/lib/meta-ads-constants";
import MetaAdSetForm from "@/app/components/meta/MetaAdSetForm";
import MetaAdForm from "@/app/components/meta/MetaAdForm";
import ShopeeLinkHistoryPickButton from "@/app/components/shopee/ShopeeLinkHistoryPickButton";

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Afiliado Shopee: valor da venda ≠ comissão. ROAS e lucro líquido usam comissão. */
const ATI_HINT = {
  custo:
    "Quanto você gastou em anúncio no Meta (Facebook) neste anúncio, no mesmo período selecionado acima (Meta + vendas Shopee). Não tem relação com o valor do produto na Shopee.",
  valorVendas:
    "Soma do que os clientes pagaram nos pedidos (Valor de Compra no relatório Shopee), com seu Sub ID no período. Ex.: produto sai R$ 50 — aqui entra R$ 50. Isso NÃO é o que cai na sua conta; sua grana é a comissão.",
  comissao:
    "Sua comissão líquida da Shopee nos pedidos com este Sub ID (ex.: venda R$ 50, você ganha R$ 13,69 — aqui aparece R$ 13,69). É o que a Shopee paga a você de fato.",
  lucro:
    "Lucro líquido = Comissão Shopee − Custo no Meta. Ex.: R$ 13,69 de comissão − R$ 10 de tráfego = R$ 3,69. É o que sobra depois de pagar o anúncio.",
  roas:
    "ROAS de afiliado = Comissão Shopee ÷ Custo Meta. Ex.: R$ 13,69 de comissão ÷ R$ 10 de ads = 1,37. Mede retorno sobre o que VOCÊ ganhou (comissão), não sobre o preço cheio do produto.",
  pedidos:
    "Quantidade de pedidos no relatório Shopee com o Sub ID deste anúncio, no período escolhido.",
  cpa:
    "Custo Meta ÷ pedidos com Sub ID. Quanto você gastou em média em anúncio para cada venda atribuída.",
  cliques:
    "Cliques Shopee: a API da Shopee não informa quantos cliques houve no seu link afiliado (só conversões). No ATI usamos o mesmo número de cliques do Meta como referência — cada clique no anúncio é tratado como chegada ao fluxo Shopee.",
} as const;

// ─── Portal Tooltip ───────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);

  const show = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);

  const tip = visible ? createPortal(
    <span
      style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className="pointer-events-none w-72 p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block">
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
    </span>, document.body
  ) : null;

  return (
    <span ref={anchorRef} className="inline-flex items-center" onMouseEnter={show} onMouseLeave={hide}>
      <HelpCircle className="h-3 w-3 shrink-0 text-text-secondary/40 hover:text-shopee-orange/70 transition-colors cursor-help" />
      {tip}
    </span>
  );
}

function MetricHint({
  icon: Icon,
  label,
  hint,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-1.5 text-text-secondary text-xs mb-0.5">
      <Icon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      <span className="leading-snug flex-1 min-w-0">{label}</span>
      <Tooltip text={hint} />
    </div>
  );
}

type Grouped = {
  campaignId: string;
  campaignName: string;
  adAccountId?: string;
  adSets: { adSetId: string; adSetName: string; adAccountId?: string; ads: ATICreativeRow[] }[];
}[];

/** Monta árvore campanha -> conjuntos -> anúncios a partir das listas do Meta (inclui conjuntos sem anúncio). */
function buildTree(
  campaignsList: Array<{ id: string; name: string; ad_account_id: string }>,
  adSetList: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }>,
  creatives: ATICreativeRow[]
): Grouped {
  const byAdSet = new Map<string, ATICreativeRow[]>();
  for (const row of creatives) {
    const list = byAdSet.get(row.adSetId) ?? [];
    list.push(row);
    byAdSet.set(row.adSetId, list);
  }
  return campaignsList.map((camp) => ({
    campaignId: camp.id,
    campaignName: camp.name,
    adAccountId: camp.ad_account_id,
    adSets: adSetList
      .filter((s) => s.campaign_id === camp.id)
      .map((s) => ({
        adSetId: s.id,
        adSetName: s.name,
        adAccountId: s.ad_account_id,
        ads: byAdSet.get(s.id) ?? [],
      })),
  }));
}

function StatusBadge({ status }: { status: ATICreativeRow["status"] }) {
  if (status === "excellent") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-0.5 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
        Criativo Excelente (Pronto para Escala)
      </span>
    );
  }
  if (status === "bad") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/20 text-red-400 px-2.5 py-0.5 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Criativo Ruim
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-dark-border/50 text-text-secondary px-2.5 py-0.5 text-xs font-semibold">
        <span className="w-2 h-2 rounded-full bg-text-secondary" />
        Aguardando dados
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 text-amber-400 px-2.5 py-0.5 text-xs font-semibold">
      <span className="w-2 h-2 rounded-full bg-amber-500" />
      Criativo Bom
    </span>
  );
}

function AdAccordionItem({
  row,
  dateLabel,
  expandedId,
  onToggle,
  onValidate,
  validatingId,
  onOpenLinkModal,
  hasExistingLink,
  onExpandedFetchLink,
  onDeleteAd,
  onDuplicateAd,
  adStatus,
  onAdStatusToggle,
  adTogglingId,
  onEditAd,
  onReloadAti,
  campaignIsInfoP = false,
  campaignIsGrupos = false,
}: {
  row: ATICreativeRow;
  dateLabel: string;
  expandedId: string | null;
  onToggle: (id: string) => void;
  onValidate: (r: ATICreativeRow) => void;
  validatingId: string | null;
  onOpenLinkModal: (r: ATICreativeRow) => void;
  hasExistingLink: boolean | undefined;
  onExpandedFetchLink: (r: ATICreativeRow) => void;
  onDeleteAd: (r: ATICreativeRow) => void;
  onDuplicateAd: (r: ATICreativeRow) => void;
  adStatus?: string;
  onAdStatusToggle?: (adId: string) => void;
  adTogglingId?: string | null;
  onEditAd?: (r: ATICreativeRow) => void;
  onReloadAti: () => Promise<void>;
  /** Se a campanha-pai está marcada como InfoP, exibimos o bloco de SubId InfoP. */
  campaignIsInfoP?: boolean;
  /** Se a campanha-pai está marcada como Grupos, exibimos o bloco de Sub ID Shopee. */
  campaignIsGrupos?: boolean;
}) {
  const isOpen = expandedId === row.adId;
  const [shopeeSubDraft, setShopeeSubDraft] = useState(() => row.shopeeSubId ?? row.subId ?? "");
  const [shopeeSubBusy, setShopeeSubBusy] = useState(false);
  const [shopeeSubFeedback, setShopeeSubFeedback] = useState<string | null>(null);

  const [infopSubDraft, setInfopSubDraft] = useState(() => row.infopSubId ?? "");
  const [infopSubBusy, setInfopSubBusy] = useState(false);
  const [infopSubFeedback, setInfopSubFeedback] = useState<string | null>(null);

  useEffect(() => {
    setShopeeSubDraft(row.shopeeSubId ?? row.subId ?? "");
    setShopeeSubFeedback(null);
    setInfopSubDraft(row.infopSubId ?? "");
    setInfopSubFeedback(null);
  }, [row.adId, row.shopeeSubId, row.subId, row.infopSubId]);

  useEffect(() => {
    if (isOpen && row) onExpandedFetchLink(row);
  }, [isOpen, row.adId]);

  // Permite ao usuário sobrescrever manualmente "Cliques Shopee" (API Shopee não retorna cliques).
  // "Cliques Meta" continua vindo do Meta (API) via `row.clicksMeta`.
  const [clicksShopeeDraft, setClicksShopeeDraft] = useState<string>(() =>
    String(row.clicksShopee ?? row.clicksMeta ?? 0)
  );
  useEffect(() => {
    setClicksShopeeDraft(String(row.clicksShopee ?? row.clicksMeta ?? 0));
  }, [row.adId, row.clicksShopee, row.clicksMeta]);

  const effectiveClicksShopee = useMemo(() => {
    const trimmed = clicksShopeeDraft.trim();
    if (!trimmed) return 0;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.floor(n));
  }, [clicksShopeeDraft]);

  const clickDiscrepancyPct = useMemo(() => {
    return row.clicksMeta > 0 ? ((row.clicksMeta - effectiveClicksShopee) / row.clicksMeta) * 100 : 0;
  }, [row.clicksMeta, effectiveClicksShopee]);

  const effectiveEpc = useMemo(() => {
    return effectiveClicksShopee > 0 ? row.commission / effectiveClicksShopee : 0;
  }, [row.commission, effectiveClicksShopee]);

  const effectiveLevelCpcMeta = useMemo(() => getLevelCpcMeta(row.cpcMeta), [row.cpcMeta]);
  const effectiveLevelClickDiscrepancy = useMemo(
    () => getLevelClickDiscrepancy(clickDiscrepancyPct),
    [clickDiscrepancyPct]
  );

  const effectiveStatus = useMemo(() => {
    return getCreativeStatus(
      row.roas,
      row.cpcMeta,
      clickDiscrepancyPct,
      row.cpa,
      row.cost > 0 || row.clicksMeta > 0
    );
  }, [row.roas, row.cpcMeta, clickDiscrepancyPct, row.cpa, row.cost, row.clicksMeta]);

  const effectiveDiagnosis = useMemo(() => {
    return getCreativeDiagnosis(
      effectiveStatus,
      row.roas,
      row.cpcMeta,
      effectiveLevelCpcMeta,
      clickDiscrepancyPct,
      effectiveLevelClickDiscrepancy,
      row.orders
    );
  }, [
    effectiveStatus,
    row.roas,
    row.cpcMeta,
    effectiveLevelCpcMeta,
    clickDiscrepancyPct,
    effectiveLevelClickDiscrepancy,
    row.orders,
  ]);

  const effectiveCanValidate = useMemo(() => canValidateCreative(effectiveStatus), [effectiveStatus]);

  const profit = row.commission - row.cost;
  const isProfitPositive = profit >= 0;

  return (
    <div className="rounded-lg border border-dark-border bg-[#39393E] overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(row.adId)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="font-medium text-text-primary truncate">{row.adName}</span>
        <span className="flex items-center gap-2 flex-shrink-0">
          {onAdStatusToggle && (
            <button
              type="button"
              role="switch"
              aria-checked={adStatus === "ACTIVE"}
              disabled={adTogglingId === row.adId}
              onClick={(e) => { e.stopPropagation(); onAdStatusToggle(row.adId); }}
              title={adStatus === "ACTIVE" ? "Pausar anúncio" : "Ativar anúncio"}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-shopee-orange focus:ring-offset-2 focus:ring-offset-dark-card disabled:opacity-50 ${
                adStatus === "ACTIVE" ? "bg-emerald-500 border-transparent" : "bg-dark-border border-gray-600"
              }`}
            >
              <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition ${adStatus === "ACTIVE" ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          )}
          <StatusBadge status={effectiveStatus} />
          {isOpen ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-dark-border bg-dark-bg/30 p-4 space-y-4">
          {/* Shopee SubId: só renderiza se a campanha-pai está marcada como Grupos (dados permanecem salvos no banco independente disso). */}
          {campaignIsGrupos ? (
          <div className="rounded-lg border border-dark-border/80 bg-dark-card/50 p-3 space-y-2">
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <ShoppingBag className="h-3.5 w-3.5 text-shopee-orange" />
              Seu Sub ID Shopee
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Anexe o seu sub id Shopee para que possamos cruzar tráfego x vendas.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] text-text-secondary mb-0.5">Sub ID 1</label>
                <input
                  type="text"
                  value={shopeeSubDraft}
                  onChange={(e) => setShopeeSubDraft(e.target.value)}
                  placeholder="ex: meta_camp1_a1"
                  className="w-full rounded-lg border border-dark-border bg-dark-bg py-1.5 px-2.5 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-shopee-orange"
                />
              </div>
              <button
                type="button"
                disabled={shopeeSubBusy || shopeeSubDraft.trim().length < 2}
                onClick={async () => {
                  setShopeeSubBusy(true);
                  setShopeeSubFeedback(null);
                  try {
                    const res = await fetch("/api/ati/ad-shopee-sub", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ adId: row.adId, shopeeSubId: shopeeSubDraft.trim() }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(j?.error ?? "Erro ao salvar");
                    setShopeeSubFeedback("Salvo.");
                    await onReloadAti();
                  } catch (e) {
                    setShopeeSubFeedback(e instanceof Error ? e.message : "Erro");
                  } finally {
                    setShopeeSubBusy(false);
                  }
                }}
                className="rounded-lg bg-shopee-orange px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {shopeeSubBusy ? "…" : "Salvar"}
              </button>
              {(row.shopeeSubId || row.subId) && (
                <button
                  type="button"
                  disabled={shopeeSubBusy}
                  onClick={async () => {
                    setShopeeSubBusy(true);
                    setShopeeSubFeedback(null);
                    try {
                      const res = await fetch(`/api/ati/ad-shopee-sub?adId=${encodeURIComponent(row.adId)}`, { method: "DELETE" });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j?.error ?? "Erro");
                      setShopeeSubDraft("");
                      setShopeeSubFeedback("Removido.");
                      await onReloadAti();
                    } catch (e) {
                      setShopeeSubFeedback(e instanceof Error ? e.message : "Erro");
                    } finally {
                      setShopeeSubBusy(false);
                    }
                  }}
                  className="rounded-lg border border-dark-border px-3 py-1.5 text-xs text-text-secondary hover:text-red-400 hover:border-red-500/40 disabled:opacity-50"
                >
                  Limpar
                </button>
              )}
            </div>
            {shopeeSubFeedback && (
              <p className={`text-[11px] ${shopeeSubFeedback === "Salvo." || shopeeSubFeedback === "Removido." ? "text-emerald-400" : "text-red-400"}`}>
                {shopeeSubFeedback}
              </p>
            )}
          </div>
          ) : null}

          {/* ── SubId InfoP (cruzamento com produtos Stripe) — só aparece em campanhas marcadas como InfoP ── */}
          {campaignIsInfoP ? (
          <div className="rounded-lg border border-[#635bff]/30 bg-[#635bff]/5 p-3 space-y-2">
            <p className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-[#a8a2ff]" />
              SubId InfoP (produtos Stripe)
            </p>
            <p className="text-[11px] text-text-secondary leading-relaxed">
              Cole aqui o mesmo SubId do produto Stripe (ex.: <code className="bg-dark-bg px-1 rounded">whey-protein</code>) para cruzar custos e receita na aba Trackeamento.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[10px] text-text-secondary mb-0.5">SubId</label>
                <input
                  type="text"
                  value={infopSubDraft}
                  onChange={(e) => setInfopSubDraft(e.target.value)}
                  placeholder="ex.: whey-protein"
                  className="w-full rounded-lg border border-dark-border bg-dark-bg py-1.5 px-2.5 text-xs text-text-primary placeholder-text-secondary/50 focus:outline-none focus:border-[#635bff]"
                />
              </div>
              <button
                type="button"
                disabled={infopSubBusy || infopSubDraft.trim().length < 2}
                onClick={async () => {
                  setInfopSubBusy(true);
                  setInfopSubFeedback(null);
                  try {
                    const res = await fetch("/api/ati/ad-infop-sub", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ adId: row.adId, infopSubId: infopSubDraft.trim() }),
                    });
                    const j = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(j?.error ?? "Erro ao salvar");
                    setInfopSubFeedback("Salvo.");
                    await onReloadAti();
                  } catch (e) {
                    setInfopSubFeedback(e instanceof Error ? e.message : "Erro");
                  } finally {
                    setInfopSubBusy(false);
                  }
                }}
                className="rounded-lg bg-[#635bff] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5047e5] disabled:opacity-50"
              >
                {infopSubBusy ? "…" : "Salvar"}
              </button>
              {row.infopSubId && (
                <button
                  type="button"
                  disabled={infopSubBusy}
                  onClick={async () => {
                    setInfopSubBusy(true);
                    setInfopSubFeedback(null);
                    try {
                      const res = await fetch(`/api/ati/ad-infop-sub?adId=${encodeURIComponent(row.adId)}`, { method: "DELETE" });
                      const j = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(j?.error ?? "Erro");
                      setInfopSubDraft("");
                      setInfopSubFeedback("Removido.");
                      await onReloadAti();
                    } catch (e) {
                      setInfopSubFeedback(e instanceof Error ? e.message : "Erro");
                    } finally {
                      setInfopSubBusy(false);
                    }
                  }}
                  className="rounded-lg border border-dark-border px-3 py-1.5 text-xs text-text-secondary hover:text-red-400 hover:border-red-500/40 disabled:opacity-50"
                >
                  Limpar
                </button>
              )}
            </div>
            {infopSubFeedback && (
              <p className={`text-[11px] ${infopSubFeedback === "Salvo." || infopSubFeedback === "Removido." ? "text-emerald-400" : "text-red-400"}`}>
                {infopSubFeedback}
              </p>
            )}
          </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenLinkModal(row)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold hover:opacity-90 ${
                hasExistingLink === true
                  ? "bg-emerald-600 text-white"
                  : "bg-shopee-orange text-white"
              }`}
            >
              {hasExistingLink === true ? (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Link no anúncio
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5" />
                  Colocar link no anúncio
                </>
              )}
            </button>
            {onEditAd && (
              <button
                type="button"
                onClick={() => onEditAd(row)}
                className="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-dark-bg"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar anúncio
              </button>
            )}
            <button
              type="button"
              onClick={() => onDuplicateAd(row)}
              className="inline-flex items-center gap-1.5 rounded-md border border-dark-border px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-shopee-orange/20 hover:border-shopee-orange/50"
            >
              <CopyPlus className="h-3.5 w-3.5" />
              Duplicar
            </button>
            <button
              type="button"
              onClick={() => onDeleteAd(row)}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-500/50 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Deletar
            </button>
          </div>
          {/* Cards de resumo (estilo print) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3">
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={DollarSign} label="Custo Meta" hint={ATI_HINT.custo} />
              <p className="text-red-400 font-bold text-sm">{formatBRL(row.cost)}</p>
              <p className="text-[10px] text-text-secondary">Tráfego Facebook</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={TrendingUp} label="Valor das vendas" hint={ATI_HINT.valorVendas} />
              <p className="text-sky-300 font-bold text-sm">{formatBRL(row.revenue)}</p>
              <p className="text-[10px] text-text-secondary">Total pago pelos clientes</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-shopee-orange/25 p-3">
              <MetricHint icon={BadgePercent} label="Comissão Shopee" hint={ATI_HINT.comissao} />
              <p className="text-shopee-orange font-bold text-sm">{formatBRL(row.commission)}</p>
              <p className="text-[10px] text-text-secondary">Seu ganho na Shopee</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={Wallet} label="Lucro líquido" hint={ATI_HINT.lucro} />
              <p className={`font-bold text-sm ${isProfitPositive ? "text-emerald-400" : "text-red-400"}`}>
                {formatBRL(profit)}
              </p>
              <p className="text-[10px] text-text-secondary">Comissão − custo Meta</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={BarChart3} label="ROAS" hint={ATI_HINT.roas} />
              <p className="text-text-primary font-bold text-sm">{row.roas.toFixed(2)}</p>
              <p className="text-[10px] text-text-secondary">Comissão ÷ custo Meta</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={ShoppingBag} label="Pedidos" hint={ATI_HINT.pedidos} />
              <p className="text-text-primary font-bold text-sm">{row.orders}</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-indigo-500/25 p-3">
              <MetricHint icon={ShoppingBag} label="P. diretos" hint="Compras realizadas do produto divulgado." />
              <p className="text-indigo-400 font-bold text-sm">{row.directOrders ?? 0}</p>
            
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={Target} label="CPA médio" hint={ATI_HINT.cpa} />
              <p className="text-text-primary font-bold text-sm">{formatBRL(row.cpa)}</p>
            </div>
            <div className="rounded-lg bg-dark-card border border-dark-border p-3">
              <MetricHint icon={MousePointerClick} label="Cliques Shopee" hint={ATI_HINT.cliques} />
              <input
                type="number"
                min={0}
                step={1}
                value={clicksShopeeDraft}
                onChange={(e) => setClicksShopeeDraft(e.target.value)}
                className="w-full rounded-md border border-shopee-orange/60 bg-dark-card py-1.5 px-2 text-text-primary font-bold text-sm text-center focus:outline-none focus:border-shopee-orange/90 focus:ring-1 focus:ring-shopee-orange/20"
              />
            </div>
          </div>

          {/* Tabela Histórico Diário (uma linha = período) */}
          <div>
            <h4 className="text-sm font-semibold text-text-primary mb-2">Histórico do período</h4>
            <div className="overflow-x-auto rounded-lg border border-dark-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-dark-card border-b border-dark-border text-text-secondary">
                    <th className="text-left py-2 px-3 font-semibold">Período</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.custo}>Custo Tráfego</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.cliques}>Cliques Meta</th>
                    <th className="text-right py-2 px-2 font-semibold">CPC Meta (R$)</th>
                    <th className="text-right py-2 px-2 font-semibold">CTR</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.pedidos}>Pedidos</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.cpa}>CPA (R$)</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.valorVendas}>Valor vendas</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.comissao}>Comissão</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.lucro}>Lucro líq.</th>
                    <th className="text-right py-2 px-2 font-semibold cursor-help" title={ATI_HINT.roas}>ROAS</th>
                    <th className="text-right py-2 px-2 font-semibold">EPC (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-dark-bg/50 border-b border-dark-border text-text-primary">
                    <td className="py-2 px-3">{dateLabel}</td>
                    <td className="text-right py-2 px-2 text-red-400">{formatBRL(row.cost)}</td>
                    <td className="text-right py-2 px-2">{row.clicksMeta}</td>
                    <td className="text-right py-2 px-2">{formatBRL(row.cpcMeta)}</td>
                    <td className="text-right py-2 px-2">{row.ctrMeta.toFixed(2)}%</td>
                    <td className="text-right py-2 px-2">{row.orders}</td>
                    <td className="text-right py-2 px-2">{formatBRL(row.cpa)}</td>
                    <td className="text-right py-2 px-2 text-sky-300/90">{formatBRL(row.revenue)}</td>
                    <td className="text-right py-2 px-2 text-shopee-orange">{formatBRL(row.commission)}</td>
                    <td className={`text-right py-2 px-2 ${isProfitPositive ? "text-emerald-400" : "text-red-400"}`}>{formatBRL(profit)}</td>
                    <td className="text-right py-2 px-2">{row.roas.toFixed(2)}</td>
                    <td className="text-right py-2 px-2">{formatBRL(effectiveEpc)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Diagnóstico / Aviso abaixo da tabela */}
          {effectiveDiagnosis && (
            <div
              className={`rounded-lg border p-3 text-sm ${
                effectiveStatus === "excellent"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : effectiveStatus === "bad"
                    ? "bg-red-500/10 border-red-500/30 text-red-200"
                    : effectiveStatus === "pending"
                      ? "bg-dark-border/20 border-dark-border text-text-secondary"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              }`}
            >
              <p className="font-semibold mb-0.5">
                {effectiveStatus === "excellent"
                  ? "Pronto para escala"
                  : effectiveStatus === "bad"
                    ? "Criativo ruim"
                    : effectiveStatus === "pending"
                      ? "Aguardando dados"
                      : "Criativo bom"}
              </p>
              <p className="opacity-90">{effectiveDiagnosis}</p>
            </div>
          )}

          {effectiveCanValidate && (
            <button
              onClick={() => onValidate(row)}
              disabled={!!validatingId}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-60 transition-colors"
            >
              {validatingId === row.adId ? "Salvando..." : <><Rocket className="h-3.5 w-3.5" /> Adicionar em Criativo Validado</>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ATIClient() {
  const router = useRouter();
  const [start, setStart] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [end, setEnd] = useState(() => new Date().toISOString().slice(0, 10));
  /** Loading de tela cheia (sem dados em cache para o período ou primeira carga). */
  const [loading, setLoading] = useState(true);
  /** Atualização manual ou após ações — ícone no botão, lista continua visível. */
  const [refreshing, setRefreshing] = useState(false);
  const dataPresentRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [creatives, setCreatives] = useState<ATICreativeRow[]>([]);
  const [validated, setValidated] = useState<Array<{ id: string; adId: string; adName: string; campaignId: string; campaignName: string; scaledAt: string }>>([]);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [expandedAdId, setExpandedAdId] = useState<string | null>(null);
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterAdSet, setFilterAdSet] = useState("");
  const [filterAd, setFilterAd] = useState("");

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkModalAd, setLinkModalAd] = useState<ATICreativeRow | null>(null);
  const [linkModalAdId, setLinkModalAdId] = useState("");
  const [linkModalShopeeLink, setLinkModalShopeeLink] = useState("");
  const [linkModalPublishing, setLinkModalPublishing] = useState(false);
  const [linkModalError, setLinkModalError] = useState<string | null>(null);
  const [linkModalErrorDetail, setLinkModalErrorDetail] = useState<string | null>(null);
  const [linkModalTitle, setLinkModalTitle] = useState<"Gerar link de anúncio" | "Editar link de anúncio">("Gerar link de anúncio");
  const [linkModalLoadingLink, setLinkModalLoadingLink] = useState(false);
  const [adIdToHasLink, setAdIdToHasLink] = useState<Record<string, boolean>>({});
  const [campaignStatus, setCampaignStatus] = useState<Record<string, string>>({});
  const [campaignTogglingId, setCampaignTogglingId] = useState<string | null>(null);
  const [campaignsList, setCampaignsList] = useState<Array<{ id: string; name: string; ad_account_id: string }>>([]);
  const [adSetList, setAdSetList] = useState<Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }>>([]);
  const [adSetStatusMap, setAdSetStatusMap] = useState<Record<string, string>>({});
  const [adStatusMap, setAdStatusMap] = useState<Record<string, string>>({});
  const [adSetTogglingId, setAdSetTogglingId] = useState<string | null>(null);
  const [adTogglingId, setAdTogglingId] = useState<string | null>(null);
  const [campaignIdsTraficoGrupos, setCampaignIdsTraficoGrupos] = useState<string[]>([]);
  const [traficoGruposTogglingId, setTraficoGruposTogglingId] = useState<string | null>(null);
  const [campaignIdsInfoP, setCampaignIdsInfoP] = useState<string[]>([]);
  const [infopTogglingId, setInfopTogglingId] = useState<string | null>(null);
  const [expandedCampaigns, setExpandedCampaigns] = useState<Record<string, boolean>>({});
  const [expandedAdSets, setExpandedAdSets] = useState<Record<string, boolean>>({});
  const [campaignListPage, setCampaignListPage] = useState(1);

  // Campanha: editar / deletar
  const [campaignEditModal, setCampaignEditModal] = useState<{
    campaignId: string;
    campaignName: string;
    /** Tráfego ou Vendas; vazio = não alterar objetivo no Meta ao salvar */
    objective: string;
    metaObjective: string | null;
    loadingObjective: boolean;
  } | null>(null);
  const [campaignEditSaving, setCampaignEditSaving] = useState(false);
  const [campaignDeleteConfirm, setCampaignDeleteConfirm] = useState<{ campaignId: string; campaignName: string } | null>(null);
  const [campaignDeleteDeleting, setCampaignDeleteDeleting] = useState(false);

  // Conjunto: novo / editar / deletar / duplicar
  const [adSetNewModal, setAdSetNewModal] = useState<{ campaignId: string; adAccountId: string; campaignName: string } | null>(null);
  const [adSetNewSaving, setAdSetNewSaving] = useState(false);
  const [adSetNewError, setAdSetNewError] = useState<string | null>(null);
  const [adSetEditModal, setAdSetEditModal] = useState<{ adSetId: string; adSetName: string; adAccountId: string; campaignId?: string; campaignName?: string } | null>(null);
  const [adSetEditSaving, setAdSetEditSaving] = useState(false);
  const [adSetEditError, setAdSetEditError] = useState<string | null>(null);
  const [adSetEditInitialData, setAdSetEditInitialData] = useState<{
    name: string;
    daily_budget: string;
    country_code: string;
    country_codes: string[];
    age_min: number;
    age_max: number;
    gender: "all" | "male" | "female";
    optimization_goal: string;
    pixel_id: string;
    conversion_event: string;
    publisher_platforms: string[];
  } | null>(null);
  const [adSetDeleteConfirm, setAdSetDeleteConfirm] = useState<{ adSetId: string; adSetName: string } | null>(null);
  const [adSetDeleteDeleting, setAdSetDeleteDeleting] = useState(false);
  const [adSetDuplicateModal, setAdSetDuplicateModal] = useState<{ adSetId: string; adSetName: string } | null>(null);
  const [adSetDuplicateCount, setAdSetDuplicateCount] = useState("5");
  const [adSetDuplicateSaving, setAdSetDuplicateSaving] = useState(false);

  // Anúncio: deletar / duplicar / novo / editar
  const [adNewModal, setAdNewModal] = useState<{ adAccountId: string; adsetId: string; adSetName: string } | null>(null);
  const [adNewSaving, setAdNewSaving] = useState(false);
  const [adNewError, setAdNewError] = useState<string | null>(null);
  const [adEditModal, setAdEditModal] = useState<{ adId: string; adName: string; adAccountId: string; adsetId: string; adSetName: string } | null>(null);
  const [adEditSaving, setAdEditSaving] = useState(false);
  const [adEditError, setAdEditError] = useState<string | null>(null);
  const [adEditInitialData, setAdEditInitialData] = useState<{
    name: string;
    link: string;
    message: string;
    title: string;
    call_to_action: string;
    page_id: string;
  } | null>(null);
  const [adDeleteConfirm, setAdDeleteConfirm] = useState<{ adId: string; adName: string } | null>(null);
  const [adDeleteDeleting, setAdDeleteDeleting] = useState(false);
  const [adDuplicateModal, setAdDuplicateModal] = useState<{ adId: string; adName: string } | null>(null);
  const [adDuplicateCount, setAdDuplicateCount] = useState("5");
  const [adDuplicateSaving, setAdDuplicateSaving] = useState(false);
  const [shopeeWarning, setShopeeWarning] = useState<string | null>(null);
  const [pauseConfirm, setPauseConfirm] = useState<{ type: "campaign" | "adset" | "ad"; id: string; name: string } | null>(null);
  const [pauseConfirmLoading, setPauseConfirmLoading] = useState(false);

  const applyAtiPayload = useCallback((data: ATIDashboardSessionPayload) => {
    setCreatives(data.creatives);
    setValidated(data.validated);
    setCampaignStatus(data.campaignStatus);
    setCampaignsList(data.campaignsList);
    setAdSetList(data.adSetList);
    setAdSetStatusMap(data.adSetStatusMap);
    setAdStatusMap(data.adStatusMap);
    setShopeeWarning(data.shopeeWarning);
    setCampaignIdsTraficoGrupos(data.campaignIdsTraficoGrupos);
    setCampaignIdsInfoP(Array.isArray(data.campaignIdsInfoP) ? data.campaignIdsInfoP : []);
  }, []);

  useEffect(() => {
    dataPresentRef.current =
      creatives.length > 0 ||
      campaignsList.length > 0 ||
      validated.length > 0;
  }, [creatives.length, campaignsList.length, validated.length]);

  const load = useCallback(
    async (opts?: { skipCache?: boolean }) => {
      if (!opts?.skipCache) {
        const cached = readAtiSessionCache(start, end);
        if (cached) {
          applyAtiPayload(cached);
          setLoading(false);
          setRefreshing(false);
          setError(null);
          return;
        }
      }

      const keepUiOnError = opts?.skipCache === true;
      const soft = opts?.skipCache === true && dataPresentRef.current;

      if (soft) setRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/ati/data?start=${start}&end=${end}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar");

        const tagsRes = await fetch("/api/ati/campaign-tags?tag=Tráfego%20para%20Grupos", { cache: "no-store" });
        let campaignIdsTraficoGrupos: string[] = [];
        if (tagsRes.ok) {
          const tagsJson = (await tagsRes.json()) as { campaignIds?: string[] };
          campaignIdsTraficoGrupos = Array.isArray(tagsJson.campaignIds) ? tagsJson.campaignIds : [];
        }

        const infopTagsRes = await fetch("/api/ati/campaign-tags?tag=Tráfego%20para%20InfoP", { cache: "no-store" });
        let campaignIdsInfoP: string[] = [];
        if (infopTagsRes.ok) {
          const infopJson = (await infopTagsRes.json()) as { campaignIds?: string[] };
          campaignIdsInfoP = Array.isArray(infopJson.campaignIds) ? infopJson.campaignIds : [];
        }

        const payload: ATIDashboardSessionPayload = {
          creatives: json.creatives ?? [],
          validated: json.validated ?? [],
          campaignStatus: (json.campaignStatus as Record<string, string>) ?? {},
          campaignsList: Array.isArray(json.campaignsList) ? json.campaignsList : [],
          adSetList: Array.isArray(json.adSetList) ? json.adSetList : [],
          adSetStatusMap: (json.adSetStatusMap as Record<string, string>) ?? {},
          adStatusMap: (json.adStatusMap as Record<string, string>) ?? {},
          shopeeWarning: typeof json.shopeeWarning === "string" ? json.shopeeWarning : null,
          campaignIdsTraficoGrupos,
          campaignIdsInfoP,
        };

        writeAtiSessionCache(start, end, payload);
        applyAtiPayload(payload);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
        if (!keepUiOnError) {
          setCreatives([]);
          setValidated([]);
          setCampaignStatus({});
          setCampaignsList([]);
          setAdSetList([]);
          setAdSetStatusMap({});
          setAdStatusMap({});
          setCampaignIdsTraficoGrupos([]);
          setCampaignIdsInfoP([]);
          setShopeeWarning(null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [start, end, applyAtiPayload],
  );

  useLayoutEffect(() => {
    const cached = readAtiSessionCache(start, end);
    if (cached) {
      applyAtiPayload(cached);
      setLoading(false);
      setError(null);
    } else {
      setLoading(true);
    }
  }, [start, end, applyAtiPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!adSetEditModal) {
      setAdSetEditInitialData(null);
      return;
    }
    let cancelled = false;
    setAdSetEditInitialData(null);
    fetch(`/api/meta/adsets?adset_id=${encodeURIComponent(adSetEditModal.adSetId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || json.error) return;
        const cc = Array.isArray(json.country_codes) && json.country_codes.length > 0
          ? json.country_codes.map((x: string) => String(x).toUpperCase().slice(0, 2))
          : [json.country_code ?? "BR"];
        setAdSetEditInitialData({
          name: json.name ?? "",
          daily_budget: json.daily_budget ?? "10",
          country_code: cc[0] ?? "BR",
          country_codes: cc,
          age_min: json.age_min ?? 18,
          age_max: json.age_max ?? 65,
          gender: json.gender ?? "all",
          optimization_goal: json.optimization_goal ?? "LINK_CLICKS",
          pixel_id: json.pixel_id ?? "",
          conversion_event: json.conversion_event ?? "PAGE_VIEW",
          publisher_platforms: Array.isArray(json.publisher_platforms) ? json.publisher_platforms : ["facebook", "instagram"],
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adSetEditModal?.adSetId]);

  useEffect(() => {
    if (!adEditModal) {
      setAdEditInitialData(null);
      return;
    }
    let cancelled = false;
    setAdEditInitialData(null);
    fetch(`/api/meta/ads/details?ad_id=${encodeURIComponent(adEditModal.adId)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || json.error) return;
        setAdEditInitialData({
          name: json.name ?? "",
          link: json.link ?? "https://www.facebook.com",
          message: json.message ?? "",
          title: json.title ?? "",
          call_to_action: json.call_to_action ?? "LEARN_MORE",
          page_id: json.page_id ?? "",
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adEditModal?.adId]);

  const handleValidate = async (row: ATICreativeRow) => {
    setValidatingId(row.adId);
    try {
      const res = await fetch("/api/ati/validated", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_id: row.adId,
          ad_name: row.adName,
          campaign_id: row.campaignId,
          campaign_name: row.campaignName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro");
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao adicionar");
    } finally {
      setValidatingId(null);
    }
  };

  const handleRemoveValidated = async (id: string) => {
    try {
      const res = await fetch(`/api/ati/validated?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    }
  };

  const handleConfirmPause = async () => {
    if (!pauseConfirm) return;
    const { type, id } = pauseConfirm;
    setPauseConfirmLoading(true);
    try {
      if (type === "campaign") {
        setCampaignTogglingId(id);
        const res = await fetch("/api/meta/campaigns/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaign_id: id, status: "PAUSED" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao pausar");
        setCampaignStatus((prev) => ({ ...prev, [id]: "PAUSED" }));
        setCampaignTogglingId(null);
      } else if (type === "adset") {
        setAdSetTogglingId(id);
        const res = await fetch("/api/meta/adsets/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ adset_id: id, status: "PAUSED" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao pausar");
        setAdSetStatusMap((prev) => ({ ...prev, [id]: "PAUSED" }));
        setAdSetTogglingId(null);
      } else {
        setAdTogglingId(id);
        const res = await fetch("/api/meta/ads/status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_id: id, status: "PAUSED" }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao pausar");
        setAdStatusMap((prev) => ({ ...prev, [id]: "PAUSED" }));
        setAdTogglingId(null);
      }
      setPauseConfirm(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao pausar");
      setCampaignTogglingId(null);
      setAdSetTogglingId(null);
      setAdTogglingId(null);
    } finally {
      setPauseConfirmLoading(false);
    }
  };

  const handleCampaignStatusToggle = async (campaignId: string) => {
    const isActive = campaignStatus[campaignId] === "ACTIVE";
    if (isActive) {
      const name = campaignsList.find((c) => c.id === campaignId)?.name ?? campaignId;
      setPauseConfirm({ type: "campaign", id: campaignId, name });
      return;
    }
    setCampaignTogglingId(campaignId);
    try {
      const res = await fetch("/api/meta/campaigns/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaign_id: campaignId, status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar campanha");
      setCampaignStatus((prev) => ({ ...prev, [campaignId]: "ACTIVE" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar status");
    } finally {
      setCampaignTogglingId(null);
    }
  };

  const toggleCampaign = (campaignId: string) => {
    setExpandedCampaigns((prev) => ({ ...prev, [campaignId]: !prev[campaignId] }));
  };
  const toggleAdSet = (adSetId: string) => {
    setExpandedAdSets((prev) => ({ ...prev, [adSetId]: !prev[adSetId] }));
  };

  const handleToggleTraficoGrupos = async (campaignId: string) => {
    const hasTag = campaignIdsTraficoGrupos.includes(campaignId);
    setTraficoGruposTogglingId(campaignId);
    try {
      const res = await fetch("/api/ati/campaign-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          tag: "Tráfego para Grupos",
          add: !hasTag,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar tag");
      setCampaignIdsTraficoGrupos((prev) =>
        hasTag ? prev.filter((id) => id !== campaignId) : [...prev, campaignId]
      );
      // Mantém o cache de sessão coerente — senão, ao sair e voltar, o toggle volta ao estado antigo.
      const cached = readAtiSessionCache(start, end);
      if (cached) {
        const currentIds = Array.isArray(cached.campaignIdsTraficoGrupos) ? cached.campaignIdsTraficoGrupos : [];
        const nextIds = hasTag
          ? currentIds.filter((id) => id !== campaignId)
          : [...currentIds, campaignId];
        writeAtiSessionCache(start, end, { ...cached, campaignIdsTraficoGrupos: nextIds });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar tag");
    } finally {
      setTraficoGruposTogglingId(null);
    }
  };

  const handleToggleInfoP = async (campaignId: string) => {
    const hasTag = campaignIdsInfoP.includes(campaignId);
    setInfopTogglingId(campaignId);
    try {
      const res = await fetch("/api/ati/campaign-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          tag: "Tráfego para InfoP",
          add: !hasTag,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar tag InfoP");
      setCampaignIdsInfoP((prev) =>
        hasTag ? prev.filter((id) => id !== campaignId) : [...prev, campaignId],
      );
      // Mantém o cache de sessão coerente — senão, ao sair e voltar, o toggle volta ao estado antigo.
      const cached = readAtiSessionCache(start, end);
      if (cached) {
        const currentIds = Array.isArray(cached.campaignIdsInfoP) ? cached.campaignIdsInfoP : [];
        const nextIds = hasTag
          ? currentIds.filter((id) => id !== campaignId)
          : [...currentIds, campaignId];
        writeAtiSessionCache(start, end, { ...cached, campaignIdsInfoP: nextIds });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar tag InfoP");
    } finally {
      setInfopTogglingId(null);
    }
  };

  const handleAdSetStatusToggle = async (adSetId: string) => {
    const isActive = adSetStatusMap[adSetId] === "ACTIVE";
    if (isActive) {
      const name = adSetList.find((s) => s.id === adSetId)?.name ?? adSetId;
      setPauseConfirm({ type: "adset", id: adSetId, name });
      return;
    }
    setAdSetTogglingId(adSetId);
    try {
      const res = await fetch("/api/meta/adsets/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adset_id: adSetId, status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar conjunto");
      setAdSetStatusMap((prev) => ({ ...prev, [adSetId]: "ACTIVE" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar status do conjunto");
    } finally {
      setAdSetTogglingId(null);
    }
  };

  const handleAdStatusToggle = async (adId: string) => {
    const isActive = adStatusMap[adId] === "ACTIVE";
    if (isActive) {
      const name = creatives.find((c) => c.adId === adId)?.adName ?? adId;
      setPauseConfirm({ type: "ad", id: adId, name });
      return;
    }
    setAdTogglingId(adId);
    try {
      const res = await fetch("/api/meta/ads/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: adId, status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao atualizar anúncio");
      setAdStatusMap((prev) => ({ ...prev, [adId]: "ACTIVE" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao alterar status do anúncio");
    } finally {
      setAdTogglingId(null);
    }
  };

  const handleCampaignEditSave = async () => {
    if (!campaignEditModal) return;
    setCampaignEditSaving(true);
    try {
      const res = await fetch("/api/meta/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignEditModal.campaignId,
          name: campaignEditModal.campaignName.trim(),
          ...(campaignEditModal.objective
            ? { objective: campaignEditModal.objective }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao editar");
      setCampaignEditModal(null);
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao editar campanha");
    } finally {
      setCampaignEditSaving(false);
    }
  };

  const handleCampaignDeleteConfirm = async () => {
    if (!campaignDeleteConfirm) return;
    setCampaignDeleteDeleting(true);
    try {
      const res = await fetch(`/api/meta/campaigns?campaign_id=${encodeURIComponent(campaignDeleteConfirm.campaignId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao deletar");
      setCampaignDeleteConfirm(null);
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao deletar campanha");
    } finally {
      setCampaignDeleteDeleting(false);
    }
  };

  const handleAdSetNewSave = async (body: import("@/app/components/meta/MetaAdSetForm").MetaAdSetFormBody) => {
    if (!adSetNewModal) return;
    setAdSetNewError(null);
    setAdSetNewSaving(true);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adSetNewModal.adAccountId,
          campaign_id: adSetNewModal.campaignId,
          name: body.name,
          daily_budget: body.daily_budget,
          country_codes: body.country_codes,
          country_code: body.country_codes?.[0] ?? body.country_code,
          age_min: body.age_min,
          age_max: body.age_max,
          gender: body.gender,
          optimization_goal: body.optimization_goal,
          pixel_id: body.pixel_id,
          conversion_event: body.conversion_event,
          publisher_platforms: body.publisher_platforms,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar conjunto");
      const newAdsetId = json.adset_id;
      const adAccountId = adSetNewModal.adAccountId;
      const newAdsetName = body.name;
      setAdSetNewModal(null);
      await load({ skipCache: true });
      // Abrir imediatamente o modal de Novo anúncio para criar o ad deste conjunto
      if (newAdsetId && adAccountId) {
        setAdNewModal({ adAccountId, adsetId: newAdsetId, adSetName: newAdsetName });
        setAdNewError(null);
      }
    } catch (e) {
      setAdSetNewError(e instanceof Error ? e.message : "Erro ao criar conjunto");
    } finally {
      setAdSetNewSaving(false);
    }
  };

  const handleAdNewSave = async (body: import("@/app/components/meta/MetaAdForm").MetaAdFormBody) => {
    if (!adNewModal) return;
    setAdNewError(null);
    setAdNewSaving(true);
    try {
      const res = await fetch("/api/meta/ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ad_account_id: adNewModal.adAccountId,
          adset_id: adNewModal.adsetId,
          name: body.name,
          page_id: body.page_id,
          link: body.link || "https://www.facebook.com",
          message: body.message,
          title: body.title,
          call_to_action: body.call_to_action,
          image_hash: body.image_hash,
          image_url: body.image_url,
          video_id: body.video_id,
          ...(body.tracking_pixel_id ? { tracking_pixel_id: body.tracking_pixel_id } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao criar anúncio");
      setAdNewModal(null);
      await load({ skipCache: true });
    } catch (e) {
      setAdNewError(e instanceof Error ? e.message : "Erro ao criar anúncio");
    } finally {
      setAdNewSaving(false);
    }
  };

  const handleAdSetEditSave = async (body: import("@/app/components/meta/MetaAdSetForm").MetaAdSetFormBody) => {
    if (!adSetEditModal) return;
    setAdSetEditError(null);
    setAdSetEditSaving(true);
    try {
      const res = await fetch("/api/meta/adsets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adset_id: adSetEditModal.adSetId,
          campaign_id: adSetEditModal.campaignId,
          name: body.name,
          daily_budget: body.daily_budget,
          country_codes: body.country_codes,
          country_code: body.country_codes?.[0] ?? body.country_code,
          age_min: body.age_min,
          age_max: body.age_max,
          gender: body.gender,
          optimization_goal: body.optimization_goal,
          pixel_id: body.pixel_id,
          conversion_event: body.conversion_event,
          publisher_platforms: body.publisher_platforms,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao editar conjunto");
      setAdSetEditModal(null);
      setAdSetEditInitialData(null);
      await load({ skipCache: true });
    } catch (e) {
      setAdSetEditError(e instanceof Error ? e.message : "Erro ao editar conjunto");
    } finally {
      setAdSetEditSaving(false);
    }
  };

  const handleAdSetDeleteConfirm = async () => {
    if (!adSetDeleteConfirm) return;
    setAdSetDeleteDeleting(true);
    try {
      const res = await fetch(`/api/meta/adsets?adset_id=${encodeURIComponent(adSetDeleteConfirm.adSetId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao deletar");
      setAdSetDeleteConfirm(null);
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao deletar conjunto");
    } finally {
      setAdSetDeleteDeleting(false);
    }
  };

  const handleAdSetDuplicateSave = async () => {
    if (!adSetDuplicateModal) return;
    const count = Math.min(50, Math.max(1, parseInt(adSetDuplicateCount, 10) || 1));
    setAdSetDuplicateSaving(true);
    try {
      const res = await fetch("/api/meta/adsets/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adset_id: adSetDuplicateModal.adSetId, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao duplicar");
      setAdSetDuplicateModal(null);
      setAdSetDuplicateCount("5");
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao duplicar conjunto");
    } finally {
      setAdSetDuplicateSaving(false);
    }
  };

  const handleAdDeleteConfirm = async () => {
    if (!adDeleteConfirm) return;
    setAdDeleteDeleting(true);
    try {
      const res = await fetch(`/api/meta/ads?ad_id=${encodeURIComponent(adDeleteConfirm.adId)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao deletar");
      setAdDeleteConfirm(null);
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao deletar anúncio");
    } finally {
      setAdDeleteDeleting(false);
    }
  };

  const handleAdDuplicateSave = async () => {
    if (!adDuplicateModal) return;
    const count = Math.min(50, Math.max(1, parseInt(adDuplicateCount, 10) || 1));
    setAdDuplicateSaving(true);
    try {
      const res = await fetch("/api/meta/ads/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: adDuplicateModal.adId, count }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao duplicar");
      setAdDuplicateModal(null);
      setAdDuplicateCount("5");
      await load({ skipCache: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao duplicar anúncio");
    } finally {
      setAdDuplicateSaving(false);
    }
  };

  const handleAdEditSave = async (body: import("@/app/components/meta/MetaAdForm").MetaAdFormBody) => {
    if (!adEditModal) return;
    setAdEditError(null);
    setAdEditSaving(true);
    try {
      const resName = await fetch("/api/meta/ads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ad_id: adEditModal.adId, name: body.name.trim() || adEditModal.adName }),
      });
      const jsonName = await resName.json();
      if (!resName.ok) throw new Error(jsonName?.error ?? "Erro ao editar nome");
      if (body.link && body.link.trim()) {
        const resLink = await fetch("/api/meta/ads/update-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ad_id: adEditModal.adId, link: body.link.trim() }),
        });
        const jsonLink = await resLink.json();
        if (!resLink.ok) throw new Error(jsonLink?.error ?? "Erro ao atualizar link");
      }
      setAdEditModal(null);
      setAdEditInitialData(null);
      await load({ skipCache: true });
    } catch (e) {
      setAdEditError(e instanceof Error ? e.message : "Erro ao editar anúncio");
    } finally {
      setAdEditSaving(false);
    }
  };

  const handleExpandedFetchLink = (row: ATICreativeRow) => {
    if (adIdToHasLink[row.adId] !== undefined) return;
    fetch(`/api/meta/ads/current-link?ad_id=${encodeURIComponent(row.adId)}`)
      .then((r) => r.json())
      .then((json: { link?: string | null }) => {
        setAdIdToHasLink((prev) => ({ ...prev, [row.adId]: Boolean(json?.link) }));
      })
      .catch(() => {});
  };

  const handleOpenLinkModal = (row: ATICreativeRow) => {
    setLinkModalAd(row);
    setLinkModalAdId(row.adId);
    setLinkModalShopeeLink("");
    setLinkModalError(null);
    setLinkModalErrorDetail(null);
    setLinkModalTitle("Gerar link de anúncio");
    setLinkModalOpen(true);
    setLinkModalLoadingLink(true);
    fetch(`/api/meta/ads/current-link?ad_id=${encodeURIComponent(row.adId)}`)
      .then((r) => r.json())
      .then((json: { link?: string | null }) => {
        const hasLink = Boolean(json?.link);
        setLinkModalTitle(hasLink ? "Editar link de anúncio" : "Gerar link de anúncio");
        if (json?.link) setLinkModalShopeeLink(json.link);
        setAdIdToHasLink((prev) => ({ ...prev, [row.adId]: hasLink }));
      })
      .catch(() => {})
      .finally(() => setLinkModalLoadingLink(false));
  };

  const filteredAndGrouped = useMemo(() => {
    const lowerCamp = filterCampaign.trim().toLowerCase();
    const lowerSet = filterAdSet.trim().toLowerCase();
    const lowerAd = filterAd.trim().toLowerCase();
    let tree = buildTree(campaignsList, adSetList, creatives);
    if (lowerCamp || lowerSet || lowerAd) {
      tree = tree
        .filter((c) => !lowerCamp || c.campaignName.toLowerCase().includes(lowerCamp))
        .map((camp) => ({
          ...camp,
          adSets: camp.adSets
            .filter((s) => !lowerSet || s.adSetName.toLowerCase().includes(lowerSet))
            .map((s) => ({
              ...s,
              ads: lowerAd ? s.ads.filter((a) => a.adName.toLowerCase().includes(lowerAd)) : s.ads,
            }))
            .filter((s) => !lowerAd || s.ads.length > 0),
        }))
        .filter((c) => c.adSets.length > 0);
    }
    return tree;
  }, [creatives, campaignsList, adSetList, filterCampaign, filterAdSet, filterAd]);

  const campaignListTotalPages = Math.max(1, Math.ceil(filteredAndGrouped.length / ATI_CAMPAIGNS_PER_PAGE));
  const paginatedCampaigns = useMemo(() => {
    const start = (campaignListPage - 1) * ATI_CAMPAIGNS_PER_PAGE;
    return filteredAndGrouped.slice(start, start + ATI_CAMPAIGNS_PER_PAGE);
  }, [filteredAndGrouped, campaignListPage]);

  useEffect(() => {
    setCampaignListPage(1);
  }, [filterCampaign, filterAdSet, filterAd]);

  useEffect(() => {
    const max = Math.max(1, Math.ceil(filteredAndGrouped.length / ATI_CAMPAIGNS_PER_PAGE));
    setCampaignListPage((p) => (p > max ? max : p < 1 ? 1 : p));
  }, [filteredAndGrouped.length]);

  const periodLabel = `${new Date(start).toLocaleDateString("pt-BR")} – ${new Date(end).toLocaleDateString("pt-BR")}`;
  const dateLabel = `Meta + Shopee: ${periodLabel}`;

  return (
    <>
      {/* ── Header ── */}
      <div className="mb-5">
        {/* Título + controles de período — numa única linha no desktop */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Título */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-shopee-orange/15 border border-shopee-orange/25 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-shopee-orange" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-text-primary leading-tight truncate">Advanced Traffic Intelligence</h1>
            
            </div>
          </div>

          {/* Período: métricas Meta (insights) + vendas Shopee no relatório */}
          <div className="flex flex-col items-end gap-1 shrink-0 max-w-full">
            <span className="text-[10px] text-text-secondary/80 font-medium uppercase tracking-wide text-right">
              Período Meta + Shopee
            </span>
            <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex items-center gap-1.5 bg-dark-card border border-dark-border rounded-xl px-3 py-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-text-secondary/60 shrink-0" />
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent text-text-primary text-xs w-[100px] focus:outline-none cursor-pointer"
              />
              <span className="text-text-secondary/50 text-xs select-none">—</span>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="bg-transparent text-text-primary text-xs w-[100px] focus:outline-none cursor-pointer"
              />
            </div>
            <button
              type="button"
              onClick={() => void load({ skipCache: true })}
              disabled={loading || refreshing}
              title="Atualizar ATI: campanhas Meta + vendas Shopee (período acima)"
              aria-label="Atualizar dados do ATI: campanhas Meta e vendas Shopee no período selecionado"
              className="inline-flex items-center gap-2 rounded-xl bg-shopee-orange px-3 py-1.5 sm:px-3.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0 shadow-sm border border-shopee-orange/30"
            >
              <RefreshCw
                className={`h-4 w-4 shrink-0 text-white stroke-2 ${refreshing ? "animate-spin" : ""}`}
              />
              <span>Atualizar</span>
            </button>
            {campaignsList.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-dark-card border border-dark-border text-text-secondary shrink-0">
                <BarChart3 className="h-2.5 w-2.5" />
                {campaignsList.length}c · {creatives.length}cr
              </span>
            )}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[min(360px,calc(100vh-12rem))] flex flex-col items-center justify-center px-6 py-16 -mx-1 rounded-none bg-dark-bg">
          <div className="relative flex items-center justify-center">
            <span className="absolute inline-flex h-20 w-20 rounded-full bg-shopee-orange/10 animate-ping" />
            <span className="absolute inline-flex h-14 w-14 rounded-full bg-shopee-orange/15 animate-pulse" />
            <Loader2 className="h-10 w-10 animate-spin text-shopee-orange relative z-10" />
          </div>
          <div className="flex flex-col items-center gap-2 text-center mt-8 max-w-sm">
            <span className="text-sm font-semibold text-white/95">Sincronizando ATI</span>
            <span className="text-xs text-white/45 leading-relaxed">
              Buscando campanhas Meta, anúncios e vendas Shopee no período selecionado…
            </span>
          </div>
        </div>
      ) : (
        <>
      {error && (
        <div className="mb-5 p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <p className="text-xs text-text-secondary mt-1">
              Token Meta obrigatório. Shopee é opcional para listar campanhas.{" "}
              <button type="button" onClick={() => router.push("/configuracoes")} className="text-shopee-orange hover:underline font-semibold">
                Configurações →
              </button>
            </p>
          </div>
          <button type="button" onClick={() => setError(null)} className="text-red-400/60 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {shopeeWarning && !error && (
        <div className="mb-5 p-3 rounded-xl border border-amber-500/35 bg-amber-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-200">Vendas Shopee (período)</p>
            <p className="text-xs text-text-secondary mt-1">{shopeeWarning}</p>
          </div>
          <button type="button" onClick={() => setShopeeWarning(null)} className="text-amber-400/60 text-xs shrink-0">✕</button>
        </div>
      )}

      {validated.length > 0 && (
        <section className="mb-6">
          <div className="bg-dark-card rounded-xl border border-emerald-500/20 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 bg-emerald-500/5 border-b border-emerald-500/15">
              <Rocket className="h-4 w-4 text-emerald-400 shrink-0" />
              <h2 className="text-sm font-semibold text-emerald-400 uppercase tracking-wide flex-1">
                Criativos Validados — Escala
              </h2>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold">
                {validated.length} criativo{validated.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="p-3">
              <p className="text-xs text-text-secondary mb-3 flex items-center gap-1.5">
                <span className="inline-block w-1 h-1 rounded-full bg-amber-400" />
                Aguarde ≥ 3 dias após aumentar o orçamento para o Meta estabilizar. Não mexa no orçamento durante esse período.
              </p>
              <ul className="space-y-1.5">
                {validated.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{v.adName}</p>
                        <p className="text-xs text-text-secondary">{v.campaignName} · Escalado em {new Date(v.scaledAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                    </div>
                    <button onClick={() => handleRemoveValidated(v.id)}
                      className="shrink-0 p-1.5 rounded-lg text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      <section>
        {/* Filtros */}
        {(creatives.length > 0 || campaignsList.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {/* Input unificado com ícone + separadores */}
            <div className="flex flex-1 min-w-0 items-center bg-dark-card border border-dark-border/40 rounded-xl overflow-hidden divide-x divide-dark-border/40">
              <div className="relative flex-1 min-w-[100px] group">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-secondary/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Campanha"
                  value={filterCampaign}
                  onChange={(e) => setFilterCampaign(e.target.value)}
                  className="w-full bg-transparent pl-7 pr-3 pt-2 pb-1.5 text-xs text-text-primary placeholder-text-secondary/40 focus:outline-none border-b-2 border-transparent focus:border-shopee-orange transition-colors"
                />
              </div>
              <div className="relative flex-1 min-w-[100px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-secondary/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Conjunto"
                  value={filterAdSet}
                  onChange={(e) => setFilterAdSet(e.target.value)}
                  className="w-full bg-transparent pl-7 pr-3 pt-2 pb-1.5 text-xs text-text-primary placeholder-text-secondary/40 focus:outline-none border-b-2 border-transparent focus:border-shopee-orange transition-colors"
                />
              </div>
              <div className="relative flex-1 min-w-[100px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-text-secondary/40 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Anúncio"
                  value={filterAd}
                  onChange={(e) => setFilterAd(e.target.value)}
                  className="w-full bg-transparent pl-7 pr-3 pt-2 pb-1.5 text-xs text-text-primary placeholder-text-secondary/40 focus:outline-none border-b-2 border-transparent focus:border-shopee-orange transition-colors"
                />
              </div>
            </div>
            {(filterCampaign || filterAdSet || filterAd) && (
              <button type="button" onClick={() => { setFilterCampaign(""); setFilterAdSet(""); setFilterAd(""); }}
                className="px-2.5 py-2 rounded-xl border border-dark-border/60 text-[11px] text-text-secondary/60 hover:text-red-400 hover:border-red-500/30 transition-all shrink-0">
                ✕ limpar
              </button>
            )}
          </div>
        )}

        {/* Tutorial */}
        <div className="mb-5 rounded-xl border border-dark-border bg-dark-card overflow-hidden">
          <button
            type="button"
            onClick={() => setHelpOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-dark-bg/40 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <HelpCircle className="h-4 w-4 text-shopee-orange" />
              Como cruzar Meta + Shopee e ver ROAS por criativo
            </span>
            {helpOpen ? <ChevronUp className="h-4 w-4 text-text-secondary" /> : <ChevronDown className="h-4 w-4 text-text-secondary" />}
          </button>
          {helpOpen && (
            <div className="px-4 pb-4 pt-0 border-t border-dark-border space-y-4 text-sm text-text-secondary">
              <div>
                <h3 className="text-text-primary font-semibold mb-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-shopee-orange" /> Por anúncio: um Sub ID
                </h3>
                <p className="text-text-primary bg-dark-bg/80 rounded-md p-3 border-l-2 border-shopee-orange">
                  No <strong>Gerador de links Shopee</strong>, use um código único em <strong>Sub ID 1</strong> (ex.: <code className="bg-dark-bg px-1 rounded">meta_a1</code>). Cole esse mesmo código no campo <strong>Sub ID Shopee</strong> do anúncio aqui no ATI. O link do anúncio no Meta pode ser o link gerado, sem precisar de <code className="bg-dark-bg px-1 rounded">utm_content</code>.
                </p>
              </div>
              <div>
                <h3 className="text-text-primary font-semibold mb-2 flex items-center gap-1.5"><Link2 className="h-4 w-4 text-shopee-orange" /> Passo a passo</h3>
                <ol className="list-decimal list-inside space-y-2 ml-2">
                  <li>Gere o link da oferta com Sub ID 1 = código seu (único por anúncio).</li>
                  <li>Abra o anúncio no ATI, salve esse código em <strong>Sub ID Shopee</strong>.</li>
                  <li>Use <strong>Colocar link no anúncio</strong> para publicar o link da Shopee no Meta (URL exata).</li>
                  <li>Vendas no relatório da Shopee com esse Sub1 aparecem cruzadas com o gasto do anúncio.</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {creatives.length === 0 && campaignsList.length === 0 && !loading ? (
          <div className="bg-dark-card border border-dashed border-dark-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
            <div className="w-12 h-12 rounded-2xl bg-shopee-orange/10 border border-shopee-orange/20 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-shopee-orange/60" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Nenhum dado no período</p>
              <p className="text-xs text-text-secondary mt-1 max-w-sm">
                Integrações não configuradas ou sem criativos. Configure Sub ID 1 no gerador e vincule cada anúncio no ATI para cruzar vendas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.push("/configuracoes")}
              className="inline-flex items-center gap-2 mt-1 px-4 py-2 rounded-xl bg-shopee-orange text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-[0_2px_12px_rgba(238,77,45,0.2)]"
            >
              <Settings className="h-4 w-4" /> Configurar Meta e Shopee
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedCampaigns.map((camp) => {
              const campaignOpen = expandedCampaigns[camp.campaignId];
              const campIsActive = campaignStatus[camp.campaignId] === "ACTIVE";
              return (
                <div key={camp.campaignId} className={`rounded-xl border overflow-hidden transition-all ${campIsActive ? "border-dark-border" : "border-dark-border/50 opacity-80"}`}>
                  {/* ── Cabeçalho campanha ── */}
                  <div className={`px-5 pt-3 pb-5 flex items-center justify-between gap-2 ${campIsActive ? "bg-[#27272A]" : "bg-[#1F1F23]"}`}>
                    <button
                      type="button"
                      onClick={() => toggleCampaign(camp.campaignId)}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      {campaignOpen ? (
                        <ChevronUp className="h-4 w-4 shrink-0 text-text-secondary" />
                      ) : (
                        <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
                      )}
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-text-primary truncate">{camp.campaignName}</h3>
                        <p className="text-[11px] text-text-secondary mt-0.5">{camp.adSets.length} conjunto{camp.adSets.length !== 1 ? "s" : ""}</p>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      <button
                        type="button"
                        disabled={traficoGruposTogglingId === camp.campaignId}
                        onClick={(e) => { e.stopPropagation(); handleToggleTraficoGrupos(camp.campaignId); }}
                        title={campaignIdsTraficoGrupos.includes(camp.campaignId) ? "Remover tag Tráfego para Grupos" : "Marcar como Tráfego para Grupos"}
                        aria-label="Tráfego para Grupos"
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                          campaignIdsTraficoGrupos.includes(camp.campaignId)
                            ? "bg-shopee-orange/15 text-shopee-orange border border-shopee-orange/40"
                            : "text-text-secondary border border-dark-border hover:border-shopee-orange/40 hover:text-shopee-orange"
                        } disabled:opacity-50`}
                      >
                        {traficoGruposTogglingId === camp.campaignId ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <MessageCircle className="h-3 w-3" />
                        )}
                        <span className="hidden md:inline">Grupos</span>
                      </button>
                      <button
                        type="button"
                        disabled={infopTogglingId === camp.campaignId}
                        onClick={(e) => { e.stopPropagation(); handleToggleInfoP(camp.campaignId); }}
                        title={campaignIdsInfoP.includes(camp.campaignId) ? "Remover tag Tráfego para InfoP" : "Marcar como Tráfego para InfoP (cruza com produtos Stripe)"}
                        aria-label="Tráfego para InfoP"
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                          campaignIdsInfoP.includes(camp.campaignId)
                            ? "bg-[#635bff]/15 text-[#a8a2ff] border border-[#635bff]/40"
                            : "text-text-secondary border border-dark-border hover:border-[#635bff]/40 hover:text-[#a8a2ff]"
                        } disabled:opacity-50`}
                      >
                        {infopTogglingId === camp.campaignId ? (
                          <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                          <CreditCard className="h-3 w-3" />
                        )}
                        <span className="hidden md:inline">InfoP</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCampaignEditModal({
                            campaignId: camp.campaignId,
                            campaignName: camp.campaignName,
                            objective: "",
                            metaObjective: null,
                            loadingObjective: true,
                          });
                          fetch(`/api/meta/campaigns?campaign_id=${encodeURIComponent(camp.campaignId)}`)
                            .then((r) => r.json())
                            .then((json) => {
                              const meta = String(json.objective ?? "OUTCOME_TRAFFIC").toUpperCase();
                              const isTrafficSalesOrLeads =
                                meta === "OUTCOME_TRAFFIC" || meta === "OUTCOME_SALES" || meta === "OUTCOME_LEADS";
                              setCampaignEditModal((p) =>
                                p && p.campaignId === camp.campaignId
                                  ? {
                                      ...p,
                                      metaObjective: meta,
                                      objective: isTrafficSalesOrLeads ? meta : "",
                                      loadingObjective: false,
                                    }
                                  : p
                              );
                            })
                            .catch(() => {
                              setCampaignEditModal((p) =>
                                p && p.campaignId === camp.campaignId
                                  ? { ...p, metaObjective: "OUTCOME_TRAFFIC", objective: "OUTCOME_TRAFFIC", loadingObjective: false }
                                  : p
                              );
                            });
                        }}
                        className="p-1.5 rounded-lg text-text-secondary hover:bg-dark-bg hover:text-text-primary transition-all"
                        title="Editar campanha"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setCampaignDeleteConfirm({ campaignId: camp.campaignId, campaignName: camp.campaignName }); }}
                        className="p-1.5 rounded-lg text-text-secondary hover:bg-red-500/15 hover:text-red-400 transition-all"
                        title="Deletar campanha"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                      {/* Toggle ativo/pausado */}
                      <div className="flex items-center gap-1.5 pl-1 border-l border-dark-border/60 ml-0.5">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={campIsActive}
                          disabled={campaignTogglingId === camp.campaignId}
                          onClick={(e) => { e.stopPropagation(); handleCampaignStatusToggle(camp.campaignId); }}
                          title={campIsActive ? "Pausar campanha" : "Ativar campanha"}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 transition-colors focus:outline-none disabled:opacity-50 ${
                            campIsActive ? "bg-emerald-500 border-transparent" : "bg-dark-border border-gray-600"
                          }`}
                        >
                          <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition ${campIsActive ? "translate-x-4" : "translate-x-0.5"}`} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {campaignOpen && (
                    <div className="border-t pb-4 bg-[#242428] border-dark-border">
                      {camp.adAccountId && (
                        <div className={`px-4 py-2 pl-5 border-b border-dark-border/40 flex items-center gap-2  ${campIsActive ? "bg-[#242428]" : "bg-[#222226]"}`}>
                          <button
                            type="button"
                            onClick={() => { setAdSetNewModal({ campaignId: camp.campaignId, adAccountId: camp.adAccountId!, campaignName: camp.campaignName }); setAdSetNewError(null); }}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#06a548] border border-dark-border px-2.5 py-1 text-xs font-medium text-white hover:text-text-primary hover:border-shopee-orange/40 transition-all cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                            Novo conjunto
                          </button>
                        </div>
                      )}
                      {camp.adSets.map((set) => {
                        const adSetOpen = expandedAdSets[set.adSetId];
                        const adSetIsActive = adSetStatusMap[set.adSetId] === "ACTIVE";
                        return (
                          <div key={set.adSetId} className="mx-3 mb-3 border border-dark-border/60 bg-[#242428] rounded-xl overflow-hidden">
                            <div className="flex items-center w-full bg-[#323235]">
                              <button
                                type="button"
                                onClick={() => toggleAdSet(set.adSetId)}
                                className="flex items-center gap-2 flex-1 min-w-0 px-4 py-2 pl-5 text-left border-l-2 border-shopee-orange/60 cursor-pointer"
                              >
                                {adSetOpen ? (
                                  <ChevronUp className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                                )}
                                <div className="min-w-0">
                                  <span className="text-xs font-semibold text-text-primary block truncate">{set.adSetName}</span>
                                  <span className="text-[10px] text-text-secondary">{set.ads.length} anúncio{set.ads.length !== 1 ? "s" : ""}</span>
                                </div>
                              </button>
                              <div className="flex items-center gap-1 pr-2 shrink-0">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={adSetIsActive}
                                  disabled={adSetTogglingId === set.adSetId}
                                  onClick={(e) => { e.stopPropagation(); handleAdSetStatusToggle(set.adSetId); }}
                                  title={adSetIsActive ? "Pausar conjunto" : "Ativar conjunto"}
                                  className={`relative inline-flex h-4 w-8 shrink-0 rounded-full border-2 transition-colors disabled:opacity-50 ${adSetIsActive ? "bg-emerald-500 border-transparent" : "bg-dark-border border-gray-600"}`}
                                >
                                  <span className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow ring-0 transition ${adSetIsActive ? "translate-x-3.5" : "translate-x-0.5"}`} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAdSetEditModal({ adSetId: set.adSetId, adSetName: set.adSetName, adAccountId: set.adAccountId ?? "", campaignId: camp.campaignId, campaignName: camp.campaignName }); setAdSetEditError(null); }}
                                  className="p-1.5 rounded-lg text-text-secondary hover:bg-dark-bg hover:text-text-primary transition-all"
                                  title="Editar conjunto"
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAdSetDeleteConfirm({ adSetId: set.adSetId, adSetName: set.adSetName }); }}
                                  className="p-1.5 rounded-lg text-text-secondary hover:bg-red-500/15 hover:text-red-400 transition-all"
                                  title="Deletar conjunto"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setAdSetDuplicateModal({ adSetId: set.adSetId, adSetName: set.adSetName }); setAdSetDuplicateCount("5"); }}
                                  className="p-1.5 rounded-lg text-text-secondary hover:bg-shopee-orange/15 hover:text-shopee-orange transition-all"
                                  title="Duplicar conjunto"
                                >
                                  <CopyPlus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                            {adSetOpen && set.adAccountId && (
                              <div className="px-4 py-2 pl-7 border-b border-dark-border/40 flex items-center gap-2 bg-[#323235]">
                                <button
                                  type="button"
                                  onClick={() => { setAdNewModal({ adAccountId: set.adAccountId!, adsetId: set.adSetId, adSetName: set.adSetName }); setAdNewError(null); }}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1C77FF] border border-dark-border px-2.5 py-1 text-xs font-medium text-white hover:text-text-primary hover:border-shopee-orange/40 transition-all cursor-pointer"
                                >
                                  <Plus className="h-3 w-3" />
                                  Novo anúncio
                                </button>
                              </div>
                            )}
                            {adSetOpen && (
                              <div className="bg-[#212124] pl-7 pr-3 py-2.5 space-y-1.5">
                                {set.ads.map((row) => (
                                  <AdAccordionItem
                                    key={row.adId}
                                    row={row}
                                    dateLabel={dateLabel}
                                    expandedId={expandedAdId}
                                    onToggle={(id) => setExpandedAdId((prev) => (prev === id ? null : id))}
                                    onValidate={handleValidate}
                                    validatingId={validatingId}
                                    onOpenLinkModal={handleOpenLinkModal}
                                    hasExistingLink={adIdToHasLink[row.adId]}
                                    onExpandedFetchLink={handleExpandedFetchLink}
                                    onDeleteAd={(r) => setAdDeleteConfirm({ adId: r.adId, adName: r.adName })}
                                    onDuplicateAd={(r) => { setAdDuplicateModal({ adId: r.adId, adName: r.adName }); setAdDuplicateCount("5"); }}
                                    adStatus={adStatusMap[row.adId]}
                                    onAdStatusToggle={handleAdStatusToggle}
                                    adTogglingId={adTogglingId}
                                    onEditAd={(r) => {
                                      if (r.adAccountId) {
                                        setAdEditModal({ adId: r.adId, adName: r.adName, adAccountId: r.adAccountId, adsetId: r.adSetId, adSetName: r.adSetName });
                                        setAdEditError(null);
                                      } else setError("Conta de anúncios não disponível.");
                                    }}
                                    onReloadAti={load}
                                    campaignIsInfoP={campaignIdsInfoP.includes(camp.campaignId)}
                                    campaignIsGrupos={campaignIdsTraficoGrupos.includes(camp.campaignId)}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {campaignListTotalPages > 1 && filteredAndGrouped.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 mt-1 border-t border-dark-border">
                <p className="text-xs text-text-secondary">
                  Mostrando campanhas{" "}
                  <span className="text-text-primary font-medium">
                    {(campaignListPage - 1) * ATI_CAMPAIGNS_PER_PAGE + 1}
                    –
                    {Math.min(campaignListPage * ATI_CAMPAIGNS_PER_PAGE, filteredAndGrouped.length)}
                  </span>{" "}
                  de <span className="text-text-primary font-medium">{filteredAndGrouped.length}</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={campaignListPage <= 1}
                    onClick={() => setCampaignListPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </button>
                  <span className="text-xs text-text-secondary tabular-nums px-2">
                    Página <span className="text-text-primary font-semibold">{campaignListPage}</span> / {campaignListTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={campaignListPage >= campaignListTotalPages}
                    onClick={() => setCampaignListPage((p) => Math.min(campaignListTotalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-dark-border bg-dark-bg px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-shopee-orange hover:border-shopee-orange/40 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
            {filteredAndGrouped.length === 0 && (creatives.length > 0 || campaignsList.length > 0) && (
              <p className="text-center text-text-secondary py-6">Nenhum resultado para os filtros informados.</p>
            )}
          </div>
        )}
      </section>

      {linkModalOpen && linkModalAd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setLinkModalOpen(false)}>
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-w-lg w-full p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-dark-border bg-dark-bg/40">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-shopee-orange" />
                <h3 className="text-sm font-semibold text-text-primary">{linkModalLoadingLink ? "Link de anúncio" : linkModalTitle}</h3>
              </div>
              <button type="button" onClick={() => setLinkModalOpen(false)} className="text-text-secondary hover:text-text-primary transition-colors">✕</button>
            </div>
            <div className="p-5 space-y-4">
            {linkModalAdId && adIdToHasLink[linkModalAdId] === true && (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/8 p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs font-medium text-amber-300">
                  Ao editar o link, você perderá os dados de aprendizado do anúncio atual. Considere criar um novo AD em vez de alterar este.
                </p>
              </div>
            )}
            <p className="text-xs text-text-secondary">
              Anúncio: <strong className="text-text-primary">{linkModalAd.adName}</strong>
            </p>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5">Link da Shopee</label>
              <div className="flex gap-2 items-center">
                <input
                  type="url"
                  value={linkModalShopeeLink}
                  onChange={(e) => setLinkModalShopeeLink(e.target.value)}
                  placeholder="https://s.shopee.com.br/60MfL7egOy"
                  className="flex-1 min-w-0 rounded-xl border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm placeholder-text-secondary/50 focus:outline-none focus:border-shopee-orange transition-colors"
                />
                <ShopeeLinkHistoryPickButton onPick={setLinkModalShopeeLink} />
              </div>
            </div>
            <p className="text-xs text-text-secondary/70">
              O link é publicado <strong className="text-text-primary">exatamente</strong> como você colou. O cruzamento com vendas é pelo <strong>Sub ID Shopee</strong> que você configurou no anúncio (Sub1 do gerador).
            </p>
            {linkModalError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-1">
                <p className="text-sm font-medium text-red-400">{linkModalError}</p>
                {linkModalErrorDetail && <p className="text-xs text-red-300/90">{linkModalErrorDetail}</p>}
                <p className="text-xs text-text-secondary mt-1">Abra o Console (F12) para ver o erro completo.</p>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setLinkModalOpen(false)} className="rounded-xl border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg transition-colors">Cancelar</button>
              <button
                type="button"
                disabled={!linkModalAdId || !linkModalShopeeLink.trim() || linkModalPublishing}
                onClick={async () => {
                  const finalLink = linkModalShopeeLink.trim();
                  setLinkModalPublishing(true);
                  setLinkModalError(null);
                  setLinkModalErrorDetail(null);
                  try {
                    const res = await fetch("/api/meta/ads/update-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ad_id: linkModalAdId, link: finalLink }) });
                    const json = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      const step = json?.step ? ` [etapa: ${json.step}]` : "";
                      const errMsg = json?.error ?? "Erro ao atualizar";
                      const fullMsg = `${errMsg}${step}`;
                      const metaErr = json?.meta_error;
                      const detail = metaErr?.message || metaErr?.error_user_msg
                        ? `Meta: ${metaErr.error_user_msg || metaErr.message}${metaErr.code != null ? ` (código ${metaErr.code})` : ""}`
                        : null;
                      console.error("[ATI] update-link falhou:", { status: res.status, step: json?.step, error: json?.error, meta_error: json?.meta_error, full: json });
                      setLinkModalError(fullMsg);
                      if (detail) setLinkModalErrorDetail(detail);
                      return;
                    }
                    setLinkModalOpen(false);
                    setLinkModalAd(null);
                    setLinkModalShopeeLink("");
                    setAdIdToHasLink((prev) => ({ ...prev, [linkModalAdId]: true }));
                    await load({ skipCache: true });
                  } catch (e) {
                    const msg = e instanceof Error ? e.message : "Erro ao publicar";
                    console.error("[ATI] update-link exceção:", e);
                    setLinkModalError(msg);
                  } finally {
                    setLinkModalPublishing(false);
                  }
                }}
                className="flex items-center gap-2 rounded-xl bg-shopee-orange py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 shadow-[0_2px_12px_rgba(238,77,45,0.25)] transition-all"
              >
                {linkModalPublishing ? <><span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />Publicando…</> : "Publicar"}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Editar campanha */}
      {campaignEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setCampaignEditModal(null)}>
          <div className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Pencil className="h-4 w-4 text-shopee-orange" /> Editar campanha</h3>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Nome</label>
              <input
                type="text"
                value={campaignEditModal.campaignName}
                onChange={(e) => setCampaignEditModal((p) => p ? { ...p, campaignName: e.target.value } : null)}
                className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Objetivo</label>
              {campaignEditModal.loadingObjective ? (
                <p className="text-sm text-text-secondary py-2">Carregando…</p>
              ) : (
                <>
                  {campaignEditModal.metaObjective &&
                    campaignEditModal.metaObjective !== "OUTCOME_TRAFFIC" &&
                    campaignEditModal.metaObjective !== "OUTCOME_SALES" &&
                    campaignEditModal.metaObjective !== "OUTCOME_LEADS" && (
                      <p className="text-xs text-amber-400/90 mb-2">
                        No Meta esta campanha está como{" "}
                        <strong>
                          {META_CAMPAIGN_OBJECTIVES.find((o) => o.value === campaignEditModal.metaObjective)?.label ??
                            campaignEditModal.metaObjective}
                        </strong>
                        . Escolha <strong>Tráfego</strong>, <strong>Leads</strong> ou <strong>Vendas</strong> abaixo para alterar, ou salve só o nome.
                      </p>
                    )}
                  <select
                    value={campaignEditModal.objective}
                    onChange={(e) =>
                      setCampaignEditModal((p) => (p ? { ...p, objective: e.target.value } : null))
                    }
                    className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm"
                  >
                    {(campaignEditModal.metaObjective !== "OUTCOME_TRAFFIC" &&
                      campaignEditModal.metaObjective !== "OUTCOME_SALES" &&
                      campaignEditModal.metaObjective !== "OUTCOME_LEADS") && (
                      <option value="">Manter objetivo atual (só alterar nome)</option>
                    )}
                    {META_CREATE_CAMPAIGN_OBJECTIVES.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCampaignEditModal(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button
                type="button"
                disabled={
                  campaignEditSaving ||
                  !campaignEditModal.campaignName.trim() ||
                  campaignEditModal.loadingObjective
                }
                onClick={handleCampaignEditSave}
                className="rounded-md bg-shopee-orange py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {campaignEditSaving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deletar campanha */}
      {campaignDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70" onClick={() => setCampaignDeleteConfirm(null)}>
          <div className="bg-dark-card border border-red-500/20 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2"><Trash2 className="h-4 w-4 text-red-400" /> Deletar campanha</h3>
            <p className="text-sm text-text-secondary">Tem certeza que deseja deletar a campanha <strong className="text-text-primary">{campaignDeleteConfirm.campaignName}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setCampaignDeleteConfirm(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button type="button" disabled={campaignDeleteDeleting} onClick={handleCampaignDeleteConfirm} className="rounded-md bg-red-600 py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{campaignDeleteDeleting ? "Deletando…" : "Deletar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Novo conjunto - formulário completo como em Criar Campanha Meta */}
      {adSetNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 max-md:overflow-y-auto max-md:scrollbar-shopee md:overflow-y-visible"
          onClick={() => setAdSetNewModal(null)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-xl shadow-xl w-full max-w-2xl p-4 md:p-5 my-4 md:my-6 md:max-h-[min(92vh,820px)] md:flex md:flex-col md:overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <MetaAdSetForm
              campaignId={adSetNewModal.campaignId}
              adAccountId={adSetNewModal.adAccountId}
              campaignName={adSetNewModal.campaignName}
              onSubmit={handleAdSetNewSave}
              onCancel={() => setAdSetNewModal(null)}
              saving={adSetNewSaving}
              error={adSetNewError}
            />
          </div>
        </div>
      )}

      {/* Editar conjunto - mesmo formulário, dados pré-preenchidos */}
      {adSetEditModal && adSetEditInitialData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 max-md:overflow-y-auto max-md:scrollbar-shopee md:overflow-y-visible"
          onClick={() => { setAdSetEditModal(null); setAdSetEditInitialData(null); }}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-xl shadow-xl w-full max-w-2xl p-4 md:p-5 my-4 md:my-6 md:max-h-[min(92vh,820px)] md:flex md:flex-col md:overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base md:text-lg font-semibold text-text-primary mb-3">Editar conjunto</h3>
            <MetaAdSetForm
              key={`edit-${adSetEditModal.adSetId}`}
              campaignId={adSetEditModal.campaignId ?? ""}
              adAccountId={adSetEditModal.adAccountId}
              campaignName={adSetEditModal.campaignName}
              defaultName={adSetEditInitialData.name}
              defaultBudget={adSetEditInitialData.daily_budget}
              defaultCountryCodes={adSetEditInitialData.country_codes}
              defaultCountry={adSetEditInitialData.country_code}
              defaultAgeMin={String(adSetEditInitialData.age_min)}
              defaultAgeMax={String(adSetEditInitialData.age_max)}
              defaultGender={adSetEditInitialData.gender}
              defaultOptimizationGoal={adSetEditInitialData.optimization_goal}
              defaultPixelId={adSetEditInitialData.pixel_id}
              defaultConversionEvent={adSetEditInitialData.conversion_event}
              defaultPublisherPlatforms={adSetEditInitialData.publisher_platforms}
              submitLabel="Salvar edição"
              onSubmit={handleAdSetEditSave}
              onCancel={() => { setAdSetEditModal(null); setAdSetEditInitialData(null); }}
              saving={adSetEditSaving}
              error={adSetEditError}
            />
          </div>
        </div>
      )}

      {/* Novo anúncio - formulário completo como em Criar Campanha Meta */}
      {adNewModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 max-md:overflow-y-auto max-md:scrollbar-shopee md:overflow-y-visible"
          onClick={() => setAdNewModal(null)}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-xl shadow-xl w-full max-w-2xl p-4 md:p-5 my-4 md:my-6 md:max-h-[min(92vh,820px)] flex flex-col overflow-hidden min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MetaAdForm
              adAccountId={adNewModal.adAccountId}
              adsetId={adNewModal.adsetId}
              adsetName={adNewModal.adSetName}
              onSubmit={handleAdNewSave}
              onCancel={() => setAdNewModal(null)}
              saving={adNewSaving}
              error={adNewError}
            />
          </div>
        </div>
      )}

      {/* Editar anúncio - mesmo formulário, dados pré-preenchidos (nome e link editáveis) */}
      {adEditModal && adEditInitialData && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 max-md:overflow-y-auto max-md:scrollbar-shopee md:overflow-y-visible"
          onClick={() => { setAdEditModal(null); setAdEditInitialData(null); }}
        >
          <div
            className="bg-dark-card border border-dark-border rounded-xl shadow-xl w-full max-w-2xl p-4 md:p-5 my-4 md:my-6 md:max-h-[min(92vh,820px)] flex flex-col overflow-hidden min-h-0"
            onClick={(e) => e.stopPropagation()}
          >
            <MetaAdForm
              key={`edit-ad-${adEditModal.adId}`}
              adAccountId={adEditModal.adAccountId}
              adsetId={adEditModal.adsetId}
              adsetName={adEditModal.adSetName}
              defaultName={adEditInitialData.name}
              defaultLink={adEditInitialData.link}
              defaultMessage={adEditInitialData.message}
              defaultTitle={adEditInitialData.title}
              defaultCallToAction={adEditInitialData.call_to_action}
              defaultPageId={adEditInitialData.page_id}
              isEditMode
              submitLabel="Salvar edição"
              onSubmit={handleAdEditSave}
              onCancel={() => { setAdEditModal(null); setAdEditInitialData(null); }}
              saving={adEditSaving}
              error={adEditError}
            />
          </div>
        </div>
      )}

      {/* Deletar conjunto */}
      {adSetDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAdSetDeleteConfirm(null)}>
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary">Deletar conjunto</h3>
            <p className="text-sm text-text-secondary">Deletar <strong className="text-text-primary">{adSetDeleteConfirm.adSetName}</strong>? Não é possível desfazer.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdSetDeleteConfirm(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button type="button" disabled={adSetDeleteDeleting} onClick={handleAdSetDeleteConfirm} className="rounded-md bg-red-600 py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{adSetDeleteDeleting ? "Deletando…" : "Deletar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicar conjunto */}
      {adSetDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAdSetDuplicateModal(null)}>
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary">Duplicar conjunto</h3>
            <p className="text-sm text-text-secondary">Quantas cópias? (1 a 50). Nomes: -COPIA 1, -COPIA 2...</p>
            <input type="number" min={1} max={50} value={adSetDuplicateCount} onChange={(e) => setAdSetDuplicateCount(e.target.value)} className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdSetDuplicateModal(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button type="button" disabled={adSetDuplicateSaving} onClick={handleAdSetDuplicateSave} className="rounded-md bg-shopee-orange py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{adSetDuplicateSaving ? "Duplicando…" : "Duplicar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Deletar anúncio */}
      {adDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAdDeleteConfirm(null)}>
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary">Deletar anúncio</h3>
            <p className="text-sm text-text-secondary">Deletar <strong className="text-text-primary">{adDeleteConfirm.adName}</strong>? Não é possível desfazer.</p>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdDeleteConfirm(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button type="button" disabled={adDeleteDeleting} onClick={handleAdDeleteConfirm} className="rounded-md bg-red-600 py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{adDeleteDeleting ? "Deletando…" : "Deletar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicar anúncio */}
      {adDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setAdDuplicateModal(null)}>
          <div className="bg-dark-card border border-dark-border rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-text-primary">Duplicar anúncio</h3>
            <p className="text-sm text-text-secondary">Quantas cópias? (1 a 50). Nomes: -COPIA 1, -COPIA 2...</p>
            <input type="number" min={1} max={50} value={adDuplicateCount} onChange={(e) => setAdDuplicateCount(e.target.value)} className="w-full rounded-md border border-dark-border bg-dark-bg py-2 px-3 text-text-primary text-sm" />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setAdDuplicateModal(null)} className="rounded-md border border-dark-border py-2 px-4 text-sm font-medium text-text-secondary hover:bg-dark-bg">Cancelar</button>
              <button type="button" disabled={adDuplicateSaving} onClick={handleAdDuplicateSave} className="rounded-md bg-shopee-orange py-2 px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{adDuplicateSaving ? "Duplicando…" : "Duplicar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação de pausa (campanha / conjunto / anúncio) ── */}
      {pauseConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
          onClick={() => { if (!pauseConfirmLoading) setPauseConfirm(null); }}
        >
          <div
            className="w-full max-w-sm bg-dark-card border border-amber-500/25 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >


            {/* Ícone + Título */}
            <div className="flex flex-col items-center px-6 pt-6 pb-3 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <PauseCircle className="h-7 w-7 text-amber-400" aria-hidden="true" />
              </div>
              <div className="text-center">
                <h2 className="text-base font-bold text-text-primary">
                  Pausar {pauseConfirm.type === "campaign" ? "Campanha" : pauseConfirm.type === "adset" ? "Conjunto" : "Anúncio"}?
                </h2>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2 max-w-[260px] mx-auto">
                  &ldquo;{pauseConfirm.name}&rdquo;
                </p>
              </div>
            </div>

            {/* Aviso */}
            <div className="mx-5 mb-4 rounded-xl bg-amber-500/8 border border-amber-500/20 px-3 py-2.5 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-200/80 leading-relaxed">
                Este item será pausado no Meta imediatamente. Você pode reativar a qualquer momento.
              </p>
            </div>

            {/* Botões */}
            <div className="flex gap-2.5 px-5 pt-1 pb-6">
              <button
                type="button"
                disabled={pauseConfirmLoading}
                onClick={() => setPauseConfirm(null)}
                className="flex-1 rounded-xl border border-dark-border py-3 text-sm font-semibold text-text-secondary hover:bg-dark-bg hover:text-text-primary transition-all disabled:opacity-40 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={pauseConfirmLoading}
                onClick={handleConfirmPause}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-semibold text-white hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {pauseConfirmLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    Pausando&hellip;
                  </>
                ) : (
                  <>
                    <PauseCircle className="h-4 w-4" aria-hidden="true" />
                    Confirmar pausa
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

        </>
      )}

    </>
  );
}
