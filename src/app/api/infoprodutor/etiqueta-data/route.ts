/**
 * Retorna os dados necessários para renderizar 1..N etiquetas de envio em um modal
 * no cliente (Correios, formato A6). Cada sessão passada é validada individualmente:
 *   - deve pertencer a um produto Stripe do usuário
 *   - deve ter shipping_details com endereço
 * Sessões inválidas retornam em `errors[]`.
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import { SHIPPING_RATE_DISPLAY_NAMES } from "@/lib/infoprod/stripe-checkout-copy";

export const dynamic = "force-dynamic";

const MAX_SESSIONS_PER_CALL = 50;

type Address = Stripe.Address;
type ShippingCollected = {
  name?: string | null;
  phone?: string | null;
  address?: Address | null;
};

type SenderProfile = {
  shipping_sender_name: string | null;
  shipping_sender_document: string | null;
  shipping_sender_phone: string | null;
  shipping_sender_cep: string | null;
  shipping_sender_street: string | null;
  shipping_sender_number: string | null;
  shipping_sender_complement: string | null;
  shipping_sender_neighborhood: string | null;
  shipping_sender_city: string | null;
  shipping_sender_uf: string | null;
};

function formatCep(cep: string | null | undefined): string {
  if (!cep) return "";
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return cep;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

function hasMinSender(s: SenderProfile | null): boolean {
  if (!s) return false;
  return !!(s.shipping_sender_name && s.shipping_sender_cep && s.shipping_sender_city && s.shipping_sender_uf);
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const raw = Array.isArray(body?.sessionIds) ? body.sessionIds : [];
    const sessionIds = Array.from(
      new Set(raw.map((x: unknown) => String(x).trim()).filter(Boolean)),
    ) as string[];
    if (sessionIds.length === 0) {
      return NextResponse.json({ error: "sessionIds é obrigatório" }, { status: 400 });
    }
    if (sessionIds.length > MAX_SESSIONS_PER_CALL) {
      return NextResponse.json(
        { error: `Máximo de ${MAX_SESSIONS_PER_CALL} etiquetas por impressão.` },
        { status: 400 },
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "stripe_secret_key, shipping_sender_name, shipping_sender_document, shipping_sender_phone, shipping_sender_cep, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf",
      )
      .eq("id", user.id)
      .single();

    const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
    if (!stripeKey.trim()) {
      return NextResponse.json({ error: "Conta Stripe não conectada." }, { status: 400 });
    }
    const sender = (profile ?? null) as SenderProfile | null;
    const senderValid = hasMinSender(sender);

    // Produtos Stripe do usuário (para validar o vínculo pelo payment_link)
    const { data: produtosRows } = await supabase
      .from("produtos_infoprodutor")
      .select("id, name, stripe_payment_link_id")
      .eq("user_id", user.id)
      .eq("provider", "stripe");
    const allowedPaymentLinks = new Map<string, { id: string; name: string }>();
    for (const p of produtosRows ?? []) {
      const row = p as { id: string; name: string; stripe_payment_link_id: string | null };
      if (row.stripe_payment_link_id) {
        allowedPaymentLinks.set(row.stripe_payment_link_id, { id: row.id, name: row.name });
      }
    }

    const stripe = new Stripe(stripeKey);

    const etiquetas: Array<{
      sessionId: string;
      orderNumber: string;
      dateLabel: string;
      amount: number;
      productName: string;
      receiver: {
        name: string;
        phone: string | null;
        line1: string;
        line2: string | null;
        neighborhood: string | null;
        city: string;
        state: string;
        postalCode: string;
      };
    }> = [];
    const errors: { sessionId: string; reason: string }[] = [];

    // Consulta cada sessão em paralelo (limitado ao cap acima). Expandimos
    // shipping_cost.shipping_rate para detectar pickups e pulá-los.
    const results = await Promise.allSettled(
      sessionIds.map((id) =>
        stripe.checkout.sessions.retrieve(id, { expand: ["shipping_cost.shipping_rate"] }),
      ),
    );

    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      const r = results[i];
      if (r.status === "rejected") {
        errors.push({ sessionId, reason: "Pedido não encontrado na Stripe" });
        continue;
      }
      const s = r.value;
      const plink = typeof s.payment_link === "string" ? s.payment_link : s.payment_link?.id;
      if (!plink || !allowedPaymentLinks.has(plink)) {
        errors.push({ sessionId, reason: "Pedido não pertence a um produto seu" });
        continue;
      }

      // Pickup não precisa de etiqueta — pula com mensagem clara.
      const shippingRate =
        s.shipping_cost && typeof s.shipping_cost === "object" && s.shipping_cost.shipping_rate
          ? s.shipping_cost.shipping_rate
          : null;
      const shippingRateName =
        typeof shippingRate === "object" && shippingRate !== null && "display_name" in shippingRate
          ? (shippingRate as Stripe.ShippingRate).display_name
          : null;
      if (shippingRateName === SHIPPING_RATE_DISPLAY_NAMES.pickup) {
        errors.push({ sessionId, reason: "Retirada na loja — não precisa etiqueta" });
        continue;
      }

      const anySession = s as Stripe.Checkout.Session & {
        shipping_details?: ShippingCollected | null;
        collected_information?: { shipping_details?: ShippingCollected | null } | null;
      };
      const shipping: ShippingCollected | null =
        anySession.collected_information?.shipping_details ?? anySession.shipping_details ?? null;
      if (!shipping?.address) {
        errors.push({ sessionId, reason: "Pedido sem endereço de entrega" });
        continue;
      }
      const addr = shipping.address;
      const productName = allowedPaymentLinks.get(plink)!.name;
      const receiverLine1 = [addr.line1, addr.line2].filter(Boolean).join(" — ");
      const createdAt = new Date((s.created ?? 0) * 1000);

      etiquetas.push({
        sessionId: s.id,
        orderNumber: s.id.slice(-10).toUpperCase(),
        dateLabel: createdAt.toLocaleDateString("pt-BR"),
        amount: (s.amount_total ?? 0) / 100,
        productName,
        receiver: {
          name: shipping.name ?? s.customer_details?.name ?? "—",
          phone: shipping.phone ?? s.customer_details?.phone ?? null,
          line1: receiverLine1 || "—",
          line2: null,
          neighborhood: null,
          city: addr.city ?? "",
          state: addr.state ?? "",
          postalCode: formatCep(addr.postal_code),
        },
      });
    }

    return NextResponse.json({
      senderValid,
      sender: sender
        ? {
            name: sender.shipping_sender_name ?? "",
            document: sender.shipping_sender_document ?? "",
            phone: sender.shipping_sender_phone ?? "",
            cep: formatCep(sender.shipping_sender_cep),
            street: sender.shipping_sender_street ?? "",
            number: sender.shipping_sender_number ?? "",
            complement: sender.shipping_sender_complement ?? "",
            neighborhood: sender.shipping_sender_neighborhood ?? "",
            city: sender.shipping_sender_city ?? "",
            uf: sender.shipping_sender_uf ?? "",
          }
        : null,
      etiquetas,
      errors,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
