/**
 * CRUD dos produtos do Infoprodutor (catálogo "Meus Produtos").
 * Cada produto tem: nome, descrição, link de venda, imagem (URL pública do bucket
 * `infoprodutor-images`) e preço opcional. Tudo escopado por user_id via RLS.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  link: string;
  price: number | string | null;
  price_old: number | string | null;
  created_at: string;
  updated_at: string;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function mapProduto(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: (r.description as string | null) ?? "",
    imageUrl: (r.image_url as string | null) ?? "",
    link: String(r.link ?? ""),
    price: numOrNull(r.price),
    priceOld: numOrNull(r.price_old),
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const SELECT = "id, user_id, name, description, image_url, link, price, price_old, created_at, updated_at";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .select(SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: (data ?? []).map((r) => mapProduto(r as Record<string, unknown>)) });
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
    const name = String(body?.name ?? "").trim();
    const link = String(body?.link ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? body?.image_url ?? "").trim();
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

    if (!name) return NextResponse.json({ error: "Título do produto é obrigatório." }, { status: 400 });
    if (!link) return NextResponse.json({ error: "Link do produto é obrigatório." }, { status: 400 });

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        image_url: imageUrl || null,
        link,
        price,
        price_old,
      })
      .select(SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
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
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body?.name === "string") {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: "Título não pode ficar em branco" }, { status: 400 });
      patch.name = n;
    }
    if (typeof body?.link === "string") {
      const l = body.link.trim();
      if (!l) return NextResponse.json({ error: "Link não pode ficar em branco" }, { status: 400 });
      patch.link = l;
    }
    if (typeof body?.description === "string") patch.description = body.description.trim() || null;
    if (typeof body?.imageUrl === "string" || typeof body?.image_url === "string") {
      const v = String(body?.imageUrl ?? body?.image_url ?? "").trim();
      patch.image_url = v || null;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "price")) {
      const p = body.price;
      patch.price = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "priceOld") || Object.prototype.hasOwnProperty.call(body ?? {}, "price_old")) {
      const p = body.priceOld ?? body.price_old;
      patch.price_old = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
    }

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(SELECT)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
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
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("produtos_infoprodutor")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
