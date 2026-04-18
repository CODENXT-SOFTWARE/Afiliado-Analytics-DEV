/**
 * Dados ATI: cruza Meta Ads + Shopee por Sub-ID e aplica regras de status/diagnóstico.
 * GET /api/ati/data?start=YYYY-MM-DD&end=YYYY-MM-DD
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import {
  getLevelCpcMeta,
  getLevelClickDiscrepancy,
  getLevelCpa,
  getLevelRoas,
  getCreativeStatus,
  getCreativeDiagnosis,
  canValidateCreative,
} from "@/lib/ati/rules";
import type { ATICreativeRow } from "@/lib/ati/types";
import { gateAti } from "@/lib/require-entitlements";

type ShopeeRow = {
  "ID do pedido": string;
  "Comissão líquida do afiliado(R$)": string;
  "Valor de Compra(R$)": string;
  "Status do Pedido": string;
  Sub_id1: string;
  "Tipo de atribuição": string;
};

const VALID_ORDER_STATUSES = new Set(["completed", "pending", "pending_payment"]);

function parseMoney(s: string): number {
  const n = parseFloat(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function isValidStatus(status: string): boolean {
  const s = status.trim().toLowerCase();
  return s.length > 0 && VALID_ORDER_STATUSES.has(s);
}

/** Agrega por sub_id: comissão, receita, pedidos únicos válidos, pedidos diretos únicos válidos. Sub_id1 pode ser "a / b". */
function aggregateShopeeBySubId(rows: ShopeeRow[]): Map<string, { commission: number; revenue: number; orders: number; directOrders: number }> {
  // Pré-processa: por subId, acumula comissão/receita e sets de IDs de pedido para unicidade
  const intermediate = new Map<string, {
    commission: number;
    revenue: number;
    orderIds: Set<string>;
    directOrderIds: Set<string>;
  }>();

  for (const row of rows) {
    const status = String(row["Status do Pedido"] ?? "").trim().toLowerCase();
    if (!isValidStatus(status)) continue; // ignora cancelados e status inválidos

    const orderId = String(row["ID do pedido"] ?? "").trim();
    const commission = parseMoney(row["Comissão líquida do afiliado(R$)"]);
    const revenue = parseMoney(row["Valor de Compra(R$)"]);
    const isDirect = String(row["Tipo de atribuição"] ?? "").trim().toLowerCase() === "direta";

    const parts = row.Sub_id1
      .split(/\/|\\/)
      .map((s) => s.trim())
      .filter(Boolean);
    const subIds = parts.length > 0 ? parts : ["Sem Sub ID"];

    for (const subId of subIds) {
      const cur = intermediate.get(subId) ?? {
        commission: 0,
        revenue: 0,
        orderIds: new Set<string>(),
        directOrderIds: new Set<string>(),
      };
      // Acumula comissão e receita por linha (cada item do pedido contribui)
      cur.commission += commission;
      cur.revenue += revenue;
      // Conta pedido único via Set (mesmo orderId de múltiplos itens não duplica)
      if (orderId) cur.orderIds.add(orderId);
      if (isDirect && orderId) cur.directOrderIds.add(orderId);
      intermediate.set(subId, cur);
    }
  }

  // Converte para contagens finais
  const map = new Map<string, { commission: number; revenue: number; orders: number; directOrders: number }>();
  for (const [subId, acc] of intermediate) {
    map.set(subId, {
      commission: acc.commission,
      revenue: acc.revenue,
      orders: acc.orderIds.size,
      directOrders: acc.directOrderIds.size,
    });
  }
  return map;
}


export async function GET(req: Request) {
  try {
    const gate = await gateAti();
    if (!gate.allowed) return gate.response;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const start = url.searchParams.get("start");
    const end = url.searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json(
        { error: "Parâmetros start e end são obrigatórios (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const baseUrl = new URL(req.url).origin;

    const metaRes = await fetch(
      `${baseUrl}/api/meta/insights?ati=1&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
      {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      }
    );

    if (!metaRes.ok) {
      const err = (await metaRes.json()) as { error?: string };
      return NextResponse.json(
        { error: err.error ?? "Erro ao buscar dados do Meta" },
        { status: metaRes.status }
      );
    }

    let shopeeRows: ShopeeRow[] = [];
    let shopeeWarning: string | null = null;
    try {
      const shopeeRes = await fetch(`${baseUrl}/api/shopee/conversion-report?start=${start}&end=${end}`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      if (shopeeRes.ok) {
        const sj = (await shopeeRes.json()) as { data?: ShopeeRow[] };
        shopeeRows = sj.data ?? [];
      } else {
        const err = (await shopeeRes.json().catch(() => ({}))) as { error?: string };
        shopeeWarning = err.error ?? `Shopee (${shopeeRes.status}). Vendas não cruzadas neste período.`;
      }
    } catch {
      shopeeWarning = "Shopee indisponível. Campanhas Meta carregam normalmente.";
    }

    const metaJson = (await metaRes.json()) as {
      insights?: Array<{
        ad_id: string;
        ad_name: string;
        adset_id: string;
        adset_name: string;
        campaign_id: string;
        campaign_name: string;
        ad_account_id?: string;
        spend: number;
        clicks: number;
        impressions: number;
        ctr: number;
        cpc: number;
      }>;
      campaignStatusMap?: Record<string, string>;
      campaignsList?: Array<{ id: string; name: string; ad_account_id: string }>;
      adSetList?: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }>;
      adSetStatusMap?: Record<string, string>;
      adStatusMap?: Record<string, string>;
    };
    const insights = metaJson.insights ?? [];
    const campaignStatus = metaJson.campaignStatusMap ?? {};
    const campaignsList = metaJson.campaignsList ?? [];
    const adSetList = metaJson.adSetList ?? [];
    const adSetStatusMap = metaJson.adSetStatusMap ?? {};
    const adStatusMap = metaJson.adStatusMap ?? {};
    const shopeeBySubId = aggregateShopeeBySubId(shopeeRows);

    const adToShopeeSub = new Map<string, string>();
    const { data: subRows, error: subMapErr } = await supabase
      .from("ati_ad_shopee_sub")
      .select("ad_id, shopee_sub_id")
      .eq("user_id", user.id);
    if (!subMapErr && subRows) {
      for (const r of subRows as { ad_id: string; shopee_sub_id: string }[]) {
        adToShopeeSub.set(r.ad_id, r.shopee_sub_id);
      }
    }

    const adToInfopSub = new Map<string, string>();
    const { data: infopRows, error: infopMapErr } = await supabase
      .from("ati_ad_infop_sub")
      .select("ad_id, infop_sub_id")
      .eq("user_id", user.id);
    if (!infopMapErr && infopRows) {
      for (const r of infopRows as { ad_id: string; infop_sub_id: string }[]) {
        adToInfopSub.set(r.ad_id, r.infop_sub_id);
      }
    }

    const zeroShopee = { commission: 0, revenue: 0, orders: 0, directOrders: 0 };
    const creatives: ATICreativeRow[] = insights.map((m) => {
      const shopeeSubId = adToShopeeSub.get(m.ad_id) ?? "";
      const shopee = shopeeSubId ? (shopeeBySubId.get(shopeeSubId) ?? zeroShopee) : zeroShopee;
      const cost = m.spend;
      const clicksMeta = m.clicks;
      const orders = shopee.orders;
      const directOrders = shopee.directOrders;
      const commission = shopee.commission;
      const revenue = shopee.revenue;
      const cpa = orders > 0 ? cost / orders : 0;
      const roas = cost > 0 ? commission / cost : 0;
      const epc = clicksMeta > 0 ? commission / clicksMeta : 0;
      // A Shopee (Open API / relatório de conversão) não expõe contagem de cliques por link/sub_id —
      // só pedidos e comissão. Usamos os cliques do Meta como proxy para `clicksShopee` (mesmo valor).
      const clicksShopee = clicksMeta;
      const cpcShopee = 0;
      const clickDiscrepancyPct =
        clicksMeta > 0 ? ((clicksMeta - clicksShopee) / clicksMeta) * 100 : 0;

      const levelCpcMeta = getLevelCpcMeta(m.cpc);
      const levelClickDiscrepancy = getLevelClickDiscrepancy(clickDiscrepancyPct);
      const levelCpa = getLevelCpa(cpa);
      const levelRoas = getLevelRoas(roas);
      const status = getCreativeStatus(
        roas,
        m.cpc,
        clickDiscrepancyPct,
        cpa,
        cost > 0 || clicksMeta > 0
      );
      const diagnosis = getCreativeDiagnosis(
        status,
        roas,
        m.cpc,
        levelCpcMeta,
        clickDiscrepancyPct,
        levelClickDiscrepancy,
        orders
      );
      const canValidate = canValidateCreative(status);

      return {
        adId: m.ad_id,
        adName: m.ad_name,
        adSetId: m.adset_id,
        adSetName: m.adset_name,
        campaignId: m.campaign_id,
        campaignName: m.campaign_name,
        adAccountId: m.ad_account_id,
        subId: shopeeSubId || null,
        shopeeSubId: shopeeSubId || null,
        infopSubId: adToInfopSub.get(m.ad_id) ?? null,
        cost,
        clicksMeta,
        ctrMeta: m.ctr,
        cpcMeta: m.cpc,
        clicksShopee,
        cpcShopee,
        orders,
        directOrders,
        revenue,
        commission,
        cpa,
        roas,
        epc,
        clickDiscrepancyPct,
        levelCpcMeta,
        levelClickDiscrepancy,
        levelCpa,
        levelRoas,
        status,
        diagnosis,
        canValidate,
      };
    });

    const validated: Array<{ id: string; adId: string; adName: string; campaignId: string; campaignName: string; scaledAt: string }> = [];
    const { data: validatedRows, error: validatedError } = await supabase
      .from("ati_validated_creatives")
      .select("id, ad_id, ad_name, campaign_id, campaign_name, scaled_at")
      .eq("user_id", user.id);
    if (!validatedError && validatedRows) {
      for (const v of validatedRows) {
        validated.push({
          id: v.id,
          adId: v.ad_id,
          adName: v.ad_name,
          campaignId: v.campaign_id,
          campaignName: v.campaign_name,
          scaledAt: v.scaled_at,
        });
      }
    }

    return NextResponse.json({
      creatives,
      validated,
      campaignStatus,
      campaignsList,
      adSetList,
      adSetStatusMap,
      adStatusMap,
      shopeePeriodStart: start,
      shopeePeriodEnd: end,
      metaMetricsMode: "range",
      ...(shopeeWarning ? { shopeeWarning } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao gerar dados ATI";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
