"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { readInfoprodCache, writeInfoprodCache, clearInfoprodCache } from "@/lib/infoprod/cache";
import Toolist from "@/app/components/ui/Toolist";
import {
  RefreshCw,
  BarChart3,
  CreditCard,
  AlertTriangle,
  Loader2,
  Megaphone,
  Image as ImageIcon,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const PAGE_SIZE = 10;

type Period = "7d" | "30d" | "90d" | "all";

type ProdInfo = { id: string; name: string; imageUrl: string | null } | null;

type AdRow = {
  adId: string;
  adName: string;
  campaignId: string;
  campaignName: string;
  subId: string | null;
  produto: ProdInfo;
  produtoCount: number;
  produtoExtras: string[];
  spend: number;
  clicks: number;
  impressions: number;
  revenue: number;
  orders: number;
  profit: number;
  roas: number;
  cpc: number;
  cpa: number;
};

type Totals = {
  spend: number;
  revenue: number;
  orders: number;
  clicks: number;
  profit: number;
  roas: number;
  cpc: number;
  cpa: number;
};

type Response = {
  period: Period;
  rows: AdRow[];
  totals: Totals;
  hasInfopCampaigns: boolean;
  fetchedAt: string;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

function formatBRL(v: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function formatInt(v: number): string {
  return new Intl.NumberFormat("pt-BR").format(v);
}

function formatRoas(r: number): string {
  if (!Number.isFinite(r) || r === 0) return "—";
  return `${r.toFixed(2)}x`;
}

function formatPct(v: number): string {
  if (!Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

const CACHE_SECTION = "adperf";

export default function AdPerformanceTable({ refreshSignal = 0 }: { refreshSignal?: number }) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<Response | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [period, data?.fetchedAt]);

  const totalPages = data ? Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE)) : 1;
  const pagedRows = useMemo(() => {
    if (!data) return [];
    const start = page * PAGE_SIZE;
    return data.rows.slice(start, start + PAGE_SIZE);
  }, [data, page]);

  const load = useCallback(async (p: Period, opts?: { skipCache?: boolean }) => {
    if (!opts?.skipCache) {
      const cached = readInfoprodCache<Response>(CACHE_SECTION, p);
      if (cached) {
        setData(cached);
        setError(null);
        return;
      }
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/infoprodutor/ad-performance?period=${p}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar performance");
      setData(json as Response);
      writeInfoprodCache(CACHE_SECTION, p, json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(period);
  }, [period, load]);

  const lastSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === lastSignalRef.current) return;
    lastSignalRef.current = refreshSignal;
    clearInfoprodCache(CACHE_SECTION);
    void load(period, { skipCache: true });
  }, [refreshSignal, period, load]);

  return (
    <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
      {/* Header */}
      <div className="px-4 sm:px-6 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#27272a] border border-[#2c2c32] flex items-center justify-center shrink-0">
            <BarChart3 className="w-4 h-4 text-[#EE4D2D]" />
          </div>
          <h2 className="text-base font-bold text-[#f0f0f2] truncate">Performance</h2>
          {data ? (
            <span className="text-[11px] text-[#bebebe] bg-[#232328] px-2 py-0.5 rounded-full border border-[#3e3e3e] shrink-0">
              {data.rows.length} ad{data.rows.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="inline-flex rounded-lg border border-[#3e3e46] bg-[#222228] p-0.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                disabled={loading}
                className={`px-3 py-1.5 rounded-md text-[12px] font-semibold transition-colors disabled:opacity-60 ${
                  period === p.value ? "bg-[#EE4D2D] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              clearInfoprodCache(CACHE_SECTION, period);
              void load(period, { skipCache: true });
            }}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#3e3e46] text-[12px] font-semibold text-[#d2d2d2] hover:bg-[#2f2f34] disabled:opacity-60"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {error ? (
        <div className="px-4 sm:px-6 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-300 shrink-0 mt-0.5" />
          <p className="text-[13px] text-red-300 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {/* Empty states */}
      {!loading && data && !data.hasInfopCampaigns ? (
        <div className="px-4 sm:px-6 py-10 flex flex-col items-center text-center gap-3 bg-[#1c1c1f]">
          <Megaphone className="w-10 h-10 text-[#686868]" />
          <p className="text-base font-semibold text-[#f0f0f2]">Nenhuma campanha marcada como InfoP</p>
          <p className="text-[13px] text-[#9a9aa2] max-w-md leading-relaxed">
            Vá em <Link href="/dashboard/ati" className="underline text-[#EE4D2D]">ATI</Link>, ative o botão <strong>InfoP</strong> nas campanhas que vendem seus produtos e cole o mesmo SubId do produto no campo <strong>SubId InfoP</strong> de cada anúncio.
          </p>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="py-16 flex items-center justify-center bg-[#1c1c1f]">
          <Loader2 className="w-6 h-6 animate-spin text-[#EE4D2D]" />
        </div>
      ) : null}

      {data && data.hasInfopCampaigns ? (
        <div className="bg-[#1c1c1f]">
          <KpiStrip data={data} />

          {data.rows.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-base text-[#f0f0f2]">Sem dados de anúncios InfoP no período</p>
              <p className="text-[13px] text-[#9a9aa2] mt-1.5">
                Verifique se as campanhas InfoP têm entregas no período selecionado.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1000px]">
                <thead>
                  <tr className="bg-[#222228] text-[11px] uppercase tracking-wider text-[#9a9aa2]">
                    <th className="text-left px-4 py-3 font-bold">Ad</th>
                    <th className="text-left px-4 py-3 font-bold">SubId / Produto</th>
                    <th className="text-right px-4 py-3 font-bold">Custo Meta</th>
                    <th className="text-right px-4 py-3 font-bold">Vendas</th>
                    <th className="text-right px-4 py-3 font-bold">Lucro</th>
                    <th className="text-right px-4 py-3 font-bold">ROAS</th>
                    <th className="text-right px-4 py-3 font-bold">Pedidos</th>
                    <th className="text-right px-4 py-3 font-bold">CPC</th>
                    <th className="text-right px-4 py-3 font-bold">CPA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2c2c32]">
                  {pagedRows.map((r) => (
                    <tr key={r.adId} className="hover:bg-[#222228] transition-colors">
                      <td className="px-4 py-3.5 align-top">
                        <p className="text-[13px] text-[#f0f0f2] font-semibold leading-tight truncate max-w-[260px]" title={r.adName}>
                          {r.adName}
                        </p>
                        <p className="text-[11px] text-[#7a7a80] truncate max-w-[260px] mt-0.5" title={r.campaignName}>
                          {r.campaignName}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 align-top">
                        {r.subId ? (
                          <>
                            <p className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-[#3e3e46] bg-[#222228] text-[11px] font-bold text-[#EE4D2D] font-mono">
                              <CreditCard className="w-3 h-3" />
                              {r.subId}
                            </p>
                            {r.produto ? (
                              <div
                                className="flex items-center gap-2 mt-1.5"
                                title={
                                  r.produtoExtras.length > 0
                                    ? `Também inclui: ${r.produtoExtras.join(", ")}`
                                    : undefined
                                }
                              >
                                {r.produto.imageUrl ? (
                                  <div className="w-7 h-7 rounded-md overflow-hidden bg-white shrink-0 border border-[#2c2c32]">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={r.produto.imageUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                ) : (
                                  <div className="w-7 h-7 rounded-md bg-[#222228] shrink-0 flex items-center justify-center border border-[#2c2c32]">
                                    <ImageIcon className="w-3.5 h-3.5 text-[#6b6b72]" />
                                  </div>
                                )}
                                <span className="text-[12px] text-[#c8c8ce] truncate max-w-[180px]">{r.produto.name}</span>
                                {r.produtoCount > 1 ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-[#3e3e46] bg-[#222228] text-[10px] font-bold text-[#EE4D2D]">
                                    +{r.produtoCount - 1}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <p className="text-[11px] text-amber-300/90 mt-1.5 max-w-[200px] leading-tight">
                                SubId sem produto vinculado
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-[12px] text-[#7a7a80] italic">
                            sem SubId — <Link href="/dashboard/ati" className="underline hover:text-[#EE4D2D]">configurar</Link>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#f0f0f2] font-mono tabular-nums">{formatBRL(r.spend)}</td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-emerald-400 font-semibold">{formatBRL(r.revenue)}</td>
                      <td
                        className={`px-4 py-3.5 text-right font-mono tabular-nums font-semibold ${
                          r.profit >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatBRL(r.profit)}
                      </td>
                      <td
                        className={`px-4 py-3.5 text-right font-mono tabular-nums font-semibold ${
                          r.roas >= 2 ? "text-emerald-400" : r.roas >= 1 ? "text-amber-300" : "text-[#c8c8ce]"
                        }`}
                      >
                        {formatRoas(r.roas)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#f0f0f2] font-mono tabular-nums">{formatInt(r.orders)}</td>
                      <td className="px-4 py-3.5 text-right text-[#c8c8ce] font-mono tabular-nums">
                        {r.cpc > 0 ? formatBRL(r.cpc) : "—"}
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#c8c8ce] font-mono tabular-nums">
                        {r.cpa > 0 ? formatBRL(r.cpa) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#222228] text-[#f0f0f2] font-bold border-t-2 border-[#3e3e46] text-[13px]">
                    <td className="px-4 py-3.5" colSpan={2}>
                      Totais
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatBRL(data.totals.spend)}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums text-emerald-400">{formatBRL(data.totals.revenue)}</td>
                    <td
                      className={`px-4 py-3.5 text-right font-mono tabular-nums ${
                        data.totals.profit >= 0 ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {formatBRL(data.totals.profit)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatRoas(data.totals.roas)}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">{formatInt(data.totals.orders)}</td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                      {data.totals.cpc > 0 ? formatBRL(data.totals.cpc) : "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono tabular-nums">
                      {data.totals.cpa > 0 ? formatBRL(data.totals.cpa) : "—"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <div className="px-4 py-3 border-t border-[#2c2c32] flex items-center justify-between flex-wrap gap-3 text-[11px] text-[#7a7a80]">
            {data.rows.length > PAGE_SIZE ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] text-[11px] text-[#d2d2d2] hover:bg-[#2f2f34] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3 h-3" />
                  Anterior
                </button>
                <span className="text-[11px] text-[#9a9aa2] tabular-nums">
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.rows.length)} de {data.rows.length}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-[#3e3e46] text-[11px] text-[#d2d2d2] hover:bg-[#2f2f34] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Próxima
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <span />
            )}

            <Link
              href="https://www.mercadopago.com.br/activities"
              target="_blank"
              className="inline-flex items-center gap-1.5 hover:text-[#EE4D2D]"
            >
              Ver pagamentos no Mercado Pago <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ─── KPI Strip (topo da tabela com métricas agregadas) ─────────────────────────

type KpiAccent = "neutral" | "emerald" | "red" | "amber";

const KPI_TEXT: Record<KpiAccent, string> = {
  neutral: "text-[#f0f0f2]",
  emerald: "text-emerald-400",
  red: "text-red-400",
  amber: "text-amber-300",
};

function KpiStrip({ data }: { data: Response }) {
  const { totals, rows } = data;
  const avgTicket = useMemo(
    () => (totals.orders > 0 ? totals.revenue / totals.orders : 0),
    [totals.orders, totals.revenue],
  );
  const margin = useMemo(
    () => (totals.revenue > 0 ? totals.profit / totals.revenue : 0),
    [totals.profit, totals.revenue],
  );
  const adsComData = useMemo(() => rows.filter((r) => r.spend > 0 || r.revenue > 0).length, [rows]);

  const profitAccent: KpiAccent = totals.profit >= 0 ? "emerald" : "red";
  const roasAccent: KpiAccent = totals.roas >= 2 ? "emerald" : totals.roas >= 1 ? "amber" : "red";
  const marginAccent: KpiAccent = margin >= 0 ? "emerald" : "red";

  return (
    <div className="px-4 sm:px-6 py-4 border-b border-[#2c2c32] bg-[#1c1c1f]">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        <KpiCell
          label="Custo Meta"
          value={formatBRL(totals.spend)}
          tip="Total gasto nos anúncios Meta das campanhas marcadas como InfoP no período."
        />
        <KpiCell
          label="Receita"
          value={formatBRL(totals.revenue)}
          accent="emerald"
          tip="Soma das vendas Mercado Pago concluídas cujos produtos tenham SubId cruzado com algum ad InfoP."
        />
        <KpiCell
          label="Lucro"
          value={formatBRL(totals.profit)}
          sub={totals.revenue > 0 ? `Margem ${formatPct(margin)}` : undefined}
          accent={profitAccent}
          tip="Receita menos o custo dos anúncios Meta. Verde = positivo, vermelho = prejuízo."
        />
        <KpiCell
          label="ROAS"
          value={formatRoas(totals.roas)}
          accent={roasAccent}
          tip="Retorno sobre investimento em ads: receita ÷ custo. 2x significa R$2 de receita pra cada R$1 gasto."
        />
        <KpiCell
          label="Pedidos"
          value={formatInt(totals.orders)}
          sub={totals.orders > 0 ? `Ticket ${formatBRL(avgTicket)}` : undefined}
          tip="Quantidade de vendas concluídas nos produtos cruzados com ads InfoP."
        />
        <KpiCell
          label="Ticket Médio"
          value={totals.orders > 0 ? formatBRL(avgTicket) : "—"}
          tip="Valor médio por pedido: receita total ÷ número de pedidos."
        />
        <KpiCell
          label="CPA"
          value={totals.cpa > 0 ? formatBRL(totals.cpa) : "—"}
          tip="Custo por Aquisição: quanto foi gasto em ads para gerar cada venda. Quanto menor, melhor."
        />
        <KpiCell
          label="CPC"
          value={totals.cpc > 0 ? formatBRL(totals.cpc) : "—"}
          tip="Custo por Clique médio do Meta nos ads InfoP no período."
        />
        <KpiCell
          label="Margem"
          value={totals.revenue > 0 ? formatPct(margin) : "—"}
          accent={marginAccent}
          tip="Percentual de lucro sobre a receita: lucro ÷ receita."
        />
        <KpiCell
          label="Ads com dados"
          value={`${adsComData} / ${rows.length}`}
          tip="Quantos anúncios InfoP tiveram gasto ou receita no período, sobre o total listado."
        />
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  sub,
  accent = "neutral",
  tip,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: KpiAccent;
  tip: string;
}) {
  return (
    <div className="rounded-lg border border-[#2c2c32] bg-[#222228] px-3 py-2.5 min-w-0 hover:border-[#3e3e46] transition-colors">
      <div className="flex items-center gap-1">
        <p className="text-[10px] font-medium text-[#8a8a90] uppercase tracking-wide truncate">{label}</p>
        <Toolist variant="floating" wide text={tip} />
      </div>
      <p className={`mt-1 text-[14px] font-semibold tabular-nums leading-snug ${KPI_TEXT[accent]}`}>{value}</p>
      {sub ? <p className="text-[10px] text-[#6b6b72] truncate mt-0.5">{sub}</p> : null}
    </div>
  );
}
