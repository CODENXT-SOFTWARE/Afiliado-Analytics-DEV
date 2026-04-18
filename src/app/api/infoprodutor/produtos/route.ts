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
    createdAt: String(r.created_at ?? ""),
    updatedAt: String(r.updated_at ?? ""),
  };
}

const SELECT =
  "id, user_id, name, description, image_url, link, price, price_old, provider, stripe_product_id, stripe_price_id, stripe_payment_link_id, stripe_subid, created_at, updated_at";

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

    return NextResponse.json({ data: (data ?? []).map((r) => mapProduto(r as Record<string, unknown>)) });
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

      const stripe = new Stripe(stripeKey);

      let createdProductId: string | null = null;
      let createdPriceId: string | null = null;
      let createdPaymentLinkId: string | null = null;
      let paymentLinkUrl = "";

      try {
        const stripeProduct = await stripe.products.create({
          name,
          description: description || undefined,
          images: imageUrl ? [imageUrl] : undefined,
        });
        createdProductId = stripeProduct.id;

        const stripePrice = await stripe.prices.create({
          product: stripeProduct.id,
          currency: "brl",
          unit_amount: Math.round(price * 100),
        });
        createdPriceId = stripePrice.id;

        const stripePaymentLink = await stripe.paymentLinks.create({
          line_items: [{ price: stripePrice.id, quantity: 1 }],
          shipping_address_collection: { allowed_countries: ["BR"] },
          phone_number_collection: { enabled: true },
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

      // Sincroniza name/description/image no Stripe (best-effort — mudanças cosméticas).
      if ((newName !== null || newDescription !== undefined || newImageUrl !== undefined) && currentRow.stripe_product_id) {
        const stripeKey = await getStripeKeyForUser(supabase, user.id);
        if (stripeKey) {
          try {
            const stripe = new Stripe(stripeKey);
            const updatePayload: Stripe.ProductUpdateParams = {};
            if (newName !== null) updatePayload.name = newName;
            if (newDescription !== undefined) updatePayload.description = newDescription ?? undefined;
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
