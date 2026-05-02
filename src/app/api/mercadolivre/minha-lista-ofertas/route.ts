import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { effectiveListaOfferPromoPrice } from "@/lib/lista-ofertas-effective-promo";
import { gateMercadoLivre } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

const SELECT_COLS =
  "id, lista_id, image_url, product_name, price_original, price_promo, discount_rate, coupon_percent, coupon_amount, pix_discount_percent, is_full, free_shipping, installments_count, installment_amount, installments_free_interest, converter_link, product_page_url, created_at";

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
    pixDiscountPercent:
      r.pix_discount_percent != null ? Number(r.pix_discount_percent) : null,
    isFull: r.is_full == null ? null : Boolean(r.is_full),
    freeShipping: r.free_shipping == null ? null : Boolean(r.free_shipping),
    installmentsCount:
      r.installments_count != null ? Number(r.installments_count) : null,
    installmentAmount:
      r.installment_amount != null ? Number(r.installment_amount) : null,
    installmentsFreeInterest:
      r.installments_free_interest == null ? null : Boolean(r.installments_free_interest),
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

function boolOrNull(v: unknown): boolean | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1 || v === "1") return true;
  if (v === "false" || v === 0 || v === "0") return false;
  return null;
}

export async function GET(req: Request) {
  try {
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const url = new URL(req.url);
    const listaId = url.searchParams.get("lista_id")?.trim();

    if (listaId) {
      const { data: rows, error } = await supabase
        .from("minha_lista_ofertas_ml")
        .select(SELECT_COLS)
        .eq("user_id", user.id)
        .eq("lista_id", listaId)
        .order("created_at", { ascending: true });

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data: (rows ?? []).map(mapItem) });
    }

    const { data: rows, error } = await supabase
      .from("minha_lista_ofertas_ml")
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
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const listaId = (body?.listaId ?? body?.lista_id ?? "").toString().trim();
    const converterLink = String(body?.converterLink ?? body?.converter_link ?? "").trim();
    const productPageUrl = String(body?.productPageUrl ?? body?.product_page_url ?? "").trim();

    if (!listaId) return NextResponse.json({ error: "listaId é obrigatório" }, { status: 400 });
    if (!converterLink) return NextResponse.json({ error: "converterLink é obrigatório (seu link de afiliado já gerado)" }, { status: 400 });

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
    const pixDiscountPercent = numOrNull(
      body?.pixDiscountPercent ?? body?.pix_discount_percent,
    );
    const isFull = boolOrNull(body?.isFull ?? body?.is_full);
    const freeShipping = boolOrNull(body?.freeShipping ?? body?.free_shipping);
    const installmentsCount = numOrNull(
      body?.installmentsCount ?? body?.installments_count,
    );
    const installmentAmount = numOrNull(
      body?.installmentAmount ?? body?.installment_amount,
    );
    const installmentsFreeInterest = boolOrNull(
      body?.installmentsFreeInterest ?? body?.installments_free_interest,
    );

    const { data: row, error } = await supabase
      .from("minha_lista_ofertas_ml")
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
        pix_discount_percent: pixDiscountPercent,
        is_full: isFull,
        free_shipping: freeShipping,
        installments_count: installmentsCount,
        installment_amount: installmentAmount,
        installments_free_interest: installmentsFreeInterest,
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
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const body = await req.json().catch(() => ({}));
    const itemIds = body?.itemIds || body?.item_ids;
    const listaIdForReorder = body?.listaId || body?.lista_id;

    // Se houver itemIds e listaId, tratamos como reordenação
    if (Array.isArray(itemIds) && listaIdForReorder) {
      const now = new Date();
      for (let i = 0; i < itemIds.length; i++) {
        const id = itemIds[i];
        // Invertemos: o primeiro da lista UI é o mais antigo para a automação
        const newDate = new Date(now.getTime() - (itemIds.length - i) * 1000);
        await supabase
          .from("minha_lista_ofertas_ml")
          .update({ created_at: newDate.toISOString() })
          .eq("id", id)
          .eq("user_id", user.id)
          .eq("lista_id", listaIdForReorder);
      }
      return NextResponse.json({ ok: true });
    }

    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório para atualização individual ou itemIds para reordenação" }, { status: 400 });

    const priceOriginal = body?.priceOriginal != null ? Number(body.priceOriginal) : null;
    const pricePromo = body?.pricePromo != null ? Number(body.pricePromo) : null;
    const discountRate = body?.discountRate != null ? Number(body.discountRate) : null;

    const poFin = Number.isFinite(priceOriginal as number) ? priceOriginal : null;
    let ppFin = Number.isFinite(pricePromo as number) ? pricePromo : null;
    const drFin = Number.isFinite(discountRate as number) ? discountRate : null;
    const normalizedPromo = effectiveListaOfferPromoPrice(poFin, ppFin, drFin);
    if (normalizedPromo != null) ppFin = normalizedPromo;

    const updatePayload: Record<string, unknown> = {
      product_name: String(body?.productName ?? body?.product_name ?? "").trim(),
      price_original: poFin,
      price_promo: ppFin,
      discount_rate: drFin,
    };
    // Só atualizamos campos novos quando o cliente realmente mandou — assim
    // o PATCH "editar produto" antigo (que só envia preço) não zera nada.
    const has = (k: string) => Object.prototype.hasOwnProperty.call(body ?? {}, k);
    if (has("couponPercent") || has("coupon_percent")) {
      updatePayload.coupon_percent = numOrNull(body?.couponPercent ?? body?.coupon_percent);
    }
    if (has("couponAmount") || has("coupon_amount")) {
      updatePayload.coupon_amount = numOrNull(body?.couponAmount ?? body?.coupon_amount);
    }
    if (has("pixDiscountPercent") || has("pix_discount_percent")) {
      updatePayload.pix_discount_percent = numOrNull(
        body?.pixDiscountPercent ?? body?.pix_discount_percent,
      );
    }
    if (has("isFull") || has("is_full")) {
      updatePayload.is_full = boolOrNull(body?.isFull ?? body?.is_full);
    }
    if (has("freeShipping") || has("free_shipping")) {
      updatePayload.free_shipping = boolOrNull(body?.freeShipping ?? body?.free_shipping);
    }
    if (has("installmentsCount") || has("installments_count")) {
      updatePayload.installments_count = numOrNull(
        body?.installmentsCount ?? body?.installments_count,
      );
    }
    if (has("installmentAmount") || has("installment_amount")) {
      updatePayload.installment_amount = numOrNull(
        body?.installmentAmount ?? body?.installment_amount,
      );
    }
    if (has("installmentsFreeInterest") || has("installments_free_interest")) {
      updatePayload.installments_free_interest = boolOrNull(
        body?.installmentsFreeInterest ?? body?.installments_free_interest,
      );
    }

    const { data: row, error } = await supabase
      .from("minha_lista_ofertas_ml")
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
    const gate = await gateMercadoLivre();
    if (!gate.allowed) return gate.response;
    const user = { id: gate.userId };
    const supabase = await createClient();

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    const listaId = url.searchParams.get("lista_id")?.trim();
    const empty = url.searchParams.get("empty") === "1";

    if (listaId && empty) {
      const { error } = await supabase.from("minha_lista_ofertas_ml").delete().eq("lista_id", listaId).eq("user_id", user.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { error } = await supabase.from("minha_lista_ofertas_ml").delete().eq("id", id).eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
