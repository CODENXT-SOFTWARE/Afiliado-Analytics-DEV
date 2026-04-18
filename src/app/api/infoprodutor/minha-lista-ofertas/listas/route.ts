/**
 * Listas do Infoprodutor.
 * - GET: todas as listas + contagem de itens (para o picker da Automação de Grupos).
 * - POST: cria lista; se `produtosIds[]` vier no body, copia cada produto do catálogo
 *   para `minha_lista_ofertas_info` (snapshot). Ao apagar o produto original, os itens
 *   continuam na lista (produto_id vira NULL via ON DELETE SET NULL).
 * - DELETE ?id=: apaga a lista (cascade nos itens).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: rows, error } = await supabase
      .from("listas_ofertas_info")
      .select("id, nome, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const listas = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id ?? ""),
      nome: String(r.nome ?? ""),
      createdAt: String(r.created_at ?? ""),
    }));

    const { data: counts } = await supabase
      .from("minha_lista_ofertas_info")
      .select("lista_id")
      .eq("user_id", user.id);

    const countByLista: Record<string, number> = {};
    (counts ?? []).forEach((c: { lista_id: string }) => {
      countByLista[c.lista_id] = (countByLista[c.lista_id] ?? 0) + 1;
    });

    const data = listas.map((l) => ({ ...l, totalItens: countByLista[l.id] ?? 0 }));
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
    const nome = String(body?.nome ?? "").trim() || "Nova lista Infoprodutor";
    const produtosIdsRaw = Array.isArray(body?.produtosIds) ? body.produtosIds : [];
    const produtosIds = produtosIdsRaw
      .map((v: unknown) => (typeof v === "string" ? v.trim() : ""))
      .filter(Boolean);

    const { data: lista, error } = await supabase
      .from("listas_ofertas_info")
      .insert({ user_id: user.id, nome })
      .select("id, nome, created_at")
      .single();

    if (error || !lista) {
      return NextResponse.json({ error: error?.message ?? "Erro ao criar lista" }, { status: 500 });
    }

    let totalItens = 0;

    if (produtosIds.length > 0) {
      const { data: produtos, error: pErr } = await supabase
        .from("produtos_infoprodutor")
        .select("id, name, description, image_url, link, price, price_old")
        .eq("user_id", user.id)
        .in("id", produtosIds);

      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }

      const rows = (produtos ?? []).map((p: Record<string, unknown>) => ({
        user_id: user.id,
        lista_id: lista.id,
        produto_id: String(p.id ?? ""),
        product_name: String(p.name ?? ""),
        description: (p.description as string | null) ?? null,
        image_url: (p.image_url as string | null) ?? null,
        link: String(p.link ?? ""),
        price:
          p.price == null || p.price === ""
            ? null
            : Number.isFinite(Number(p.price))
              ? Number(p.price)
              : null,
        price_old:
          p.price_old == null || p.price_old === ""
            ? null
            : Number.isFinite(Number(p.price_old))
              ? Number(p.price_old)
              : null,
      }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("minha_lista_ofertas_info").insert(rows);
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
        totalItens = rows.length;
      }
    }

    return NextResponse.json({
      data: {
        id: lista.id,
        nome: lista.nome,
        createdAt: lista.created_at,
        totalItens,
      },
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
    const id = String(body?.id ?? "").trim();
    const nome = String(body?.nome ?? "").trim();
    if (!id || !nome) return NextResponse.json({ error: "id e nome são obrigatórios" }, { status: 400 });

    const { data, error } = await supabase
      .from("listas_ofertas_info")
      .update({ nome })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, nome, created_at")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Lista não encontrada" }, { status: 404 });

    return NextResponse.json({ data });
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
    if (!id) return NextResponse.json({ error: "id da lista é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("listas_ofertas_info")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
