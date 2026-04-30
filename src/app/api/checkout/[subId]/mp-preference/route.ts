/**
 * Cria uma Preference do Mercado Pago para o checkout do comprador.
 *
 * Devolve `preferenceId` + `publicKey` do vendedor — o front usa isso pra
 * inicializar o Payment Brick do MP.
 *
 *   POST /api/checkout/[subId]/mp-preference
 *   Body: { mode, shippingPrice?, shippingName?, buyerName, buyerWhatsapp, buyerEmail? }
 *   Resposta: { preferenceId, publicKey, initPoint, sandboxInitPoint, amount }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { parseOptionalBuyerEmail, payerEmailForMercadoPago } from "@/lib/infoprod/payer-email-mp";
import { createMpPreference, type MpPreferenceInput } from "@/lib/mercadopago/api";
import { getMercadoPagoAppOrigin } from "@/lib/mercadopago/config";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  price: number | string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
  allow_digital: boolean | null;
  allow_local_delivery: boolean | null;
  local_delivery_cost: number | string | null;
  thank_you_message: string | null;
};

type ProfileRow = {
  mp_access_token: string | null;
  mp_public_key: string | null;
  mp_user_id: string | null;
  checkout_method_card: boolean | null;
  checkout_method_pix: boolean | null;
  checkout_method_boleto: boolean | null;
};

function num(v: unknown): number {
  if (v == null || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function POST(req: Request, ctx: { params: Promise<{ subId: string }> }) {
  try {
    const { subId: slug } = await ctx.params;
    if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "shipping");
    const shippingPrice = Number(body?.shippingPrice ?? 0);
    const shippingName = String(body?.shippingName ?? "Frete").trim() || "Frete";
    const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 120) : "";
    const buyerWhatsapp = typeof body?.buyerWhatsapp === "string" ? body.buyerWhatsapp.trim().slice(0, 40) : "";
    const buyerEmail = typeof body?.buyerEmail === "string" ? body.buyerEmail.trim().slice(0, 200) : "";

    if (mode !== "shipping" && mode !== "pickup" && mode !== "digital" && mode !== "local_delivery") {
      return NextResponse.json({ error: "Modo de entrega inválido" }, { status: 400 });
    }
    if (mode === "shipping" && (!Number.isFinite(shippingPrice) || shippingPrice < 0)) {
      return NextResponse.json({ error: "Valor de frete inválido" }, { status: 400 });
    }
    // Nome e WhatsApp obrigatórios; e-mail é opcional (MP exige payer.email —
    // usamos placeholder técnico quando vazio: ver `payerEmailForMercadoPago`).
    if (buyerName.length < 3) {
      return NextResponse.json({ error: "Informe o nome completo do comprador." }, { status: 400 });
    }
    if (buyerWhatsapp.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Informe o WhatsApp com DDD (mínimo 10 dígitos)." },
        { status: 400 },
      );
    }
    const buyerEmailParsed = parseOptionalBuyerEmail(buyerEmail);
    if (buyerEmail.length > 0 && !buyerEmailParsed) {
      return NextResponse.json({ error: "Informe um e-mail válido ou deixe o campo vazio." }, { status: 400 });
    }

    const payerEmailResolved = payerEmailForMercadoPago(buyerEmail, buyerWhatsapp);

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select(
        "id, user_id, name, price, allow_shipping, allow_pickup, allow_digital, allow_local_delivery, local_delivery_cost, thank_you_message",
      )
      .eq("public_slug", slug)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;
    if (mode === "shipping" && !row.allow_shipping) {
      return NextResponse.json({ error: "Produto não aceita envio" }, { status: 400 });
    }
    if (mode === "pickup" && !row.allow_pickup) {
      return NextResponse.json({ error: "Produto não aceita retirada" }, { status: 400 });
    }
    if (mode === "digital" && !row.allow_digital) {
      return NextResponse.json({ error: "Produto não é digital" }, { status: 400 });
    }
    if (mode === "local_delivery" && !row.allow_local_delivery) {
      return NextResponse.json({ error: "Produto não aceita entrega em casa" }, { status: 400 });
    }

    const productPrice = num(row.price);
    if (productPrice <= 0) {
      return NextResponse.json({ error: "Produto sem preço válido" }, { status: 400 });
    }
    const localDeliveryCost = num(row.local_delivery_cost);
    const frete =
      mode === "shipping"
        ? shippingPrice
        : mode === "local_delivery"
          ? localDeliveryCost
          : 0;
    const totalAmount = Math.round((productPrice + frete) * 100) / 100;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "mp_access_token, mp_public_key, mp_user_id, checkout_method_card, checkout_method_pix, checkout_method_boleto",
      )
      .eq("id", row.user_id)
      .maybeSingle();
    const prof = (profile as ProfileRow | null) ?? null;
    const accessToken = prof?.mp_access_token?.trim();
    const publicKey = prof?.mp_public_key?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Vendedor sem conta Mercado Pago configurada" }, { status: 503 });
    }
    if (!publicKey) {
      return NextResponse.json(
        { error: "Vendedor ainda não configurou a Public Key do Mercado Pago" },
        { status: 503 },
      );
    }

    // Métodos de pagamento desabilitados pelo afiliado.
    const allowCard = prof?.checkout_method_card !== false;
    const allowPix = prof?.checkout_method_pix !== false;
    const allowBoleto = prof?.checkout_method_boleto !== false;
    const excludedTypes: Array<{ id: string }> = [];
    if (!allowCard) excludedTypes.push({ id: "credit_card" }, { id: "debit_card" });
    if (!allowPix) excludedTypes.push({ id: "atm" }); // PIX no MP cai como "bank_transfer", mas exclude por id "atm" é o mais comum
    if (!allowBoleto) excludedTypes.push({ id: "ticket" });

    const itemTitle =
      mode === "pickup"
        ? `${row.name} (retirada na loja)`
        : mode === "digital"
          ? `${row.name} (entrega digital)`
          : mode === "local_delivery"
            ? `${row.name} (entrega em casa)`
            : `${row.name} + ${shippingName}`;

    let appOrigin: string;
    try {
      appOrigin = getMercadoPagoAppOrigin();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Configuração ausente";
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const notificationUrl = `${appOrigin}/api/webhooks/mercadopago?user_id=${encodeURIComponent(row.user_id)}`;
    const successUrl = `${appOrigin}/checkout/sucesso?slug=${encodeURIComponent(slug)}`;
    const failureUrl = `${appOrigin}/checkout/${encodeURIComponent(slug)}?status=failure`;
    const pendingUrl = `${appOrigin}/checkout/${encodeURIComponent(slug)}?status=pending`;

    const buyerPhoneDigits = buyerWhatsapp.replace(/\D/g, "");
    const buyerPhonePayload =
      buyerPhoneDigits.length >= 10
        ? { area_code: buyerPhoneDigits.slice(0, 2), number: buyerPhoneDigits.slice(2) }
        : undefined;

    const buyerNameParts = buyerName.split(/\s+/).filter(Boolean);
    const buyerFirstName = buyerNameParts.length > 0 ? buyerNameParts[0] : "";
    const buyerLastName = buyerNameParts.length > 1 ? buyerNameParts.slice(1).join(" ") : "";

    const preferenceInput: MpPreferenceInput = {
      items: [
        {
          id: row.id,
          title: itemTitle,
          quantity: 1,
          unit_price: totalAmount,
          currency_id: "BRL",
        },
      ],
      external_reference: `infoprod:${row.id}`,
      notification_url: notificationUrl,
      back_urls: { success: successUrl, failure: failureUrl, pending: pendingUrl },
      auto_return: "approved",
      payer: {
        email: payerEmailResolved,
        ...(buyerFirstName ? { first_name: buyerFirstName } : {}),
        ...(buyerLastName ? { last_name: buyerLastName } : {}),
        ...(buyerPhonePayload ? { phone: buyerPhonePayload } : {}),
      },
      payment_methods:
        excludedTypes.length > 0
          ? { excluded_payment_types: excludedTypes }
          : undefined,
      metadata: {
        produto_id: row.id,
        produto_name: row.name,
        public_slug: slug,
        delivery_mode: mode,
        shipping_name: itemTitle,
        shipping_price_brl: frete.toFixed(2),
        product_price_brl: productPrice.toFixed(2),
        ...(buyerName ? { buyer_name: buyerName } : {}),
        ...(buyerWhatsapp ? { buyer_whatsapp: buyerWhatsapp } : {}),
        ...(buyerEmailParsed ? { buyer_email: buyerEmailParsed } : {}),
      },
      statement_descriptor: row.name.slice(0, 22),
    };

    const preference = await createMpPreference(preferenceInput, accessToken);

    // Best-effort: guardar a última preference criada pra debug. Não bloqueia
    // a resposta se falhar.
    void supabase
      .from("produtos_infoprodutor")
      .update({
        mp_preference_id: preference.id,
        mp_init_point: preference.init_point ?? null,
      })
      .eq("id", row.id)
      .then(() => undefined);

    return NextResponse.json({
      preferenceId: preference.id,
      publicKey,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point ?? null,
      amount: totalAmount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar preference";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
