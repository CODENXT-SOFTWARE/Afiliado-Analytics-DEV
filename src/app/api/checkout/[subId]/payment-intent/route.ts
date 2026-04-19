import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  price: number | string | null;
  stripe_subid: string | null;
  stripe_payment_link_id: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
};

type ProfileRow = {
  stripe_secret_key: string | null;
  stripe_publishable_key: string | null;
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
        "id, user_id, name, price, stripe_subid, stripe_payment_link_id, allow_shipping, allow_pickup",
      )
      .eq("public_slug", slug)
      .eq("provider", "stripe")
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

    const productPrice = num(row.price);
    if (productPrice <= 0) {
      return NextResponse.json({ error: "Produto sem preço válido" }, { status: 400 });
    }
    const frete = mode === "pickup" ? 0 : shippingPrice;
    const totalCents = Math.round((productPrice + frete) * 100);

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key, stripe_publishable_key")
      .eq("id", row.user_id)
      .maybeSingle();
    const prof = (profile as ProfileRow | null) ?? null;
    const stripeKey = prof?.stripe_secret_key?.trim();
    if (!stripeKey) {
      return NextResponse.json({ error: "Vendedor sem chave Stripe configurada" }, { status: 503 });
    }
    if (!prof?.stripe_publishable_key?.trim()) {
      return NextResponse.json(
        { error: "Vendedor ainda não configurou a Publishable Key da Stripe" },
        { status: 503 },
      );
    }

    const stripe = new Stripe(stripeKey);
    const intent = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: "brl",
      // Payment methods habilitados na conta Stripe do afiliado (cartão, PIX, boleto, etc.)
      automatic_payment_methods: { enabled: true },
      metadata: {
        produto_id: row.id,
        produto_name: row.name,
        public_slug: slug,
        stripe_subid: row.stripe_subid ?? "",
        stripe_payment_link_id: row.stripe_payment_link_id ?? "",
        delivery_mode: mode,
        shipping_name: mode === "pickup" ? "Retirada na loja" : shippingName,
        shipping_price_brl: frete.toFixed(2),
        product_price_brl: productPrice.toFixed(2),
      },
    });

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: totalCents,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar pagamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
