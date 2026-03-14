/**
 * Listas de grupos: criar lista com nome e grupos, listar, excluir.
 * GET ?instanceId= → listas do usuário (opcional por instância)
 * POST { instanceId, nomeLista, groups: [{ id, nome }] } → criar lista e salvar grupos
 * DELETE ?id= → excluir lista (cascade nos grupos)
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
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
      .map((g: { id: string; nome?: string }) => ({
        group_id: String(g.id),
        group_name: String(g.nome ?? g.name ?? "").trim() || "Grupo",
      }));
    if (toInsert.length === 0) return NextResponse.json({ error: "Selecione ao menos um grupo." }, { status: 400 });

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
