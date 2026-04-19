import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
};

type ProfileRow = {
  stripe_secret_key: string | null;
  shipping_sender_whatsapp: string | null;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const slug = (url.searchParams.get("slug") ?? "").trim();
    const piId = (url.searchParams.get("pi") ?? "").trim();
    if (!slug || !piId) {
      return NextResponse.json({ error: "slug e pi são obrigatórios" }, { status: 400 });
    }
    if (!/^pi_[a-zA-Z0-9_]+$/.test(piId)) {
      return NextResponse.json({ error: "PaymentIntent id inválido" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select("id, user_id, name")
      .eq("public_slug", slug)
      .eq("provider", "stripe")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key, shipping_sender_whatsapp")
      .eq("id", row.user_id)
      .maybeSingle();
    const prof = (profile as ProfileRow | null) ?? null;
    const stripeKey = prof?.stripe_secret_key?.trim();
    if (!stripeKey) {
      return NextResponse.json({ error: "Vendedor sem chave Stripe" }, { status: 503 });
    }

    const stripe = new Stripe(stripeKey);
    let intent: Stripe.PaymentIntent;
    try {
      intent = await stripe.paymentIntents.retrieve(piId, { expand: ["latest_charge"] });
    } catch {
      return NextResponse.json({ error: "Pagamento não encontrado" }, { status: 404 });
    }

    // Valida que este PI é desse produto mesmo (segurança contra PIs arbitrários)
    const metaProdutoId = typeof intent.metadata?.produto_id === "string" ? intent.metadata.produto_id : "";
    if (metaProdutoId !== row.id) {
      return NextResponse.json({ error: "Pagamento não corresponde ao produto" }, { status: 403 });
    }

    const latestCharge = (intent as Stripe.PaymentIntent & { latest_charge?: Stripe.Charge | string | null })
      .latest_charge;
    const charge = latestCharge && typeof latestCharge === "object" ? (latestCharge as Stripe.Charge) : null;
    const billing = charge?.billing_details ?? null;
    const shipping = intent.shipping ?? null;

    const status = intent.status; // "succeeded" | "processing" | ...
    const paid = status === "succeeded";
    const amountCents = intent.amount_received || intent.amount || 0;
    const deliveryMode = typeof intent.metadata?.delivery_mode === "string" ? intent.metadata.delivery_mode : "";
    const shippingName = typeof intent.metadata?.shipping_name === "string" ? intent.metadata.shipping_name : "";

    const address = shipping?.address
      ? {
          line1: shipping.address.line1 ?? null,
          line2: shipping.address.line2 ?? null,
          city: shipping.address.city ?? null,
          state: shipping.address.state ?? null,
          postalCode: shipping.address.postal_code ?? null,
        }
      : null;

    return NextResponse.json({
      paid,
      status,
      amount: amountCents / 100,
      product: { name: row.name },
      delivery: { mode: deliveryMode || null, name: shippingName || null },
      buyer: {
        name: shipping?.name ?? billing?.name ?? null,
        email: billing?.email ?? intent.receipt_email ?? null,
        phone: billing?.phone ?? shipping?.phone ?? null,
      },
      shippingAddress: address,
      sellerWhatsapp: prof?.shipping_sender_whatsapp?.trim() || null,
      orderShort: intent.id.slice(-10).toUpperCase(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
