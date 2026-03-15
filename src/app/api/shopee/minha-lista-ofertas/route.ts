/**
 * Minha Lista de Ofertas: GET (listar listas com itens ou itens de uma lista),
 * POST (adicionar item à lista), DELETE (remover item ou esvaziar lista).
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function mapItem(r: Record<string, unknown>) {
  return {
    id: r.id,
    listaId: r.lista_id,
    imageUrl: r.image_url ?? "",
    productName: r.product_name ?? "",
    priceOriginal: r.price_original != null ? Number(r.price_original) : null,
    pricePromo: r.price_promo != null ? Number(r.price_promo) : null,
    discountRate: r.discount_rate != null ? Number(r.discount_rate) : null,
    converterLink: r.converter_link ?? "",
    createdAt: r.created_at,
  };
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const listaId = url.searchParams.get("lista_id")?.trim();

    if (listaId) {
      const { data: rows, error } = await supabase
        .from("minha_lista_ofertas")
        .select("id, lista_id, image_url, product_name, price_original, price_promo, discount_rate, converter_link, created_at")
        .eq("user_id", user.id)
        .eq("lista_id", listaId)
        .order("created_at", { ascending: false });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: (rows ?? []).map(mapItem) });
    }

    const { data: rows, error } = await supabase
      .from("minha_lista_ofertas")
      .select("id, lista_id, image_url, product_name, price_original, price_promo, discount_rate, converter_link, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const data = (rows ?? []).map(mapItem);
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
    const listaId = (body?.listaId ?? body?.lista_id ?? "").toString().trim();
    const converterLink = String(body?.converterLink ?? body?.converter_link ?? "").trim();

    if (!listaId) return NextResponse.json({ error: "listaId é obrigatório" }, { status: 400 });
    if (!converterLink) return NextResponse.json({ error: "converterLink é obrigatório" }, { status: 400 });

    const priceOriginal = body?.priceOriginal != null ? Number(body.priceOriginal) : null;
    const pricePromo = body?.pricePromo != null ? Number(body.pricePromo) : null;
    const discountRate = body?.discountRate != null ? Number(body.discountRate) : null;

    const { data: row, error } = await supabase
      .from("minha_lista_ofertas")
      .insert({
        user_id: user.id,
        lista_id: listaId,
        image_url: String(body?.imageUrl ?? body?.image_url ?? "").trim(),
        product_name: String(body?.productName ?? body?.product_name ?? "").trim(),
        price_original: priceOriginal,
        price_promo: pricePromo,
        discount_rate: discountRate,
        converter_link: converterLink,
      })
      .select("id, lista_id, image_url, product_name, price_original, price_promo, discount_rate, converter_link, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: mapItem(row as Record<string, unknown>) });
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
        .from("minha_lista_ofertas")
        .delete()
        .eq("lista_id", listaId)
        .eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("minha_lista_ofertas")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
