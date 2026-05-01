import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { gateAmazon } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, lista_id, image_url, product_name, price_original, price_promo, discount_rate, coupon_percent, coupon_amount, affiliate_commission_pct, converter_link, product_page_url, created_at";

function mapItem(r: Record<string, unknown>) {
  return {
    id: r.id,
    listaId: r.lista_id,
    imageUrl: r.image_url ?? "",
    productName: r.product_name ?? "",
    priceOriginal: r.price_original != null ? Number(r.price_original) : null,
    pricePromo: r.price_promo != null ? Number(r.price_promo) : null,
    discountRate: r.discount_rate != null ? Number(r.discount_rate) : null,
    couponPercent: r.coupon_percent != null ? Number(r.coupon_percent) : null,
    couponAmount: r.coupon_amount != null ? Number(r.coupon_amount) : null,
    affiliateCommissionPct:
      r.affiliate_commission_pct != null ? Number(r.affiliate_commission_pct) : null,
    converterLink: r.converter_link ?? "",
    productPageUrl: String(r.product_page_url ?? "").trim(),
    createdAt: r.created_at,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const url = new URL(req.url);
    const listaId = url.searchParams.get("lista_id")?.trim();

    if (listaId) {
      const { data: rows, error } = await supabase
        .from("minha_lista_ofertas_amazon")
        .select(SELECT_COLS)
        .eq("user_id", user.id)
        .eq("lista_id", listaId)
        .order("created_at", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: (rows ?? []).map(mapItem) });
    }

    const { data: rows, error } = await supabase
      .from("minha_lista_ofertas_amazon")
      .select(SELECT_COLS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: (rows ?? []).map(mapItem) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const listaId = (body?.listaId ?? body?.lista_id ?? "").toString().trim();
    const converterLink = String(body?.converterLink ?? body?.converter_link ?? "").trim();
    const productPageUrl = String(body?.productPageUrl ?? body?.product_page_url ?? "").trim();

    if (!listaId) return NextResponse.json({ error: "listaId é obrigatório" }, { status: 400 });
    if (!converterLink) {
      return NextResponse.json(
        { error: "converterLink é obrigatório (link de afiliado Amazon já gerado)" },
        { status: 400 },
      );
    }

    const priceOriginal = body?.priceOriginal != null ? Number(body.priceOriginal) : null;
    let pricePromo = body?.pricePromo != null ? Number(body.pricePromo) : null;
    const discountRate = body?.discountRate != null ? Number(body.discountRate) : null;

    const poFin = Number.isFinite(priceOriginal as number) ? priceOriginal : null;
    const ppFin = Number.isFinite(pricePromo as number) ? pricePromo : null;
    const drFin = Number.isFinite(discountRate as number) ? discountRate : null;
    const normalizedPromo = effectiveListaOfferPromoPrice(poFin, ppFin, drFin);
    if (normalizedPromo != null) pricePromo = normalizedPromo;

    const couponPercent = numOrNull(body?.couponPercent ?? body?.coupon_percent);
    const couponAmount = numOrNull(body?.couponAmount ?? body?.coupon_amount);
    const affiliateCommissionPct = numOrNull(
      body?.affiliateCommissionPct ?? body?.affiliate_commission_pct,
    );

    const { data: row, error } = await supabase
      .from("minha_lista_ofertas_amazon")
      .insert({
        user_id: user.id,
        lista_id: listaId,
        image_url: String(body?.imageUrl ?? body?.image_url ?? "").trim(),
        product_name: String(body?.productName ?? body?.product_name ?? "").trim(),
        price_original: Number.isFinite(priceOriginal as number) ? priceOriginal : null,
        price_promo: Number.isFinite(pricePromo as number) ? pricePromo : null,
        discount_rate: Number.isFinite(discountRate as number) ? discountRate : null,
        coupon_percent: couponPercent,
        coupon_amount: couponAmount,
        affiliate_commission_pct: affiliateCommissionPct,
        converter_link: converterLink,
        product_page_url: productPageUrl,
      })
      .select(SELECT_COLS)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: mapItem(row as Record<string, unknown>) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const itemIds = body?.itemIds || body?.item_ids;
    const listaIdForReorder = body?.listaId || body?.lista_id;

    if (Array.isArray(itemIds) && listaIdForReorder) {
      const now = new Date();
      for (let i = 0; i < itemIds.length; i++) {
        const id = itemIds[i];
        const newDate = new Date(now.getTime() - (itemIds.length - i) * 1000);
        await supabase
          .from("minha_lista_ofertas_amazon")
          .update({ created_at: newDate.toISOString() })
          .eq("id", id)
          .eq("user_id", user.id)
          .eq("lista_id", listaIdForReorder);
      }
      return NextResponse.json({ ok: true });
    }

    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json(
        { error: "id é obrigatório para atualização individual ou itemIds para reordenação" },
        { status: 400 },
      );
    }

    const priceOriginal = body?.priceOriginal != null ? Number(body.priceOriginal) : null;
    const pricePromo = body?.pricePromo != null ? Number(body.pricePromo) : null;
    const discountRate = body?.discountRate != null ? Number(body.discountRate) : null;

    const poFin = Number.isFinite(priceOriginal as number) ? priceOriginal : null;
    let ppFin = Number.isFinite(pricePromo as number) ? pricePromo : null;
    const drFin = Number.isFinite(discountRate as number) ? discountRate : null;
    const normalizedPromo = effectiveListaOfferPromoPrice(poFin, ppFin, drFin);
    if (normalizedPromo != null) ppFin = normalizedPromo;

    const couponPercent = numOrNull(body?.couponPercent ?? body?.coupon_percent);
    const couponAmount = numOrNull(body?.couponAmount ?? body?.coupon_amount);
    const affiliateCommissionPct = numOrNull(
      body?.affiliateCommissionPct ?? body?.affiliate_commission_pct,
    );
    const updatePayload: Record<string, unknown> = {
      product_name: String(body?.productName ?? body?.product_name ?? "").trim(),
      price_original: poFin,
      price_promo: ppFin,
      discount_rate: drFin,
    };
    // Só atualizamos cupom/comissão quando o cliente realmente mandou no body —
    // assim o PATCH "editar produto" antigo (que só envia preço) não zera campos.
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "couponPercent") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "coupon_percent")) {
      updatePayload.coupon_percent = couponPercent;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "couponAmount") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "coupon_amount")) {
      updatePayload.coupon_amount = couponAmount;
    }
    if (Object.prototype.hasOwnProperty.call(body ?? {}, "affiliateCommissionPct") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "affiliate_commission_pct")) {
      updatePayload.affiliate_commission_pct = affiliateCommissionPct;
    }

    const { data: row, error } = await supabase
      .from("minha_lista_ofertas_amazon")
      .update(updatePayload)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(SELECT_COLS)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!row) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });

    return NextResponse.json({ data: mapItem(row as Record<string, unknown>) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const gate = await gateAmazon();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    const listaId = url.searchParams.get("lista_id")?.trim();
    const empty = url.searchParams.get("empty") === "1";

    if (listaId && empty) {
      const { error } = await supabase
        .from("minha_lista_ofertas_amazon")
        .delete()
        .eq("lista_id", listaId)
        .eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("minha_lista_ofertas_amazon")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
