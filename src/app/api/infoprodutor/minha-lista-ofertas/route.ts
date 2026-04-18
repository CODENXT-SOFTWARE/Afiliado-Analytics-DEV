/**
 * Itens das listas do Infoprodutor (snapshot copiado dos produtos do catálogo).
 * - GET ?lista_id=: itens de uma lista.
 * - POST { listaId, produtoId? | name, link, ... }: adiciona produto à lista (snapshot).
 * - DELETE ?id=: remove um item.
 * - DELETE ?lista_id=&empty=1: esvazia a lista (sem apagar a lista em si).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function mapItem(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    listaId: String(r.lista_id ?? ""),
    produtoId: r.produto_id ? String(r.produto_id) : null,
    productName: String(r.product_name ?? ""),
    description: (r.description as string | null) ?? "",
    imageUrl: (r.image_url as string | null) ?? "",
    link: String(r.link ?? ""),
    price: numOrNull(r.price),
    priceOld: numOrNull(r.price_old),
    createdAt: String(r.created_at ?? ""),
  };
}

const SELECT = "id, lista_id, produto_id, product_name, description, image_url, link, price, price_old, created_at";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const listaId = url.searchParams.get("lista_id")?.trim();

    let query = supabase
      .from("minha_lista_ofertas_info")
      .select(SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (listaId) query = query.eq("lista_id", listaId);

    const { data: rows, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: (rows ?? []).map((r) => mapItem(r as Record<string, unknown>)) });
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
    const listaId = String(body?.listaId ?? body?.lista_id ?? "").trim();
    if (!listaId) return NextResponse.json({ error: "listaId é obrigatório" }, { status: 400 });

    const produtoId = String(body?.produtoId ?? body?.produto_id ?? "").trim();

    let row: {
      user_id: string;
      lista_id: string;
      produto_id: string | null;
      product_name: string;
      description: string | null;
      image_url: string | null;
      link: string;
      price: number | null;
      price_old: number | null;
    } | null = null;

    if (produtoId) {
      const { data: p } = await supabase
        .from("produtos_infoprodutor")
        .select("id, name, description, image_url, link, price, price_old")
        .eq("id", produtoId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!p) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
      const price = p.price == null ? null : Number.isFinite(Number(p.price)) ? Number(p.price) : null;
      const price_old =
        p.price_old == null || p.price_old === ""
          ? null
          : Number.isFinite(Number(p.price_old))
            ? Number(p.price_old)
            : null;
      row = {
        user_id: user.id,
        lista_id: listaId,
        produto_id: p.id as string,
        product_name: String(p.name ?? ""),
        description: (p.description as string | null) ?? null,
        image_url: (p.image_url as string | null) ?? null,
        link: String(p.link ?? ""),
        price,
        price_old,
      };
    } else {
      const name = String(body?.name ?? body?.productName ?? body?.product_name ?? "").trim();
      const link = String(body?.link ?? body?.converterLink ?? "").trim();
      if (!name) return NextResponse.json({ error: "Título do produto é obrigatório" }, { status: 400 });
      if (!link) return NextResponse.json({ error: "Link é obrigatório" }, { status: 400 });
      const description = String(body?.description ?? "").trim() || null;
      const imageUrl = String(body?.imageUrl ?? body?.image_url ?? "").trim() || null;
      const priceRaw = body?.price;
      const price =
        priceRaw == null || priceRaw === ""
          ? null
          : Number.isFinite(Number(priceRaw))
            ? Number(priceRaw)
            : null;
      const priceOldRaw = body?.priceOld ?? body?.price_old;
      const price_old =
        priceOldRaw == null || priceOldRaw === ""
          ? null
          : Number.isFinite(Number(priceOldRaw))
            ? Number(priceOldRaw)
            : null;
      row = {
        user_id: user.id,
        lista_id: listaId,
        produto_id: null,
        product_name: name,
        description,
        image_url: imageUrl,
        link,
        price,
        price_old,
      };
    }

    const { data, error } = await supabase
      .from("minha_lista_ofertas_info")
      .insert(row)
      .select(SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: mapItem(data as Record<string, unknown>) });
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
    const listaId = url.searchParams.get("lista_id")?.trim();
    const empty = url.searchParams.get("empty") === "1";

    if (listaId && empty) {
      const { error } = await supabase
        .from("minha_lista_ofertas_info")
        .delete()
        .eq("lista_id", listaId)
        .eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("minha_lista_ofertas_info")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
