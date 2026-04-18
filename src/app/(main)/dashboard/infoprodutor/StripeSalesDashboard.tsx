"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  RefreshCw,
  TrendingUp,
  ShoppingBag,
  Receipt,
  Undo2,
  Users,
  BarChart3,
  CreditCard,
  AlertTriangle,
  Loader2,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
import type { ChartOptions, TooltipItem } from "chart.js";
import "@/lib/chart-setup";
import { readInfoprodCache, writeInfoprodCache, clearInfoprodCache } from "@/lib/infoprod/cache";

const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });

type Period = "7d" | "30d" | "90d" | "all";

type Summary = {
  totalRevenue: number;
  totalSales: number;
  avgTicket: number;
  totalRefunded: number;
  refundRate: number;
  uniqueCustomers: number;
};

type DayPoint = { date: string; revenue: number; sales: number };

type TopProduct = {
  produtoId: string;
  name: string;
  imageUrl: string | null;
  sales: number;
  revenue: number;
  avgTicket: number;
  share: number;
};

type SalesResponse = {
  period: Period;
  summary: Summary;
  byDay: DayPoint[];
  topProducts: TopProduct[];
  fetchedAt: string;
  hasProducts: boolean;
};

const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7 dias" },
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatInt(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function formatPct(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function formatDayLabel(iso: string): string {
  // "2026-04-18" → "18/abr"
  const [, m, d] = iso.split("-");
  const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${d}/${months[Number(m) - 1] ?? m}`;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const sec = Math.max(0, Math.round(ms / 1000));
  if (sec < 60) return "agora mesmo";
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  return new Date(iso).toLocaleString("pt-BR");
}

const CACHE_SECTION = "sales";

export default function StripeSalesDashboard({
  stripeConnected,
  refreshSignal = 0,
}: {
  stripeConnected: boolean;
  refreshSignal?: number;
}) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<SalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: Period, opts?: { skipCache?: boolean }) => {
      if (!stripeConnected) return;
      if (!opts?.skipCache) {
        const cached = readInfoprodCache<SalesResponse>(CACHE_SECTION, p);
        if (cached) {
          setData(cached);
          setError(null);
          return;
        }
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/infoprodutor/stripe-sales?period=${p}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Erro ao carregar vendas");
        setData(json as SalesResponse);
        writeInfoprodCache(CACHE_SECTION, p, json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar vendas");
      } finally {
        setLoading(false);
      }
    },
    [stripeConnected],
  );

  useEffect(() => {
    if (stripeConnected) void load(period);
  }, [period, stripeConnected, load]);

  // Quando o refresh global é acionado, invalida todo o cache desta seção e recarrega.
  const lastSignalRef = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === lastSignalRef.current) return;
    lastSignalRef.current = refreshSignal;
    if (stripeConnected) {
      clearInfoprodCache(CACHE_SECTION);
      void load(period, { skipCache: true });
    }
  }, [refreshSignal, stripeConnected, period, load]);

  const chartData = useMemo(() => {
    const byDay = data?.byDay ?? [];
    return {
      labels: byDay.map((d) => formatDayLabel(d.date)),
      datasets: [
        {
          fill: true,
          label: "Receita",
          data: byDay.map((d) => Number(d.revenue.toFixed(2))),
          borderColor: "#635bff",
          backgroundColor: "rgba(99, 91, 255, 0.18)",
          pointBackgroundColor: "#635bff",
          pointBorderColor: "#FFFFFF",
          pointBorderWidth: 2,
          pointHoverBackgroundColor: "#FFFFFF",
          pointHoverBorderColor: "#635bff",
          pointHoverBorderWidth: 2,
          pointRadius: byDay.length > 45 ? 0 : 3,
          tension: 0.35,
        },
      ],
    };
  }, [data]);

  const chartOptions: ChartOptions<"line"> = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          backgroundColor: "#18181B",
          titleColor: "#FFFFFF",
          bodyColor: "#E9E9E9",
          borderColor: "#27272A",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (ctx: TooltipItem<"line">) => {
              const v = typeof ctx.raw === "number" ? ctx.raw : 0;
              const day = data?.byDay?.[ctx.dataIndex];
              const sales = day?.sales ?? 0;
              return [`${formatBRL(v)}`, `${sales} venda${sales === 1 ? "" : "s"}`];
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          grid: { color: "rgba(233, 233, 233, 0.06)" },
          ticks: { color: "#9a9aa2", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
        },
        y: {
          grid: { color: "rgba(233, 233, 233, 0.06)" },
          ticks: {
            color: "#9a9aa2",
            callback: (val) => formatBRL(Number(val)),
          },
        },
      },
    }),
    [data],
  );

  if (!stripeConnected) {
    return (
      <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
        <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#635bff]/15 border border-[#635bff]/25 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3 h-3 text-[#a8a2ff]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Vendas Stripe</h2>
        </div>
        <div className="px-4 sm:px-6 py-10 flex flex-col items-center text-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[#635bff]/10 border border-[#635bff]/25 flex items-center justify-center">
            <CreditCard className="w-6 h-6 text-[#a8a2ff]" />
          </div>
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-[#f0f0f2]">Conecte sua conta Stripe</p>
            <p className="text-[11px] text-[#9a9aa2] mt-1.5 leading-relaxed">
              Depois de conectar, você verá aqui receita, ticket médio, top produtos e evolução diária das vendas.
            </p>
          </div>
          <Link
            href="/configuracoes"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#635bff] hover:bg-[#5047e5] text-white text-xs font-semibold"
          >
            Conectar em Configurações
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[#2c2c32] bg-[#27272a] overflow-hidden mt-6">
      {/* Header */}
      <div className="px-3 sm:px-5 py-4 border-b border-[#2c2c32] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-[#635bff]/15 border border-[#635bff]/25 flex items-center justify-center shrink-0">
            <BarChart3 className="w-3 h-3 text-[#a8a2ff]" />
          </div>
          <h2 className="text-sm font-bold text-[#f0f0f2] truncate">Vendas Stripe</h2>
          {data?.fetchedAt ? (
            <span className="text-[9px] text-[#7a7a80] hidden sm:inline">
              atualizado {relativeTime(data.fetchedAt)}
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
                className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors disabled:opacity-60 ${
                  period === p.value ? "bg-[#635bff] text-white" : "text-[#c8c8ce] hover:bg-[#2f2f34]"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#3e3e46] text-[10px] font-semibold text-[#d2d2d2] hover:bg-[#2f2f34] disabled:opacity-60"
            title="Atualizar dados"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="px-4 sm:px-5 py-3 bg-red-500/10 border-b border-red-500/30 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-300 shrink-0 mt-0.5" />
          <p className="text-[11px] text-red-300 leading-relaxed">{error}</p>
        </div>
      ) : null}

      {/* Empty state: conectado mas sem produtos Stripe */}
      {data && !data.hasProducts ? (
        <div className="px-4 sm:px-6 py-10 flex flex-col items-center text-center gap-3 bg-[#1c1c1f]">
          <div className="w-12 h-12 rounded-xl bg-[#635bff]/10 border border-[#635bff]/25 flex items-center justify-center">
            <ShoppingBag className="w-6 h-6 text-[#a8a2ff]" />
          </div>
          <div className="max-w-sm">
            <p className="text-sm font-semibold text-[#f0f0f2]">Nenhum produto Stripe cadastrado</p>
            <p className="text-[11px] text-[#9a9aa2] mt-1.5 leading-relaxed">
              Crie um produto no modo Stripe (botão acima) para começar a ver métricas de venda aqui.
            </p>
          </div>
        </div>
      ) : null}

      {/* Loading placeholder */}
      {loading && !data ? (
        <div className="px-4 py-16 flex items-center justify-center bg-[#1c1c1f]">
          <Loader2 className="w-6 h-6 animate-spin text-[#635bff]" />
        </div>
      ) : null}

      {/* Conteúdo */}
      {data && data.hasProducts ? (
        <div className="bg-[#1c1c1f] p-4 sm:p-5 space-y-5">
          {/* Cards de KPI */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <KpiCard
              icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
              label="Receita"
              value={formatBRL(data.summary.totalRevenue)}
              accent="emerald"
            />
            <KpiCard
              icon={<ShoppingBag className="w-4 h-4 text-[#a8a2ff]" />}
              label="Vendas"
              value={formatInt(data.summary.totalSales)}
              accent="stripe"
            />
            <KpiCard
              icon={<Receipt className="w-4 h-4 text-sky-400" />}
              label="Ticket médio"
              value={formatBRL(data.summary.avgTicket)}
              accent="sky"
            />
            <KpiCard
              icon={<Undo2 className="w-4 h-4 text-amber-400" />}
              label="Reembolsos"
              value={formatBRL(data.summary.totalRefunded)}
              sub={data.summary.totalRevenue > 0 ? `${formatPct(data.summary.refundRate)} do total` : "—"}
              accent="amber"
            />
            <KpiCard
              icon={<Users className="w-4 h-4 text-fuchsia-400" />}
              label="Clientes únicos"
              value={formatInt(data.summary.uniqueCustomers)}
              accent="fuchsia"
            />
          </div>

          {/* Gráfico + Top produtos lado a lado (em >lg) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Chart */}
            <div className="lg:col-span-3 rounded-xl border border-[#2c2c32] bg-[#222228] p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2 gap-2">
                <p className="text-[11px] font-bold text-[#d8d8d8] uppercase tracking-widest">
                  Receita por dia
                </p>
                <span className="text-[10px] text-[#7a7a80]">
                  {data.byDay.length} {data.byDay.length === 1 ? "dia" : "dias"}
                </span>
              </div>
              <div className="h-[260px]">
                {data.byDay.length > 0 ? (
                  <Line key={`sales-${period}-${data.byDay.length}`} data={chartData} options={chartOptions} />
                ) : (
                  <div className="h-full flex items-center justify-center text-[11px] text-[#7a7a80]">
                    Sem dados de venda no período.
                  </div>
                )}
              </div>
            </div>

            {/* Top produtos */}
            <div className="lg:col-span-2 rounded-xl border border-[#2c2c32] bg-[#222228] p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3 gap-2">
                <p className="text-[11px] font-bold text-[#d8d8d8] uppercase tracking-widest">
                  Top produtos
                </p>
                <a
                  href="https://dashboard.stripe.com/payments"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-[#a8a2ff] hover:underline inline-flex items-center gap-1"
                  title="Ver no painel da Stripe"
                >
                  Stripe <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              {data.topProducts.length === 0 ? (
                <p className="text-[11px] text-[#7a7a80] py-6 text-center">
                  Nenhuma venda registrada no período.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.topProducts.slice(0, 6).map((p, i) => (
                    <li
                      key={p.produtoId}
                      className="flex items-center gap-2 p-2 rounded-lg bg-[#1c1c1f] border border-[#2c2c32]"
                    >
                      <span className="w-5 text-center text-[10px] font-bold text-[#7a7a80] shrink-0">
                        #{i + 1}
                      </span>
                      {p.imageUrl ? (
                        <div className="w-8 h-8 rounded bg-white shrink-0 overflow-hidden border border-[#2c2c32]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded bg-[#222228] shrink-0 flex items-center justify-center border border-[#2c2c32] text-[#6b6b72]">
                          <ImageIcon className="w-3.5 h-3.5" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-[#f0f0f2] truncate">{p.name}</p>
                        <p className="text-[10px] text-[#9a9aa2] mt-0.5">
                          {formatInt(p.sales)} {p.sales === 1 ? "venda" : "vendas"} · ticket {formatBRL(p.avgTicket)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-bold text-emerald-400">{formatBRL(p.revenue)}</p>
                        <p className="text-[9px] text-[#7a7a80]">{formatPct(p.share)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function KpiCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: "emerald" | "stripe" | "sky" | "amber" | "fuchsia";
}) {
  const borderClass = {
    emerald: "border-emerald-500/20",
    stripe: "border-[#635bff]/25",
    sky: "border-sky-500/20",
    amber: "border-amber-500/20",
    fuchsia: "border-fuchsia-500/20",
  }[accent];
  return (
    <div className={`rounded-xl border ${borderClass} bg-[#222228] p-3`}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-[#9a9aa2] uppercase tracking-wider">
        {icon}
        <span>{label}</span>
      </div>
      <p className="mt-1.5 text-base sm:text-lg font-bold text-[#f0f0f2] leading-tight">{value}</p>
      {sub ? <p className="text-[9px] text-[#7a7a80] mt-0.5">{sub}</p> : null}
    </div>
  );
}
