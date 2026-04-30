/**
 * Cria o pagamento no Mercado Pago a partir do `formData` do Payment Brick.
 *
 *   POST /api/checkout/[subId]/mp-payment
 *
 * Body esperado:
 *   {
 *     formData: { payment_method_id, token?, installments?, issuer_id?,
 *                 payer: { email, identification?, first_name?, last_name? },
 *                 transaction_amount?: number },  // do Brick
 *     mode: "shipping" | "pickup" | "digital" | "local_delivery",
 *     shippingPrice?: number, shippingName?: string,
 *     buyerWhatsapp?: string, buyerEmail?: string,
 *   }
 *
 * Resposta: { id, status, statusDetail, qrCode?, qrCodeBase64?, ticketUrl?, boletoUrl? }
 *
 * O cálculo do `transaction_amount` é REFEITO no servidor (não confiamos no
 * valor que veio do client) e usamos isso pra evitar manipulação de preço.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { parseOptionalBuyerEmail, payerEmailForMercadoPago } from "@/lib/infoprod/payer-email-mp";
import {
  createMpPayment,
  type MpCreatePaymentInput,
  type MpPaymentResponse,
} from "@/lib/mercadopago/api";
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
};

type ProfileRow = {
  mp_access_token: string | null;
};

type BrickFormData = {
  payment_method_id?: string;
  token?: string;
  installments?: number;
  issuer_id?: string;
  payer?: {
    email?: string;
    identification?: { type?: string; number?: string };
    first_name?: string;
    last_name?: string;
  };
  transaction_amount?: number;
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
    const formData = (body?.formData ?? {}) as BrickFormData;

    if (!formData.payment_method_id) {
      return NextResponse.json({ error: "payment_method_id é obrigatório (do Brick)" }, { status: 400 });
    }
    const mode = String(body?.mode ?? "shipping");
    const shippingPrice = Number(body?.shippingPrice ?? 0);
    const shippingName = String(body?.shippingName ?? "Frete").trim() || "Frete";
    const buyerName = typeof body?.buyerName === "string" ? body.buyerName.trim().slice(0, 120) : "";
    const buyerWhatsapp = typeof body?.buyerWhatsapp === "string" ? body.buyerWhatsapp.trim().slice(0, 40) : "";
    const buyerEmail = typeof body?.buyerEmail === "string" ? body.buyerEmail.trim().slice(0, 200) : "";

    const brickEmail = formData.payer?.email?.trim() ?? "";
    const resolvedPayerEmail =
      parseOptionalBuyerEmail(buyerEmail) ??
      parseOptionalBuyerEmail(brickEmail) ??
      payerEmailForMercadoPago("", buyerWhatsapp);

    // Divide o nome em first/last (MP exige campos separados — pega tudo antes
    // do primeiro espaço como first_name e o resto como last_name).
    const buyerNameParts = buyerName.split(/\s+/).filter(Boolean);
    const buyerFirstName = buyerNameParts.length > 0 ? buyerNameParts[0] : "";
    const buyerLastName = buyerNameParts.length > 1 ? buyerNameParts.slice(1).join(" ") : "";

    if (mode !== "shipping" && mode !== "pickup" && mode !== "digital" && mode !== "local_delivery") {
      return NextResponse.json({ error: "Modo de entrega inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select(
        "id, user_id, name, price, allow_shipping, allow_pickup, allow_digital, allow_local_delivery, local_delivery_cost",
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
        ? Number.isFinite(shippingPrice) && shippingPrice >= 0
          ? shippingPrice
          : 0
        : mode === "local_delivery"
          ? localDeliveryCost
          : 0;
    const totalAmount = Math.round((productPrice + frete) * 100) / 100;

    const { data: profile } = await supabase
      .from("profiles")
      .select("mp_access_token")
      .eq("id", row.user_id)
      .maybeSingle();
    const accessToken = (profile as ProfileRow | null)?.mp_access_token?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Vendedor sem conta Mercado Pago configurada" }, { status: 503 });
    }

    let appOrigin: string;
    try {
      appOrigin = getMercadoPagoAppOrigin();
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Configuração ausente" },
        { status: 500 },
      );
    }

    const buyerPhoneDigits = buyerWhatsapp.replace(/\D/g, "");
    const buyerPhonePayload =
      buyerPhoneDigits.length >= 10
        ? { area_code: buyerPhoneDigits.slice(0, 2), number: buyerPhoneDigits.slice(2) }
        : undefined;

    const itemTitle =
      mode === "pickup"
        ? `${row.name} (retirada na loja)`
        : mode === "digital"
          ? `${row.name} (entrega digital)`
          : mode === "local_delivery"
            ? `${row.name} (entrega em casa)`
            : `${row.name} + ${shippingName}`;

    const paymentInput: MpCreatePaymentInput = {
      transaction_amount: totalAmount,
      description: row.name,
      payment_method_id: formData.payment_method_id,
      ...(formData.token ? { token: formData.token } : {}),
      ...(typeof formData.installments === "number" ? { installments: formData.installments } : {}),
      ...(formData.issuer_id ? { issuer_id: formData.issuer_id } : {}),
      payer: {
        email: resolvedPayerEmail,
        ...(formData.payer?.identification ? { identification: formData.payer.identification } : {}),
        // Nome coletado no nosso form tem prioridade sobre o que veio do Brick
        // (no PIX/Boleto o Brick não pede nome — sem fallback ficaria vazio).
        first_name: buyerFirstName || formData.payer?.first_name || "",
        last_name: buyerLastName || formData.payer?.last_name || "",
        ...(buyerPhonePayload ? { phone: buyerPhonePayload } : {}),
      },
      external_reference: `infoprod:${row.id}`,
      notification_url: `${appOrigin}/api/webhooks/mercadopago?user_id=${encodeURIComponent(row.user_id)}`,
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
        ...(buyerEmail ? { buyer_email: buyerEmail } : {}),
      },
      additional_info: {
        items: [
          {
            id: row.id,
            title: itemTitle,
            quantity: 1,
            unit_price: totalAmount,
          },
        ],
      },
      statement_descriptor: row.name.slice(0, 22),
    };

    let payment: MpPaymentResponse;
    try {
      payment = await createMpPayment(paymentInput, accessToken, randomUUID());
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao criar pagamento";
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    return NextResponse.json({
      id: payment.id,
      status: payment.status,
      statusDetail: payment.status_detail ?? null,
      qrCode: payment.point_of_interaction?.transaction_data?.qr_code ?? null,
      qrCodeBase64: payment.point_of_interaction?.transaction_data?.qr_code_base64 ?? null,
      ticketUrl: payment.point_of_interaction?.transaction_data?.ticket_url ?? null,
      boletoUrl: payment.transaction_details?.external_resource_url ?? null,
      amount: totalAmount,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao processar pagamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
