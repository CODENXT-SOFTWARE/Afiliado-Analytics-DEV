/**
 * Snapshots de grupos WhatsApp (GPL).
 * POST: salva snapshot de hoje; na primeira vez da instância, salva também a BASE (nunca sobrescreve).
 * GET: ?instance_id=&start=&end= — retorna base (primeira atualização) + snapshots no intervalo.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { applyGplGroupSnapshot, type GplGroupRow } from "@/lib/gpl-apply-group-snapshot";

function todayUTC(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const instanceId = (body?.instance_id ?? "").trim();
    const groups = Array.isArray(body?.groups) ? body.groups : [];

    if (!instanceId) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 });
    }

    const payload: GplGroupRow[] = groups.map((g: { id?: string; nome?: string; qtdMembros?: number }) => ({
      id: String(g?.id ?? ""),
      nome: String(g?.nome ?? ""),
      qtdMembros: Number(g?.qtdMembros ?? 0),
    }));

    const applied = await applyGplGroupSnapshot(supabase, user.id, instanceId, payload);
    if (!applied.ok) {
      return NextResponse.json({ error: applied.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, snapshot_date: applied.snapshot_date });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao salvar snapshot";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const instanceId = url.searchParams.get("instance_id")?.trim();
    const start = url.searchParams.get("start")?.trim();
    const end = url.searchParams.get("end")?.trim();

    if (!instanceId) {
      return NextResponse.json({ error: "instance_id é obrigatório" }, { status: 400 });
    }

    let query = supabase
      .from("gpl_group_snapshots")
      .select("snapshot_date, groups, created_at")
      .eq("user_id", user.id)
      .eq("instance_id", instanceId)
      .order("snapshot_date", { ascending: false });

    if (start && end) {
      query = query.gte("snapshot_date", start).lte("snapshot_date", end);
    } else {
      const yesterday = yesterdayUTC();
      const today = todayUTC();
      query = query.in("snapshot_date", [yesterday, today]);
    }

    const { data: rows, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const snapshots = (rows ?? []).map((r) => ({
      date: r.snapshot_date,
      groups: Array.isArray(r.groups) ? r.groups : [],
      created_at: r.created_at,
    }));

    // Buscar BASE (primeira atualização da instância) para comparação
    const { data: baseRow } = await supabase
      .from("gpl_group_snapshots_base")
      .select("groups, created_at")
      .eq("user_id", user.id)
      .eq("instance_id", instanceId)
      .maybeSingle();

    const base = baseRow
      ? {
          groups: Array.isArray(baseRow.groups) ? baseRow.groups : [],
          created_at: baseRow.created_at,
        }
      : null;

    const { data: cumulativeRows } = await supabase
      .from("gpl_group_cumulative")
      .select("group_id, group_name, total_novos, total_saidas")
      .eq("user_id", user.id)
      .eq("instance_id", instanceId);

    const cumulative = (cumulativeRows ?? []).map((r) => ({
      group_id: r.group_id,
      group_name: r.group_name ?? "",
      total_novos: r.total_novos ?? 0,
      total_saidas: r.total_saidas ?? 0,
    }));

    return NextResponse.json({ base, snapshots, cumulative });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar snapshots";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** Zera total_novos e total_saidas acumulados do grupo (GPL). */
export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const instanceId = String(body?.instance_id ?? "").trim();
    const groupId = String(body?.group_id ?? "").trim();
    const groupName = String(body?.group_name ?? "").trim();

    if (!instanceId || !groupId) {
      return NextResponse.json({ error: "instance_id e group_id são obrigatórios" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await supabase.from("gpl_group_cumulative").upsert(
      {
        user_id: user.id,
        instance_id: instanceId,
        group_id: groupId,
        group_name: groupName,
        total_novos: 0,
        total_saidas: 0,
        updated_at: now,
      },
      { onConflict: "user_id,instance_id,group_id" }
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao limpar acumulado";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
