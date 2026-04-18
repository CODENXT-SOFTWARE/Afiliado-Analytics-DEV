/**
 * Performance por ad no cruzamento ATI × Stripe (Trackeamento InfoP).
 *
 *   1. Filtra campanhas com a tag "Tráfego para InfoP".
 *   2. Busca insights do Meta para o período (spend, clicks, impressions por ad).
 *   3. Lê mapeamento `ad_id → infop_sub_id` em `ati_ad_infop_sub`.
 *   4. Lê mapeamento `infop_sub_id → produto Stripe` em `produtos_infoprodutor`.
 *   5. Lista sessions concluídas da Stripe no período, agrupadas por produto (por payment_link).
 *   6. Combina: cada ad → produto (via subId) → receita/pedidos + spend Meta → ROAS/CPA/CPC/Lucro.
 *
 * Retorna uma linha por ad que tenha SubId InfoP (mesmo sem venda, pra mostrar custo).
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const TAG_INFOP = "Tráfego para InfoP";
type Period = "7d" | "30d" | "90d" | "all";

function getDateRangeFromPeriod(period: Period): { start: string; end: string; gteUnix: number | null } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);
  if (period === "all") {
    return { start: "1970-01-01", end, gteUnix: null };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const gteUnix = Math.floor(startDate.getTime() / 1000);
  return { start: startDate.toISOString().slice(0, 10), end, gteUnix };
}

type Insight = {
  ad_id: string;
  ad_name: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id: string;
  campaign_name: string;
  ad_account_id?: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr?: number;
  cpc?: number;
};

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const periodRaw = String(url.searchParams.get("period") ?? "30d").trim().toLowerCase();
    const period: Period = (["7d", "30d", "90d", "all"] as Period[]).includes(periodRaw as Period)
      ? (periodRaw as Period)
      : "30d";
    const { start, end, gteUnix } = getDateRangeFromPeriod(period);

    // 1) Campanhas marcadas como InfoP
    const { data: tagRows } = await supabase
      .from("ati_campaign_tags")
      .select("campaign_id")
      .eq("user_id", user.id)
      .eq("tag", TAG_INFOP);
    const infopCampaignIds = new Set<string>((tagRows ?? []).map((r) => r.campaign_id as string));

    if (infopCampaignIds.size === 0) {
      return NextResponse.json({
        period,
        rows: [],
        totals: emptyTotals(),
        hasInfopCampaigns: false,
        fetchedAt: new Date().toISOString(),
      });
    }

    // 2) Insights do Meta no período
    const baseUrl = new URL(req.url).origin;
    const metaRes = await fetch(`${baseUrl}/api/meta/insights?start=${start}&end=${end}`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: (err as { error?: string }).error ?? "Erro ao buscar dados do Meta" },
        { status: metaRes.status },
      );
    }
    const metaJson = (await metaRes.json()) as { insights?: Insight[] };
    const insights = (metaJson.insights ?? []).filter((i) => infopCampaignIds.has(i.campaign_id));

    // 3) subId por ad (InfoP)
    const { data: subRows } = await supabase
      .from("ati_ad_infop_sub")
      .select("ad_id, infop_sub_id")
      .eq("user_id", user.id);
    const subIdByAd = new Map<string, string>();
    for (const r of subRows ?? []) {
      subIdByAd.set(String(r.ad_id), String(r.infop_sub_id));
    }

    // 4) produtos Stripe com subId
    const { data: produtos } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, image_url, stripe_subid, stripe_payment_link_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe")
      .not("stripe_subid", "is", null);
    type ProdInfo = { id: string; name: string; imageUrl: string | null; paymentLinkId: string | null };
    // Vários produtos podem compartilhar o mesmo subId — agregamos tudo no cruzamento.
    const produtosPorSubId = new Map<string, ProdInfo[]>();
    const produtoPorId = new Map<string, ProdInfo>();
    for (const p of produtos ?? []) {
      const row = p as {
        id: string;
        name: string;
        image_url: string | null;
        stripe_subid: string | null;
        stripe_payment_link_id: string | null;
      };
      const info: ProdInfo = {
        id: row.id,
        name: row.name,
        imageUrl: row.image_url,
        paymentLinkId: row.stripe_payment_link_id,
      };
      if (row.stripe_subid) {
        const bucket = produtosPorSubId.get(row.stripe_subid) ?? [];
        bucket.push(info);
        produtosPorSubId.set(row.stripe_subid, bucket);
      }
      produtoPorId.set(row.id, info);
    }

    // 5) Revenue + pedidos por produto via Stripe (só se tivermos chave)
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key")
      .eq("id", user.id)
      .single();
    const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";

    type ProdSalesAgg = { revenueCents: number; orders: number };
    const salesByProduct = new Map<string, ProdSalesAgg>();

    if (stripeKey.trim() && produtoPorId.size > 0) {
      const stripe = new Stripe(stripeKey);
      // Monta o inverso: payment_link → produtoId para agrupar
      const produtoByPaymentLink = new Map<string, string>();
      for (const [pid, info] of produtoPorId.entries()) {
        if (info.paymentLinkId) produtoByPaymentLink.set(info.paymentLinkId, pid);
      }

      let startingAfter: string | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const params: Stripe.Checkout.SessionListParams = {
          limit: 100,
          ...(gteUnix != null ? { created: { gte: gteUnix } } : {}),
          ...(startingAfter ? { starting_after: startingAfter } : {}),
        };
        const page = await stripe.checkout.sessions.list(params);
        for (const s of page.data) {
          if (s.status !== "complete") continue;
          if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") continue;
          const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
          if (!plink) continue;
          const pid = produtoByPaymentLink.get(plink);
          if (!pid) continue;
          const agg = salesByProduct.get(pid) ?? { revenueCents: 0, orders: 0 };
          agg.revenueCents += s.amount_total ?? 0;
          agg.orders += 1;
          salesByProduct.set(pid, agg);
        }
        if (!page.has_more) break;
        startingAfter = page.data[page.data.length - 1]?.id;
        if (!startingAfter) break;
      }
    }

    // 6) Monta as linhas (ad × bucket de produtos com o mesmo subId)
    type Row = {
      adId: string;
      adName: string;
      campaignId: string;
      campaignName: string;
      subId: string | null;
      /** Produto principal (primeiro do bucket) — pra exibir imagem/nome na tabela. */
      produto: ProdInfo | null;
      /** Quantos produtos compartilham esse subId. */
      produtoCount: number;
      /** Nomes dos demais produtos do bucket (para tooltip). */
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

    // Agrega insights por ad (pode vir duplicado por dia/accounts)
    const byAd = new Map<string, Insight>();
    for (const i of insights) {
      const cur = byAd.get(i.ad_id);
      if (cur) {
        cur.spend += i.spend ?? 0;
        cur.clicks += i.clicks ?? 0;
        cur.impressions += i.impressions ?? 0;
      } else {
        byAd.set(i.ad_id, {
          ad_id: i.ad_id,
          ad_name: i.ad_name,
          campaign_id: i.campaign_id,
          campaign_name: i.campaign_name,
          spend: i.spend ?? 0,
          clicks: i.clicks ?? 0,
          impressions: i.impressions ?? 0,
        });
      }
    }

    const rows: Row[] = [];
    for (const [adId, ins] of byAd.entries()) {
      const subId = subIdByAd.get(adId) ?? null;
      const bucket = subId ? produtosPorSubId.get(subId) ?? [] : [];
      // Agrega vendas de todos os produtos do bucket (mesmo subId pode cobrir múltiplos produtos).
      let revenueCents = 0;
      let orders = 0;
      for (const prod of bucket) {
        const s = salesByProduct.get(prod.id);
        if (s) {
          revenueCents += s.revenueCents;
          orders += s.orders;
        }
      }
      const revenue = revenueCents / 100;
      const spend = ins.spend;
      const profit = revenue - spend;
      const roas = spend > 0 ? revenue / spend : 0;
      const cpc = ins.clicks > 0 ? spend / ins.clicks : 0;
      const cpa = orders > 0 ? spend / orders : 0;
      const primary = bucket[0] ?? null;
      const produtoExtras = bucket.slice(1).map((p) => p.name);

      rows.push({
        adId,
        adName: ins.ad_name,
        campaignId: ins.campaign_id,
        campaignName: ins.campaign_name,
        subId,
        produto: primary,
        produtoCount: bucket.length,
        produtoExtras,
        spend,
        clicks: ins.clicks,
        impressions: ins.impressions,
        revenue,
        orders,
        profit,
        roas,
        cpc,
        cpa,
      });
    }

    rows.sort((a, b) => b.revenue - a.revenue || b.spend - a.spend);

    const totals = rows.reduce(
      (acc, r) => {
        acc.spend += r.spend;
        acc.revenue += r.revenue;
        acc.orders += r.orders;
        acc.clicks += r.clicks;
        return acc;
      },
      { spend: 0, revenue: 0, orders: 0, clicks: 0 },
    );
    const totalsWithDerived = {
      ...totals,
      profit: totals.revenue - totals.spend,
      roas: totals.spend > 0 ? totals.revenue / totals.spend : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      cpa: totals.orders > 0 ? totals.spend / totals.orders : 0,
    };

    return NextResponse.json({
      period,
      rows,
      totals: totalsWithDerived,
      hasInfopCampaigns: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function emptyTotals() {
  return { spend: 0, revenue: 0, orders: 0, clicks: 0, profit: 0, roas: 0, cpc: 0, cpa: 0 };
}
