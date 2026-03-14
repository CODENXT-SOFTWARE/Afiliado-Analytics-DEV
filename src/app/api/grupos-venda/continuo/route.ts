/**
 * Disparo contínuo: múltiplos por usuário, cada um ligado a uma lista de grupos.
 * GET → lista de configs (id, listaId, listaNome, instanceId, keywords, subIds, ativo, proximoIndice, ultimoDisparoAt)
 * POST { listaId, keywords, subId1, subId2, subId3, ativo } → criar config ou { id, ativo: false } → parar
 * DELETE ?id= → remover um config
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: rows, error } = await supabase
      .from("grupos_venda_continuo")
      .select("id, lista_id, instance_id, keywords, sub_id_1, sub_id_2, sub_id_3, ativo, proximo_indice, ultimo_disparo_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = (rows ?? []) as { id: string; lista_id: string | null; instance_id: string; keywords: string[]; sub_id_1: string; sub_id_2: string; sub_id_3: string; ativo: boolean; proximo_indice: number; ultimo_disparo_at: string | null; updated_at: string }[];
    const listaIds = [...new Set(list.map((r) => r.lista_id).filter(Boolean))] as string[];
    const listasMap: Record<string, string> = {};
    if (listaIds.length > 0) {
      const { data: listas } = await supabase.from("listas_grupos_venda").select("id, nome_lista").in("id", listaIds);
      (listas ?? []).forEach((l: { id: string; nome_lista: string }) => { listasMap[l.id] = l.nome_lista; });
    }

    const data = list.map((r) => {
      const keywords = Array.isArray(r.keywords) ? r.keywords : [];
      const idx = r.proximo_indice ?? 0;
      return {
        id: r.id,
        listaId: r.lista_id,
        listaNome: (r.lista_id && listasMap[r.lista_id]) || "—",
        instanceId: r.instance_id,
        keywords,
        subId1: r.sub_id_1 ?? "",
        subId2: r.sub_id_2 ?? "",
        subId3: r.sub_id_3 ?? "",
        ativo: !!r.ativo,
        proximoIndice: idx,
        ultimoDisparoAt: r.ultimo_disparo_at,
        updatedAt: r.updated_at,
        proximaKeyword: keywords.length > 0 ? keywords[idx % keywords.length] : null,
      };
    });

    return NextResponse.json({ data });
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
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const listaId = typeof body.listaId === "string" ? body.listaId.trim() : "";
    const ativo = body.ativo === true || body.ativo === "true";
    const keywordsRaw = body.keywords;
    const keywords: string[] = Array.isArray(keywordsRaw)
      ? keywordsRaw.map((k: unknown) => String(k).trim()).filter(Boolean)
      : typeof keywordsRaw === "string"
        ? keywordsRaw.split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean)
        : [];
    const subId1 = typeof body.subId1 === "string" ? body.subId1.trim() : "";
    const subId2 = typeof body.subId2 === "string" ? body.subId2.trim() : "";
    const subId3 = typeof body.subId3 === "string" ? body.subId3.trim() : "";

    const now = new Date().toISOString();

    if (!ativo && id) {
      const { data: updated, error } = await supabase
        .from("grupos_venda_continuo")
        .update({ ativo: false, updated_at: now })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, ativo, proximo_indice, ultimo_disparo_at")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        success: true,
        ativo: false,
        id: updated?.id,
        proximoIndice: updated?.proximo_indice ?? 0,
        ultimoDisparoAt: updated?.ultimo_disparo_at,
      });
    }

    if (!listaId) return NextResponse.json({ error: "listaId é obrigatório para ativar." }, { status: 400 });
    if (keywords.length === 0) return NextResponse.json({ error: "Informe ao menos uma keyword." }, { status: 400 });

    const { data: lista } = await supabase
      .from("listas_grupos_venda")
      .select("id, instance_id")
      .eq("id", listaId)
      .eq("user_id", user.id)
      .single();
    if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

    const instanceId = (lista as { instance_id: string }).instance_id;

    const { data: groups } = await supabase
      .from("grupos_venda")
      .select("group_id")
      .eq("lista_id", listaId);
    if (!groups?.length) return NextResponse.json({ error: "Nenhum grupo nesta lista. Adicione grupos à lista primeiro." }, { status: 400 });

    if (id) {
      const { data: updated, error } = await supabase
        .from("grupos_venda_continuo")
        .update({
          lista_id: listaId,
          instance_id: instanceId,
          keywords,
          sub_id_1: subId1,
          sub_id_2: subId2,
          sub_id_3: subId3,
          ativo: true,
          proximo_indice: 0,
          updated_at: now,
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("id, ativo, proximo_indice, ultimo_disparo_at")
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({
        success: true,
        ativo: true,
        id: updated?.id,
        proximoIndice: 0,
        ultimoDisparoAt: updated?.ultimo_disparo_at,
      });
    }

    const { data: inserted, error } = await supabase
      .from("grupos_venda_continuo")
      .insert({
        user_id: user.id,
        lista_id: listaId,
        instance_id: instanceId,
        keywords,
        sub_id_1: subId1,
        sub_id_2: subId2,
        sub_id_3: subId3,
        ativo: true,
        proximo_indice: 0,
        updated_at: now,
      })
      .select("id, ativo, proximo_indice, ultimo_disparo_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      ativo: true,
      id: inserted?.id,
      proximoIndice: 0,
      ultimoDisparoAt: inserted?.ultimo_disparo_at,
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

    const { error } = await supabase.from("grupos_venda_continuo").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
