import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

type Mode = "dark" | "light";
type FooterSize = "full" | "medium" | "small";

const SELECT_FIELDS =
  "checkout_theme_mode, checkout_header_image_url, checkout_footer_image_url, checkout_footer_image_size, checkout_method_card, checkout_method_pix, checkout_method_boleto, checkout_pay_button_color, checkout_pay_button_light_sweep, checkout_trigger_sale_notifications, checkout_trigger_countdown, checkout_countdown_minutes, checkout_countdown_message, checkout_countdown_expired_message, checkout_trigger_stock, checkout_stock_initial, checkout_trigger_viewers, checkout_viewers_min, checkout_viewers_max, checkout_trigger_guarantee, checkout_guarantee_text";

type Row = {
  checkout_theme_mode?: string | null;
  checkout_header_image_url?: string | null;
  checkout_footer_image_url?: string | null;
  checkout_footer_image_size?: string | null;
  checkout_method_card?: boolean | null;
  checkout_method_pix?: boolean | null;
  checkout_method_boleto?: boolean | null;
  checkout_pay_button_color?: string | null;
  checkout_pay_button_light_sweep?: boolean | null;
  checkout_trigger_sale_notifications?: boolean | null;
  checkout_trigger_countdown?: boolean | null;
  checkout_countdown_minutes?: number | null;
  checkout_countdown_message?: string | null;
  checkout_countdown_expired_message?: string | null;
  checkout_trigger_stock?: boolean | null;
  checkout_stock_initial?: number | null;
  checkout_trigger_viewers?: boolean | null;
  checkout_viewers_min?: number | null;
  checkout_viewers_max?: number | null;
  checkout_trigger_guarantee?: boolean | null;
  checkout_guarantee_text?: string | null;
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_COLOR = "#EE4D2D";

function normalizeColor(v: unknown): string {
  if (typeof v !== "string") return DEFAULT_COLOR;
  const trimmed = v.trim();
  return HEX_COLOR_RE.test(trimmed) ? trimmed.toLowerCase() : DEFAULT_COLOR;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeText(v: unknown, max: number, fallback: string): string {
  if (typeof v !== "string") return fallback;
  const t = v.trim().slice(0, max);
  return t || fallback;
}

function mapRow(row: Row) {
  const rawSize = row.checkout_footer_image_size;
  const footerImageSize: FooterSize =
    rawSize === "medium" || rawSize === "small" ? rawSize : "full";
  return {
    mode: (row.checkout_theme_mode as Mode | null) ?? "dark",
    headerImageUrl: row.checkout_header_image_url ?? null,
    footerImageUrl: row.checkout_footer_image_url ?? null,
    footerImageSize,
    methodCard: row.checkout_method_card !== false,
    methodPix: row.checkout_method_pix !== false,
    methodBoleto: row.checkout_method_boleto !== false,
    payButtonColor: normalizeColor(row.checkout_pay_button_color),
    payButtonLightSweep: Boolean(row.checkout_pay_button_light_sweep),
    triggerSaleNotifications: Boolean(row.checkout_trigger_sale_notifications),
    triggerCountdown: Boolean(row.checkout_trigger_countdown),
    countdownMinutes: clampInt(row.checkout_countdown_minutes, 1, 180, 15),
    countdownMessage: row.checkout_countdown_message ?? "Não feche esta página!",
    countdownExpiredMessage:
      row.checkout_countdown_expired_message ?? "Última chance — compre agora!",
    triggerStock: Boolean(row.checkout_trigger_stock),
    stockInitial: clampInt(row.checkout_stock_initial, 1, 9999, 12),
    triggerViewers: Boolean(row.checkout_trigger_viewers),
    viewersMin: clampInt(row.checkout_viewers_min, 1, 9999, 50),
    viewersMax: clampInt(row.checkout_viewers_max, 1, 9999, 200),
    triggerGuarantee: Boolean(row.checkout_trigger_guarantee),
    guaranteeText:
      row.checkout_guarantee_text ?? "Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.",
  };
}

export async function GET() {
  const gate = await gateInfoprodutor();
  if (!gate.allowed) return gate.response;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(SELECT_FIELDS)
    .eq("id", gate.userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(mapRow((data ?? {}) as Row));
}

export async function POST(req: Request) {
  const gate = await gateInfoprodutor();
  if (!gate.allowed) return gate.response;
  const supabase = await createClient();

  const body = await req.json().catch(() => ({}));
  const rawMode = String(body?.mode ?? "dark").toLowerCase();
  const mode: Mode = rawMode === "light" ? "light" : "dark";

  const normalizeUrlField = (v: unknown): string | null | undefined => {
    if (typeof v === "string" && v.trim()) return v.trim();
    if (v === null) return null;
    return undefined;
  };
  const headerImageUrl = normalizeUrlField(body?.headerImageUrl);
  const footerImageUrl = normalizeUrlField(body?.footerImageUrl);
  const rawFooterSize = body?.footerImageSize;
  const footerImageSize: FooterSize =
    rawFooterSize === "medium" || rawFooterSize === "small" ? rawFooterSize : "full";

  const methodCard = body?.methodCard !== false;
  const methodPix = body?.methodPix !== false;
  const methodBoleto = body?.methodBoleto !== false;

  // Proteção: se o afiliado desmarcar tudo, força cartão ligado (evita checkout quebrado).
  const anyMethod = methodCard || methodPix || methodBoleto;
  const finalCard = anyMethod ? methodCard : true;

  // Botão Pagar
  const payButtonColor = normalizeColor(body?.payButtonColor);
  const payButtonLightSweep = body?.payButtonLightSweep === true;

  // Gatilhos
  const triggerSaleNotifications = body?.triggerSaleNotifications === true;
  const triggerCountdown = body?.triggerCountdown === true;
  const countdownMinutes = clampInt(body?.countdownMinutes, 1, 180, 15);
  const countdownMessage = normalizeText(body?.countdownMessage, 140, "Não feche esta página!");
  const countdownExpiredMessage = normalizeText(
    body?.countdownExpiredMessage,
    140,
    "Última chance — compre agora!",
  );
  const triggerStock = body?.triggerStock === true;
  const stockInitial = clampInt(body?.stockInitial, 1, 9999, 12);
  const triggerViewers = body?.triggerViewers === true;
  let viewersMin = clampInt(body?.viewersMin, 1, 9999, 50);
  let viewersMax = clampInt(body?.viewersMax, 1, 9999, 200);
  if (viewersMin > viewersMax) [viewersMin, viewersMax] = [viewersMax, viewersMin];
  const triggerGuarantee = body?.triggerGuarantee === true;
  const guaranteeText = normalizeText(
    body?.guaranteeText,
    240,
    "Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.",
  );

  const patch: Record<string, string | boolean | number | null> = {
    checkout_theme_mode: mode,
    checkout_footer_image_size: footerImageSize,
    checkout_method_card: finalCard,
    checkout_method_pix: methodPix,
    checkout_method_boleto: methodBoleto,
    checkout_pay_button_color: payButtonColor,
    checkout_pay_button_light_sweep: payButtonLightSweep,
    checkout_trigger_sale_notifications: triggerSaleNotifications,
    checkout_trigger_countdown: triggerCountdown,
    checkout_countdown_minutes: countdownMinutes,
    checkout_countdown_message: countdownMessage,
    checkout_countdown_expired_message: countdownExpiredMessage,
    checkout_trigger_stock: triggerStock,
    checkout_stock_initial: stockInitial,
    checkout_trigger_viewers: triggerViewers,
    checkout_viewers_min: viewersMin,
    checkout_viewers_max: viewersMax,
    checkout_trigger_guarantee: triggerGuarantee,
    checkout_guarantee_text: guaranteeText,
  };
  if (headerImageUrl !== undefined) patch.checkout_header_image_url = headerImageUrl;
  if (footerImageUrl !== undefined) patch.checkout_footer_image_url = footerImageUrl;

  const { data, error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", gate.userId)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ...mapRow((data ?? {}) as Row) });
}
