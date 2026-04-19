/**
 * CRUD dos produtos do Infoprodutor (catálogo "Meus Produtos").
 * Cada produto tem: nome, descrição, link de venda, imagem (URL pública do bucket
 * `infoprodutor-images`) e preço opcional. Tudo escopado por user_id via RLS.
 *
 * Providers suportados:
 *   - 'manual' (padrão): usuário informa o link de venda livremente.
 *   - 'stripe': criamos product + price + payment_link na Stripe e o link de venda
 *     é o payment_link gerado. Exige chave salva em profiles.stripe_secret_key.
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

type Row = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  link: string;
  price: number | string | null;
  price_old: number | string | null;
  provider: string | null;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_payment_link_id: string | null;
  stripe_subid: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
  shipping_cost: number | string | null;
  stripe_account_id: string | null;
  thank_you_message: string | null;
  created_at: string;
  updated_at: string;
};

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function mapProduto(r: Record<string, unknown>) {
  return {
    id: String(r.id ?? ""),
    name: String(r.name ?? ""),
    description: (r.description as string | null) ?? "",
    imageUrl: (r.image_url as string | null) ?? "",
    link: String(r.link ?? ""),
    price: numOrNull(r.price),
    priceOld: numOrNull(r.price_old),
    provider: (r.provider as string | null) ?? "manual",
    stripeProductId: (r.stripe_product_id as string | null) ?? null,
    stripePriceId: (r.stripe_price_id as string | null) ?? null,
    stripePaymentLinkId: (r.stripe_payment_link_id as string | null) ?? null,
    stripeSubid: (r.stripe_subid as string | null) ?? null,
    allowShipping: r.allow_shipping === null || r.allow_shipping === undefined ? true : Boolean(r.allow_shipping),
    allowPickup: Boolean(r.allow_pickup ?? false),
    shippingCost: numOrNull(r.shipping_cost),
    stripeAccountId: (r.stripe_account_id as string | null) ?? null,
    thankYouMessage: (r.thank_you_message as string | null) ?? "",
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const SELECT =
  "id, user_id, name, description, image_url, link, price, price_old, provider, stripe_product_id, stripe_price_id, stripe_payment_link_id, stripe_subid, allow_shipping, allow_pickup, shipping_cost, stripe_account_id, thank_you_message, created_at, updated_at";

const SUBID_REGEX = /^[a-zA-Z0-9_\-.]+$/;

function normalizeSubid(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, 64) : "";
}

async function getStripeKeyForUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("stripe_secret_key")
    .eq("id", userId)
    .single();
  const key = (data as { stripe_secret_key?: string | null } | null)?.stripe_secret_key ?? null;
  return key && key.trim() ? key.trim() : null;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .select(SELECT)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Lê a conta Stripe atual pra marcar produtos órfãos (criados em conta anterior).
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .single();
    const currentAccountId =
      (profile as { stripe_account_id?: string | null } | null)?.stripe_account_id ?? null;

    const produtos = (data ?? []).map((r) => {
      const mapped = mapProduto(r as Record<string, unknown>);
      const isOrphan =
        mapped.provider === "stripe" &&
        !!mapped.stripeAccountId &&
        !!currentAccountId &&
        mapped.stripeAccountId !== currentAccountId;
      return { ...mapped, isOrphan };
    });

    return NextResponse.json({ data: produtos, currentAccountId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const provider = String(body?.provider ?? "manual").trim().toLowerCase() as "manual" | "stripe";
    const name = String(body?.name ?? "").trim();
    const description = String(body?.description ?? "").trim();
    const imageUrl = String(body?.imageUrl ?? body?.image_url ?? "").trim();
    const priceRaw = body?.price;
    const price =
      priceRaw == null || priceRaw === ""
        ? null
        : Number.isFinite(Number(priceRaw))
          ? Number(priceRaw)
          : null;
    const priceOldRaw = body?.priceOld ?? body?.price_old;
    const price_old =
      priceOldRaw == null || priceOldRaw === ""
        ? null
        : Number.isFinite(Number(priceOldRaw))
          ? Number(priceOldRaw)
          : null;

    if (!name) return NextResponse.json({ error: "Título do produto é obrigatório." }, { status: 400 });

    if (provider === "stripe") {
      if (price == null || price <= 0) {
        return NextResponse.json({ error: "Preço é obrigatório (em BRL) para produtos Stripe." }, { status: 400 });
      }

      const stripeSubid = normalizeSubid(body?.stripeSubid ?? body?.stripe_subid);
      if (!stripeSubid || stripeSubid.length < 2) {
        return NextResponse.json(
          { error: "SubId é obrigatório em produtos Stripe (mínimo 2 caracteres, ex.: suplementos)." },
          { status: 400 },
        );
      }
      if (!SUBID_REGEX.test(stripeSubid)) {
        return NextResponse.json(
          { error: "SubId: use apenas letras, números, hífen, ponto e underscore." },
          { status: 400 },
        );
      }

      const stripeKey = await getStripeKeyForUser(supabase, user.id);
      if (!stripeKey) {
        return NextResponse.json(
          { error: "Conecte sua conta Stripe em Configurações antes de criar produtos na Stripe." },
          { status: 400 },
        );
      }

      // Lê WhatsApp + endereço do remetente + account_id (p/ custom_text de checkout, pickup e marca conta).
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select(
          "shipping_sender_whatsapp, shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf, stripe_account_id",
        )
        .eq("id", user.id)
        .single();
      const senderRow = senderProfile as {
        shipping_sender_whatsapp?: string | null;
        shipping_sender_street?: string | null;
        shipping_sender_number?: string | null;
        shipping_sender_complement?: string | null;
        shipping_sender_neighborhood?: string | null;
        shipping_sender_city?: string | null;
        shipping_sender_uf?: string | null;
        stripe_account_id?: string | null;
      } | null;
      const userStripeAccountId = senderRow?.stripe_account_id ?? null;
      const waUrl = toWhatsAppUrl(senderRow?.shipping_sender_whatsapp ?? null);
      const senderSnapshot: SenderSnapshot = {
        street: senderRow?.shipping_sender_street ?? null,
        number: senderRow?.shipping_sender_number ?? null,
        complement: senderRow?.shipping_sender_complement ?? null,
        neighborhood: senderRow?.shipping_sender_neighborhood ?? null,
        city: senderRow?.shipping_sender_city ?? null,
        uf: senderRow?.shipping_sender_uf ?? null,
      };
      const senderAddress = formatSenderAddressShort(senderSnapshot);

      // Modo de entrega (aceita envio, aceita retirada, valor do frete)
      const allowShipping = body?.allowShipping !== false; // default true
      const allowPickup = body?.allowPickup === true; // default false
      if (!allowShipping && !allowPickup) {
        return NextResponse.json(
          { error: "Marque ao menos uma opção de entrega: envio ou retirada." },
          { status: 400 },
        );
      }
      const shippingCostRaw = body?.shippingCost;
      const shippingCost =
        shippingCostRaw == null || shippingCostRaw === ""
          ? null
          : Number.isFinite(Number(shippingCostRaw))
            ? Math.max(0, Number(shippingCostRaw))
            : null;
      if (allowShipping && (shippingCost == null || shippingCost < 0)) {
        return NextResponse.json(
          { error: "Informe o valor do frete (use 0 para frete grátis)." },
          { status: 400 },
        );
      }
      if (allowPickup && !senderAddress) {
        return NextResponse.json(
          {
            error:
              "Preencha o endereço do remetente em Configurações antes de habilitar 'Retirada na loja' (é mostrado ao comprador no checkout).",
          },
          { status: 400 },
        );
      }

      const mode: DeliveryMode = { allowShipping, allowPickup };

      const stripe = new Stripe(stripeKey);

      let createdProductId: string | null = null;
      let createdPriceId: string | null = null;
      let createdPaymentLinkId: string | null = null;
      let paymentLinkUrl = "";

      try {
        const stripeDescription = buildStripeProductDescription(description, waUrl);
        const stripeProduct = await stripe.products.create({
          name,
          description: stripeDescription ?? undefined,
          images: imageUrl ? [imageUrl] : undefined,
        });
        createdProductId = stripeProduct.id;

        const stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          currency: "brl",
          unit_amount: Math.round(price * 100),
        });
        createdPriceId = stripePrice.id;

        // ShippingRates dinâmicas conforme modos de entrega habilitados
        const shippingRateIds: string[] = [];
        if (allowShipping) {
          const rate = await stripe.shippingRates.create({
            display_name: SHIPPING_RATE_DISPLAY_NAMES.shipping,
            type: "fixed_amount",
            fixed_amount: { amount: Math.round((shippingCost ?? 0) * 100), currency: "brl" },
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
        const stripePaymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: stripePrice.id, quantity: 1 }],
          // shipping_address_collection só é obrigatório quando aceita envio
          // (pickup puro evita fricção de preencher endereço)
          ...(allowShipping
            ? { shipping_address_collection: { allowed_countries: ["BR"] } }
            : {}),
          phone_number_collection: { enabled: true },
          ...(shippingRateIds.length > 0
            ? { shipping_options: shippingRateIds.map((id) => ({ shipping_rate: id })) }
            : {}),
          ...(customText ? { custom_text: customText } : {}),
          ...(afterCompletion ? { after_completion: afterCompletion } : {}),
        });
        createdPaymentLinkId = stripePaymentLink.id;
        paymentLinkUrl = stripePaymentLink.url;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro na Stripe";
        return NextResponse.json({ error: `Falha ao criar produto na Stripe: ${msg}` }, { status: 502 });
      }

      const { data, error } = await supabase
        .from("produtos_infoprodutor")
        .insert({
          user_id: user.id,
          name,
          description: description || null,
          image_url: imageUrl || null,
          link: paymentLinkUrl,
          price,
          price_old,
          provider: "stripe",
          stripe_product_id: createdProductId,
          stripe_price_id: createdPriceId,
          stripe_payment_link_id: createdPaymentLinkId,
          stripe_subid: stripeSubid,
          allow_shipping: allowShipping,
          allow_pickup: allowPickup,
          shipping_cost: allowShipping ? (shippingCost ?? 0) : null,
          stripe_account_id: userStripeAccountId,
          thank_you_message:
            typeof body?.thankYouMessage === "string" && body.thankYouMessage.trim()
              ? body.thankYouMessage.trim()
              : null,
        })
        .select(SELECT)
        .single();

      if (error) {
        return NextResponse.json(
          { error: `Produto criado na Stripe (${createdProductId}) mas falhou ao salvar no banco: ${error.message}` },
          { status: 500 },
        );
      }

      return NextResponse.json({ data: mapProduto(data as unknown as Row) });
    }

    // provider === "manual"
    const link = String(body?.link ?? "").trim();
    if (!link) return NextResponse.json({ error: "Link do produto é obrigatório." }, { status: 400 });

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .insert({
        user_id: user.id,
        name,
        description: description || null,
        image_url: imageUrl || null,
        link,
        price,
        price_old,
        provider: "manual",
      })
      .select(SELECT)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { data: current, error: loadError } = await supabase
      .from("produtos_infoprodutor")
      .select(SELECT)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
    if (!current) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const currentRow = current as unknown as Row;
    const isStripe = currentRow.provider === "stripe";

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let newName: string | null = null;
    let newDescription: string | null | undefined = undefined;
    let newImageUrl: string | null | undefined = undefined;

    if (typeof body?.name === "string") {
      const n = body.name.trim();
      if (!n) return NextResponse.json({ error: "Título não pode ficar em branco" }, { status: 400 });
      patch.name = n;
      newName = n;
    }
    if (typeof body?.description === "string") {
      const d = body.description.trim() || null;
      patch.description = d;
      newDescription = d;
    }
    if (typeof body?.imageUrl === "string" || typeof body?.image_url === "string") {
      const v = String(body?.imageUrl ?? body?.image_url ?? "").trim();
      patch.image_url = v || null;
      newImageUrl = v || null;
    }

    if (isStripe) {
      // v1: preço e link de venda não podem ser alterados em produtos Stripe
      // (mudar preço exige criar Price novo e invalidar o antigo — fora do escopo).
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "price")) {
        return NextResponse.json(
          { error: "Não é possível alterar o preço de produtos criados na Stripe. Remova e recrie se necessário." },
          { status: 400 },
        );
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "link")) {
        return NextResponse.json(
          { error: "O link de venda de produtos Stripe é gerado automaticamente e não pode ser editado." },
          { status: 400 },
        );
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "priceOld") || Object.prototype.hasOwnProperty.call(body ?? {}, "price_old")) {
        const p = body.priceOld ?? body.price_old;
        patch.price_old = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
      if (
        Object.prototype.hasOwnProperty.call(body ?? {}, "stripeSubid") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "stripe_subid")
      ) {
        const newSubid = normalizeSubid(body?.stripeSubid ?? body?.stripe_subid);
        if (!newSubid || newSubid.length < 2) {
          return NextResponse.json(
            { error: "SubId é obrigatório (mínimo 2 caracteres)." },
            { status: 400 },
          );
        }
        if (!SUBID_REGEX.test(newSubid)) {
          return NextResponse.json(
            { error: "SubId: use apenas letras, números, hífen, ponto e underscore." },
            { status: 400 },
          );
        }
        if (newSubid !== currentRow.stripe_subid) {
          patch.stripe_subid = newSubid;
        }
      }

      if (
        Object.prototype.hasOwnProperty.call(body ?? {}, "thankYouMessage") ||
        Object.prototype.hasOwnProperty.call(body ?? {}, "thank_you_message")
      ) {
        const raw = body?.thankYouMessage ?? body?.thank_you_message;
        const trimmed = typeof raw === "string" ? raw.trim() : "";
        patch.thank_you_message = trimmed || null;
      }

      // Sincroniza name/description/image no Stripe (best-effort — mudanças cosméticas).
      if ((newName !== null || newDescription !== undefined || newImageUrl !== undefined) && currentRow.stripe_product_id) {
        const stripeKey = await getStripeKeyForUser(supabase, user.id);
        if (stripeKey) {
          try {
            const stripe = new Stripe(stripeKey);
            const updatePayload: Stripe.ProductUpdateParams = {};
            if (newName !== null) updatePayload.name = newName;
            if (newDescription !== undefined) {
              // Regenera a descrição da Stripe preservando a linha CTA do WhatsApp (se houver).
              const { data: profile } = await supabase
                .from("profiles")
                .select("shipping_sender_whatsapp")
                .eq("id", user.id)
                .single();
              const waUrl = toWhatsAppUrl(
                (profile as { shipping_sender_whatsapp?: string | null } | null)?.shipping_sender_whatsapp ?? null,
              );
              updatePayload.description = buildStripeProductDescription(newDescription ?? null, waUrl) ?? undefined;
            }
            if (newImageUrl !== undefined) updatePayload.images = newImageUrl ? [newImageUrl] : [];
            await stripe.products.update(currentRow.stripe_product_id, updatePayload);
          } catch {
            // Falha silenciosa: produto local é atualizado mesmo que a sincronia com Stripe falhe.
          }
        }
      }
    } else {
      if (typeof body?.link === "string") {
        const l = body.link.trim();
        if (!l) return NextResponse.json({ error: "Link não pode ficar em branco" }, { status: 400 });
        patch.link = l;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "price")) {
        const p = body.price;
        patch.price = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
      if (Object.prototype.hasOwnProperty.call(body ?? {}, "priceOld") || Object.prototype.hasOwnProperty.call(body ?? {}, "price_old")) {
        const p = body.priceOld ?? body.price_old;
        patch.price_old = p == null || p === "" ? null : Number.isFinite(Number(p)) ? Number(p) : null;
      }
    }

    const { data, error } = await supabase
      .from("produtos_infoprodutor")
      .update(patch)
      .eq("id", id)
      .eq("user_id", user.id)
      .select(SELECT)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    // Propaga o update para os snapshots em `minha_lista_ofertas_info` — assim os
    // itens copiados nas listas refletem as últimas mudanças do produto.
    const listaPatch: Record<string, unknown> = {};
    if (Object.prototype.hasOwnProperty.call(patch, "name")) listaPatch.product_name = patch.name;
    if (Object.prototype.hasOwnProperty.call(patch, "description")) listaPatch.description = patch.description;
    if (Object.prototype.hasOwnProperty.call(patch, "image_url")) listaPatch.image_url = patch.image_url;
    if (Object.prototype.hasOwnProperty.call(patch, "link")) listaPatch.link = patch.link;
    if (Object.prototype.hasOwnProperty.call(patch, "price")) listaPatch.price = patch.price;
    if (Object.prototype.hasOwnProperty.call(patch, "price_old")) listaPatch.price_old = patch.price_old;

    if (Object.keys(listaPatch).length > 0) {
      const { error: syncError } = await supabase
        .from("minha_lista_ofertas_info")
        .update(listaPatch)
        .eq("user_id", user.id)
        .eq("produto_id", id);
      if (syncError) {
        // Não trava a resposta — o produto já foi atualizado. Só loga.
        console.error("[produtos PATCH] falha sync listas:", syncError.message);
      }
    }

    return NextResponse.json({ data: mapProduto(data as unknown as Row) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const { data: current } = await supabase
      .from("produtos_infoprodutor")
      .select("id, provider, stripe_product_id, stripe_payment_link_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    // Arquiva no Stripe antes de apagar do banco (Stripe não permite deletar
    // produtos com histórico, só arquivar).
    if (current && (current as { provider?: string }).provider === "stripe") {
      const stripeKey = await getStripeKeyForUser(supabase, user.id);
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey);
          const row = current as { stripe_product_id?: string | null; stripe_payment_link_id?: string | null };
          if (row.stripe_payment_link_id) {
            await stripe.paymentLinks.update(row.stripe_payment_link_id, { active: false });
          }
          if (row.stripe_product_id) {
            await stripe.products.update(row.stripe_product_id, { active: false });
          }
        } catch {
          // Falha silenciosa — o usuário removeu localmente; pode arquivar no painel da Stripe se necessário.
        }
      }
    }

    const { error } = await supabase
      .from("produtos_infoprodutor")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
