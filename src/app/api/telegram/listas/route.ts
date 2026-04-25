/**
 * CRUD de listas de grupos Telegram.
 *
 * Diferença vs listas WhatsApp: aqui os grupos JÁ existem em telegram_grupos_venda
 * (vieram pelo webhook). O endpoint apenas atualiza `lista_id` dos grupos
 * selecionados — não cria/deleta linhas em telegram_grupos_venda.
 *
 *   GET    /api/telegram/listas?bot_id=  → listas do usuário (opcional por bot)
 *   GET    /api/telegram/listas?id=      → uma lista + grupos vinculados (edição)
 *   POST   { bot_id, nome_lista, chat_ids: [string] } → cria lista + vincula grupos
 *   PATCH  { id, nome_lista?, chat_ids? } → renomeia e/ou substitui grupos vinculados
 *   DELETE ?id=                          → exclui lista (grupos ficam, com lista_id=NULL via FK)
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const singleId = url.searchParams.get("id")?.trim() || null;

    if (singleId) {
      const { data: lista, error: listaErr } = await supabase
        .from("telegram_listas_grupos_venda")
        .select("id, bot_id, nome_lista, created_at")
        .eq("id", singleId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (listaErr) return NextResponse.json({ error: listaErr.message }, { status: 500 });
      if (!lista) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });

      const listaRow = lista as { id: string; bot_id: string; nome_lista: string; created_at: string };

      const { data: grps, error: gErr } = await supabase
        .from("telegram_grupos_venda")
        .select("chat_id, group_name")
        .eq("lista_id", singleId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });
      if (gErr) return NextResponse.json({ error: gErr.message }, { status: 500 });

      const groups = (grps ?? []).map((r: { chat_id: string; group_name: string }) => ({
        chat_id: r.chat_id,
        nome: (r.group_name ?? "").trim() || "Grupo",
      }));

      return NextResponse.json({
        data: {
          id: listaRow.id,
          bot_id: listaRow.bot_id,
          nome_lista: listaRow.nome_lista,
          created_at: listaRow.created_at,
          groups,
        },
      });
    }

    const botIdFilter = url.searchParams.get("bot_id")?.trim() || null;

    let query = supabase
      .from("telegram_listas_grupos_venda")
      .select("id, bot_id, nome_lista, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (botIdFilter) query = query.eq("bot_id", botIdFilter);

    const { data: listas, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Conta grupos por lista numa query só
    const listIds = (listas ?? []).map((l: { id: string }) => l.id);
    let counts: Record<string, number> = {};
    if (listIds.length) {
      const { data: gAll } = await supabase
        .from("telegram_grupos_venda")
        .select("lista_id")
        .eq("user_id", user.id)
        .in("lista_id", listIds);
      counts = (gAll ?? []).reduce(
        (acc: Record<string, number>, r: { lista_id: string | null }) => {
          if (r.lista_id) acc[r.lista_id] = (acc[r.lista_id] ?? 0) + 1;
          return acc;
        },
        {}
      );
    }

    const list = (listas ?? []).map(
      (l: { id: string; bot_id: string; nome_lista: string; created_at: string }) => ({
        id: l.id,
        bot_id: l.bot_id,
        nome_lista: l.nome_lista,
        created_at: l.created_at,
        groups_count: counts[l.id] ?? 0,
      })
    );

    return NextResponse.json({ data: list });
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

    const body = await req.json().catch(() => ({}));
    const bot_id = typeof body.bot_id === "string" ? body.bot_id.trim() : "";
    const nome_lista = typeof body.nome_lista === "string" ? body.nome_lista.trim() : "";
    const chatIdsRaw = Array.isArray(body.chat_ids) ? body.chat_ids : [];
    const chat_ids = chatIdsRaw
      .map((c: unknown) => (typeof c === "string" ? c.trim() : ""))
      .filter((c: string) => c.length > 0);

    if (!bot_id) return NextResponse.json({ error: "bot_id é obrigatório." }, { status: 400 });
    if (!nome_lista) return NextResponse.json({ error: "nome_lista é obrigatório." }, { status: 400 });
    if (chat_ids.length === 0) {
      return NextResponse.json({ error: "Selecione ao menos um grupo." }, { status: 400 });
    }

    const { data: bot } = await supabase
      .from("telegram_bots")
      .select("id")
      .eq("id", bot_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!bot) return NextResponse.json({ error: "Bot não encontrado." }, { status: 404 });

    const { data: lista, error: errLista } = await supabase
      .from("telegram_listas_grupos_venda")
      .insert({ user_id: user.id, bot_id, nome_lista })
      .select("id, nome_lista")
      .single();
    if (errLista) return NextResponse.json({ error: errLista.message }, { status: 500 });
    const listaId = (lista as { id: string }).id;

    // Vincula grupos selecionados a esta lista (UPDATE — grupos já existem)
    const { error: linkErr, data: linked } = await supabase
      .from("telegram_grupos_venda")
      .update({ lista_id: listaId })
      .eq("user_id", user.id)
      .eq("bot_id", bot_id)
      .in("chat_id", chat_ids)
      .select("id");
    if (linkErr) {
      // rollback da lista pra não deixar lixo
      await supabase.from("telegram_listas_grupos_venda").delete().eq("id", listaId);
      return NextResponse.json({ error: linkErr.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: listaId,
        nome_lista: (lista as { nome_lista: string }).nome_lista,
        groups_count: linked?.length ?? 0,
      },
    });
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

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const nome_lista_raw = typeof body.nome_lista === "string" ? body.nome_lista.trim() : null;
    const chatIdsRaw = Array.isArray(body.chat_ids) ? body.chat_ids : null;

    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });
    if (nome_lista_raw === null && chatIdsRaw === null) {
      return NextResponse.json({ error: "Nada para atualizar (envie nome_lista e/ou chat_ids)." }, { status: 400 });
    }

    const { data: row, error: rowErr } = await supabase
      .from("telegram_listas_grupos_venda")
      .select("id, bot_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (rowErr) return NextResponse.json({ error: rowErr.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Lista não encontrada." }, { status: 404 });
    const bot_id = (row as { bot_id: string }).bot_id;

    if (nome_lista_raw !== null) {
      if (!nome_lista_raw) {
        return NextResponse.json({ error: "nome_lista não pode ser vazio." }, { status: 400 });
      }
      const { error: upNome } = await supabase
        .from("telegram_listas_grupos_venda")
        .update({ nome_lista: nome_lista_raw })
        .eq("id", id)
        .eq("user_id", user.id);
      if (upNome) return NextResponse.json({ error: upNome.message }, { status: 500 });
    }

    let groupsCount: number | undefined;
    if (chatIdsRaw !== null) {
      const chat_ids = chatIdsRaw
        .map((c: unknown) => (typeof c === "string" ? c.trim() : ""))
        .filter((c: string) => c.length > 0);
      if (chat_ids.length === 0) {
        return NextResponse.json({ error: "Mantenha ao menos um grupo na lista." }, { status: 400 });
      }

      // Desvincula tudo que estava nessa lista
      const { error: unlinkErr } = await supabase
        .from("telegram_grupos_venda")
        .update({ lista_id: null })
        .eq("user_id", user.id)
        .eq("lista_id", id);
      if (unlinkErr) return NextResponse.json({ error: unlinkErr.message }, { status: 500 });

      // Vincula os selecionados
      const { error: linkErr, data: linked } = await supabase
        .from("telegram_grupos_venda")
        .update({ lista_id: id })
        .eq("user_id", user.id)
        .eq("bot_id", bot_id)
        .in("chat_id", chat_ids)
        .select("id");
      if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
      groupsCount = linked?.length ?? 0;
    }

    return NextResponse.json({
      data: {
        id,
        nome_lista: nome_lista_raw ?? undefined,
        groups_count: groupsCount,
      },
    });
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

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

    // Defensivo: desvincula grupos antes de excluir a lista (independente do FK behavior).
    await supabase
      .from("telegram_grupos_venda")
      .update({ lista_id: null })
      .eq("user_id", user.id)
      .eq("lista_id", id);

    const { error } = await supabase
      .from("telegram_listas_grupos_venda")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
