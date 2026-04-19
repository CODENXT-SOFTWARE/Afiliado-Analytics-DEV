import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number | string | null;
  price_old: number | string | null;
  provider: string | null;
  stripe_subid: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
  shipping_cost: number | string | null;
  peso_g: number | string | null;
  altura_cm: number | string | null;
  largura_cm: number | string | null;
  comprimento_cm: number | string | null;
};

type SenderRow = {
  shipping_sender_street: string | null;
  shipping_sender_number: string | null;
  shipping_sender_complement: string | null;
  shipping_sender_neighborhood: string | null;
  shipping_sender_city: string | null;
  shipping_sender_uf: string | null;
  shipping_sender_cep: string | null;
  stripe_publishable_key: string | null;
};

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatPickupAddress(s: SenderRow | null): string | null {
  if (!s) return null;
  const parts = [
    s.shipping_sender_street,
    s.shipping_sender_number,
    s.shipping_sender_complement,
    s.shipping_sender_neighborhood,
    s.shipping_sender_city && s.shipping_sender_uf
      ? `${s.shipping_sender_city}/${s.shipping_sender_uf}`
      : s.shipping_sender_city,
  ].filter((p) => p && String(p).trim().length > 0);
  if (parts.length === 0) return null;
  return parts.join(", ");
}

export async function GET(_req: Request, ctx: { params: Promise<{ subId: string }> }) {
  try {
    const { subId: slug } = await ctx.params;
    if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select(
        "id, user_id, name, description, image_url, price, price_old, provider, stripe_subid, allow_shipping, allow_pickup, shipping_cost, peso_g, altura_cm, largura_cm, comprimento_cm",
      )
      .eq("public_slug", slug)
      .eq("provider", "stripe")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf, shipping_sender_cep, stripe_publishable_key",
      )
      .eq("id", row.user_id)
      .maybeSingle();

    const sender = (profile as SenderRow | null) ?? null;
    const pickupAddress = row.allow_pickup ? formatPickupAddress(sender) : null;
    const publishableKey = sender?.stripe_publishable_key?.trim() ?? null;

    const hasDimensions =
      num(row.peso_g) !== null &&
      num(row.altura_cm) !== null &&
      num(row.largura_cm) !== null &&
      num(row.comprimento_cm) !== null &&
      (num(row.peso_g) ?? 0) > 0;

    return NextResponse.json({
      produto: {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        imageUrl: row.image_url ?? null,
        price: num(row.price) ?? 0,
        priceOld: num(row.price_old),
        allowShipping: row.allow_shipping !== false,
        allowPickup: Boolean(row.allow_pickup),
        hasDimensions,
      },
      pickupAddress,
      publishableKey,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
