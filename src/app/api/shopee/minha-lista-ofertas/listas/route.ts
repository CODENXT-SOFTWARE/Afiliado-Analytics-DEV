/**
 * Listas de ofertas: GET (listar), POST (criar), DELETE (apagar lista inteira).
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
      .from("listas_ofertas")
      .select("id, nome, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const listas = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      nome: r.nome ?? "",
      createdAt: r.created_at,
    }));

    const { data: counts } = await supabase
      .from("minha_lista_ofertas")
      .select("lista_id");
    const countByLista: Record<string, number> = {};
    (counts ?? []).forEach((c: { lista_id: string }) => {
      countByLista[c.lista_id] = (countByLista[c.lista_id] ?? 0) + 1;
    });

    const data = listas.map((l: { id: string; nome: string; createdAt: string }) => ({
      ...l,
      totalItens: countByLista[l.id] ?? 0,
    }));

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
    const nome = String(body?.nome ?? "").trim() || "Nova lista";

    const { data: row, error } = await supabase
      .from("listas_ofertas")
      .insert({ user_id: user.id, nome })
      .select("id, nome, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      data: { id: row.id, nome: row.nome ?? "", createdAt: row.created_at, totalItens: 0 },
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
    if (!id) return NextResponse.json({ error: "id da lista é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("listas_ofertas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
