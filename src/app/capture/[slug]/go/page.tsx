import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { detectBot } from "../../../../lib/bot-detection";
import { CAPTURE_PUBLIC_DOMAIN, loadCaptureSiteRow } from "@/lib/capture-load-site";
import CaptureGoWhatsAppClient from "./CaptureGoWhatsAppClient";

export const dynamic = "force-dynamic";

const DOMAIN = CAPTURE_PUBLIC_DOMAIN;
const LOGO_BUCKET = "capture-logos";

function admin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl)
    throw new Error(
      "Env do Supabase ausente: defina NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_URL."
    );
  if (!serviceKey)
    throw new Error(
      "Env do Supabase ausente: defina SUPABASE_SERVICE_ROLE_KEY ou SERVICE_ROLE_KEY."
    );

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

function getIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return h.get("x-real-ip") ?? null;
}

async function hashIp(ip: string): Promise<string> {
  const crypto = await import("crypto");
  const salt = process.env.IP_HASH_SALT ?? "";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

function extractWhatsAppData(url: string): {
  inviteCode: string | null;
  universalLink: string;
} {
  const chatMatch = url.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/);
  if (chatMatch) {
    return {
      inviteCode: chatMatch[1] ?? null,
      universalLink: url,
    };
  }

  return {
    inviteCode: null,
    universalLink: url,
  };
}

/** Colunas JSON / tipos inconsistentes na BD não devem rebentar o cliente. */
function asLinkString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  return String(v).trim();
}

/** Cor do botão vinda da BD (hex, rgb, nome); evita valores absurdos ou não-string. */
function asCssColor(v: unknown, fallback: string): string {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s || s.length > 120) return fallback;
  return s;
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const supabase = admin();
  const { data: site, error } = await loadCaptureSiteRow(supabase, DOMAIN, slug);
  if (error || !site || !site.active) return { title: "Redirecionar" };
  if (site.expiresat && new Date(site.expiresat) < new Date()) return { title: "Redirecionar" };
  return { title: site.title ?? "Grupo VIP" };
}

export default async function WhatsAppRedirectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = admin();
  const h = await headers();

  const useragent = h.get("user-agent") ?? "";
  const referer = h.get("referer") ?? "";
  const ip = getIpFromHeaders(h);

  const { data: site, error: loadErr } = await loadCaptureSiteRow(supabase, DOMAIN, slug);
  if (loadErr) {
    throw new Error(
      "Não foi possível carregar o site de captura. Confirme NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY na Vercel."
    );
  }

  if (!site) return notFound();
  if (!site.active) return notFound();
  if (site.expiresat && new Date(site.expiresat) < new Date()) return notFound();

  try {
    const isbot = detectBot(useragent);
    const iphash = ip ? await hashIp(ip) : null;

    await supabase.from("capture_site_events").insert({
      site_id: site.id,
      event_type: "cta_click",
      iphash,
      useragent,
      referer,
      isbot,
    });
  } catch {
    // não interrompe
  }

  const whatsappUrl = asLinkString(site.whatsapp_url);
  const { inviteCode, universalLink } = extractWhatsAppData(whatsappUrl);
  const buttonColor = asCssColor(site.button_color, "#90ee90");

  let logoUrl: string | null = null;
  if (site.logopath) {
    const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(site.logopath);
    logoUrl = data.publicUrl ?? null;
  }

  return (
    <CaptureGoWhatsAppClient
      inviteCode={inviteCode}
      universalLink={universalLink}
      logoUrl={logoUrl}
      buttonColor={buttonColor}
    />
  );
}
