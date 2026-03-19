/**
 * Snapshots de grupos WhatsApp (GPL).
 * POST: salva snapshot de hoje; na primeira vez da instância, salva também a BASE (nunca sobrescreve).
 * GET: ?instance_id=&start=&end= — retorna base (primeira atualização) + snapshots no intervalo.
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

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

    const payload = groups.map((g: { id?: string; nome?: string; qtdMembros?: number }) => ({
      id: String(g?.id ?? ""),
      nome: String(g?.nome ?? ""),
      qtdMembros: Number(g?.qtdMembros ?? 0),
    }));

    const snapshotDate = todayUTC();

    // Salvar BASE só na primeira vez (insert que ignora conflito)
    await supabase.from("gpl_group_snapshots_base").upsert(
      {
        user_id: user.id,
        instance_id: instanceId,
        groups: payload,
      },
      { onConflict: "user_id,instance_id", ignoreDuplicates: true }
    );

    // Estado anterior: primeiro o snapshot DE HOJE (o que vamos sobrescrever); se não existir, o último antes de hoje ou a base
    const { data: todaySnapshotRow } = await supabase
      .from("gpl_group_snapshots")
      .select("groups")
      .eq("user_id", user.id)
      .eq("instance_id", instanceId)
      .eq("snapshot_date", snapshotDate)
      .maybeSingle();

    let previousGroups: Array<{ id: string; nome: string; qtdMembros: number }> = [];
    if (todaySnapshotRow?.groups && Array.isArray(todaySnapshotRow.groups)) {
      previousGroups = todaySnapshotRow.groups as Array<{ id: string; nome: string; qtdMembros: number }>;
    } else {
      const { data: prevSnapshotRow } = await supabase
        .from("gpl_group_snapshots")
        .select("groups")
        .eq("user_id", user.id)
        .eq("instance_id", instanceId)
        .lt("snapshot_date", snapshotDate)
        .order("snapshot_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prevSnapshotRow?.groups && Array.isArray(prevSnapshotRow.groups)) {
        previousGroups = prevSnapshotRow.groups as Array<{ id: string; nome: string; qtdMembros: number }>;
      } else {
        const { data: baseRow } = await supabase
          .from("gpl_group_snapshots_base")
          .select("groups")
          .eq("user_id", user.id)
          .eq("instance_id", instanceId)
          .maybeSingle();
        if (baseRow?.groups && Array.isArray(baseRow.groups)) {
          previousGroups = baseRow.groups as Array<{ id: string; nome: string; qtdMembros: number }>;
        }
      }
    }

    const prevMap = new Map(previousGroups.map((g) => [g.id, g.qtdMembros]));
    const novosDelta = new Map<string, number>();
    const saidasDelta = new Map<string, number>();
    for (const g of payload) {
      const prev = prevMap.get(g.id) ?? 0;
      const delta = g.qtdMembros - prev;
      if (delta > 0) novosDelta.set(g.id, (novosDelta.get(g.id) ?? 0) + delta);
      if (delta < 0) saidasDelta.set(g.id, (saidasDelta.get(g.id) ?? 0) + -delta);
    }
    for (const g of previousGroups) {
      if (!payload.some((p: { id: string }) => p.id === g.id)) {
        saidasDelta.set(g.id, (saidasDelta.get(g.id) ?? 0) + g.qtdMembros);
      }
    }

    const { data: existingCumulative } = await supabase
      .from("gpl_group_cumulative")
      .select("group_id, total_novos, total_saidas")
      .eq("user_id", user.id)
      .eq("instance_id", instanceId);

    const cumMap = new Map(
      (existingCumulative ?? []).map((r) => [r.group_id, { novos: r.total_novos ?? 0, saidas: r.total_saidas ?? 0 }])
    );
    const now = new Date().toISOString();
    type GroupRow = { id: string; nome: string; qtdMembros: number };
    const allGroupIds = new Set([...payload.map((g: GroupRow) => g.id), ...novosDelta.keys(), ...saidasDelta.keys()]);
    for (const g of payload) {
      if (!allGroupIds.has(g.id)) allGroupIds.add(g.id);
    }
    for (const gid of allGroupIds) {
      const gPayload = payload.find((p: GroupRow) => p.id === gid);
      const nome = gPayload?.nome ?? previousGroups.find((p: GroupRow) => p.id === gid)?.nome ?? "";
      const cur = cumMap.get(gid) ?? { novos: 0, saidas: 0 };
      const novos = cur.novos + (novosDelta.get(gid) ?? 0);
      const saidas = cur.saidas + (saidasDelta.get(gid) ?? 0);
      await supabase.from("gpl_group_cumulative").upsert(
        {
          user_id: user.id,
          instance_id: instanceId,
          group_id: gid,
          group_name: nome,
          total_novos: novos,
          total_saidas: saidas,
          updated_at: now,
        },
        { onConflict: "user_id,instance_id,group_id" }
      );
    }

    const { error } = await supabase
      .from("gpl_group_snapshots")
      .upsert(
        {
          user_id: user.id,
          instance_id: instanceId,
          snapshot_date: snapshotDate,
          groups: payload,
        },
        { onConflict: "user_id,instance_id,snapshot_date" }
      );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, snapshot_date: snapshotDate });
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
