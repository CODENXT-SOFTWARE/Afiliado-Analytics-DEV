/**
 * Lista pedidos Stripe do usuário, com dados do comprador e endereço de entrega.
 * - Usa checkout.sessions.list → filtra pelas que vieram de payment_links nossos
 * - Cruza com `produtos_infoprodutor` (provider='stripe')
 * - Para refunds, consulta `charge.refunded` via payment_intent expandido
 *
 * Query params: ?period=7d|30d|90d|all&produtoId=uuid (opcional)
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import { SHIPPING_RATE_DISPLAY_NAMES } from "@/lib/infoprod/stripe-checkout-copy";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d" | "all";

function periodStartSeconds(period: Period): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return Math.floor(Date.now() / 1000) - days * 24 * 60 * 60;
}

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const periodRaw = String(url.searchParams.get("period") ?? "30d").trim().toLowerCase();
    const period: Period = (["7d", "30d", "90d", "all"] as Period[]).includes(periodRaw as Period)
      ? (periodRaw as Period)
      : "30d";
    const produtoIdFilter = (url.searchParams.get("produtoId") ?? "").trim() || null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key")
      .eq("id", user.id)
      .single();
    const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
    if (!stripeKey.trim()) {
      return NextResponse.json({ error: "Conta Stripe não conectada." }, { status: 400 });
    }

    const { data: produtosRows } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, image_url, stripe_payment_link_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe");

    type ProdInfo = { id: string; name: string; imageUrl: string | null };
    const byPaymentLink = new Map<string, ProdInfo>();
    for (const p of produtosRows ?? []) {
      const row = p as { id: string; name: string; image_url: string | null; stripe_payment_link_id: string | null };
      if (row.stripe_payment_link_id) {
        byPaymentLink.set(row.stripe_payment_link_id, {
          id: row.id,
          name: row.name,
          imageUrl: row.image_url,
        });
      }
    }

    if (byPaymentLink.size === 0) {
      return NextResponse.json({ period, orders: [], fetchedAt: new Date().toISOString() });
    }

    const stripe = new Stripe(stripeKey);
    const gte = periodStartSeconds(period);

    const sessions: Stripe.Checkout.Session[] = [];
    let startingAfter: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const params: Stripe.Checkout.SessionListParams = {
        limit: 100,
        expand: ["data.shipping_cost.shipping_rate"],
        ...(gte != null ? { created: { gte } } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      };
      const page = await stripe.checkout.sessions.list(params);
      for (const s of page.data) {
        if (s.status !== "complete") continue;
        if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") continue;
        const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
        if (!plink || !byPaymentLink.has(plink)) continue;
        const prod = byPaymentLink.get(plink)!;
        if (produtoIdFilter && prod.id !== produtoIdFilter) continue;
        sessions.push(s);
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
      if (!startingAfter) break;
    }

    // Ordena por data desc
    sessions.sort((a, b) => b.created - a.created);

    // Mapa PI → refunded_cents (busca refunds no mesmo período)
    const piToRefund = new Map<string, number>();
    const ourPIs = new Set<string>();
    for (const s of sessions) {
      const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
      if (piId) ourPIs.add(piId);
    }
    if (ourPIs.size > 0) {
      let refundAfter: string | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const page = await stripe.refunds.list({
          limit: 100,
          ...(gte != null ? { created: { gte } } : {}),
          ...(refundAfter ? { starting_after: refundAfter } : {}),
        });
        for (const r of page.data) {
          if (r.status !== "succeeded") continue;
          const piId = typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id;
          if (!piId || !ourPIs.has(piId)) continue;
          piToRefund.set(piId, (piToRefund.get(piId) ?? 0) + (r.amount ?? 0));
        }
        if (!page.has_more) break;
        refundAfter = page.data[page.data.length - 1]?.id;
        if (!refundAfter) break;
      }
    }

    // Checkout Session em versões recentes expõe shipping em `collected_information.shipping_details`;
    // em versões mais antigas, em `shipping_details`. Tentamos ambos.
    type AnySession = Stripe.Checkout.Session & {
      shipping_details?: {
        name?: string | null;
        phone?: string | null;
        address?: Stripe.Address | null;
      } | null;
      collected_information?: {
        shipping_details?: {
          name?: string | null;
          phone?: string | null;
          address?: Stripe.Address | null;
        } | null;
      } | null;
    };

    const orders = sessions.map((sRaw) => {
      const s = sRaw as AnySession;
      const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
      const prod = plink ? byPaymentLink.get(plink) ?? null : null;

      const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
      const refundedCents = piId ? piToRefund.get(piId) ?? 0 : 0;

      const shippingRaw = s.collected_information?.shipping_details ?? s.shipping_details ?? null;

      // Detecta modo de entrega escolhido pelo comprador via display_name do ShippingRate.
      const shippingRate =
        s.shipping_cost && typeof s.shipping_cost === "object" && s.shipping_cost.shipping_rate
          ? s.shipping_cost.shipping_rate
          : null;
      const shippingRateName =
        typeof shippingRate === "object" && shippingRate !== null && "display_name" in shippingRate
          ? (shippingRate as Stripe.ShippingRate).display_name
          : null;
      const deliveryType: "shipping" | "pickup" | "unknown" =
        shippingRateName === SHIPPING_RATE_DISPLAY_NAMES.pickup
          ? "pickup"
          : shippingRateName === SHIPPING_RATE_DISPLAY_NAMES.shipping
            ? "shipping"
            : shippingRaw?.address
              ? "shipping"
              : "unknown";

      return {
        sessionId: s.id,
        paymentIntentId: piId,
        createdAt: new Date(s.created * 1000).toISOString(),
        amount: (s.amount_total ?? 0) / 100,
        currency: (s.currency ?? "brl").toUpperCase(),
        refunded: refundedCents / 100,
        status: refundedCents > 0 ? (refundedCents >= (s.amount_total ?? 0) ? "refunded" : "partially_refunded") : "paid",
        produto: prod,
        deliveryType,
        customer: {
          name: s.customer_details?.name ?? null,
          email: s.customer_details?.email ?? null,
          phone: s.customer_details?.phone ?? null,
        },
        shipping: shippingRaw
          ? {
              name: shippingRaw.name ?? null,
              phone: shippingRaw.phone ?? null,
              address: shippingRaw.address
                ? {
                    line1: shippingRaw.address.line1 ?? null,
                    line2: shippingRaw.address.line2 ?? null,
                    city: shippingRaw.address.city ?? null,
                    state: shippingRaw.address.state ?? null,
                    postalCode: shippingRaw.address.postal_code ?? null,
                    country: shippingRaw.address.country ?? null,
                  }
                : null,
            }
          : null,
      };
    });

    return NextResponse.json({
      period,
      orders,
      fetchedAt: new Date().toISOString(),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
