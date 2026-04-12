/**
 * Campanhas no Meta Ads: criar, editar e deletar.
 * POST: criar | PATCH: editar nome/objetivo | DELETE: deletar
 */

const ALLOWED_OBJECTIVES = [
  "OUTCOME_TRAFFIC",
  "OUTCOME_SALES",
  "OUTCOME_LEADS",
  "OUTCOME_ENGAGEMENT",
  "OUTCOME_AWARENESS",
  "OUTCOME_APP_PROMOTION",
];

/** Apenas estes objetivos na criação de campanha pelo app. */
const CREATE_CAMPAIGN_OBJECTIVES = ["OUTCOME_TRAFFIC", "OUTCOME_LEADS", "OUTCOME_SALES"];

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

async function getToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, token: null };
  const { data: profile } = await supabase.from("profiles").select("meta_access_token").eq("id", user.id).single();
  return { user, token: profile?.meta_access_token?.trim() || null };
}

/** GET ?campaign_id= — objective e nome (para formulário de conjunto no ATI). */
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const campaign_id = new URL(req.url).searchParams.get("campaign_id")?.trim();
    if (!campaign_id) return NextResponse.json({ error: "campaign_id é obrigatório." }, { status: 400 });
    const res = await fetch(
      `${GRAPH_BASE}/${campaign_id}?fields=objective,name&access_token=${encodeURIComponent(token)}`
    );
    const json = (await res.json()) as { objective?: string; name?: string; error?: { message: string } };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao buscar campanha" }, { status: 500 });
    }
    return NextResponse.json({
      objective: (json.objective ?? "OUTCOME_TRAFFIC").toUpperCase(),
      name: json.name ?? "",
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const campaign_id = body?.campaign_id?.trim();
    const name = body?.name?.trim();
    const objective = body?.objective?.trim()?.toUpperCase();
    if (!campaign_id) return NextResponse.json({ error: "campaign_id é obrigatório." }, { status: 400 });
    if (!name && !objective) return NextResponse.json({ error: "Informe name e/ou objective para editar." }, { status: 400 });
    if (objective && !ALLOWED_OBJECTIVES.includes(objective)) {
      return NextResponse.json({ error: `objective inválido. Use: ${ALLOWED_OBJECTIVES.join(", ")}` }, { status: 400 });
    }

    const params = new URLSearchParams({ access_token: token });
    if (name) params.set("name", name);
    if (objective) params.set("objective", objective);
    const res = await fetch(`${GRAPH_BASE}/${campaign_id}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = (await res.json()) as { success?: boolean; error?: { message: string } };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao editar campanha", meta_error: json.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao editar campanha" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { user, token } = await getToken(supabase);
    if (!user || !token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const campaign_id = req.url.includes("?") ? new URL(req.url).searchParams.get("campaign_id")?.trim() : null;
    const body = await req.json().catch(() => ({}));
    const id = campaign_id || body?.campaign_id?.trim();
    if (!id) return NextResponse.json({ error: "campaign_id é obrigatório." }, { status: 400 });

    const res = await fetch(`${GRAPH_BASE}/${id}?access_token=${encodeURIComponent(token)}`, { method: "DELETE" });
    const json = (await res.json()) as { success?: boolean; error?: { message: string } };
    if (json.error) {
      return NextResponse.json({ error: json.error.message ?? "Erro ao deletar campanha", meta_error: json.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro ao deletar campanha" }, { status: 500 });
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
    const name = body?.name?.trim();
    const objective = (body?.objective?.trim() || "OUTCOME_TRAFFIC").toUpperCase();
    if (!ad_account_id || !name) {
      return NextResponse.json(
        { error: "ad_account_id e name são obrigatórios." },
        { status: 400 }
      );
    }
    if (!CREATE_CAMPAIGN_OBJECTIVES.includes(objective)) {
      return NextResponse.json(
        { error: `Neste fluxo só é permitido criar campanhas: ${CREATE_CAMPAIGN_OBJECTIVES.join(" ou ")}.` },
        { status: 400 }
      );
    }

    const params = new URLSearchParams();
    params.set("access_token", token);
    params.set("name", name);
    params.set("objective", objective);
    params.set("status", "PAUSED");
    params.set("special_ad_categories", "[]");
    params.set("is_adset_budget_sharing_enabled", "false");

    const url = `${GRAPH_BASE}/${ad_account_id}/campaigns`;
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
    return NextResponse.json({ campaign_id: json.id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar campanha";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
