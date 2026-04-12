/**
 * Conjuntos de anúncios (ad set) no Meta: GET um conjunto | PATCH: editar | DELETE: deletar | POST: criar
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { normalizeAdSetTargeting } from "../../../../lib/meta-adset-targeting";
import { isMetaLeadsWebsiteConversionEvent } from "../../../../lib/meta-ads-constants";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

/** Garante que o ID da conta tenha o prefixo act_ (exigido pela API ao criar recursos). */
function normalizeAdAccountId(id: string): string {
  const raw = String(id).trim();
  if (!raw) return raw;
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

/** Metas de desempenho permitidas por objetivo de campanha (evita erro 2490408). Inclui objetivos legados. */
const OBJECTIVE_GOALS: Record<string, string[]> = {
  OUTCOME_TRAFFIC: ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"],
  OUTCOME_SALES: ["REACH", "IMPRESSIONS", "OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"],
  OUTCOME_LEADS: [
    "LINK_CLICKS",
    "REACH",
    "IMPRESSIONS",
    "OFFSITE_CONVERSIONS",
    "VALUE",
    "CONVERSIONS",
    "LEAD_GENERATION",
  ],
  OUTCOME_ENGAGEMENT: ["LINK_CLICKS", "REACH", "IMPRESSIONS", "ENGAGED_USERS"],
  OUTCOME_AWARENESS: ["REACH", "IMPRESSIONS", "AD_RECALL_LIFT"],
  OUTCOME_APP_PROMOTION: ["APP_INSTALLS", "LINK_CLICKS", "REACH", "IMPRESSIONS"],
  // Objetivos legados (campanhas antigas)
  CONVERSIONS: ["REACH", "IMPRESSIONS", "OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"],
  LINK_CLICKS: ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"],
  BRAND_AWARENESS: ["REACH", "IMPRESSIONS", "AD_RECALL_LIFT"],
  REACH: ["REACH", "IMPRESSIONS"],
  MESSAGES: ["REACH", "IMPRESSIONS", "LINK_CLICKS"],
  LEAD_GENERATION: ["LINK_CLICKS", "REACH", "IMPRESSIONS", "LEAD_GENERATION"],
  PRODUCT_CATALOG_SALES: ["REACH", "IMPRESSIONS", "OFFSITE_CONVERSIONS", "VALUE"],
};

function isValidGoalForObjective(goal: string, objective: string): boolean {
  const key = objective.toUpperCase().replace(/-/g, "_").replace(/\s/g, "");
  const allowed = OBJECTIVE_GOALS[key] ?? OBJECTIVE_GOALS.REACH ?? ["REACH", "IMPRESSIONS"];
  return allowed.includes(goal.toUpperCase());
}

function defaultGoalForObjective(objective: string): string {
  const key = objective.toUpperCase().replace(/-/g, "_").replace(/\s/g, "");
  const allowed = OBJECTIVE_GOALS[key] ?? OBJECTIVE_GOALS.REACH ?? ["REACH", "IMPRESSIONS"];
  return allowed[0] ?? "REACH";
}

/**
 * A Graph API (v21) não aceita `CONVERSIONS` em optimization_goal na criação/edição de conjuntos;
 * o equivalente para conversões no site com Pixel é `OFFSITE_CONVERSIONS`.
 */
function toGraphOptimizationGoal(goal: string): string {
  const g = goal.toUpperCase();
  return g === "CONVERSIONS" ? "OFFSITE_CONVERSIONS" : g;
}

const VALID_PUBLISHER_PLATFORMS = new Set(["facebook", "instagram", "audience_network", "messenger"]);

/** Máximo de países por conjunto (API do Meta aceita vários em geo_locations.countries). */
const MAX_TARGET_COUNTRIES = 25;

/**
 * Monta lista de códigos ISO 2 letras a partir de country_codes[] ou country_code legado.
 */
function parseCountryCodes(body: { country_codes?: unknown; country_code?: unknown }): string[] {
  const out: string[] = [];
  if (Array.isArray(body.country_codes)) {
    for (const x of body.country_codes) {
      const c = String(x).trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);
      if (c.length === 2) out.push(c);
    }
  }
  if (out.length === 0 && body.country_code != null && String(body.country_code).trim() !== "") {
    const single = String(body.country_code).trim().toUpperCase().slice(0, 2);
    if (/^[A-Z]{2}$/.test(single)) out.push(single);
  }
  const uniq = [...new Set(out)];
  if (uniq.length === 0) uniq.push("BR");
  return uniq.slice(0, MAX_TARGET_COUNTRIES);
}

function parsePublisherPlatforms(raw: unknown): string[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["facebook", "instagram"];
  const list = raw
    .map((x) => String(x).toLowerCase().trim())
    .filter((x) => VALID_PUBLISHER_PLATFORMS.has(x));
  const uniq = [...new Set(list)];
  return uniq.length > 0 ? uniq : ["facebook", "instagram"];
}

async function getToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, token: null };
  const { data: profile } = await supabase.from("profiles").select("meta_access_token").eq("id", user.id).single();
  return { user, token: profile?.meta_access_token?.trim() || null };
}

/** GET ?adset_id=xxx — retorna dados do conjunto para preencher formulário de edição. */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const adset_id = url.searchParams.get("adset_id")?.trim();
    if (!adset_id) return NextResponse.json({ error: "adset_id é obrigatório." }, { status: 400 });

    const fields = "name,daily_budget,targeting,optimization_goal,campaign_id,promoted_object";
    const res = await fetch(`${GRAPH_BASE}/${adset_id}?fields=${fields}&access_token=${encodeURIComponent(token)}`);
    const json = (await res.json()) as {
      name?: string;
      daily_budget?: string;
      targeting?: {
        geo_locations?: { countries?: string[] };
        age_min?: number;
        age_max?: number;
        genders?: number[];
        publisher_platforms?: string[];
      };
      optimization_goal?: string;
      campaign_id?: string;
      promoted_object?: { pixel_id?: string; custom_event_type?: string };
      error?: { message: string };
    };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao buscar conjunto", meta_error: json.error }, { status: 500 });
    }
    const targeting = json.targeting;
    const countries = targeting?.geo_locations?.countries?.filter(
      (c): c is string => typeof c === "string" && /^[A-Z]{2}$/i.test(c)
    );
    const country_codes =
      countries && countries.length > 0
        ? [...new Set(countries.map((c) => c.toUpperCase().slice(0, 2)))].slice(0, MAX_TARGET_COUNTRIES)
        : ["BR"];
    const country_code = country_codes[0] ?? "BR";
    const genderNum = targeting?.genders?.[0];
    const gender = genderNum === 2 ? "female" : genderNum === 1 ? "male" : "all";
    const promoted = json.promoted_object;
    const pp = targeting?.publisher_platforms;
    const publisher_platforms = Array.isArray(pp) && pp.length > 0 ? pp : ["facebook", "instagram"];
    return NextResponse.json({
      name: json.name ?? "",
      daily_budget: json.daily_budget != null ? String(Number(json.daily_budget) / 100) : "10",
      country_code,
      country_codes: country_codes,
      age_min: targeting?.age_min ?? 18,
      age_max: targeting?.age_max ?? 65,
      gender,
      optimization_goal: json.optimization_goal ?? "LINK_CLICKS",
      campaign_id: json.campaign_id ?? "",
      pixel_id: promoted?.pixel_id ?? "",
      conversion_event: promoted?.custom_event_type ?? "PAGE_VIEW",
      publisher_platforms,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao buscar conjunto" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const adset_id = body?.adset_id?.trim();
    const name = body?.name?.trim();
    const daily_budget_raw = body?.daily_budget;
    // Front envia em centavos (ex: 700 = R$ 7). Usar como está; não multiplicar por 100.
    const daily_budget = daily_budget_raw != null ? (typeof daily_budget_raw === "number" ? Math.round(daily_budget_raw) : Math.round(Number(daily_budget_raw))) : undefined;
    const country_codes = parseCountryCodes(body);
    const hasExplicitCountryInput =
      (Array.isArray(body?.country_codes) && body.country_codes.length > 0) ||
      (body?.country_code != null && String(body.country_code).trim() !== "");
    const age_min = body?.age_min != null ? Number(body.age_min) : 18;
    const age_max = body?.age_max != null ? Number(body.age_max) : 65;
    const gender = body?.gender || "all";
    const optimization_goal = body?.optimization_goal?.trim();
    const pixel_id = body?.pixel_id?.trim();
    let conversion_event = (body?.conversion_event?.trim() || "PAGE_VIEW").toUpperCase();
    if (conversion_event === "VIEW_CONTENT") conversion_event = "CONTENT_VIEW";

    if (!adset_id) return NextResponse.json({ error: "adset_id é obrigatório." }, { status: 400 });
    if (
      !name &&
      daily_budget === undefined &&
      !optimization_goal &&
      !hasExplicitCountryInput &&
      body?.age_min == null &&
      body?.age_max == null &&
      body?.gender == null &&
      !pixel_id &&
      body?.publisher_platforms == null
    ) {
      return NextResponse.json({ error: "Informe ao menos um campo para editar (name, daily_budget, optimization_goal, targeting, pixel)." }, { status: 400 });
    }
    if (daily_budget !== undefined && (!Number.isFinite(daily_budget) || daily_budget < 100)) {
      return NextResponse.json({ error: "daily_budget mínimo 100 centavos (R$ 1)." }, { status: 400 });
    }

    const params = new URLSearchParams({ access_token: token });
    if (name) params.set("name", name);
    if (daily_budget !== undefined) params.set("daily_budget", String(Math.round(daily_budget)));
    let patchCampaignObjective = "";
    let patchCampaignId = body?.campaign_id?.trim();
    if (!patchCampaignId) {
      const adsetRes = await fetch(`${GRAPH_BASE}/${adset_id}?fields=campaign_id&access_token=${encodeURIComponent(token)}`);
      const adsetJson = (await adsetRes.json()) as { campaign_id?: string };
      patchCampaignId = adsetJson.campaign_id ?? "";
    }
    if (patchCampaignId) {
      const campaignRes = await fetch(`${GRAPH_BASE}/${patchCampaignId}?fields=objective&access_token=${encodeURIComponent(token)}`);
      const campJson = (await campaignRes.json()) as { objective?: string };
      patchCampaignObjective = (campJson.objective ?? "OUTCOME_TRAFFIC").toUpperCase().replace(/-/g, "_").replace(/\s/g, "");
    }
    if (optimization_goal) {
      if (patchCampaignObjective === "OUTCOME_SALES") {
        params.set("optimization_goal", "OFFSITE_CONVERSIONS");
      } else if (patchCampaignId && isValidGoalForObjective(optimization_goal, patchCampaignObjective)) {
        params.set("optimization_goal", toGraphOptimizationGoal(optimization_goal));
      }
    } else if (patchCampaignObjective === "OUTCOME_SALES" && pixel_id) {
      params.set("optimization_goal", "OFFSITE_CONVERSIONS");
    }
    if (patchCampaignObjective === "OUTCOME_SALES" && pixel_id) {
      if (!["PURCHASE", "ADD_TO_CART"].includes(conversion_event)) {
        return NextResponse.json(
          { error: "Para campanhas de vendas use o evento Comprar ou Adicionar ao carrinho." },
          { status: 400 }
        );
      }
    }
    const patchLeadConvGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (patchCampaignObjective === "OUTCOME_LEADS" && optimization_goal && patchLeadConvGoals.includes(optimization_goal.toUpperCase())) {
      if (!pixel_id) {
        return NextResponse.json(
          {
            error:
              "Campanhas de leads com meta Conversões no site exigem o Pixel e um evento (ex.: Lead ou Cadastro completo).",
          },
          { status: 400 }
        );
      }
      if (!isMetaLeadsWebsiteConversionEvent(conversion_event)) {
        return NextResponse.json(
          {
            error:
              "Para leads com conversões no site, escolha um evento compatível com o Pixel (ex.: LEAD, COMPLETE_REGISTRATION).",
          },
          { status: 400 }
        );
      }
    }
    const publisher_platforms = parsePublisherPlatforms(body?.publisher_platforms);
    const targeting: Record<string, unknown> = {
      geo_locations: { countries: country_codes },
      age_min,
      age_max,
      publisher_platforms,
    };
    if (gender !== "all") targeting.genders = gender === "female" ? [2] : [1];
    params.set("targeting", JSON.stringify(normalizeAdSetTargeting(targeting)));
    if (pixel_id && conversion_event) {
      const promotedObject = { pixel_id, custom_event_type: conversion_event };
      params.set("promoted_object", JSON.stringify(promotedObject));
    }
    const res = await fetch(`${GRAPH_BASE}/${adset_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = (await res.json()) as { success?: boolean; error?: { message: string } };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao editar conjunto", meta_error: json.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao editar conjunto" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const adset_id = url.searchParams.get("adset_id")?.trim() || (await req.json().catch(() => ({})))?.adset_id?.trim();
    if (!adset_id) return NextResponse.json({ error: "adset_id é obrigatório." }, { status: 400 });

    const res = await fetch(`${GRAPH_BASE}/${adset_id}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
    const json = (await res.json()) as { success?: boolean; error?: { message: string } };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao deletar conjunto", meta_error: json.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao deletar conjunto" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("meta_access_token")
      .eq("id", user.id)
      .single();

    const token = profile?.meta_access_token?.trim();
    if (!token) {
      return NextResponse.json(
        { error: "Token do Meta não configurado." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const ad_account_id = body?.ad_account_id?.trim();
    const campaign_id = body?.campaign_id?.trim();
    const name = body?.name?.trim();
    const daily_budget = body?.daily_budget != null ? Number(body.daily_budget) : NaN;
    const country_codes = parseCountryCodes(body);
    const age_min = body?.age_min != null ? Number(body.age_min) : 18;
    const age_max = body?.age_max != null ? Number(body.age_max) : 65;
    const gender = body?.gender || "all"; // all | male | female
    const pixel_id = body?.pixel_id?.trim();
    const custom_conversion_id = body?.custom_conversion_id?.trim();
    let conversion_event = (body?.conversion_event?.trim() || "PAGE_VIEW").toUpperCase();
    if (conversion_event === "VIEW_CONTENT") conversion_event = "CONTENT_VIEW";

    if (!ad_account_id || !campaign_id || !name) {
      return NextResponse.json(
        { error: "ad_account_id, campaign_id e name são obrigatórios." },
        { status: 400 }
      );
    }
    if (!Number.isFinite(daily_budget) || daily_budget < 100) {
      return NextResponse.json(
        { error: "daily_budget obrigatório (mínimo 100 centavos, ex: 1000 = R$ 10)." },
        { status: 400 }
      );
    }

    // Buscar objetivo da campanha para usar optimization_goal compatível (evita erro 2490408)
    const campaignRes = await fetch(
      `${GRAPH_BASE}/${campaign_id}?fields=objective&access_token=${encodeURIComponent(token)}`
    );
    const campaignJson = (await campaignRes.json()) as { objective?: string; error?: { message: string } };
    if (campaignJson.error) {
      return NextResponse.json(
        { error: campaignJson.error.message ?? "Erro ao buscar campanha", meta_error: campaignJson.error },
        { status: 500 }
      );
    }
    const campaignObjective = (campaignJson.objective ?? "OUTCOME_TRAFFIC").toUpperCase().replace(/-/g, "_").replace(/\s/g, "");

    let effectiveOptimizationGoal = (body?.optimization_goal?.trim() || "").toUpperCase();
    if (campaignObjective === "OUTCOME_SALES") {
      effectiveOptimizationGoal = "OFFSITE_CONVERSIONS";
      if (!pixel_id) {
        return NextResponse.json(
          { error: "Campanhas de vendas exigem o Pixel e o evento Comprar ou Adicionar ao carrinho." },
          { status: 400 }
        );
      }
      if (!["PURCHASE", "ADD_TO_CART"].includes(conversion_event)) {
        return NextResponse.json(
          { error: "Para vendas, use apenas o evento Comprar (PURCHASE) ou Adicionar ao carrinho (ADD_TO_CART)." },
          { status: 400 }
        );
      }
    } else if (campaignObjective === "OUTCOME_LEADS") {
      const convGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
      if (convGoals.includes(effectiveOptimizationGoal)) {
        if (!pixel_id) {
          return NextResponse.json(
            {
              error:
                "Campanhas de leads com meta Conversões no site exigem o Pixel e um evento (ex.: Lead ou Cadastro completo).",
            },
            { status: 400 }
          );
        }
        if (!isMetaLeadsWebsiteConversionEvent(conversion_event)) {
          return NextResponse.json(
            {
              error:
                "Para leads com conversões no site, escolha um evento compatível com o Pixel (ex.: LEAD, COMPLETE_REGISTRATION).",
            },
            { status: 400 }
          );
        }
      }
    } else if (!effectiveOptimizationGoal || !isValidGoalForObjective(effectiveOptimizationGoal, campaignObjective)) {
      effectiveOptimizationGoal = defaultGoalForObjective(campaignObjective);
    }

    const accountIdForCreate = normalizeAdAccountId(ad_account_id);
    const publisher_platforms = parsePublisherPlatforms(body?.publisher_platforms);

    const targeting: Record<string, unknown> = {
      geo_locations: { countries: country_codes },
      age_min,
      age_max,
      publisher_platforms,
    };
    if (gender !== "all") {
      targeting.genders = gender === "female" ? [2] : [1];
    }

    const targetingPayload = normalizeAdSetTargeting(targeting);

    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("campaign_id", campaign_id);
    params.set("name", name);
    params.set("daily_budget", String(Math.round(daily_budget)));
    params.set("billing_event", "IMPRESSIONS");
    params.set("optimization_goal", toGraphOptimizationGoal(effectiveOptimizationGoal));
    params.set("targeting", JSON.stringify(targetingPayload));
    params.set("status", "PAUSED");
    params.set("start_time", new Date().toISOString());
    params.set("destination_type", "WEBSITE");
    params.set("bid_strategy", "LOWEST_COST_WITHOUT_CAP");
    const conversionGoals = ["OFFSITE_CONVERSIONS", "VALUE", "CONVERSIONS"];
    if (pixel_id && conversionGoals.includes(effectiveOptimizationGoal)) {
      const promotedObject: { pixel_id: string; custom_event_type?: string } = { pixel_id };
      promotedObject.custom_event_type = conversion_event;
      params.set("promoted_object", JSON.stringify(promotedObject));
      if (custom_conversion_id && /^\d+$/.test(custom_conversion_id)) {
        params.set("custom_conversion_id", custom_conversion_id);
      }
    }
    const url = `${GRAPH_BASE}/${accountIdForCreate}/adsets`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = (await res.json()) as {
      id?: string;
      error?: {
        message: string;
        code?: number;
        error_subcode?: number;
        error_user_msg?: string;
        error_user_title?: string;
        type?: string;
      };
    };
    if (json.error) {
      const err = json.error;
      const detail = [err.message];
      if (err.error_user_msg) detail.push(err.error_user_msg);
      if (err.code != null) detail.push(`(código: ${err.code})`);
      if (err.error_subcode != null) detail.push(`(subcódigo: ${err.error_subcode})`);
      throw new Error(detail.join(" "));
    }
    return NextResponse.json({ adset_id: json.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar conjunto de anúncios";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
