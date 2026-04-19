/**
 * Endereço do remetente — usado pra gerar etiquetas de envio dos pedidos Stripe.
 * Todos os campos opcionais, mas o card da UI pede preenchimento mínimo antes
 * de liberar a impressão da etiqueta (nome/CEP/endereço/cidade/UF).
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase-server";
import {
  toWhatsAppUrl,
  buildPaymentLinkCustomText,
  buildAfterCompletion,
  buildStripeProductDescription,
  formatSenderAddressShort,
  type SenderSnapshot,
  type DeliveryMode,
} from "@/lib/infoprod/stripe-checkout-copy";

export const dynamic = "force-dynamic";

const FIELDS = [
  "shipping_sender_name",
  "shipping_sender_document",
  "shipping_sender_phone",
  "shipping_sender_whatsapp",
  "shipping_sender_cep",
  "shipping_sender_street",
  "shipping_sender_number",
  "shipping_sender_complement",
  "shipping_sender_neighborhood",
  "shipping_sender_city",
  "shipping_sender_uf",
] as const;

type Field = (typeof FIELDS)[number];

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select(FIELDS.join(", "))
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  const row = (data ?? {}) as unknown as Record<string, string | null>;
  const out: Record<Field, string> = {} as Record<Field, string>;
  for (const f of FIELDS) out[f] = row[f] ?? "";
  return NextResponse.json(out);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const patch: Record<string, string | null> = {};
  for (const f of FIELDS) {
    const v = typeof body?.[f] === "string" ? (body[f] as string).trim() : "";
    patch[f] = v || null;
  }

  // UF sempre 2 letras maiúsculas se informada
  if (patch.shipping_sender_uf) {
    patch.shipping_sender_uf = patch.shipping_sender_uf.toUpperCase().slice(0, 2);
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  // Sincroniza o WhatsApp em todos os Payment Links InfoP do usuário (best-effort).
  // Se a chave Stripe não estiver conectada ou algum produto falhar, não bloqueia o salvamento.
  const syncResult = await syncPaymentLinksForUser(supabase, user.id, patch);

  return NextResponse.json({ ok: true, syncResult });
}

async function syncPaymentLinksForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  patch: Record<string, string | null>,
): Promise<{ synced: number; skipped: number; failed: number } | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_secret_key")
    .eq("id", userId)
    .single();
  const stripeKey = (profile as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? "";
  if (!stripeKey.trim()) return null;

  const { data: produtos } = await supabase
    .from("produtos_infoprodutor")
    .select("id, description, stripe_product_id, stripe_payment_link_id, allow_shipping, allow_pickup")
    .eq("user_id", userId)
    .eq("provider", "stripe")
    .not("stripe_payment_link_id", "is", null);
  const rows = (produtos ?? []) as Array<{
    id: string;
    description: string | null;
    stripe_product_id: string | null;
    stripe_payment_link_id: string | null;
    allow_shipping: boolean | null;
    allow_pickup: boolean | null;
  }>;
  if (rows.length === 0) return { synced: 0, skipped: 0, failed: 0 };

  const waUrl = toWhatsAppUrl(patch.shipping_sender_whatsapp ?? null);
  const senderSnapshot: SenderSnapshot = {
    street: patch.shipping_sender_street ?? null,
    number: patch.shipping_sender_number ?? null,
    complement: patch.shipping_sender_complement ?? null,
    neighborhood: patch.shipping_sender_neighborhood ?? null,
    city: patch.shipping_sender_city ?? null,
    uf: patch.shipping_sender_uf ?? null,
  };
  const senderAddress = formatSenderAddressShort(senderSnapshot);
  const stripe = new Stripe(stripeKey);

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const mode: DeliveryMode = {
        allowShipping: row.allow_shipping !== false,
        allowPickup: row.allow_pickup === true,
      };

      // 1) Atualiza custom_text do Payment Link
      if (row.stripe_payment_link_id) {
        const updatePayload: Stripe.PaymentLinkUpdateParams = {};
        const customText = buildPaymentLinkCustomText(waUrl, mode, senderAddress);
        updatePayload.custom_text = customText ?? { submit: { message: "" } };
        const afterCompletion = buildAfterCompletion(waUrl, mode, senderAddress);
        if (afterCompletion) {
          updatePayload.after_completion = afterCompletion;
        }
        await stripe.paymentLinks.update(row.stripe_payment_link_id, updatePayload);
      }

      // 2) Atualiza description do Product (linha CTA WhatsApp preservando descrição original)
      if (row.stripe_product_id) {
        const newDesc = buildStripeProductDescription(row.description, waUrl);
        await stripe.products.update(row.stripe_product_id, {
          description: newDesc ?? undefined,
        });
      }

      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, skipped: 0, failed };
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patch: Record<Field, null> = {} as Record<Field, null>;
  for (const f of FIELDS) patch[f] = null;

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
