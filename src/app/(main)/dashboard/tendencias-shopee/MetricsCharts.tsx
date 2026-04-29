"use client";

/**
 * Métricas visuais de tendências:
 *   1. Pizza:   top 8 produtos por score (paleta laranja monocromática)
 *   2. Linha:   top 8 categorias por número de produtos
 *   3. Bubble:  Comissão (Y) × Vendas (X) com preço modulando o raio.
 *               Sweet-spot (alto×alto) salta visualmente.
 *   4. Histograma: distribuição dos scores em bins de 10. Mostra se o
 *               mercado está saturado de virais ou disperso.
 *   5. Score Velocity: top 10 produtos com maior ganho de score nas últimas
 *               24h (delta = sparkline[last] − sparkline[first]).
 *   6. Live ticker: barra deslizante estilo bolsa, símbolo do produto + Δscore.
 *
 * Tudo Chart.js (sem libs novas) + sparklines já vêm na resposta do API.
 * Click na pizza ou no bubble chama `onProductClick` pra abrir popup do produto.
 */

import { useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { ArcElement, BubbleController, Chart as ChartJS, LogarithmicScale } from "chart.js";
import { TreemapController, TreemapElement } from "chartjs-chart-treemap";
import { TagCloud } from "react-tagcloud";
import { useChartColors } from "@/app/components/theme/useChartColors";
import { ArrowDown, ArrowUp, Minus, TrendingUp } from "lucide-react";

const Pie = dynamic(() => import("react-chartjs-2").then((m) => m.Pie), { ssr: false });
const Line = dynamic(() => import("react-chartjs-2").then((m) => m.Line), { ssr: false });
const Bubble = dynamic(() => import("react-chartjs-2").then((m) => m.Bubble), { ssr: false });
const Bar = dynamic(() => import("react-chartjs-2").then((m) => m.Bar), { ssr: false });
const TreemapChart = dynamic(() => import("react-chartjs-2").then((m) => m.Chart), { ssr: false });

type Product = {
  itemId: number;
  productName: string;
  score: number;
  sales?: number;
  commissionRate?: number | null;
  price?: number | null;
  priceMin?: number | null;
  sparkline?: number[];
  categoryIds?: number[];
};

type CategoryRow = {
  categoryId: number;
  count: number;
  name: string | null;
};

type ClickableProduct = Product & Record<string, unknown>;

/** Paleta laranja monocromática (escuro → claro). Top score = laranja brand. */
const PIE_COLORS = [
  "#ee4d2d", // brand
  "#f56c50",
  "#ff8a73",
  "#ffa898",
  "#fb923c",
  "#fdba74",
  "#fed7aa",
  "#ffe4dd",
];

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

/** Símbolo de 3 letras maiúsculas pra ticker (estilo bolsa: PETR4 → "PRO"). */
function tickerSymbol(name: string): string {
  const clean = name.replace(/[^A-Za-zÀ-ÿ ]/g, " ").trim();
  const words = clean.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length >= 3) return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  if (words.length === 2) return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
  return (clean.slice(0, 3) || "—").toUpperCase();
}

export function MetricsCharts<T extends ClickableProduct>({
  products,
  categories,
  onProductClick,
}: {
  products: T[];
  categories: CategoryRow[];
  onProductClick?: (p: T) => void;
}) {
  const colors = useChartColors();

  // Registra controllers/elements que o Chart.js v4 exige por instância.
  // Idempotente — pode rodar em todo mount.
  // LogarithmicScale: usado no eixo X do bubble chart (vendas variam de 100
  // a 10k+, log evita que outliers comprimam o resto).
  useEffect(() => {
    ChartJS.register(
      ArcElement,
      BubbleController,
      LogarithmicScale,
      TreemapController,
      TreemapElement,
    );
  }, []);

  // ── Pizza: top produtos por score ───────────────────────────────────────
  const topByScore = useMemo(
    () => [...products].sort((a, b) => b.score - a.score).slice(0, 8),
    [products],
  );

  const pieData = useMemo(
    () => ({
      labels: topByScore.map((p) =>
        p.productName.length > 28 ? `${p.productName.slice(0, 25)}…` : p.productName,
      ),
      datasets: [
        {
          data: topByScore.map((p) => p.score),
          backgroundColor: topByScore.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
          borderColor: "rgba(0,0,0,0)",
          borderWidth: 1,
        },
      ],
    }),
    [topByScore],
  );

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event: unknown, elements: unknown[]) => {
        const ev = event as { native?: { target?: HTMLElement } };
        const target = ev.native?.target;
        if (target) target.style.cursor = elements.length > 0 ? "pointer" : "default";
      },
      onClick: (_e: unknown, elements: Array<{ index: number }>) => {
        if (!onProductClick || elements.length === 0) return;
        const p = topByScore[elements[0].index];
        if (p) onProductClick(p);
      },
      plugins: {
        legend: {
          position: "right" as const,
          labels: {
            color: colors.text,
            font: { size: 10 },
            boxWidth: 10,
            boxHeight: 10,
            padding: 8,
          },
        },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
        },
        datalabels: { display: false },
      },
    }),
    [colors, onProductClick, topByScore],
  );

  // ── Linha: categorias mais ativas ───────────────────────────────────────
  const topCategories = useMemo(
    () =>
      [...categories]
        .filter((c) => c.name)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8),
    [categories],
  );

  const lineData = useMemo(
    () => ({
      labels: topCategories.map((c) => c.name ?? `Cat #${c.categoryId}`),
      datasets: [
        {
          label: "Produtos no top",
          data: topCategories.map((c) => c.count),
          borderColor: "#ee4d2d",
          backgroundColor: "rgba(238,77,45,0.18)",
          borderWidth: 2,
          tension: 0.4,
          pointBackgroundColor: "#ee4d2d",
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
        },
      ],
    }),
    [topCategories],
  );

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          ticks: {
            color: colors.textSecondary,
            font: { size: 9 },
            maxRotation: 45,
            minRotation: 30,
          },
          grid: { display: false },
        },
        y: {
          ticks: { color: colors.textSecondary, font: { size: 10 } },
          grid: { color: colors.grid },
          beginAtZero: true,
        },
      },
    }),
    [colors],
  );

  // ── Bubble: Comissão × Vendas ───────────────────────────────────────────
  const bubbleProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          (p.sales ?? 0) > 0 &&
          (p.commissionRate ?? 0) > 0 &&
          ((p.price ?? p.priceMin ?? 0) > 0),
      ),
    [products],
  );

  const bubbleData = useMemo(() => {
    // Normaliza preço pra raio entre 4 e 20 px.
    const prices = bubbleProducts
      .map((p) => p.price ?? p.priceMin ?? 0)
      .filter((v) => v > 0);
    const maxP = Math.max(1, ...prices);
    const minP = Math.min(...prices, maxP);
    const radiusOf = (price: number) => {
      if (maxP === minP) return 8;
      const t = (price - minP) / (maxP - minP);
      return 4 + t * 16; // 4–20
    };
    return {
      datasets: [
        {
          label: "Produtos",
          data: bubbleProducts.map((p) => ({
            x: p.sales ?? 0,
            y: (p.commissionRate ?? 0) * 100,
            r: radiusOf(p.price ?? p.priceMin ?? 0),
            // metadata pra tooltip + click
            _name: p.productName,
            _price: p.price ?? p.priceMin ?? 0,
            _index: bubbleProducts.indexOf(p),
          })),
          backgroundColor: "rgba(238,77,45,0.55)",
          borderColor: "#ee4d2d",
          borderWidth: 1,
          hoverBackgroundColor: "rgba(238,77,45,0.85)",
        },
      ],
    };
  }, [bubbleProducts]);

  const bubbleOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      onHover: (event: unknown, elements: unknown[]) => {
        const ev = event as { native?: { target?: HTMLElement } };
        const target = ev.native?.target;
        if (target) target.style.cursor = elements.length > 0 ? "pointer" : "default";
      },
      onClick: (_e: unknown, elements: Array<{ index: number }>) => {
        if (!onProductClick || elements.length === 0) return;
        const p = bubbleProducts[elements[0].index];
        if (p) onProductClick(p);
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          callbacks: {
            label: (ctx: {
              raw: { _name: string; _price: number; x: number; y: number };
            }) => {
              const r = ctx.raw;
              return [
                r._name.length > 40 ? `${r._name.slice(0, 37)}…` : r._name,
                `Vendas: ${formatInt(r.x)}`,
                `Comissão: ${r.y.toFixed(1)}%`,
                `Preço: ${formatBRL(r._price)}`,
              ];
            },
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          type: "logarithmic" as const,
          title: {
            display: true,
            text: "Vendas (escala log)",
            color: colors.textSecondary,
            font: { size: 9 },
          },
          ticks: { color: colors.textSecondary, font: { size: 9 } },
          grid: { color: colors.grid },
        },
        y: {
          title: {
            display: true,
            text: "Comissão %",
            color: colors.textSecondary,
            font: { size: 9 },
          },
          ticks: {
            color: colors.textSecondary,
            font: { size: 9 },
            callback: (v: number | string) => `${v}%`,
          },
          grid: { color: colors.grid },
          beginAtZero: true,
        },
      },
    }),
    [colors, onProductClick, bubbleProducts],
  );

  // ── Histograma: distribuição de score ───────────────────────────────────
  const scoreHistogram = useMemo(() => {
    const bins = Array.from({ length: 10 }, () => 0); // 0-10, 11-20, ..., 91-100
    for (const p of products) {
      const idx = Math.min(9, Math.max(0, Math.floor(p.score / 10)));
      bins[idx] += 1;
    }
    return bins;
  }, [products]);

  const histData = useMemo(
    () => ({
      labels: ["0-10", "11-20", "21-30", "31-40", "41-50", "51-60", "61-70", "71-80", "81-90", "91-100"],
      datasets: [
        {
          label: "Produtos",
          data: scoreHistogram,
          backgroundColor: scoreHistogram.map((_, i) => {
            // Bins de score alto ficam mais saturados em laranja
            if (i >= 7) return "#ee4d2d";
            if (i >= 5) return "#fb923c";
            if (i >= 3) return "#fdba74";
            return "#3f3f46"; // bins de score baixo: cinza neutro
          }),
          borderRadius: 4,
        },
      ],
    }),
    [scoreHistogram],
  );

  const histOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              `${ctx.parsed.y} produtos`,
          },
        },
        datalabels: { display: false },
      },
      scales: {
        x: {
          ticks: { color: colors.textSecondary, font: { size: 9 } },
          grid: { display: false },
        },
        y: {
          ticks: { color: colors.textSecondary, font: { size: 9 }, stepSize: 1 },
          grid: { color: colors.grid },
          beginAtZero: true,
        },
      },
    }),
    [colors],
  );

  // ── Score Velocity: top em ascensão ─────────────────────────────────────
  const velocityList = useMemo(() => {
    return products
      .map((p) => {
        const sp = p.sparkline ?? [];
        if (sp.length < 2) return { product: p, delta: 0, last: p.score };
        return {
          product: p,
          delta: sp[sp.length - 1] - sp[0],
          last: sp[sp.length - 1],
        };
      })
      .filter((x) => x.delta !== 0)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 8);
  }, [products]);

  // ── Ticker: produtos com Δscore (vs primeiro ponto da sparkline) ────────
  const tickerItems = useMemo(() => {
    return products
      .map((p) => {
        const sp = p.sparkline ?? [];
        const delta = sp.length >= 2 ? sp[sp.length - 1] - sp[0] : 0;
        return { product: p, symbol: tickerSymbol(p.productName), delta };
      })
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 30);
  }, [products]);

  // ── Treemap: vendas agregadas por categoria ────────────────────────────
  // Cruza `products[i].categoryIds` × `categories[i].name` somando `sales`.
  // Cada categoria vira uma caixa proporcional ao volume; cor escurece com
  // o tamanho (mais vendas = laranja mais saturado).
  const categoryVolume = useMemo(() => {
    const nameById = new Map<number, string>();
    for (const c of categories) {
      if (c.name) nameById.set(c.categoryId, c.name);
    }
    const byCat = new Map<number, { name: string; sales: number; count: number }>();
    for (const p of products) {
      for (const cid of p.categoryIds ?? []) {
        const name = nameById.get(cid);
        if (!name) continue; // ignora categorias sem nome (UI fica limpa)
        const acc = byCat.get(cid) ?? { name, sales: 0, count: 0 };
        acc.sales += p.sales ?? 0;
        acc.count += 1;
        byCat.set(cid, acc);
      }
    }
    return [...byCat.values()]
      .filter((c) => c.sales > 0)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 12);
  }, [products, categories]);

  const treemapMaxSales = useMemo(
    () => Math.max(1, ...categoryVolume.map((c) => c.sales)),
    [categoryVolume],
  );

  const treemapData = useMemo(
    () => ({
      datasets: [
        {
          tree: categoryVolume,
          key: "sales",
          backgroundColor: (ctx: { type?: string; raw?: { _data?: { sales?: number } } }) => {
            if (ctx.type !== "data") return "transparent";
            const sales = ctx.raw?._data?.sales ?? 0;
            const t = sales / treemapMaxSales;
            // 0.35 → 0.95: garante contraste mesmo em caixas pequenas
            const alpha = 0.35 + t * 0.6;
            return `rgba(238,77,45,${alpha.toFixed(2)})`;
          },
          borderColor: "rgba(0,0,0,0.35)",
          borderWidth: 1,
          spacing: 1.5,
          labels: {
            display: true,
            align: "left",
            position: "top",
            color: "#ffffff",
            font: { size: 11, weight: "bold" as const },
            padding: 6,
            formatter: (ctx: { raw?: { _data?: { name?: string; sales?: number } } }) => {
              const d = ctx.raw?._data;
              if (!d?.name) return "";
              return [d.name, formatInt(d.sales ?? 0) + " vendas"];
            },
          },
        },
      ],
    }),
    [categoryVolume, treemapMaxSales],
  );

  const treemapOptions = useMemo(
    () => ({
      maintainAspectRatio: false,
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: colors.tooltipBg,
          titleColor: colors.tooltipTitle,
          bodyColor: colors.tooltipBody,
          borderColor: colors.tooltipBorder,
          borderWidth: 1,
          callbacks: {
            title: (items: Array<{ raw?: { _data?: { name?: string } } }>) =>
              items[0]?.raw?._data?.name ?? "",
            label: (ctx: { raw?: { _data?: { sales?: number; count?: number } } }) => {
              const d = ctx.raw?._data;
              if (!d) return "";
              return `${formatInt(d.sales ?? 0)} vendas · ${d.count ?? 0} produtos`;
            },
          },
        },
        datalabels: { display: false },
      },
    }),
    [colors],
  );

  // ── Word cloud: palavras mais frequentes nos top 50 produtos ───────────
  // Tokenizar nome → minúsculas → remover stop words + ruído (unidades,
  // números curtos). Mantém termos comerciais relevantes ("kit", "premium",
  // "feminino"...) — esses ARE os trending keywords do mercado.
  const STOP_WORDS_PT = useMemo(
    () =>
      new Set([
        "de", "do", "da", "dos", "das",
        "para", "pra", "por",
        "com", "sem",
        "em", "no", "na", "nos", "nas",
        "ou", "e",
        "a", "o", "as", "os",
        "um", "uma", "uns", "umas",
        "que", "se",
        // unidades e ruído numérico:
        "cm", "mm", "ml", "kg", "pcs", "und", "uni",
      ]),
    [],
  );

  const wordCloudTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products.slice(0, 60)) {
      const tokens = p.productName
        .toLowerCase()
        .replace(/[^a-zà-ÿ\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4 && !STOP_WORDS_PT.has(w));
      for (const t of tokens) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, c]) => c >= 2) // só palavras que aparecem ≥ 2x
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 30);
  }, [products, STOP_WORDS_PT]);

  return (
    <div className="space-y-3">
      {/* Linha 1: Pizza + Linha (existentes) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard title="Top produtos por score">
          {topByScore.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-56">
              <Pie data={pieData} options={pieOptions as never} />
            </div>
          )}
        </ChartCard>
        <ChartCard title="Categorias mais ativas">
          {topCategories.length === 0 ? (
            <EmptyState text="Aguardando próxima varredura pra mapear nomes." />
          ) : (
            <div className="h-56">
              <Line data={lineData} options={lineOptions as never} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Linha 2: Bubble + Histograma */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title="Comissão × Vendas"
          subtitle="Tamanho da bolha = preço · clique pra abrir o produto"
        >
          {bubbleProducts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-56">
              <Bubble data={bubbleData} options={bubbleOptions as never} />
            </div>
          )}
        </ChartCard>
        <ChartCard
          title="Distribuição de score"
          subtitle="Bins de 10 — concentração à direita = mercado saturado de virais"
        >
          {products.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-56">
              <Bar data={histData} options={histOptions as never} />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Linha 3: Score Velocity */}
      <ChartCard
        title="Em ascensão · 24h"
        subtitle="Produtos com maior ganho de score desde o primeiro snapshot"
      >
        {velocityList.length === 0 ? (
          <EmptyState text="Histórico ainda vazio. Próximas varreduras vão alimentar essa lista." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {velocityList.map(({ product, delta, last }) => (
              <button
                key={product.itemId}
                type="button"
                onClick={() => onProductClick?.(product)}
                className="text-left rounded-lg border border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50 hover:bg-[#2f2f34] light:hover:bg-zinc-100 px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums ${
                      delta > 0
                        ? "bg-emerald-500/15 text-emerald-400 light:text-emerald-700"
                        : delta < 0
                          ? "bg-red-500/15 text-red-400 light:text-red-700"
                          : "bg-[#3e3e46] light:bg-zinc-200 text-[#9a9aa2] light:text-zinc-500"
                    }`}
                  >
                    {delta > 0 ? <ArrowUp className="w-2.5 h-2.5" /> : delta < 0 ? <ArrowDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                    {delta > 0 ? "+" : ""}
                    {delta}
                  </span>
                  <span className="text-[9px] text-[#7a7a80] light:text-zinc-500 tabular-nums">
                    score {last}
                  </span>
                </div>
                <p className="text-[10px] font-semibold text-text-primary light:text-zinc-900 line-clamp-2 leading-snug">
                  {product.productName}
                </p>
              </button>
            ))}
          </div>
        )}
      </ChartCard>

      {/* Linha 4: Treemap categorias × volume + Word cloud nomes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChartCard
          title="Mapa do mercado · vendas por categoria"
          subtitle="Tamanho da caixa = vendas agregadas · cor = intensidade do volume"
        >
          {categoryVolume.length === 0 ? (
            <EmptyState text="Aguardando próxima varredura pra mapear nomes das categorias." />
          ) : (
            <div className="h-72">
              <TreemapChart
                type="treemap"
                data={treemapData as never}
                options={treemapOptions as never}
              />
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Palavras-chave em alta"
          subtitle="Tokens mais frequentes nos nomes dos top 60 — use no copy de criativos"
        >
          {wordCloudTags.length === 0 ? (
            <EmptyState text="Aguardando dados pra extrair palavras." />
          ) : (
            <div className="h-72 flex items-center justify-center px-2 overflow-hidden">
              <TagCloud
                minSize={11}
                maxSize={30}
                tags={wordCloudTags}
                disableRandomColor
                renderer={(tag, size) => (
                  <span
                    key={tag.value}
                    style={{
                      fontSize: `${size}px`,
                      lineHeight: 1.4,
                      margin: "0 6px",
                      display: "inline-block",
                      // Gradiente de cor por frequência: maior = mais saturado.
                      // tag.count está no range [min, max] da nuvem.
                      color: `rgba(238,77,45,${0.55 + (size - 11) / (30 - 11) * 0.45})`,
                      fontWeight: size > 20 ? 800 : size > 15 ? 600 : 500,
                      cursor: "default",
                    }}
                    title={`${tag.value} — ${tag.count} ocorrências`}
                  >
                    {tag.value}
                  </span>
                )}
              />
            </div>
          )}
        </ChartCard>
      </div>

      {/* Linha 5: Live ticker estilo bolsa */}
      {tickerItems.length > 0 ? (
        <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white overflow-hidden">
          <div className="px-4 py-2 border-b border-[#2c2c32] light:border-zinc-200 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-text-secondary light:text-zinc-600">
              Live · variação de score
            </h3>
            <span className="ml-auto text-[9px] text-[#7a7a80] light:text-zinc-500">
              {tickerItems.length} produtos
            </span>
          </div>
          <div className="ticker-viewport overflow-hidden py-2">
            <div className="ticker-track flex items-center gap-2 whitespace-nowrap pl-2">
              {/* Duplica items pra criar loop seamless */}
              {[...tickerItems, ...tickerItems].map((item, i) => {
                const up = item.delta > 0;
                const down = item.delta < 0;
                return (
                  <button
                    key={`${item.product.itemId}-${i}`}
                    type="button"
                    onClick={() => onProductClick?.(item.product)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#2c2c32] light:border-zinc-200 bg-[#222228] light:bg-zinc-50 hover:bg-[#2f2f34] light:hover:bg-zinc-100 transition-colors shrink-0"
                  >
                    <span className="font-mono text-[10px] font-bold text-text-primary light:text-zinc-900">
                      {item.symbol}
                    </span>
                    <span className="text-[9px] text-[#9a9aa2] light:text-zinc-500 tabular-nums">
                      {item.product.score}
                    </span>
                    <span
                      className={`inline-flex items-center gap-0.5 text-[9px] font-bold tabular-nums ${
                        up
                          ? "text-emerald-400 light:text-emerald-700"
                          : down
                            ? "text-red-400 light:text-red-700"
                            : "text-[#9a9aa2] light:text-zinc-500"
                      }`}
                    >
                      {up ? <ArrowUp className="w-2.5 h-2.5" /> : down ? <ArrowDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
                      {up ? "+" : ""}
                      {item.delta}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .ticker-track {
          animation: ticker-scroll 60s linear infinite;
        }
        .ticker-viewport:hover .ticker-track {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#2c2c32] light:border-zinc-200 bg-[#1c1c1f] light:bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-[#ee4d2d]" />
        <h3 className="text-[11px] uppercase tracking-widest font-bold text-text-secondary light:text-zinc-600">
          {title}
        </h3>
      </div>
      {subtitle ? (
        <p className="text-[9px] text-[#7a7a80] light:text-zinc-500 mb-2">{subtitle}</p>
      ) : null}
      {children}
    </div>
  );
}

function EmptyState({ text = "Aguardando dados." }: { text?: string }) {
  return (
    <p className="text-[11px] text-[#9a9aa2] light:text-zinc-500 py-12 text-center">
      {text}
    </p>
  );
}
