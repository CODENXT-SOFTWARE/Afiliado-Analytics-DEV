/**
 * Cron de varredura de tendências Shopee (Fase 1).
 *
 * Roda 1x por hora via Vercel Cron. Busca os top 100 produtos em alta
 * (productOfferV2 sortType=8 = vendas decrescentes) usando as credenciais
 * Shopee de um profile staff (a empresa dona do app) — mesmo dado serve pra
 * todos os usuários. A conversão pra link afiliado per-user acontece em
 * `/api/shopee-trends/affiliate-link`, lendo as credenciais do próprio usuário.
 *
 * Por que não usar a credencial de cada usuário? O dado de "trending" da
 * Shopee é global (catálogo único), então 1 chamada/hora cobre 100% da base
 * sem queimar a quota individual de ninguém.
 *
 * Autenticação: header `Authorization: Bearer ${CRON_SECRET}` em produção.
 */

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import {
  fetchTrendingProducts,
  fetchShopeeDirectories,
  fetchCategoryList,
  computeViralizationScore,
  isViralProduct,
} from "@/lib/shopee-trends";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TARGET_COUNT = 100;

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Pega o primeiro profile staff com credenciais Shopee preenchidas. Usar staff
  // garante que é a conta da empresa (não um usuário comum cuja credencial pode
  // sumir/expirar). A query ordena por `shopee_api_key_updated_at DESC` pra
  // priorizar a credencial mais recentemente rotacionada.
  const { data: staffProfile, error: staffErr } = await supabase
    .from("profiles")
    .select("shopee_app_id, shopee_api_key")
    .eq("plan_tier", "staff")
    .not("shopee_app_id", "is", null)
    .not("shopee_api_key", "is", null)
    .order("shopee_api_key_updated_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (staffErr) {
    console.error("[shopee-trends cron] erro lendo profile staff:", staffErr.message);
    return Response.json({ error: staffErr.message }, { status: 500 });
  }
  const appId = (staffProfile as { shopee_app_id?: string | null } | null)?.shopee_app_id?.trim();
  const secret = (staffProfile as { shopee_api_key?: string | null } | null)?.shopee_api_key?.trim();
  if (!appId || !secret) {
    return Response.json(
      {
        error:
          "Nenhum profile staff com credenciais Shopee. Configure shopee_app_id + shopee_api_key num profile com plan_tier='staff'.",
      },
      { status: 500 },
    );
  }

  // Buscamos produtos (top sellers), diretórios de lojas+categorias (offers),
  // e taxonomia completa de categorias em paralelo. A taxonomia (`categoryList`)
  // dá os nomes que batem com `productCatIds` dos produtos — sem ela, os IDs
  // do snapshot vão cair no fallback "Categoria #X" no client.
  let products;
  let shopDirectory: Awaited<ReturnType<typeof fetchShopeeDirectories>>["shops"] = [];
  let categoryDirectory: Awaited<ReturnType<typeof fetchShopeeDirectories>>["categories"] = [];
  let categoryTaxonomy: Awaited<ReturnType<typeof fetchCategoryList>> = [];
  try {
    const [productsResult, dirsResult, taxonomyResult] = await Promise.allSettled([
      fetchTrendingProducts(appId, secret, TARGET_COUNT),
      fetchShopeeDirectories(appId, secret),
      fetchCategoryList(appId, secret),
    ]);
    if (productsResult.status === "rejected") throw productsResult.reason;
    products = productsResult.value;
    if (dirsResult.status === "fulfilled") {
      shopDirectory = dirsResult.value.shops;
      categoryDirectory = dirsResult.value.categories;
    } else {
      console.warn("[shopee-trends cron] fetch directories falhou:", dirsResult.reason);
    }
    if (taxonomyResult.status === "fulfilled") {
      categoryTaxonomy = taxonomyResult.value;
    } else {
      console.warn("[shopee-trends cron] fetch category list falhou:", taxonomyResult.reason);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao buscar Shopee";
    console.error("[shopee-trends cron] fetch falhou:", msg);
    return Response.json({ error: msg }, { status: 502 });
  }

  if (products.length === 0) {
    return Response.json({ ok: true, count: 0, note: "Shopee retornou lista vazia" });
  }

  const fetchedAt = new Date().toISOString();
  const snapshotRows = products.map((p, idx) => {
    const score = computeViralizationScore(p);
    return {
      item_id: p.itemId,
      shop_id: p.shopId,
      product_name: p.productName,
      image_url: p.imageUrl,
      price: p.price,
      price_min: p.priceMin,
      price_max: p.priceMax,
      sales: p.sales,
      commission_rate: p.commissionRate,
      rating_star: p.ratingStar,
      product_link: p.productLink,
      offer_link: p.offerLink,
      shop_name: p.shopName,
      category_ids: p.categoryIds,
      viralization_score: score,
      rank_position: idx + 1,
      is_viral: isViralProduct(p, score),
      fetched_at: fetchedAt,
      updated_at: fetchedAt,
    };
  });

  const observationRows = snapshotRows.map((r) => ({
    item_id: r.item_id,
    observed_at: fetchedAt,
    sales: r.sales,
    price: r.price,
    score: r.viralization_score,
    rank_position: r.rank_position,
  }));

  // UPSERT do snapshot atual (item_id é PK).
  const { error: upsertError } = await supabase
    .from("shopee_trend_snapshots")
    .upsert(snapshotRows, { onConflict: "item_id" });
  if (upsertError) {
    console.error("[shopee-trends cron] upsert snapshot falhou:", upsertError.message);
    return Response.json({ error: upsertError.message }, { status: 500 });
  }

  // Append-only observations (alimenta sparklines + análise temporal).
  const { error: insertError } = await supabase
    .from("shopee_trend_observations")
    .insert(observationRows);
  if (insertError) {
    console.error("[shopee-trends cron] insert observations falhou:", insertError.message);
    // Não trava — o snapshot já foi gravado. Sparkline fica capenga só nessa janela.
  }

  // UPSERT do diretório de lojas. Idempotente.
  let shopDirectoryUpserted = 0;
  if (shopDirectory.length > 0) {
    const directoryRows = shopDirectory.map((s) => ({
      shop_id: s.shopId,
      shop_name: s.shopName,
      image_url: s.imageUrl,
      rating_star: s.ratingStar,
      updated_at: fetchedAt,
    }));
    const { error: dirError } = await supabase
      .from("shopee_shop_directory")
      .upsert(directoryRows, { onConflict: "shop_id" });
    if (dirError) {
      console.error("[shopee-trends cron] upsert shop directory falhou:", dirError.message);
    } else {
      shopDirectoryUpserted = directoryRows.length;
    }
  }

  // UPSERT do diretório de categorias. Mescla offers + taxonomy — taxonomy
  // tem prioridade (fonte canônica com IDs que casam com produtos).
  let categoryDirectoryUpserted = 0;
  const mergedCategories = new Map<number, string>();
  for (const c of categoryDirectory) mergedCategories.set(c.categoryId, c.name);
  for (const c of categoryTaxonomy) mergedCategories.set(c.categoryId, c.name); // sobrescreve com taxonomy
  if (mergedCategories.size > 0) {
    const catRows = [...mergedCategories.entries()].map(([category_id, name]) => ({
      category_id,
      name,
      updated_at: fetchedAt,
    }));
    const { error: catError } = await supabase
      .from("shopee_category_directory")
      .upsert(catRows, { onConflict: "category_id" });
    if (catError) {
      console.error("[shopee-trends cron] upsert category directory falhou:", catError.message);
    } else {
      categoryDirectoryUpserted = catRows.length;
    }
  }

  return Response.json({
    ok: true,
    count: snapshotRows.length,
    fetchedAt,
    viralCount: snapshotRows.filter((r) => r.is_viral).length,
    shopsCached: shopDirectoryUpserted,
    categoriesCached: categoryDirectoryUpserted,
  });
}
