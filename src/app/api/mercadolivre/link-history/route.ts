import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateMercadoLivre } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 4;

function isMeliLaUrl(s: string): boolean {
  try {
    const h = new URL(s.trim()).hostname.toLowerCase();
    return h === "meli.la" || h === "www.meli.la";
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const limitParam = parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
    const limit = Math.min(50, Math.max(1, Number.isNaN(limitParam) ? DEFAULT_LIMIT : limitParam));
    const searchRaw = (url.searchParams.get("search") || "").trim();
    const search = searchRaw.replace(/'/g, "''").toLowerCase();
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from("mercadolivre_link_history")
      .select(
        "id, short_link, origin_url, product_name, image_url, item_id, price_promo, price_original, discount_rate, coupon_percent, coupon_amount, pix_discount_percent, is_full, free_shipping, installments_count, installment_amount, installments_free_interest, created_at",
        { count: "exact" },
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (search) {
      const pattern = `%${search}%`;
      query = query.or(
        `product_name.ilike.${pattern},short_link.ilike.${pattern},origin_url.ilike.${pattern},item_id.ilike.${pattern}`,
      );
    }

    const { data: rows, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const total = count ?? 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const data = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      shortLink: r.short_link,
      originUrl: r.origin_url ?? "",
      productName: r.product_name ?? "",
      imageUrl: r.image_url ?? "",
      itemId: r.item_id ?? "",
      pricePromo: r.price_promo != null ? Number(r.price_promo) : null,
      priceOriginal: r.price_original != null ? Number(r.price_original) : null,
      discountRate: r.discount_rate != null ? Number(r.discount_rate) : null,
      couponPercent: r.coupon_percent != null ? Number(r.coupon_percent) : null,
      couponAmount: r.coupon_amount != null ? Number(r.coupon_amount) : null,
      pixDiscountPercent:
        r.pix_discount_percent != null ? Number(r.pix_discount_percent) : null,
      isFull: r.is_full == null ? null : Boolean(r.is_full),
      freeShipping: r.free_shipping == null ? null : Boolean(r.free_shipping),
      installmentsCount:
        r.installments_count != null ? Number(r.installments_count) : null,
      installmentAmount:
        r.installment_amount != null ? Number(r.installment_amount) : null,
      installmentsFreeInterest:
        r.installments_free_interest == null
          ? null
          : Boolean(r.installments_free_interest),
      createdAt: r.created_at,
    }));

    return NextResponse.json({ data, total, page, totalPages });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const shortLink = String(body?.shortLink ?? "").trim();
    if (!shortLink) return NextResponse.json({ error: "shortLink é obrigatório" }, { status: 400 });
    if (!isMeliLaUrl(shortLink)) {
      return NextResponse.json(
        { error: "O link deve ser um meli.la (link de afiliado do Mercado Livre)." },
        { status: 400 },
      );
    }

    const num = (v: unknown) => {
      if (v == null) return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const bool = (v: unknown) => {
      if (v == null) return null;
      if (typeof v === "boolean") return v;
      if (v === "true" || v === 1 || v === "1") return true;
      if (v === "false" || v === 0 || v === "0") return false;
      return null;
    };
    const { error } = await supabase.from("mercadolivre_link_history").insert({
      user_id: userId,
      short_link: shortLink,
      origin_url: String(body?.originUrl ?? "").trim(),
      product_name: String(body?.productName ?? "").trim(),
      image_url: String(body?.imageUrl ?? "").trim(),
      item_id: String(body?.itemId ?? "").trim(),
      price_promo: num(body?.pricePromo),
      price_original: num(body?.priceOriginal),
      discount_rate: num(body?.discountRate),
      coupon_percent: num(body?.couponPercent),
      coupon_amount: num(body?.couponAmount),
      pix_discount_percent: num(body?.pixDiscountPercent),
      is_full: bool(body?.isFull),
      free_shipping: bool(body?.freeShipping),
      installments_count: num(body?.installmentsCount),
      installment_amount: num(body?.installmentAmount),
      installments_free_interest: bool(body?.installmentsFreeInterest),
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const userId = gate.userId;
    const supabase = await createClient();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("mercadolivre_link_history")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
