import type { SupabaseClient } from "@supabase/supabase-js";

export type GplGroupRow = { id: string; nome: string; qtdMembros: number };

function todayUTC(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Mesma regra do POST /api/gpl/group-snapshots (base, deltas, cumulativo, snapshot do dia). */
export async function applyGplGroupSnapshot(
  supabase: SupabaseClient,
  userId: string,
  instanceId: string,
  payload: GplGroupRow[]
): Promise<{ ok: true; snapshot_date: string } | { ok: false; error: string }> {
  const snapshotDate = todayUTC();

  await supabase.from("gpl_group_snapshots_base").upsert(
    {
      user_id: userId,
      instance_id: instanceId,
      groups: payload,
    },
    { onConflict: "user_id,instance_id", ignoreDuplicates: true }
  );

  const { data: todaySnapshotRow } = await supabase
    .from("gpl_group_snapshots")
    .select("groups")
    .eq("user_id", userId)
    .eq("instance_id", instanceId)
    .eq("snapshot_date", snapshotDate)
    .maybeSingle();

  let previousGroups: GplGroupRow[] = [];
  if (todaySnapshotRow?.groups && Array.isArray(todaySnapshotRow.groups)) {
    previousGroups = todaySnapshotRow.groups as GplGroupRow[];
  } else {
    const { data: prevSnapshotRow } = await supabase
      .from("gpl_group_snapshots")
      .select("groups")
      .eq("user_id", userId)
      .eq("instance_id", instanceId)
      .lt("snapshot_date", snapshotDate)
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (prevSnapshotRow?.groups && Array.isArray(prevSnapshotRow.groups)) {
      previousGroups = prevSnapshotRow.groups as GplGroupRow[];
    } else {
      const { data: baseRow } = await supabase
        .from("gpl_group_snapshots_base")
        .select("groups")
        .eq("user_id", userId)
        .eq("instance_id", instanceId)
        .maybeSingle();
      if (baseRow?.groups && Array.isArray(baseRow.groups)) {
        previousGroups = baseRow.groups as GplGroupRow[];
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
    if (!payload.some((p) => p.id === g.id)) {
      saidasDelta.set(g.id, (saidasDelta.get(g.id) ?? 0) + g.qtdMembros);
    }
  }

  const { data: existingCumulative } = await supabase
    .from("gpl_group_cumulative")
    .select("group_id, total_novos, total_saidas")
    .eq("user_id", userId)
    .eq("instance_id", instanceId);

  const cumMap = new Map(
    (existingCumulative ?? []).map((r) => [r.group_id, { novos: r.total_novos ?? 0, saidas: r.total_saidas ?? 0 }])
  );
  const now = new Date().toISOString();
  const allGroupIds = new Set([...payload.map((g) => g.id), ...novosDelta.keys(), ...saidasDelta.keys()]);
  for (const g of payload) {
    if (!allGroupIds.has(g.id)) allGroupIds.add(g.id);
  }
  for (const gid of allGroupIds) {
    const gPayload = payload.find((p) => p.id === gid);
    const nome = gPayload?.nome ?? previousGroups.find((p) => p.id === gid)?.nome ?? "";
    const cur = cumMap.get(gid) ?? { novos: 0, saidas: 0 };
    const novos = cur.novos + (novosDelta.get(gid) ?? 0);
    const saidas = cur.saidas + (saidasDelta.get(gid) ?? 0);
    const { error: cumErr } = await supabase.from("gpl_group_cumulative").upsert(
      {
        user_id: userId,
        instance_id: instanceId,
        group_id: gid,
        group_name: nome,
        total_novos: novos,
        total_saidas: saidas,
        updated_at: now,
      },
      { onConflict: "user_id,instance_id,group_id" }
    );
    if (cumErr) return { ok: false, error: cumErr.message };
  }

  const { error } = await supabase.from("gpl_group_snapshots").upsert(
    {
      user_id: userId,
      instance_id: instanceId,
      snapshot_date: snapshotDate,
      groups: payload,
    },
    { onConflict: "user_id,instance_id,snapshot_date" }
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true, snapshot_date: snapshotDate };
}

type N8nGrupo = {
  id?: string;
  nome?: string;
  subject?: string;
  name?: string;
  qtdMembros?: number;
  size?: number;
  participants?: unknown[];
};

/** Alinhado ao GPL page: resposta `grupos` do webhook n8n. */
export function normalizeN8nGruposLista(lista: unknown): GplGroupRow[] {
  if (!Array.isArray(lista)) return [];
  return (lista as N8nGrupo[]).map((g) => ({
    id: String(g?.id ?? ""),
    nome: String(g?.nome ?? g?.subject ?? g?.name ?? "Sem nome"),
    qtdMembros: Number(g?.qtdMembros ?? g?.size ?? (Array.isArray(g?.participants) ? g.participants.length : 0)),
  }));
}
