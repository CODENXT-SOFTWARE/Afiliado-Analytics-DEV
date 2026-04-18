/**
 * Disparo contínuo: múltiplos por usuário, cada um ligado a uma lista de grupos.
 * Janela obrigatória: início/fim HH:MM, duração máxima 14 horas (sem modo 24h).
 * GET → lista de configs (id, listaId, listaNome, instanceId, keywords, subIds, ativo, proximoIndice, ultimoDisparoAt)
 * POST { listaId, keywords, subId1, subId2, subId3, horarioInicio, horarioFim, ativo } → criar/atualizar ou { id, ativo: false } → parar
 * DELETE ?id= → remover um config
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { mensagemErroJanela } from "@/lib/grupos-venda-janela";
import { getEntitlementsForUser, getUsageSnapshot } from "@/lib/plan-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: rows, error } = await supabase
      .from("grupos_venda_continuo")
      .select("id, lista_id, instance_id, lista_ofertas_id, lista_ofertas_ml_id, lista_ofertas_info_id, keywords, sub_id_1, sub_id_2, sub_id_3, ativo, proximo_indice, ultimo_disparo_at, updated_at, horario_inicio, horario_fim")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    type Row = { id: string; lista_id: string | null; instance_id: string; lista_ofertas_id?: string | null; lista_ofertas_ml_id?: string | null; lista_ofertas_info_id?: string | null; keywords: string[]; sub_id_1: string; sub_id_2: string; sub_id_3: string; ativo: boolean; proximo_indice: number; ultimo_disparo_at: string | null; updated_at: string; horario_inicio: string | null; horario_fim: string | null };
    const list = (rows ?? []) as Row[];
    const listaIds = [...new Set(list.map((r) => r.lista_id).filter(Boolean))] as string[];
    const listasMap: Record<string, string> = {};
    if (listaIds.length > 0) {
      const { data: listas } = await supabase.from("listas_grupos_venda").select("id, nome_lista").in("id", listaIds);
      (listas ?? []).forEach((l: { id: string; nome_lista: string }) => { listasMap[l.id] = l.nome_lista; });
    }
    const listaOfertasIds = [...new Set(list.map((r) => r.lista_ofertas_id).filter(Boolean))] as string[];
    const listasOfertasMap: Record<string, string> = {};
    if (listaOfertasIds.length > 0) {
      const { data: listasOfertas } = await supabase.from("listas_ofertas").select("id, nome").in("id", listaOfertasIds);
      (listasOfertas ?? []).forEach((l: { id: string; nome: string }) => { listasOfertasMap[l.id] = l.nome ?? ""; });
    }
    const listaOfertasMlIds = [...new Set(list.map((r) => r.lista_ofertas_ml_id).filter(Boolean))] as string[];
    const listasOfertasMlMap: Record<string, string> = {};
    if (listaOfertasMlIds.length > 0) {
      const { data: listasMl } = await supabase.from("listas_ofertas_ml").select("id, nome").in("id", listaOfertasMlIds);
      (listasMl ?? []).forEach((l: { id: string; nome: string }) => { listasOfertasMlMap[l.id] = l.nome ?? ""; });
    }
    const listaOfertasInfoIds = [...new Set(list.map((r) => r.lista_ofertas_info_id).filter(Boolean))] as string[];
    const listasOfertasInfoMap: Record<string, string> = {};
    if (listaOfertasInfoIds.length > 0) {
      const { data: listasInfo } = await supabase.from("listas_ofertas_info").select("id, nome").in("id", listaOfertasInfoIds);
      (listasInfo ?? []).forEach((l: { id: string; nome: string }) => { listasOfertasInfoMap[l.id] = l.nome ?? ""; });
    }

    const data = list.map((r) => {
      const keywords = Array.isArray(r.keywords) ? r.keywords : [];
      const idx = r.proximo_indice ?? 0;
      const listaOfertasId = r.lista_ofertas_id ?? null;
      const listaOfertasMlId = r.lista_ofertas_ml_id ?? null;
      const listaOfertasInfoId = r.lista_ofertas_info_id ?? null;
      return {
        id: r.id,
        listaId: r.lista_id,
        listaNome: (r.lista_id && listasMap[r.lista_id]) || "—",
        listaOfertasId,
        listaOfertasNome: (listaOfertasId && listasOfertasMap[listaOfertasId]) || null,
        listaOfertasMlId,
        listaOfertasMlNome: (listaOfertasMlId && listasOfertasMlMap[listaOfertasMlId]) || null,
        listaOfertasInfoId,
        listaOfertasInfoNome: (listaOfertasInfoId && listasOfertasInfoMap[listaOfertasInfoId]) || null,
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
        horarioInicio: r.horario_inicio ?? null,
        horarioFim: r.horario_fim ?? null,
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
    const listaOfertasId = typeof body.listaOfertasId === "string" ? body.listaOfertasId.trim() || null : null;
    const listaOfertasMlId = typeof body.listaOfertasMlId === "string" ? body.listaOfertasMlId.trim() || null : null;
    const listaOfertasInfoId = typeof body.listaOfertasInfoId === "string" ? body.listaOfertasInfoId.trim() || null : null;
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
    const horarioInicio = typeof body.horarioInicio === "string" && body.horarioInicio.trim() ? body.horarioInicio.trim() : null;
    const horarioFim = typeof body.horarioFim === "string" && body.horarioFim.trim() ? body.horarioFim.trim() : null;

    const now = new Date().toISOString();

    if (!ativo && id) {
      const { data: updated, error } = await supabase
        .from("grupos_venda_continuo")
        .update({ ativo: false, keyword_pool_indices: {}, updated_at: now })
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

    // Verificar limite de campanhas ativas antes de criar/ativar
    if (ativo) {
      const ent = await getEntitlementsForUser(supabase, user.id);
      const usage = await getUsageSnapshot(supabase, user.id);
      const alreadyActive = id ? usage.activeCampaigns : usage.activeCampaigns;
      const wouldBe = id ? alreadyActive : alreadyActive + 1;
      if (wouldBe > ent.gruposVenda.maxActiveCampaigns) {
        return NextResponse.json(
          { error: `Limite de ${ent.gruposVenda.maxActiveCampaigns} campanha(s) ativa(s) atingido. Faça upgrade para ativar mais.` },
          { status: 403 }
        );
      }
    }

    if (!listaId) return NextResponse.json({ error: "Lista de grupos é obrigatória." }, { status: 400 });
    const isListaShopee = !!listaOfertasId;
    const isListaMl = !!listaOfertasMlId;
    const isListaInfo = !!listaOfertasInfoId;
    const isCrossover = isListaShopee && isListaMl;
    const isListaOfertasMode = isListaShopee || isListaMl || isListaInfo;
    if (!isListaOfertasMode && keywords.length === 0) return NextResponse.json({ error: "Informe ao menos uma keyword ou selecione uma lista de ofertas." }, { status: 400 });
    if (isListaInfo) {
      const { data: listaInfo } = await supabase
        .from("listas_ofertas_info")
        .select("id")
        .eq("id", listaOfertasInfoId)
        .eq("user_id", user.id)
        .single();
      if (!listaInfo) return NextResponse.json({ error: "Lista do Infoprodutor não encontrada." }, { status: 404 });
      const { count } = await supabase
        .from("minha_lista_ofertas_info")
        .select("id", { count: "exact", head: true })
        .eq("lista_id", listaOfertasInfoId)
        .eq("user_id", user.id);
      if (!count || count < 1) return NextResponse.json({ error: "A lista do Infoprodutor está vazia. Adicione produtos primeiro." }, { status: 400 });
    } else if (isCrossover) {
      const { data: listaOferta } = await supabase.from("listas_ofertas").select("id").eq("id", listaOfertasId).eq("user_id", user.id).single();
      if (!listaOferta) return NextResponse.json({ error: "Lista de ofertas Shopee não encontrada." }, { status: 404 });
      const { count: c1 } = await supabase.from("minha_lista_ofertas").select("id", { count: "exact", head: true }).eq("lista_id", listaOfertasId).eq("user_id", user.id);
      if (!c1 || c1 < 1) return NextResponse.json({ error: "A lista Shopee está vazia." }, { status: 400 });
      const { data: listaMl } = await supabase.from("listas_ofertas_ml").select("id").eq("id", listaOfertasMlId).eq("user_id", user.id).single();
      if (!listaMl) return NextResponse.json({ error: "Lista Mercado Livre não encontrada." }, { status: 404 });
      const { count: c2 } = await supabase.from("minha_lista_ofertas_ml").select("id", { count: "exact", head: true }).eq("lista_id", listaOfertasMlId).eq("user_id", user.id);
      if (!c2 || c2 < 1) return NextResponse.json({ error: "A lista ML está vazia." }, { status: 400 });
    } else if (isListaShopee) {
      const { data: listaOferta } = await supabase.from("listas_ofertas").select("id").eq("id", listaOfertasId).eq("user_id", user.id).single();
      if (!listaOferta) return NextResponse.json({ error: "Lista de ofertas não encontrada." }, { status: 404 });
      const { count } = await supabase.from("minha_lista_ofertas").select("id", { count: "exact", head: true }).eq("lista_id", listaOfertasId).eq("user_id", user.id);
      if (!count || count < 1) return NextResponse.json({ error: "A lista de ofertas está vazia. Adicione produtos à lista primeiro." }, { status: 400 });
    } else if (isListaMl) {
      const { data: listaMl } = await supabase.from("listas_ofertas_ml").select("id").eq("id", listaOfertasMlId).eq("user_id", user.id).single();
      if (!listaMl) return NextResponse.json({ error: "Lista Mercado Livre não encontrada." }, { status: 404 });
      const { count } = await supabase.from("minha_lista_ofertas_ml").select("id", { count: "exact", head: true }).eq("lista_id", listaOfertasMlId).eq("user_id", user.id);
      if (!count || count < 1) return NextResponse.json({ error: "A lista ML está vazia. Adicione produtos primeiro." }, { status: 400 });
    }

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

    const janelaErr = mensagemErroJanela(horarioInicio, horarioFim);
    if (janelaErr) return NextResponse.json({ error: janelaErr }, { status: 400 });

    const payloadContinuo = {
      lista_id: listaId,
      instance_id: instanceId,
      keywords: isListaOfertasMode ? [] : keywords,
      lista_ofertas_id: listaOfertasId || null,
      lista_ofertas_ml_id: listaOfertasMlId || null,
      lista_ofertas_info_id: listaOfertasInfoId || null,
      sub_id_1: subId1,
      sub_id_2: subId2,
      sub_id_3: subId3,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      ativo: true,
      proximo_indice: 0,
      keyword_pool_indices: {},
      updated_at: now,
    };

    if (id) {
      const { data: updated, error } = await supabase
        .from("grupos_venda_continuo")
        .update(payloadContinuo)
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
        ...payloadContinuo,
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
