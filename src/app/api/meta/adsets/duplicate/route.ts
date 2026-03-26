/**
 * Duplicar conjunto de anúncios N vezes (nome + " -COPIA 1", " -COPIA 2", ...).
 * POST /api/meta/adsets/duplicate
 * Body: { adset_id: string, count: number }  count 1-50
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../../utils/supabase/server";
import { normalizeAdSetTargeting } from "../../../../../lib/meta-adset-targeting";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Garante que o ID da conta de anúncios tenha o prefixo act_ (exigido pela API ao criar recursos). */
function normalizeAdAccountId(id: string): string {
  const raw = String(id).trim();
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("meta_access_token").eq("id", user.id).single();
    const token = profile?.meta_access_token?.trim();
    if (!token) return NextResponse.json({ error: "Token do Meta não configurado." }, { status: 400 });

    const body = await req.json();
    const adset_id = body?.adset_id?.trim();
    let count = body?.count != null ? Number(body.count) : 1;
    if (!adset_id) return NextResponse.json({ error: "adset_id é obrigatório." }, { status: 400 });
    if (!Number.isFinite(count) || count < 1 || count > 50) {
      return NextResponse.json({ error: "count deve ser entre 1 e 50." }, { status: 400 });
    }
    count = Math.floor(count);

    const fields = "name,campaign_id,daily_budget,targeting,optimization_goal,billing_event,status,promoted_object,destination_type,bid_strategy";
    const adsetRes = await fetch(`${GRAPH_BASE}/${adset_id}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
    const adsetJson = (await adsetRes.json()) as {
      name?: string;
      campaign_id?: string;
      daily_budget?: string;
      targeting?: unknown;
      optimization_goal?: string;
      billing_event?: string;
      status?: string;
      promoted_object?: unknown;
      destination_type?: string;
      bid_strategy?: string;
      error?: { message: string };
    };
    if (adsetJson.error) {
      return NextResponse.json({ error: adsetJson.error.message ?? "Erro ao buscar conjunto", meta_error: adsetJson.error }, { status: 500 });
    }
    const campaign_id = adsetJson.campaign_id;
    if (!campaign_id) return NextResponse.json({ error: "Conjunto sem campaign_id." }, { status: 500 });

    const campaignRes = await fetch(`${GRAPH_BASE}/${campaign_id}?fields=account_id&access_token=${encodeURIComponent(token)}`);
    const campaignJson = (await campaignRes.json()) as { account_id?: string; error?: { message: string } };
    if (campaignJson.error || !campaignJson.account_id) {
      return NextResponse.json({ error: campaignJson.error?.message ?? "Erro ao buscar conta da campanha." }, { status: 500 });
    }
    const account_id = normalizeAdAccountId(campaignJson.account_id);

    const baseName = (adsetJson.name || "Conjunto").slice(0, 200);
    const fallbackTargeting: Record<string, unknown> = {
      geo_locations: { countries: ["BR"] },
      age_min: 18,
      age_max: 65,
    };
    const sourceTargeting =
      adsetJson.targeting && typeof adsetJson.targeting === "object" && adsetJson.targeting !== null && !Array.isArray(adsetJson.targeting)
        ? { ...(adsetJson.targeting as Record<string, unknown>) }
        : fallbackTargeting;
    const targetingJson = JSON.stringify(normalizeAdSetTargeting(sourceTargeting));
    const created: string[] = [];
    for (let i = 1; i <= count; i++) {
      const name = `${baseName} -COPIA ${i}`;
      const params = new URLSearchParams({
        access_token: token,
        campaign_id,
        name,
        daily_budget: String(adsetJson.daily_budget || "1000"),
        billing_event: adsetJson.billing_event || "IMPRESSIONS",
        optimization_goal: adsetJson.optimization_goal || "LINK_CLICKS",
        targeting: targetingJson,
        status: "PAUSED",
        start_time: new Date().toISOString(),
        destination_type: adsetJson.destination_type || "WEBSITE",
        bid_strategy: adsetJson.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      });
      if (adsetJson.promoted_object && typeof adsetJson.promoted_object === "object") {
        params.set("promoted_object", JSON.stringify(adsetJson.promoted_object));
      }
      const createRes = await fetch(`${GRAPH_BASE}/${account_id}/adsets`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const createJson = (await createRes.json()) as { id?: string; error?: { message: string } };
      if (createJson.error) {
        return NextResponse.json({
          error: `Erro ao criar cópia ${i}: ${createJson.error.message}`,
          created,
          meta_error: createJson.error,
        }, { status: 500 });
      }
      if (createJson.id) created.push(createJson.id);
    }
    return NextResponse.json({ success: true, count: created.length, adset_ids: created });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao duplicar conjunto" }, { status: 500 });
  }
}
