/**
 * Métricas de vendas dos produtos Stripe do usuário.
 * - Live query: cada chamada consulta a Stripe diretamente (sem cache/webhooks por ora).
 * - Mapeamento produto: cruzamos pelo `payment_link` da sessão com o `stripe_payment_link_id`
 *   salvo em `produtos_infoprodutor` — assim só contamos vendas originadas por produtos
 *   criados dentro do Afiliado Analytics (ignora produtos avulsos da Stripe).
 *
 * Responde agregado: totais, detalhamento por dia, top produtos.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d" | "all";

function periodStartSeconds(period: Period): number | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const now = Math.floor(Date.now() / 1000);
  return now - days * 24 * 60 * 60;
}

function isoDateUTC(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString().slice(0, 10);
}

function buildDailySeries(fromSec: number, toSec: number): string[] {
  const dates: string[] = [];
  const fromDay = new Date(fromSec * 1000);
  fromDay.setUTCHours(0, 0, 0, 0);
  const toDay = new Date(toSec * 1000);
  toDay.setUTCHours(0, 0, 0, 0);
  for (let t = fromDay.getTime(); t <= toDay.getTime(); t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  return dates;
}

export async function GET(req: Request) {
  try {
    const gate = await gateInfoprodutor();
    if (!gate.allowed) return gate.response;
    const supabase = await createClient();

    const url = new URL(req.url);
    const periodRaw = String(url.searchParams.get("period") ?? "30d").trim().toLowerCase();
    const period: Period = (["7d", "30d", "90d", "all"] as Period[]).includes(periodRaw as Period)
      ? (periodRaw as Period)
      : "30d";

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_secret_key")
      .eq("id", gate.userId)
      .single();
    const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
    if (!stripeKey.trim()) {
      return NextResponse.json(
        { error: "Conta Stripe não conectada. Conecte em Configurações." },
        { status: 400 },
      );
    }

    const { data: produtos } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, image_url, stripe_payment_link_id")
      .eq("user_id", gate.userId)
      .eq("provider", "stripe");

    type ProdInfo = { id: string; name: string; imageUrl: string | null };
    const byPaymentLink = new Map<string, ProdInfo>();
    const byProductId = new Map<string, ProdInfo>();
    for (const p of produtos ?? []) {
      const row = p as { id: string; name: string; image_url: string | null; stripe_payment_link_id: string | null };
      const info: ProdInfo = { id: row.id, name: row.name, imageUrl: row.image_url };
      byProductId.set(row.id, info);
      if (row.stripe_payment_link_id) {
        byPaymentLink.set(row.stripe_payment_link_id, info);
      }
    }

    if (byProductId.size === 0) {
      return NextResponse.json({
        period,
        summary: {
          totalRevenue: 0,
          totalSales: 0,
          avgTicket: 0,
          totalRefunded: 0,
          refundRate: 0,
          uniqueCustomers: 0,
        },
        byDay: [],
        topProducts: [],
        fetchedAt: new Date().toISOString(),
        hasProducts: false,
      });
    }

    const stripe = new Stripe(stripeKey);
    const gte = periodStartSeconds(period);
    const now = Math.floor(Date.now() / 1000);

    // ── Sessions concluídas no período ────────────────────────────────────────
    const sessions: Stripe.Checkout.Session[] = [];
    let startingAfter: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const params: Stripe.Checkout.SessionListParams = {
        limit: 100,
        ...(gte != null ? { created: { gte } } : {}),
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      };
      const page = await stripe.checkout.sessions.list(params);
      for (const s of page.data) {
        if (s.status !== "complete") continue;
        if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") continue;
        const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
        if (!plink || !byPaymentLink.has(plink)) continue;
        sessions.push(s);
      }
      if (!page.has_more) break;
      startingAfter = page.data[page.data.length - 1]?.id;
      if (!startingAfter) break;
    }

    // IDs dos payment_intents que originamos (para filtrar refunds relevantes)
    const ourPaymentIntentIds = new Set<string>();
    for (const s of sessions) {
      const piId = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id;
      if (piId) ourPaymentIntentIds.add(piId);
    }

    // ── PaymentIntents do nosso checkout inline (fluxo novo, sem Checkout Session) ──
    // Nosso payment-intent route grava metadata.produto_id. Listamos todos os PIs do período
    // e filtramos client-side por essa marca + match com nossos produtos.
    type PiSale = {
      id: string;
      amount: number;
      created: number;
      email: string | null;
      produtoId: string;
    };
    const piSales: PiSale[] = [];
    let piAfter: string | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const params: Stripe.PaymentIntentListParams = {
        limit: 100,
        ...(gte != null ? { created: { gte } } : {}),
        ...(piAfter ? { starting_after: piAfter } : {}),
      };
      const page = await stripe.paymentIntents.list(params);
      for (const pi of page.data) {
        if (pi.status !== "succeeded") continue;
        const produtoId = typeof pi.metadata?.produto_id === "string" ? pi.metadata.produto_id : "";
        if (!produtoId || !byProductId.has(produtoId)) continue;
        // Evita contar 2x quando o PI veio de uma Checkout Session nossa (já contabilizada acima)
        if (ourPaymentIntentIds.has(pi.id)) continue;
        const email =
          typeof pi.receipt_email === "string" && pi.receipt_email
            ? pi.receipt_email
            : null;
        piSales.push({
          id: pi.id,
          amount: pi.amount_received ?? pi.amount ?? 0,
          created: pi.created,
          email,
          produtoId,
        });
        ourPaymentIntentIds.add(pi.id);
      }
      if (!page.has_more) break;
      piAfter = page.data[page.data.length - 1]?.id;
      if (!piAfter) break;
    }

    // ── Refunds no período ────────────────────────────────────────────────────
    let totalRefunded = 0;
    if (ourPaymentIntentIds.size > 0) {
      let refundAfter: string | undefined;
      for (let guard = 0; guard < 50; guard++) {
        const params: Stripe.RefundListParams = {
          limit: 100,
          ...(gte != null ? { created: { gte } } : {}),
          ...(refundAfter ? { starting_after: refundAfter } : {}),
        };
        const page = await stripe.refunds.list(params);
        for (const r of page.data) {
          if (r.status !== "succeeded") continue;
          const piId = typeof r.payment_intent === "string" ? r.payment_intent : r.payment_intent?.id;
          if (!piId || !ourPaymentIntentIds.has(piId)) continue;
          totalRefunded += r.amount ?? 0;
        }
        if (!page.has_more) break;
        refundAfter = page.data[page.data.length - 1]?.id;
        if (!refundAfter) break;
      }
    }

    // ── Agregações ─────────────────────────────────────────────────────────────
    let totalRevenueCents = 0;
    const customers = new Set<string>();
    const dayMap = new Map<string, { revenueCents: number; sales: number }>();
    const productAgg = new Map<string, { produtoId: string; name: string; imageUrl: string | null; sales: number; revenueCents: number }>();

    for (const s of sessions) {
      const amount = s.amount_total ?? 0;
      totalRevenueCents += amount;

      const email = s.customer_details?.email ?? (typeof s.customer === "string" ? s.customer : s.customer?.id);
      if (email) customers.add(email);

      const day = isoDateUTC(s.created);
      const dayRow = dayMap.get(day) ?? { revenueCents: 0, sales: 0 };
      dayRow.revenueCents += amount;
      dayRow.sales += 1;
      dayMap.set(day, dayRow);

      const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
      if (plink) {
        const info = byPaymentLink.get(plink);
        if (info) {
          const agg = productAgg.get(info.id) ?? {
            produtoId: info.id,
            name: info.name,
            imageUrl: info.imageUrl,
            sales: 0,
            revenueCents: 0,
          };
          agg.sales += 1;
          agg.revenueCents += amount;
          productAgg.set(info.id, agg);
        }
      }
    }

    // Incorpora vendas via PaymentIntent (checkout inline)
    for (const pi of piSales) {
      totalRevenueCents += pi.amount;
      if (pi.email) customers.add(pi.email);

      const day = isoDateUTC(pi.created);
      const dayRow = dayMap.get(day) ?? { revenueCents: 0, sales: 0 };
      dayRow.revenueCents += pi.amount;
      dayRow.sales += 1;
      dayMap.set(day, dayRow);

      const info = byProductId.get(pi.produtoId);
      if (info) {
        const agg = productAgg.get(info.id) ?? {
          produtoId: info.id,
          name: info.name,
          imageUrl: info.imageUrl,
          sales: 0,
          revenueCents: 0,
        };
        agg.sales += 1;
        agg.revenueCents += pi.amount;
        productAgg.set(info.id, agg);
      }
    }

    const totalRevenue = totalRevenueCents / 100;
    const totalRefundedAmt = totalRefunded / 100;
    const totalSales = sessions.length + piSales.length;
    const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;
    const refundRate = totalRevenue > 0 ? totalRefundedAmt / totalRevenue : 0;

    // Série diária contínua (com gaps = 0)
    const allCreated = [
      ...sessions.map((s) => s.created),
      ...piSales.map((p) => p.created),
    ];
    const fromSec = gte ?? (allCreated.length > 0 ? Math.min(...allCreated) : now);
    const days = buildDailySeries(fromSec, now);
    const byDay = days.map((date) => {
      const row = dayMap.get(date);
      return {
        date,
        revenue: (row?.revenueCents ?? 0) / 100,
        sales: row?.sales ?? 0,
      };
    });

    const topProducts = Array.from(productAgg.values())
      .map((p) => ({
        produtoId: p.produtoId,
        name: p.name,
        imageUrl: p.imageUrl,
        sales: p.sales,
        revenue: p.revenueCents / 100,
        avgTicket: p.sales > 0 ? p.revenueCents / 100 / p.sales : 0,
        share: totalRevenue > 0 ? p.revenueCents / 100 / totalRevenue : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    return NextResponse.json({
      period,
      summary: {
        totalRevenue,
        totalSales,
        avgTicket,
        totalRefunded: totalRefundedAmt,
        refundRate,
        uniqueCustomers: customers.size,
      },
      byDay,
      topProducts,
      fetchedAt: new Date().toISOString(),
      hasProducts: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
