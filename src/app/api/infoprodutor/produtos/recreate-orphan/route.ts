/**
 * Recria um produto "órfão" na conta Stripe atualmente conectada.
 *
 * Contexto: quando o usuário troca a chave Stripe por uma chave de outra conta,
 * os produtos criados na conta anterior ficam órfãos — nossa DB aponta pra
 * `stripe_product_id` que não existe na conta nova. Esta rota:
 *
 *   1. Lê o produto da DB (nome, descrição, preço, subid, modos de entrega, etc.)
 *   2. Cria product + price + ShippingRates + paymentLink na conta Stripe atual
 *   3. Atualiza a linha na DB com os NOVOS IDs e o account_id atual
 *
 * NÃO apagamos nada na conta antiga (não temos mais a chave). O produto
 * continua existindo lá no painel Stripe antigo — o usuário pode arquivar
 * manualmente se quiser.
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
  SHIPPING_RATE_DISPLAY_NAMES,
  type SenderSnapshot,
  type DeliveryMode,
} from "@/lib/infoprod/stripe-checkout-copy";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    // 1) Produto na DB
    const { data: produto, error: loadError } = await supabase
      .from("produtos_infoprodutor")
      .select(
        "id, user_id, provider, name, description, image_url, price, price_old, stripe_subid, stripe_account_id, allow_shipping, allow_pickup, shipping_cost",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as {
      provider: string;
      name: string;
      description: string | null;
      image_url: string | null;
      price: number | string | null;
      price_old: number | string | null;
      stripe_subid: string | null;
      stripe_account_id: string | null;
      allow_shipping: boolean | null;
      allow_pickup: boolean | null;
      shipping_cost: number | string | null;
    };
    if (row.provider !== "stripe") {
      return NextResponse.json({ error: "Só produtos Stripe podem ser recriados." }, { status: 400 });
    }
    const price = row.price == null ? null : Number(row.price);
    if (price == null || !Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Produto sem preço válido — edite e tente novamente." }, { status: 400 });
    }

    // 2) Chave + account atual + remetente (pra custom_text/pickup/description)
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "stripe_secret_key, stripe_account_id, shipping_sender_whatsapp, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf",
      )
      .eq("id", user.id)
      .single();
    const profileRow = profile as
      | {
          stripe_secret_key?: string | null;
          stripe_account_id?: string | null;
          shipping_sender_whatsapp?: string | null;
          shipping_sender_street?: string | null;
          shipping_sender_number?: string | null;
          shipping_sender_complement?: string | null;
          shipping_sender_neighborhood?: string | null;
          shipping_sender_city?: string | null;
          shipping_sender_uf?: string | null;
        }
      | null;
    const stripeKey = profileRow?.stripe_secret_key ?? "";
    const currentAccountId = profileRow?.stripe_account_id ?? null;
    if (!stripeKey.trim()) {
      return NextResponse.json({ error: "Conta Stripe não conectada." }, { status: 400 });
    }

    // Só faz sentido recriar se for realmente órfão
    if (row.stripe_account_id && currentAccountId && row.stripe_account_id === currentAccountId) {
      return NextResponse.json(
        { error: "Este produto já está na conta Stripe atual — não é órfão." },
        { status: 400 },
      );
    }

    const waUrl = toWhatsAppUrl(profileRow?.shipping_sender_whatsapp ?? null);
    const senderSnapshot: SenderSnapshot = {
      street: profileRow?.shipping_sender_street ?? null,
      number: profileRow?.shipping_sender_number ?? null,
      complement: profileRow?.shipping_sender_complement ?? null,
      neighborhood: profileRow?.shipping_sender_neighborhood ?? null,
      city: profileRow?.shipping_sender_city ?? null,
      uf: profileRow?.shipping_sender_uf ?? null,
    };
    const senderAddress = formatSenderAddressShort(senderSnapshot);

    const allowShipping = row.allow_shipping !== false;
    const allowPickup = row.allow_pickup === true;
    const shippingCost = row.shipping_cost == null ? 0 : Number(row.shipping_cost);
    const mode: DeliveryMode = { allowShipping, allowPickup };

    if (allowPickup && !senderAddress) {
      return NextResponse.json(
        {
          error:
            "Produto com retirada ativa mas endereço do remetente vazio. Preencha em Configurações antes de recriar.",
        },
        { status: 400 },
      );
    }

    // 3) Cria tudo novo na conta atual
    const stripe = new Stripe(stripeKey);

    const stripeDescription = buildStripeProductDescription(row.description, waUrl);
    const newProduct = await stripe.products.create({
      name: row.name,
      description: stripeDescription ?? undefined,
      images: row.image_url ? [row.image_url] : undefined,
    });

    const newPrice = await stripe.prices.create({
      product: newProduct.id,
      currency: "brl",
      unit_amount: Math.round(price * 100),
    });

    const shippingRateIds: string[] = [];
    if (allowShipping) {
      const rate = await stripe.shippingRates.create({
        display_name: SHIPPING_RATE_DISPLAY_NAMES.shipping,
        type: "fixed_amount",
        fixed_amount: { amount: Math.round(shippingCost * 100), currency: "brl" },
      });
      shippingRateIds.push(rate.id);
    }
    if (allowPickup) {
      const rate = await stripe.shippingRates.create({
        display_name: SHIPPING_RATE_DISPLAY_NAMES.pickup,
        type: "fixed_amount",
        fixed_amount: { amount: 0, currency: "brl" },
      });
      shippingRateIds.push(rate.id);
    }

    const customText = buildPaymentLinkCustomText(waUrl, mode, senderAddress);
    const afterCompletion = buildAfterCompletion(waUrl, mode, senderAddress);
    const newLink = await stripe.paymentLinks.create({
      line_items: [{ price: newPrice.id, quantity: 1 }],
      ...(allowShipping ? { shipping_address_collection: { allowed_countries: ["BR"] } } : {}),
      phone_number_collection: { enabled: true },
      ...(shippingRateIds.length > 0
        ? { shipping_options: shippingRateIds.map((rateId) => ({ shipping_rate: rateId })) }
        : {}),
      ...(customText ? { custom_text: customText } : {}),
      ...(afterCompletion ? { after_completion: afterCompletion } : {}),
    });

    // 4) Atualiza DB apontando pros novos IDs + novo account
    const { data: updated, error: updateError } = await supabase
      .from("produtos_infoprodutor")
      .update({
        link: newLink.url,
        stripe_product_id: newProduct.id,
        stripe_price_id: newPrice.id,
        stripe_payment_link_id: newLink.id,
        stripe_account_id: currentAccountId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, link, stripe_product_id, stripe_price_id, stripe_payment_link_id, stripe_account_id")
      .maybeSingle();

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    // Propaga o novo link aos snapshots das listas
    const { error: syncError } = await supabase
      .from("minha_lista_ofertas_info")
      .update({ link: newLink.url })
      .eq("user_id", user.id)
      .eq("produto_id", id);
    if (syncError) {
      console.error("[recreate-orphan] falha sync listas:", syncError.message);
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao recriar produto";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
