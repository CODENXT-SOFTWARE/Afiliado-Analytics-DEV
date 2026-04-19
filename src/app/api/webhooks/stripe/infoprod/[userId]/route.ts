/**
 * Recebe eventos da Stripe do produto InfoP de um usuário e dispara notificações
 * WhatsApp (vendedor + comprador) via webhook n8n dedicado.
 *
 *   POST /api/webhooks/stripe/infoprod/:userId
 *   Header: Stripe-Signature
 *   Body: raw (não-parseado — precisamos do buffer pra validar a assinatura)
 *
 * Segurança: cada usuário tem seu próprio `stripe_webhook_secret` (um endpoint
 * por conta Stripe). O `userId` na URL + o secret no banco são a garantia.
 *
 * Ação em `checkout.session.completed`:
 *   1. Valida que a sessão pertence a um produto nosso (via payment_link)
 *   2. Monta mensagem ao VENDEDOR (detalhes do pedido)
 *   3. Monta mensagem ao COMPRADOR (thank_you_message customizado do produto, com fallback)
 *   4. Dispara as duas via `notifyPurchase()` em paralelo
 *
 * Falhas no WhatsApp NÃO retornam erro pra Stripe (não queremos retry infinito).
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { notifyPurchase } from "@/lib/infoprod/send-whatsapp-seller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

export async function POST(req: Request, context: { params: Promise<{ userId: string }> }) {
  const { userId } = await context.params;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    return new NextResponse("Invalid user", { status: 400 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) return new NextResponse("Missing signature", { status: 400 });

  const rawBody = await req.text();

  const supabase = getAdminSupabase();
  if (!supabase) {
    return new NextResponse("Supabase service role not configured", { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_secret_key, stripe_webhook_secret")
    .eq("id", userId)
    .single();
  const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
  const webhookSecret = (profile as { stripe_webhook_secret?: string | null } | null)?.stripe_webhook_secret ?? "";
  if (!stripeKey || !webhookSecret) {
    return new NextResponse("Webhook not configured for this user", { status: 400 });
  }

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Invalid signature";
    return new NextResponse(`Signature verification failed: ${msg}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
      return NextResponse.json({ received: true, skipped: "not paid" });
    }

    // Descobre o produto vinculado ao payment_link (além de carregar o thank_you customizado)
    const paymentLinkId =
      typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id ?? null;
    let produtoNome = "produto Stripe";
    let thankYouMessage: string | null = null;
    if (paymentLinkId) {
      const { data: produto } = await supabase
        .from("produtos_infoprodutor")
        .select("name, thank_you_message")
        .eq("user_id", userId)
        .eq("stripe_payment_link_id", paymentLinkId)
        .maybeSingle();
      if (!produto) {
        return NextResponse.json({ received: true, skipped: "not an infoprod product" });
      }
      const row = produto as { name: string; thank_you_message: string | null };
      produtoNome = row.name;
      thankYouMessage = row.thank_you_message ?? null;
    }

    const buyerName = session.customer_details?.name ?? "—";
    const buyerEmail = session.customer_details?.email ?? "—";
    const buyerPhone = session.customer_details?.phone ?? "";
    const amount = formatBRL(session.amount_total ?? 0);

    // Entrega (expande shipping_rate pra saber se é pickup ou envio)
    let deliveryLine = "";
    let deliverySummaryForBuyer = "";
    try {
      const full = await stripe.checkout.sessions.retrieve(session.id, {
        expand: ["shipping_cost.shipping_rate"],
      });
      const rate = full.shipping_cost?.shipping_rate;
      const rateName =
        typeof rate === "object" && rate !== null && "display_name" in rate
          ? (rate as Stripe.ShippingRate).display_name
          : null;
      if (rateName) {
        deliveryLine = `🚚 Entrega: ${rateName}`;
        deliverySummaryForBuyer = rateName;
      }
      const shipping =
        (full as Stripe.Checkout.Session & { shipping_details?: { address?: Stripe.Address | null } | null })
          .shipping_details ?? null;
      if (shipping?.address && rateName !== "Retirar na loja") {
        const addr = shipping.address;
        const line = [addr.line1, addr.line2].filter(Boolean).join(" — ");
        const cityUf = [addr.city, addr.state].filter(Boolean).join("/");
        const cep = addr.postal_code ? `CEP ${addr.postal_code}` : "";
        deliveryLine += `\n📍 ${[line, cityUf, cep].filter(Boolean).join(" · ")}`;
      }
    } catch {
      /* best-effort */
    }

    const orderShort = session.id.slice(-10).toUpperCase();

    // ── Mensagem para o vendedor ──
    const sellerLines = [
      "🎉 *Nova venda!*",
      "",
      `🛒 *Produto:* ${produtoNome}`,
      `💰 *Valor:* ${amount}`,
      "",
      `👤 *Comprador:* ${buyerName}`,
      `📧 ${buyerEmail}`,
    ];
    if (buyerPhone) sellerLines.push(`📱 ${buyerPhone}`);
    if (deliveryLine) sellerLines.push("", deliveryLine);
    sellerLines.push("", `🧾 Pedido #${orderShort}`);
    const sellerMessage = sellerLines.join("\n");

    // ── Mensagem para o comprador ──
    // Se o vendedor configurou `thank_you_message` no produto, usa essa. Senão, fallback padrão.
    const buyerBase =
      thankYouMessage && thankYouMessage.trim()
        ? thankYouMessage.trim()
        : `Olá ${buyerName !== "—" ? buyerName : ""}! 🎉\n\nObrigado pela compra de *${produtoNome}*! Seu pagamento foi aprovado com sucesso.`;

    const buyerFooter: string[] = [];
    if (deliverySummaryForBuyer) {
      buyerFooter.push(`🚚 ${deliverySummaryForBuyer}`);
    }
    buyerFooter.push(`🧾 Pedido #${orderShort}`);
    const buyerMessage = `${buyerBase}\n\n—\n${buyerFooter.join("\n")}`;

    const result = await notifyPurchase({
      userId,
      sellerMessage,
      buyerMessage,
      buyerPhone: buyerPhone || null,
    });

    if (!result.seller.ok) {
      console.error("[infoprod-webhook] notificação vendedor falhou:", result.seller.reason, {
        userId,
        sessionId: session.id,
      });
    }
    if (result.buyer && !result.buyer.ok) {
      console.error("[infoprod-webhook] notificação comprador falhou:", result.buyer.reason, {
        userId,
        sessionId: session.id,
      });
    }

    return NextResponse.json({
      received: true,
      seller: result.seller.ok,
      buyer: result.buyer ? result.buyer.ok : "skipped",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[infoprod-webhook] erro processando evento:", msg);
    return NextResponse.json({ received: true, error: msg });
  }
}
