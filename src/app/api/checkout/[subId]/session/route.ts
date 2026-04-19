import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  toWhatsAppUrl,
  buildPaymentLinkCustomText,
  formatSenderAddressShort,
  SHIPPING_RATE_DISPLAY_NAMES,
  type SenderSnapshot,
  type DeliveryMode,
} from "@/lib/infoprod/stripe-checkout-copy";
import { getAppPublicUrl } from "@/lib/infoprod/stripe-webhook-setup";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  price: number | string | null;
  stripe_price_id: string | null;
  stripe_payment_link_id: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
};

type SenderRow = {
  shipping_sender_whatsapp: string | null;
  shipping_sender_street: string | null;
  shipping_sender_number: string | null;
  shipping_sender_complement: string | null;
  shipping_sender_neighborhood: string | null;
  shipping_sender_city: string | null;
  shipping_sender_uf: string | null;
  stripe_secret_key: string | null;
};

export async function POST(req: Request, ctx: { params: Promise<{ subId: string }> }) {
  try {
    const { subId } = await ctx.params;
    if (!subId) return NextResponse.json({ error: "subId obrigatório" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const mode = String(body?.mode ?? "shipping"); // "shipping" | "pickup"
    const shippingPrice = Number(body?.shippingPrice ?? 0);
    const shippingName = String(body?.shippingName ?? "Frete").trim() || "Frete";

    if (mode !== "shipping" && mode !== "pickup") {
      return NextResponse.json({ error: "Modo de entrega inválido" }, { status: 400 });
    }
    if (mode === "shipping" && (!Number.isFinite(shippingPrice) || shippingPrice < 0)) {
      return NextResponse.json({ error: "Valor de frete inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select(
        "id, user_id, name, price, stripe_price_id, stripe_payment_link_id, allow_shipping, allow_pickup",
      )
      .eq("stripe_subid", subId)
      .eq("provider", "stripe")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;
    if (!row.stripe_price_id) {
      return NextResponse.json({ error: "Produto sem Price ID na Stripe" }, { status: 500 });
    }
    if (mode === "shipping" && !row.allow_shipping) {
      return NextResponse.json({ error: "Produto não aceita envio" }, { status: 400 });
    }
    if (mode === "pickup" && !row.allow_pickup) {
      return NextResponse.json({ error: "Produto não aceita retirada" }, { status: 400 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "shipping_sender_whatsapp, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf, stripe_secret_key",
      )
      .eq("id", row.user_id)
      .maybeSingle();

    const sender = (profile as SenderRow | null) ?? null;
    const stripeKey = sender?.stripe_secret_key?.trim();
    if (!stripeKey) {
      return NextResponse.json({ error: "Vendedor sem chave Stripe configurada" }, { status: 503 });
    }

    const waUrl = toWhatsAppUrl(sender?.shipping_sender_whatsapp ?? null);
    const senderSnapshot: SenderSnapshot = {
      street: sender?.shipping_sender_street ?? null,
      number: sender?.shipping_sender_number ?? null,
      complement: sender?.shipping_sender_complement ?? null,
      neighborhood: sender?.shipping_sender_neighborhood ?? null,
      city: sender?.shipping_sender_city ?? null,
      uf: sender?.shipping_sender_uf ?? null,
    };
    const senderAddress = formatSenderAddressShort(senderSnapshot);

    const deliveryMode: DeliveryMode =
      mode === "pickup"
        ? { allowShipping: false, allowPickup: true }
        : { allowShipping: true, allowPickup: false };
    const customText = buildPaymentLinkCustomText(waUrl, deliveryMode, senderAddress);

    const stripe = new Stripe(stripeKey);

    const shippingRate = await stripe.shippingRates.create({
      display_name:
        mode === "pickup" ? SHIPPING_RATE_DISPLAY_NAMES.pickup : shippingName,
      type: "fixed_amount",
      fixed_amount: {
        amount: mode === "pickup" ? 0 : Math.round(shippingPrice * 100),
        currency: "brl",
      },
    });

    const appUrl = getAppPublicUrl();
    const successBase = appUrl || new URL(req.url).origin;
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: row.stripe_price_id, quantity: 1 }],
      shipping_options: [{ shipping_rate: shippingRate.id }],
      ...(mode === "shipping"
        ? { shipping_address_collection: { allowed_countries: ["BR"] } }
        : {}),
      phone_number_collection: { enabled: true },
      ...(customText && typeof customText.submit === "object" && customText.submit?.message
        ? { custom_text: { submit: { message: customText.submit.message } } }
        : {}),
      success_url: `${successBase}/checkout/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${successBase}/checkout/${encodeURIComponent(subId)}`,
      client_reference_id: row.stripe_payment_link_id ?? row.id,
      metadata: {
        produto_id: row.id,
        sub_id: subId,
        stripe_payment_link_id: row.stripe_payment_link_id ?? "",
        delivery_mode: mode,
      },
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe não retornou URL da sessão" }, { status: 500 });
    }

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar sessão";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
