/**
 * Lojas Shopee mais frequentes no snapshot de tendências (agregação do
 * `shopee_trend_snapshots` — não chama a Shopee de novo, é só rollup local).
 * Logo de cada loja vem de `shopee_shop_directory` (cache populado pelo cron
 * via shopeeOfferV2).
 *
 *   GET /api/shopee-trends/shops?limit=20            → lista agregada
 *   GET /api/shopee-trends/shops?shopName=<nome>     → produtos daquela loja no snapshot
 *
 * Resposta (modo lista):
 *   { shops: [{ shopName, imageUrl, productCount, totalSales, avgScore, avgCommission, viralCount }] }
 *
 * Resposta (modo detalhe):
 *   { shopName, imageUrl, products: [...mesma shape de /api/shopee-trends] }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type SnapshotRow = {
  item_id: number;
  product_name: string;
  image_url: string | null;
  price: number | string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  sales: number;
  commission_rate: number | string | null;
  rating_star: number | string | null;
  product_link: string | null;
  shop_name: string | null;
  category_ids: number[] | null;
  viralization_score: number | null;
  rank_position: number | null;
  is_viral: boolean;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function discountRateOf(min: number | null, max: number | null): number {
  if (min == null || max == null || max <= 0 || min >= max) return 0;
  return Math.max(0, Math.min(1, (max - min) / max));
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const url = new URL(req.url);
    const shopName = url.searchParams.get("shopName")?.trim();
    const limit = Math.max(5, Math.min(50, Number(url.searchParams.get("limit") ?? 20)));

    const { data: rows, error } = await supabase
      .from("shopee_trend_snapshots")
      .select(
        "item_id, product_name, image_url, price, price_min, price_max, sales, commission_rate, rating_star, product_link, shop_name, category_ids, viralization_score, rank_position, is_viral",
      )
      .order("fetched_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const all = (rows ?? []) as SnapshotRow[];

    // Lookup do logo: traz o diretório inteiro de uma vez (≤200 rows) e
    // monta um Map por nome lower-case. Cruzar pelo nome é suficiente porque
    // o Shopee usa nome canônico estável.
    const { data: dirRows } = await supabase
      .from("shopee_shop_directory")
      .select("shop_name, image_url");
    const logoByName = new Map<string, string | null>();
    for (const row of (dirRows ?? []) as Array<{ shop_name: string; image_url: string | null }>) {
      logoByName.set(row.shop_name.toLowerCase(), row.image_url);
    }

    // Modo "detalhe da loja"
    if (shopName) {
      const matched = all.filter(
        (r) => (r.shop_name ?? "").toLowerCase() === shopName.toLowerCase(),
      );

      // Sparklines (24h de score) pra cada produto da loja — mesmo padrão do
      // endpoint principal, pra que <ProductCard> renderize sem cair em undefined.
      const itemIds = matched.map((r) => r.item_id);
      const sparkByItem = new Map<number, number[]>();
      if (itemIds.length > 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: observations } = await supabase
          .from("shopee_trend_observations")
          .select("item_id, observed_at, score")
          .in("item_id", itemIds)
          .gte("observed_at", since)
          .order("observed_at", { ascending: true });
        for (const obs of (observations ?? []) as Array<{
          item_id: number;
          score?: number | null;
        }>) {
          const arr = sparkByItem.get(obs.item_id) ?? [];
          arr.push(typeof obs.score === "number" ? obs.score : 0);
          sparkByItem.set(obs.item_id, arr);
        }
      }

      const products = matched
        .map((r) => {
          const score = r.viralization_score ?? 0;
          return {
            itemId: r.item_id,
            productName: r.product_name,
            imageUrl: r.image_url,
            price: num(r.price),
            priceMin: num(r.price_min),
            priceMax: num(r.price_max),
            sales: r.sales,
            commissionRate: num(r.commission_rate),
            ratingStar: num(r.rating_star),
            productLink: r.product_link,
            shopName: r.shop_name,
            categoryIds: r.category_ids ?? [],
            score,
            isViral: r.is_viral,
            rankPosition: r.rank_position,
            discountRate: discountRateOf(num(r.price_min), num(r.price_max)),
            sparkline: sparkByItem.get(r.item_id) ?? [score],
          };
        })
        .sort((a, b) => b.sales - a.sales);
      const imageUrl = logoByName.get(shopName.toLowerCase()) ?? null;
      return NextResponse.json({ shopName, imageUrl, products });
    }

    // Modo lista agregada por loja
    type Agg = {
      shopName: string;
      productCount: number;
      totalSales: number;
      scoreSum: number;
      commissionSum: number;
      commissionN: number;
      viralCount: number;
    };
    const byShop = new Map<string, Agg>();
    for (const r of all) {
      const name = r.shop_name?.trim();
      if (!name) continue;
      const acc = byShop.get(name) ?? {
        shopName: name,
        productCount: 0,
        totalSales: 0,
        scoreSum: 0,
        commissionSum: 0,
        commissionN: 0,
        viralCount: 0,
      };
      acc.productCount += 1;
      acc.totalSales += r.sales ?? 0;
      acc.scoreSum += r.viralization_score ?? 0;
      const c = num(r.commission_rate);
      if (c != null) {
        acc.commissionSum += c;
        acc.commissionN += 1;
      }
      if (r.is_viral) acc.viralCount += 1;
      byShop.set(name, acc);
    }

    const shops = [...byShop.values()]
      .map((a) => ({
        shopName: a.shopName,
        imageUrl: logoByName.get(a.shopName.toLowerCase()) ?? null,
        productCount: a.productCount,
        totalSales: a.totalSales,
        avgScore: a.productCount > 0 ? Math.round(a.scoreSum / a.productCount) : 0,
        avgCommission:
          a.commissionN > 0 ? Math.round((a.commissionSum / a.commissionN) * 1000) / 10 : null,
        viralCount: a.viralCount,
      }))
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, limit);

    return NextResponse.json({ shops });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar lojas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
