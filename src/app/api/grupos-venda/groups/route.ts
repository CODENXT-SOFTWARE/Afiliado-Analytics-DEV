/**
 * Grupos de Venda: listar e salvar grupos WhatsApp para disparo de ofertas.
 * GET ?instanceId=uuid → lista grupos salvos (ou todos se omitir)
 * POST { instanceId, groups: [{ id, nome }] } → salva grupos
 * DELETE ?id=uuid → remove um grupo salvo
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
    const listaId = url.searchParams.get("listaId")?.trim() || null;

    let query = supabase
      .from("grupos_venda")
      .select("id, instance_id, lista_id, group_id, group_name, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listaId) query = query.eq("lista_id", listaId);
    else if (instanceId) query = query.eq("instance_id", instanceId);

    const { data: rows, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      instanceId: r.instance_id,
      listaId: r.lista_id ?? null,
      groupId: r.group_id,
      groupName: r.group_name,
      createdAt: r.created_at,
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
    const groups = Array.isArray(body.groups) ? body.groups : [];

    if (!instanceId) return NextResponse.json({ error: "instanceId é obrigatório." }, { status: 400 });

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
        user_id: user.id,
        instance_id: instanceId,
        group_id: String(g.id),
        group_name: String(g.nome ?? g.name ?? "").trim() || "Grupo",
      }));

    if (toInsert.length === 0) return NextResponse.json({ error: "Nenhum grupo válido." }, { status: 400 });

    const { data: inserted, error } = await supabase
      .from("grupos_venda")
      .upsert(toInsert, { onConflict: "user_id,instance_id,group_id", ignoreDuplicates: false })
      .select("id, group_id, group_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: inserted ?? [], saved: (inserted ?? []).length });
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
      .from("grupos_venda")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
