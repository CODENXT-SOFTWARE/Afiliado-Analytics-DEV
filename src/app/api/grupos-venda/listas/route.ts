/**
 * Listas de grupos: criar lista com nome e grupos, listar, excluir, atualizar.
 * GET ?instanceId= → listas do usuário (opcional por instância)
 * GET ?id= → uma lista + grupos (edição)
 * POST { instanceId, nomeLista, groups: [{ id, nome }] } → criar lista e salvar grupos
 * PATCH { id, nomeLista?, groups: [{ id, nome }] } → substituir grupos da lista (e renomear)
 * DELETE ?id= → excluir lista (cascade nos grupos)
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";
import { assertSharedGroupsPoolSlot } from "@/lib/espelhamento-limits";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const singleId = url.searchParams.get("id")?.trim() || null;
    if (singleId) {
      const { data: lista, error: listaErr } = await supabase
        .from("listas_grupos_venda")
        .select("id, instance_id, nome_lista, created_at")
        .eq("id", singleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (listaErr) return NextResponse.json({ error: listaErr.message }, { status: 500 });
      if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

      const { data: grps, error: gErr } = await supabase
        .from("grupos_venda")
        .select("group_id, group_name")
        .eq("lista_id", singleId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      const groups = (grps ?? []).map((r: { group_id: string; group_name: string }) => ({
        id: r.group_id,
        nome: (r.group_name ?? "").trim() || "Grupo",
        qtdMembros: 0,
      }));

      const l = lista as { id: string; instance_id: string; nome_lista: string; created_at: string };
      return NextResponse.json({
        data: {
          id: l.id,
          instanceId: l.instance_id,
          nomeLista: l.nome_lista,
          createdAt: l.created_at,
          groups,
        },
      });
    }

    const instanceId = url.searchParams.get("instanceId")?.trim() || null;

    let query = supabase
      .from("listas_grupos_venda")
      .select("id, instance_id, nome_lista, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (instanceId) query = query.eq("instance_id", instanceId);

    const { data: listas, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (listas ?? []).map((l: { id: string; instance_id: string; nome_lista: string; created_at: string }) => ({
      id: l.id,
      instanceId: l.instance_id,
      nomeLista: l.nome_lista,
      createdAt: l.created_at,
    }));

    return NextResponse.json({ data: list });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const instanceId = typeof body.instanceId === "string" ? body.instanceId.trim() : "";
    const nomeLista = typeof body.nomeLista === "string" ? body.nomeLista.trim() : "";
    const groups = Array.isArray(body.groups) ? body.groups : [];

    if (!instanceId) return NextResponse.json({ error: "instanceId é obrigatório." }, { status: 400 });
    if (!nomeLista) return NextResponse.json({ error: "nomeLista é obrigatório." }, { status: 400 });

    const { data: inst } = await supabase
      .from("evolution_instances")
      .select("id")
      .eq("id", instanceId)
      .eq("user_id", user.id)
      .single();
    if (!inst) return NextResponse.json({ error: "Instância não encontrada." }, { status: 404 });

    const toInsert = groups
      .filter((g: { id?: string }) => g?.id)
      .map((g: { id: string; nome?: string; name?: string }) => ({
        group_id: String(g.id),
        group_name: String(g.nome ?? g.name ?? "").trim() || "Grupo",
      }));
    if (toInsert.length === 0) return NextResponse.json({ error: "Selecione ao menos um grupo." }, { status: 400 });

    const ent = await getEntitlementsForUser(supabase, user.id);
    const usage = await getUsageSnapshot(supabase, user.id);

    if (ent.gruposVenda.maxLists !== null && usage.gruposVendaLists >= ent.gruposVenda.maxLists) {
      return NextResponse.json(
        { error: `Limite de ${ent.gruposVenda.maxLists} lista(s) atingido. Faça upgrade para criar mais.` },
        { status: 403 }
      );
    }
    const pool = await assertSharedGroupsPoolSlot(
      supabase,
      user.id,
      toInsert.map((g: { group_id: string }) => g.group_id)
    );
    if (!pool.ok) return NextResponse.json({ error: pool.message }, { status: 403 });

    const { data: lista, error: errLista } = await supabase
      .from("listas_grupos_venda")
      .insert({ user_id: user.id, instance_id: instanceId, nome_lista: nomeLista })
      .select("id, nome_lista")
      .single();
    if (errLista) return NextResponse.json({ error: errLista.message }, { status: 500 });
    const listaId = (lista as { id: string }).id;

    const rows = toInsert.map((g: { group_id: string; group_name: string }) => ({
      user_id: user.id,
      instance_id: instanceId,
      lista_id: listaId,
      group_id: g.group_id,
      group_name: g.group_name,
    }));

    const { error: errGrupos } = await supabase.from("grupos_venda").insert(rows);
    if (errGrupos) {
      await supabase.from("listas_grupos_venda").delete().eq("id", listaId);
      return NextResponse.json({ error: errGrupos.message }, { status: 500 });
    }

    return NextResponse.json({
      data: { id: listaId, nomeLista: (lista as { nome_lista: string }).nome_lista, groupsCount: rows.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const nomeListaRaw = typeof body.nomeLista === "string" ? body.nomeLista.trim() : "";
    const groups = Array.isArray(body.groups) ? body.groups : [];

    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    if (!nomeListaRaw) return NextResponse.json({ error: "nomeLista é obrigatório." }, { status: 400 });

    const { data: row, error: rowErr } = await supabase
      .from("listas_grupos_venda")
      .select("id, instance_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

    const instanceId = (row as { instance_id: string }).instance_id;

    const toInsert = groups
      .filter((g: { id?: string }) => g?.id)
      .map((g: { id: string; nome?: string; name?: string }) => ({
        group_id: String(g.id),
        group_name: String(g.nome ?? g.name ?? "").trim() || "Grupo",
      }));
    if (toInsert.length === 0) {
      return NextResponse.json({ error: "Mantenha ao menos um grupo na lista." }, { status: 400 });
    }

    const { error: delErr } = await supabase.from("grupos_venda").delete().eq("lista_id", id).eq("user_id", user.id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const pool = await assertSharedGroupsPoolSlot(
      supabase,
      user.id,
      toInsert.map((g: { group_id: string }) => g.group_id)
    );
    if (!pool.ok) return NextResponse.json({ error: pool.message }, { status: 403 });

    const { error: upNome } = await supabase
      .from("listas_grupos_venda")
      .update({ nome_lista: nomeListaRaw })
      .eq("id", id)
      .eq("user_id", user.id);
    if (upNome) return NextResponse.json({ error: upNome.message }, { status: 500 });

    const rows = toInsert.map((g: { group_id: string; group_name: string }) => ({
      user_id: user.id,
      instance_id: instanceId,
      lista_id: id,
      group_id: g.group_id,
      group_name: g.group_name,
    }));

    const { error: insErr } = await supabase.from("grupos_venda").insert(rows);
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    return NextResponse.json({
      data: { id, nomeLista: nomeListaRaw, groupsCount: rows.length },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    const { error } = await supabase
      .from("listas_grupos_venda")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
