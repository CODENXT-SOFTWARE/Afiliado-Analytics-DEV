/**
 * Lista pagamentos Mercado Pago do vendedor, filtrados pelos produtos
 * Infoprodutor (`external_reference = "infoprod:{uuid}"`).
 *
 *   GET /api/infoprodutor/mp-payments?period=7d|30d|90d|all&produtoId=uuid
 *
 * Estratégia: chama `searchMpPayments` paginando até esgotar OU bater limite
 * defensivo (50 páginas × 100 = 5000 pagamentos), e cruza `external_reference`
 * com a tabela `produtos_infoprodutor`.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";
import { searchMpPayments, type MpPayment } from "@/lib/mercadopago/api";

export const dynamic = "force-dynamic";

type Period = "7d" | "30d" | "90d" | "all";

function periodStartIso(period: Period): string | undefined {
  if (period === "all") return undefined;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

type ProdInfo = { id: string; name: string; imageUrl: string | null };

function parseExternalReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const m = /^infoprod:([0-9a-f-]{36})$/i.exec(ref.trim());
  return m ? m[1] : null;
}

function deliveryFromMetadata(meta: Record<string, unknown> | undefined): {
  type: "shipping" | "pickup" | "digital" | "local_delivery" | "unknown";
  name: string | null;
} {
  const mode = typeof meta?.delivery_mode === "string" ? meta.delivery_mode : "";
  const name = typeof meta?.shipping_name === "string" ? meta.shipping_name : null;
  if (mode === "shipping" || mode === "pickup" || mode === "digital" || mode === "local_delivery") {
    return { type: mode, name };
  }
  return { type: "unknown", name };
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
    const produtoIdFilter = (url.searchParams.get("produtoId") ?? "").trim() || null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("mp_access_token")
      .eq("id", gate.userId)
      .single();
    const accessToken =
      (profile as { mp_access_token?: string | null } | null)?.mp_access_token?.trim() ?? "";
    if (!accessToken) {
      return NextResponse.json({ error: "Conta Mercado Pago não conectada." }, { status: 400 });
    }

    const { data: produtosRows } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, image_url")
      .eq("user_id", gate.userId)
      .eq("provider", "mercadopago");

    const byProductId = new Map<string, ProdInfo>();
    for (const p of produtosRows ?? []) {
      const row = p as { id: string; name: string; image_url: string | null };
      byProductId.set(row.id, { id: row.id, name: row.name, imageUrl: row.image_url });
    }

    if (byProductId.size === 0) {
      return NextResponse.json({ period, payments: [], fetchedAt: new Date().toISOString() });
    }

    const beginDate = periodStartIso(period);
    const matched: MpPayment[] = [];
    let offset = 0;
    const PAGE_SIZE = 100;
    const MAX_PAGES = 50;
    for (let i = 0; i < MAX_PAGES; i++) {
      const page = await searchMpPayments(
        { begin_date: beginDate, limit: PAGE_SIZE, offset },
        accessToken,
      );
      const results = page.results ?? [];
      for (const p of results) {
        const produtoId = parseExternalReference(p.external_reference);
        if (!produtoId || !byProductId.has(produtoId)) continue;
        if (produtoIdFilter && produtoId !== produtoIdFilter) continue;
        matched.push(p);
      }
      if (results.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
      if (offset >= (page.paging?.total ?? Infinity)) break;
    }

    const payments = matched.map((p) => {
      const produtoId = parseExternalReference(p.external_reference) ?? "";
      const prod = byProductId.get(produtoId) ?? null;
      const meta = (p.metadata ?? {}) as Record<string, unknown>;
      const delivery = deliveryFromMetadata(meta);

      // Preferimos os dados que coletamos no nosso checkout (gravados em
      // metadata), porque pra PIX/Boleto o Brick não preenche `payer.first_name`
      // nem `phone`. Caímos em `payer.*` quando metadata estiver ausente
      // (pagamentos antigos ou checkouts manuais).
      const metaName = typeof meta.buyer_name === "string" ? meta.buyer_name.trim() : "";
      const metaWhatsapp = typeof meta.buyer_whatsapp === "string" ? meta.buyer_whatsapp.trim() : "";
      const metaEmail = typeof meta.buyer_email === "string" ? meta.buyer_email.trim() : "";

      const payerNameJoined = [p.payer?.first_name ?? "", p.payer?.last_name ?? ""]
        .filter(Boolean)
        .join(" ")
        .trim();
      const buyerName = metaName || payerNameJoined || null;
      const buyerEmail = metaEmail || p.payer?.email || null;
      const buyerPhone = (() => {
        if (metaWhatsapp) return metaWhatsapp;
        const phone = p.payer?.phone ?? p.additional_info?.payer?.phone;
        if (!phone) return null;
        return `${phone.area_code ?? ""}${phone.number ?? ""}`.trim() || null;
      })();

      const recv = p.additional_info?.shipments?.receiver_address as
        | { street_name?: string; street_number?: string; city_name?: string; state_name?: string; zip_code?: string }
        | undefined;
      const shippingAddress = recv
        ? {
            line1: [recv.street_name, recv.street_number].filter(Boolean).join(", ") || null,
            city: recv.city_name ?? null,
            state: recv.state_name ?? null,
            postalCode: recv.zip_code ?? null,
          }
        : null;

      return {
        paymentId: String(p.id),
        createdAt: p.date_created ?? null,
        approvedAt: p.date_approved ?? null,
        amount: typeof p.transaction_amount === "number" ? p.transaction_amount : 0,
        currency: (p.currency_id ?? "BRL").toUpperCase(),
        status: p.status,
        statusDetail: p.status_detail ?? null,
        produto: prod,
        delivery,
        customer: { name: buyerName, email: buyerEmail, phone: buyerPhone },
        shippingAddress,
      };
    });

    return NextResponse.json({ period, payments, fetchedAt: new Date().toISOString() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao listar pagamentos";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
