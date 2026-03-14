/**
 * Histórico de links Shopee: GET (listagem paginada), POST (criar), DELETE (remover).
 */

import { NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 4;

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limitParam = parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(50, Math.max(1, Number.isNaN(limitParam) ? DEFAULT_LIMIT : limitParam));
    const searchRaw = (url.searchParams.get("search") || "").trim();
    const search = searchRaw.replace(/'/g, "''").toLowerCase();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("shopee_link_history")
      .select("id, short_link, origin_url, sub_id_1, sub_id_2, sub_id_3, observation, product_name, slug, image_url, commission_rate, commission_value, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(
        `product_name.ilike.${pattern},short_link.ilike.${pattern},sub_id_1.ilike.${pattern},sub_id_2.ilike.${pattern},sub_id_3.ilike.${pattern}`
      );
    }

    const { data: rows, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const data = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      shortLink: r.short_link,
      originUrl: r.origin_url,
      subId1: r.sub_id_1 ?? "",
      subId2: r.sub_id_2 ?? "",
      subId3: r.sub_id_3 ?? "",
      observation: r.observation ?? "",
      productName: r.product_name ?? "",
      slug: r.slug ?? "",
      imageUrl: r.image_url ?? "",
      commissionRate: Number(r.commission_rate) ?? 0,
      commissionValue: Number(r.commission_value) ?? 0,
      createdAt: r.created_at,
    }));

    return NextResponse.json({ data, total, page, totalPages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const shortLink = String(body?.shortLink ?? "").trim();
    if (!shortLink) return NextResponse.json({ error: "shortLink é obrigatório" }, { status: 400 });

    const { error } = await supabase.from("shopee_link_history").insert({
      user_id: user.id,
      short_link: shortLink,
      origin_url: String(body?.originUrl ?? "").trim(),
      sub_id_1: String(body?.subId1 ?? "").trim(),
      sub_id_2: String(body?.subId2 ?? "").trim(),
      sub_id_3: String(body?.subId3 ?? "").trim(),
      observation: String(body?.observation ?? "").trim(),
      product_name: String(body?.productName ?? "").trim(),
      slug: String(body?.slug ?? "").trim(),
      image_url: String(body?.imageUrl ?? "").trim(),
      commission_rate: Number(body?.commissionRate) || 0,
      commission_value: Number(body?.commissionValue) || 0,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase.from("shopee_link_history").delete().eq("id", id).eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
