import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { gateInfoprodutor } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

type Mode = "dark" | "light";
type FooterSize = "full" | "medium" | "small";

export async function GET() {
  const gate = await gateInfoprodutor();
  if (!gate.allowed) return gate.response;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "checkout_theme_mode, checkout_header_image_url, checkout_footer_image_url, checkout_footer_image_size, checkout_method_card, checkout_method_pix, checkout_method_boleto",
    )
    .eq("id", gate.userId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const row = (data ?? {}) as {
    checkout_theme_mode?: string | null;
    checkout_header_image_url?: string | null;
    checkout_footer_image_url?: string | null;
    checkout_footer_image_size?: string | null;
    checkout_method_card?: boolean | null;
    checkout_method_pix?: boolean | null;
    checkout_method_boleto?: boolean | null;
  };
  const rawSize = row.checkout_footer_image_size;
  const footerImageSize: FooterSize =
    rawSize === "medium" || rawSize === "small" ? rawSize : "full";
  return NextResponse.json({
    mode: (row.checkout_theme_mode as Mode | null) ?? "dark",
    headerImageUrl: row.checkout_header_image_url ?? null,
    footerImageUrl: row.checkout_footer_image_url ?? null,
    footerImageSize,
    methodCard: row.checkout_method_card !== false,
    methodPix: row.checkout_method_pix !== false,
    methodBoleto: row.checkout_method_boleto !== false,
  });
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

  const patch: Record<string, string | boolean | null> = {
    checkout_theme_mode: mode,
    checkout_footer_image_size: footerImageSize,
    checkout_method_card: finalCard,
    checkout_method_pix: methodPix,
    checkout_method_boleto: methodBoleto,
  };
  if (headerImageUrl !== undefined) patch.checkout_header_image_url = headerImageUrl;
  if (footerImageUrl !== undefined) patch.checkout_footer_image_url = footerImageUrl;

  const { error } = await supabase.from("profiles").update(patch).eq("id", gate.userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    mode,
    headerImageUrl: headerImageUrl ?? null,
    footerImageUrl: footerImageUrl ?? null,
    footerImageSize,
    methodCard: finalCard,
    methodPix,
    methodBoleto,
  });
}
