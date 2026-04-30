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
  subid: string | null;
  allow_shipping: boolean | null;
  allow_pickup: boolean | null;
  allow_digital: boolean | null;
  allow_local_delivery: boolean | null;
  shipping_cost: number | string | null;
  local_delivery_cost: number | string | null;
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
  mp_public_key: string | null;
  checkout_theme_mode: string | null;
  checkout_header_image_url: string | null;
  checkout_footer_image_url: string | null;
  checkout_footer_image_size: string | null;
  checkout_method_card: boolean | null;
  checkout_method_pix: boolean | null;
  checkout_method_boleto: boolean | null;
  checkout_pay_button_color: string | null;
  checkout_pay_button_light_sweep: boolean | null;
  checkout_trigger_sale_notifications: boolean | null;
  checkout_trigger_countdown: boolean | null;
  checkout_countdown_minutes: number | null;
  checkout_countdown_message: string | null;
  checkout_countdown_expired_message: string | null;
  checkout_trigger_stock: boolean | null;
  checkout_stock_initial: number | null;
  checkout_trigger_viewers: boolean | null;
  checkout_viewers_min: number | null;
  checkout_viewers_max: number | null;
  checkout_trigger_guarantee: boolean | null;
  checkout_guarantee_text: string | null;
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
        "id, user_id, name, description, image_url, price, price_old, provider, subid, allow_shipping, allow_pickup, allow_digital, allow_local_delivery, shipping_cost, local_delivery_cost, peso_g, altura_cm, largura_cm, comprimento_cm",
      )
      .eq("public_slug", slug)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const row = produto as ProductRow;

    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "shipping_sender_street, shipping_sender_number, shipping_sender_complement, shipping_sender_neighborhood, shipping_sender_city, shipping_sender_uf, shipping_sender_cep, mp_public_key, checkout_theme_mode, checkout_header_image_url, checkout_footer_image_url, checkout_footer_image_size, checkout_method_card, checkout_method_pix, checkout_method_boleto, checkout_pay_button_color, checkout_pay_button_light_sweep, checkout_trigger_sale_notifications, checkout_trigger_countdown, checkout_countdown_minutes, checkout_countdown_message, checkout_countdown_expired_message, checkout_trigger_stock, checkout_stock_initial, checkout_trigger_viewers, checkout_viewers_min, checkout_viewers_max, checkout_trigger_guarantee, checkout_guarantee_text",
      )
      .eq("id", row.user_id)
      .maybeSingle();

    const sender = (profile as SenderRow | null) ?? null;
    const pickupAddress = row.allow_pickup ? formatPickupAddress(sender) : null;
    const publishableKey = sender?.mp_public_key?.trim() ?? null;
    const themeMode = sender?.checkout_theme_mode === "light" ? "light" : "dark";
    const headerImageUrl = sender?.checkout_header_image_url?.trim() || null;
    const footerImageUrl = sender?.checkout_footer_image_url?.trim() || null;
    const footerSizeRaw = sender?.checkout_footer_image_size;
    const footerImageSize: "full" | "medium" | "small" =
      footerSizeRaw === "medium" || footerSizeRaw === "small" ? footerSizeRaw : "full";
    const methods = {
      card: sender?.checkout_method_card !== false,
      pix: sender?.checkout_method_pix !== false,
      boleto: sender?.checkout_method_boleto !== false,
    };

    const hasDimensions =
      num(row.peso_g) !== null &&
      num(row.altura_cm) !== null &&
      num(row.largura_cm) !== null &&
      num(row.comprimento_cm) !== null &&
      (num(row.peso_g) ?? 0) > 0;

    const HEX = /^#[0-9a-fA-F]{6}$/;
    const clampInt = (n: unknown, min: number, max: number, fb: number): number => {
      const v = Number(n);
      if (!Number.isFinite(v)) return fb;
      return Math.max(min, Math.min(max, Math.round(v)));
    };
    const payButtonColor =
      sender?.checkout_pay_button_color && HEX.test(sender.checkout_pay_button_color.trim())
        ? sender.checkout_pay_button_color.trim().toLowerCase()
        : "#EE4D2D";
    const triggers = {
      payButton: {
        color: payButtonColor,
        lightSweep: Boolean(sender?.checkout_pay_button_light_sweep),
      },
      saleNotifications: Boolean(sender?.checkout_trigger_sale_notifications),
      countdown: {
        enabled: Boolean(sender?.checkout_trigger_countdown),
        minutes: clampInt(sender?.checkout_countdown_minutes, 1, 180, 15),
        message: sender?.checkout_countdown_message ?? "Não feche esta página!",
        expiredMessage:
          sender?.checkout_countdown_expired_message ?? "Última chance — compre agora!",
      },
      stock: {
        enabled: Boolean(sender?.checkout_trigger_stock),
        initial: clampInt(sender?.checkout_stock_initial, 1, 9999, 12),
      },
      viewers: {
        enabled: Boolean(sender?.checkout_trigger_viewers),
        min: clampInt(sender?.checkout_viewers_min, 1, 9999, 50),
        max: clampInt(sender?.checkout_viewers_max, 1, 9999, 200),
      },
      guarantee: {
        enabled: Boolean(sender?.checkout_trigger_guarantee),
        text:
          sender?.checkout_guarantee_text ??
          "Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.",
      },
    };

    return NextResponse.json({
      produto: {
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        imageUrl: row.image_url ?? null,
        price: num(row.price) ?? 0,
        priceOld: num(row.price_old),
        allowShipping: Boolean(row.allow_shipping) && !row.allow_digital,
        allowPickup: Boolean(row.allow_pickup) && !row.allow_digital,
        allowDigital: Boolean(row.allow_digital),
        allowLocalDelivery: Boolean(row.allow_local_delivery) && !row.allow_digital,
        localDeliveryCost: row.allow_local_delivery ? num(row.local_delivery_cost) ?? 0 : null,
        hasDimensions,
      },
      pickupAddress,
      publishableKey,
      theme: {
        mode: themeMode,
        headerImageUrl,
        footerImageUrl,
        footerImageSize,
      },
      methods,
      triggers,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
