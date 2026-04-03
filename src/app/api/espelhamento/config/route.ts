/**
 * CRUD configurações de espelhamento (usuário logado).
 * GET lista | POST cria | PATCH atualiza | DELETE ?id=
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";
import {
  assertEspelhamentoAutomationSlot,
  assertEspelhamentoDestinationNotBlockedByContinuo,
  assertSharedGroupsPoolSlot,
  normalizeGroupJid,
} from "@/lib/espelhamento-limits";
import { gateEspelhamentoGrupos } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const gate = await gateEspelhamentoGrupos();
    if (!gate.allowed) return gate.response;

    const { data: rows, error } = await supabase
      .from("espelhamento_config")
      .select("id, instance_id, grupo_origem_jid, grupo_destino_jid, grupo_origem_nome, grupo_destino_nome, sub_id_1, sub_id_2, sub_id_3, ativo, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const instanceIds = [...new Set((rows ?? []).map((r: { instance_id: string }) => r.instance_id))];
    const names: Record<string, string> = {};
    if (instanceIds.length > 0) {
      const { data: insts } = await supabase
        .from("evolution_instances")
        .select("id, nome_instancia")
        .eq("user_id", user.id)
        .in("id", instanceIds);
      (insts ?? []).forEach((i: { id: string; nome_instancia: string }) => {
        names[i.id] = i.nome_instancia;
      });
    }

    const data = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      instanceId: r.instance_id,
      nomeInstancia: names[r.instance_id as string] ?? "—",
      grupoOrigemJid: r.grupo_origem_jid,
      grupoDestinoJid: r.grupo_destino_jid,
      grupoOrigemNome: r.grupo_origem_nome,
      grupoDestinoNome: r.grupo_destino_nome,
      subId1: r.sub_id_1 ?? "",
      subId2: r.sub_id_2 ?? "",
      subId3: r.sub_id_3 ?? "",
      ativo: !!r.ativo,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const gate = await gateEspelhamentoGrupos();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const instanceId = typeof body.instanceId === "string" ? body.instanceId.trim() : "";
    const grupoOrigemJid = normalizeGroupJid(typeof body.grupoOrigemJid === "string" ? body.grupoOrigemJid : "");
    const grupoDestinoJid = normalizeGroupJid(typeof body.grupoDestinoJid === "string" ? body.grupoDestinoJid : "");
    const grupoOrigemNome = typeof body.grupoOrigemNome === "string" ? body.grupoOrigemNome.trim() : null;
    const grupoDestinoNome = typeof body.grupoDestinoNome === "string" ? body.grupoDestinoNome.trim() : null;
    const subId1 = typeof body.subId1 === "string" ? body.subId1.trim() : "";
    const subId2 = typeof body.subId2 === "string" ? body.subId2.trim() : "";
    const subId3 = typeof body.subId3 === "string" ? body.subId3.trim() : "";
    const ativo = body.ativo === true || body.ativo === "true";

    if (!instanceId || !grupoOrigemJid || !grupoDestinoJid) {
      return NextResponse.json({ error: "instanceId, grupoOrigemJid e grupoDestinoJid são obrigatórios." }, { status: 400 });
    }
    if (grupoOrigemJid === grupoDestinoJid) {
      return NextResponse.json({ error: "Grupo origem e destino não podem ser o mesmo." }, { status: 400 });
    }

    const { data: inst, error: instErr } = await supabase
      .from("evolution_instances")
      .select("id")
      .eq("id", instanceId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (instErr || !inst) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });

    const block = await assertEspelhamentoDestinationNotBlockedByContinuo(supabase, user.id, grupoDestinoJid);
    if (!block.ok) return NextResponse.json({ error: block.message }, { status: 403 });

    const groupPool = await assertSharedGroupsPoolSlot(supabase, user.id, [grupoDestinoJid]);
    if (!groupPool.ok) return NextResponse.json({ error: groupPool.message }, { status: 403 });

    const slot = await assertEspelhamentoAutomationSlot(supabase, user.id, {
      turningActive: ativo,
      wasAlreadyActive: false,
    });
    if (!slot.ok) return NextResponse.json({ error: slot.message }, { status: 403 });

    const now = new Date().toISOString();
    const { data: inserted, error } = await supabase
      .from("espelhamento_config")
      .insert({
        user_id: user.id,
        instance_id: instanceId,
        grupo_origem_jid: grupoOrigemJid,
        grupo_destino_jid: grupoDestinoJid,
        grupo_origem_nome: grupoOrigemNome,
        grupo_destino_nome: grupoDestinoNome,
        sub_id_1: subId1,
        sub_id_2: subId2,
        sub_id_3: subId3,
        ativo,
        updated_at: now,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Já existe espelhamento para este par origem/destino nesta instância." },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: inserted?.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const gate = await gateEspelhamentoGrupos();
    if (!gate.allowed) return gate.response;

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { data: row, error: fetchErr } = await supabase
      .from("espelhamento_config")
      .select("ativo, grupo_destino_jid, instance_id, grupo_origem_jid, sub_id_1, sub_id_2, sub_id_3")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fetchErr || !row) return NextResponse.json({ error: "Config não encontrada." }, { status: 404 });

    type RowFull = {
      ativo: boolean;
      grupo_destino_jid: string;
      instance_id: string;
      grupo_origem_jid: string;
      sub_id_1: string | null;
      sub_id_2: string | null;
      sub_id_3: string | null;
    };
    const r = row as RowFull;

    const wasAlreadyActive = !!r.ativo;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const subIdsChanging = body.subId1 != null || body.subId2 != null || body.subId3 != null;
    const origChanging = body.grupoOrigemJid != null;
    const mergedSub1 = body.subId1 != null ? String(body.subId1).trim() : String(r.sub_id_1 ?? "").trim();
    const mergedSub2 = body.subId2 != null ? String(body.subId2).trim() : String(r.sub_id_2 ?? "").trim();
    const mergedSub3 = body.subId3 != null ? String(body.subId3).trim() : String(r.sub_id_3 ?? "").trim();

    if (body.grupoDestinoJid != null) {
      patch.grupo_destino_jid = normalizeGroupJid(String(body.grupoDestinoJid));
    }
    if (body.grupoOrigemJid != null) {
      patch.grupo_origem_jid = normalizeGroupJid(String(body.grupoOrigemJid));
    }
    if (body.grupoOrigemNome != null) patch.grupo_origem_nome = String(body.grupoOrigemNome).trim() || null;
    if (body.grupoDestinoNome != null) patch.grupo_destino_nome = String(body.grupoDestinoNome).trim() || null;
    if (body.subId1 != null) patch.sub_id_1 = String(body.subId1).trim();
    if (body.subId2 != null) patch.sub_id_2 = String(body.subId2).trim();
    if (body.subId3 != null) patch.sub_id_3 = String(body.subId3).trim();
    if (body.ativo != null) patch.ativo = body.ativo === true || body.ativo === "true";

    const dest = (patch.grupo_destino_jid as string) ?? r.grupo_destino_jid;
    const orig = (patch.grupo_origem_jid as string) ?? undefined;
    if (orig && dest && orig === dest) {
      return NextResponse.json({ error: "Grupo origem e destino não podem ser o mesmo." }, { status: 400 });
    }

    const willBeActive = patch.ativo !== undefined ? !!patch.ativo : wasAlreadyActive;
    if (willBeActive) {
      const block = await assertEspelhamentoDestinationNotBlockedByContinuo(supabase, user.id, dest);
      if (!block.ok) return NextResponse.json({ error: block.message }, { status: 403 });
    }

    const groupPool = await assertSharedGroupsPoolSlot(supabase, user.id, [dest], { excludeEspelhamentoConfigId: id });
    if (!groupPool.ok) return NextResponse.json({ error: groupPool.message }, { status: 403 });

    const turningActive = !!(patch.ativo === true && !wasAlreadyActive);
    const slot = await assertEspelhamentoAutomationSlot(supabase, user.id, {
      turningActive,
      wasAlreadyActive,
    });
    if (!slot.ok) return NextResponse.json({ error: slot.message }, { status: 403 });

    /** Mesmo Sub ID em todas as linhas da mesma origem (1 ou N destinos), para o pipeline sempre achar os subIds. */
    if (subIdsChanging && !origChanging) {
      const { error: syncErr } = await supabase
        .from("espelhamento_config")
        .update({
          sub_id_1: mergedSub1,
          sub_id_2: mergedSub2,
          sub_id_3: mergedSub3,
          updated_at: patch.updated_at,
        })
        .eq("user_id", user.id)
        .eq("instance_id", r.instance_id)
        .eq("grupo_origem_jid", normalizeGroupJid(r.grupo_origem_jid));
      if (syncErr) return NextResponse.json({ error: syncErr.message }, { status: 500 });
      delete patch.sub_id_1;
      delete patch.sub_id_2;
      delete patch.sub_id_3;
    }

    const patchKeys = Object.keys(patch).filter((k) => k !== "updated_at");
    if (patchKeys.length > 0) {
      const { error } = await supabase.from("espelhamento_config").update(patch).eq("id", id).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const gate = await gateEspelhamentoGrupos();
    if (!gate.allowed) return gate.response;

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { error } = await supabase.from("espelhamento_config").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
