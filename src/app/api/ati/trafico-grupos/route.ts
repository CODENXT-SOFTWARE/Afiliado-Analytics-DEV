/**
 * Lista campanhas com tag "Tráfego para Grupos" com árvore completa (sanfona):
 * campanha → conjuntos → anúncios, com spend/clicks no período.
 * GET /api/ati/trafico-grupos?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Retorna: { campaigns: Array<CampaignDetail> }
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { gateAti } from "@/lib/require-entitlements";

const TAG_TRAFICO_GRUPOS = "Tráfego para Grupos";

function getDefaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { start: fmt(start), end: fmt(end) };
}

export type TraficoGruposAd = {
  id: string;
  name: string;
  status: string;
  spend: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  /** Contagem de leads (actions na API Meta), quando disponível. */
  leads: number;
};

export type TraficoGruposAdSet = {
  id: string;
  name: string;
  status: string;
  spend: number;
  ads: TraficoGruposAd[];
};

export type TraficoGruposCampaignDetail = {
  id: string;
  name: string;
  ad_account_id: string;
  status: string;
  spend: number;
  adSets: TraficoGruposAdSet[];
};

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
    let start = url.searchParams.get("start");
    let end = url.searchParams.get("end");
    if (!start || !end) {
      const def = getDefaultRange();
      start = start ?? def.start;
      end = end ?? def.end;
    }

    const { data: tagRows, error: tagError } = await supabase
      .from("ati_campaign_tags")
      .select("campaign_id")
      .eq("user_id", user.id)
      .eq("tag", TAG_TRAFICO_GRUPOS);

    if (tagError) {
      return NextResponse.json({ error: tagError.message }, { status: 500 });
    }

    const taggedIds = new Set((tagRows ?? []).map((r) => r.campaign_id));
    if (taggedIds.size === 0) {
      return NextResponse.json({ campaigns: [] });
    }

    const baseUrl = new URL(req.url).origin;
    const metaRes = await fetch(
      `${baseUrl}/api/meta/insights?start=${start}&end=${end}`,
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
        leads?: number;
      }>;
      campaignsList?: Array<{ id: string; name: string; ad_account_id: string }>;
      adSetList?: Array<{ id: string; name: string; campaign_id: string; ad_account_id: string }>;
      campaignStatusMap?: Record<string, string>;
      adSetStatusMap?: Record<string, string>;
      adStatusMap?: Record<string, string>;
    };

    const insights = metaJson.insights ?? [];
    const campaignsList = metaJson.campaignsList ?? [];
    const adSetList = metaJson.adSetList ?? [];
    const campaignStatusMap = metaJson.campaignStatusMap ?? {};
    const adSetStatusMap = metaJson.adSetStatusMap ?? {};
    const adStatusMap = metaJson.adStatusMap ?? {};

    const campaignsFiltered = campaignsList.filter((c) => taggedIds.has(c.id));
    const campaignDetails: TraficoGruposCampaignDetail[] = campaignsFiltered.map((camp) => {
      const adSetsOfCamp = adSetList.filter((s) => s.campaign_id === camp.id);
      const insightsOfCamp = insights.filter((i) => i.campaign_id === camp.id);

      const byAdSet = new Map<string, TraficoGruposAd[]>();
      for (const i of insightsOfCamp) {
        const list = byAdSet.get(i.adset_id) ?? [];
        list.push({
          id: i.ad_id,
          name: i.ad_name,
          status: adStatusMap[i.ad_id] ?? "UNKNOWN",
          spend: i.spend,
          clicks: i.clicks,
          impressions: i.impressions,
          ctr: i.ctr,
          cpc: i.cpc,
          leads: typeof i.leads === "number" ? i.leads : 0,
        });
        byAdSet.set(i.adset_id, list);
      }

      const adSets: TraficoGruposAdSet[] = adSetsOfCamp.map((aset) => {
        const ads = byAdSet.get(aset.id) ?? [];
        const spend = ads.reduce((s, a) => s + a.spend, 0);
        return {
          id: aset.id,
          name: aset.name,
          status: adSetStatusMap[aset.id] ?? "UNKNOWN",
          spend,
          ads,
        };
      });

      const campaignSpend = adSets.reduce((s, a) => s + a.spend, 0);
      return {
        id: camp.id,
        name: camp.name,
        ad_account_id: camp.ad_account_id,
        status: campaignStatusMap[camp.id] ?? "UNKNOWN",
        spend: campaignSpend,
        adSets,
      };
    });

    return NextResponse.json({ campaigns: campaignDetails });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar campanhas";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
