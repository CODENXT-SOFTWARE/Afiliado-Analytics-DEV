import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { Tag, Zap, Gift, Lock } from "lucide-react"; // ✅ REMOVIDO MessageCircle
import ScarcityBlock from "./ScarcityBlock";
import { detectBot } from "../../../lib/bot-detection";
import CTAButton from "./CTAButton";
import CaptureVipLanding from "./CaptureVipLanding";
import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";
import { normalizeCapturePageTemplate } from "@/lib/capture-page-template";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOMAIN = "s.afiliadoanalytics.com.br";
const PUBLIC_BASE = `https://${DOMAIN}`;
const LOGO_BUCKET = "capture-logos";

const DEFAULT_OG_IMAGE = `${PUBLIC_BASE}/favicon-32x32.png`;
const DEFAULT_BUTTON_TEXT = "Acessar Grupo Vip";

function admin() {
  const supabaseUrl =
    process.env.NEXTPUBLICSUPABASEURL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceKey =
    process.env.SUPABASESERVICEROLEKEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Env do Supabase ausente: defina NEXTPUBLICSUPABASEURL (ou NEXT_PUBLIC_SUPABASE_URL)."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "Env do Supabase ausente: defina SUPABASESERVICEROLEKEY (ou SUPABASE_SERVICE_ROLE_KEY)."
    );
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
}

function getIpFromHeaders(h: Headers) {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || null;
  return h.get("x-real-ip") ?? null;
}

async function hashIp(ip: string) {
  const crypto = await import("crypto");
  const salt = process.env.IP_HASH_SALT ?? "";
  return crypto.createHash("sha256").update(ip + salt).digest("hex").slice(0, 16);
}

function parseColorToRgb(
  input: string | null | undefined
): { r: number; g: number; b: number } {
  const fallback = { r: 0, g: 0, b: 0 };

  const s = (input || "").trim();
  if (!s) return fallback;

  const hexMatch = s.match(
    /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
  );
  if (hexMatch) {
    let hex = hexMatch[1]!.toLowerCase();

    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split("")
        .map((ch) => ch + ch)
        .join("");
    }

    if (hex.length === 8) hex = hex.slice(0, 6);

    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);

    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return { r, g, b };
    return fallback;
  }

  const rgbMatch = s.match(
    /rgba?\(\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})\s*(?:,|\s)\s*(\d{1,3})(?:\s*(?:,|\/)\s*[\d.]+%?\s*)?\)\s*$/i
  );
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1]!, 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2]!, 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3]!, 10)));
    return { r, g, b };
  }

  return fallback;
}

// ---------------------------
// OG + Twitter (Metadata API)
// ---------------------------
export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;

  const supabase = admin();

  const { data: site } = await supabase
    .from("capture_sites")
    .select("title, description, active, expiresat, logopath")
    .eq("domain", DOMAIN)
    .eq("slug", slug)
    .maybeSingle();

  if (!site) return {};
  if (!site.active) return {};
  if (site.expiresat && new Date(site.expiresat) <= new Date()) return {};

  const title = site.title ?? "Grupo VIP";
  const description =
    site.description ?? "Acesso exclusivo às melhores promoções diretamente no seu WhatsApp.";
  const url = `${PUBLIC_BASE}/${slug}`;

  let ogImage = DEFAULT_OG_IMAGE;
  if (site.logopath) {
    try {
      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(site.logopath);
      ogImage = data.publicUrl || ogImage;
    } catch {
      // ignora
    }
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
  };
}

export default async function CapturePage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  const supabase = admin();

  const h = await headers();
  const useragent = h.get("user-agent") ?? "";
  const referer = h.get("referer") ?? "";
  const ip = getIpFromHeaders(h);

  const { data: site } = await supabase
    .from("capture_sites")
    .select(
      "id, title, description, whatsapp_url, button_text, button_color, active, expiresat, logopath, layout_variant, meta_pixel_id, page_template"
    )
    .eq("domain", DOMAIN)
    .eq("slug", slug)
    .maybeSingle();

  if (!site) return notFound();
  if (!site.active) return notFound();
  if (site.expiresat && new Date(site.expiresat) <= new Date()) return notFound();

  // URL pública da logo (bucket público)
  let logoUrl: string | null = null;
  if (site.logopath) {
    try {
      const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(site.logopath);
      logoUrl = data.publicUrl ?? null;
    } catch {
      // não quebra a página
    }
  }

  try {
    const isbot = detectBot(useragent);
    const iphash = ip ? await hashIp(ip) : null;

    await supabase.from("capture_site_events").insert({
      site_id: site.id,
      event_type: "view",
      iphash,
      useragent,
      referer,
      isbot,
    });
  } catch {
    // não quebra a página
  }

  const title = site.title ?? "Grupo VIP";
  const desc =
    site.description ?? "Acesso exclusivo às melhores promoções diretamente no seu WhatsApp.";

  const buttonText = (site.button_text ?? "").trim() || DEFAULT_BUTTON_TEXT;

  // ✅ NOVO: detecta se o link final é WhatsApp (para trocar o ícone do botão)
  const urlRaw = (site.whatsapp_url ?? "").trim();

  let isWhatsApp = true;
  try {
    const u = new URL(urlRaw);
    const host = u.hostname.toLowerCase();
    isWhatsApp = host.includes("whatsapp.com") || host === "wa.me";
  } catch {
    isWhatsApp = true; // fallback
  }

  const buttonColor = site.button_color ?? "#25D366";
  const { r, g, b } = parseColorToRgb(buttonColor);

  const layoutVariant = (site.layout_variant ?? "icons") as "icons" | "scarcity";

  const metaPixelId = site.meta_pixel_id;

  const siteRow = site as Record<string, unknown>;
  const pageTemplate = normalizeCapturePageTemplate(
    siteRow.page_template ?? siteRow.pageTemplate,
  );
  const isVipTemplate = pageTemplate === "vip_rosa" || pageTemplate === "vip_terroso";

  return (
    <>
      {/* Injeção do Meta Pixel (se existir) */}
      {metaPixelId && (
        <>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                !function(f,b,e,v,n,t,s)
                {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
                n.callMethod.apply(n,arguments):n.queue.push(arguments)};
                if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
                n.queue=[];t=b.createElement(e);t.async=!0;
                t.src=v;s=b.getElementsByTagName(e)[0];
                s.parentNode.insertBefore(t,s)}(window, document,'script',
                'https://connect.facebook.net/en_US/fbevents.js');
                fbq('init', '${metaPixelId}');
                fbq('track', 'PageView');
              `,
            }}
          />
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              height="1"
              width="1"
              style={{ display: "none" }}
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
              alt=""
            />
          </noscript>
        </>
      )}

      {isVipTemplate ? (
        <CaptureVipLanding
          variant={pageTemplate as Exclude<PageTemplate, "classic">}
          title={title}
          description={desc}
          buttonText={buttonText}
          ctaHref={`/${slug}/go`}
          logoUrl={logoUrl}
          buttonColor={buttonColor}
        />
      ) : null}

      {!isVipTemplate ? (
      <main
        className="min-h-screen flex flex-col px-4 pt-10 pb-6 sm:pt-8 sm:pb-12"
        style={{
          background: "linear-gradient(135deg, rgb(255, 238, 232) 0%, rgb(232, 240, 255) 100%)",
        }}
      >
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @keyframes cta-ring {
              0%   { box-shadow: 0 0 0 0 rgba(${r},${g},${b},.55), 0 0 22px rgba(${r},${g},${b},.35); opacity: .95; }
              70%  { box-shadow: 0 0 0 18px rgba(${r},${g},${b},0), 0 0 44px rgba(${r},${g},${b},0); opacity: .85; }
              100% { box-shadow: 0 0 0 0 rgba(${r},${g},${b},0), 0 0 0 rgba(${r},${g},${b},0); opacity: .95; }
            }

            .cta-pulse { position: relative; isolation: isolate; }
            .cta-pulse::before{
              content:"";
              position:absolute;
              inset: 0;
              border-radius: inherit;
              pointer-events:none;
              z-index:-1;
              animation: cta-ring 1.6s ease-out infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .cta-pulse::before { animation: none; }
            }

            .benefit-icon {
              background: rgb(235, 235, 235);
              transition: background-color .18s ease, transform .18s ease;
            }
            .benefit:hover .benefit-icon {
              background: rgb(255, 245, 242);
              transform: translateY(-1px);
            }
          `,
          }}
        />

        <div className="flex-1 flex items-center justify-center">
          <div
            className="w-full max-w-[504px] px-4 sm:px-9 pt-9 sm:pt-11 pb-5 sm:pb-5"
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.5)",
              borderRadius: "32px",
              boxShadow: "rgba(31, 38, 135, 0.15) 0px 8px 32px 0px",
              backdropFilter: "blur(6px)",
            }}
          >
            {logoUrl && (
              <div className="flex justify-center mb-6">
                <div
                  className="h-[130px] w-[130px] rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: "rgb(255, 255, 255)" }}
                  aria-label="Logo"
                >
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={130}
                    height={130}
                    priority
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>
            )}

            <h1
              className="text-center font-extrabold leading-tight"
              style={{ color: "rgb(31, 31, 31)", fontSize: "32px" }}
            >
              {title}
            </h1>

            <p
              className="text-center mt-4 leading-snug max-w-sm mx-auto font-semibold"
              style={{ color: "rgb(60, 60, 60)", fontSize: "17px" }}
            >
              {desc}
            </p>

            {layoutVariant === "scarcity" ? (
              <ScarcityBlock accentRgb={{ r, g, b }} />
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-7">
                <div className="benefit flex flex-col items-center text-center gap-2">
                  <div className="benefit-icon h-11 w-11 rounded-full flex items-center justify-center">
                    <Zap size={20} color="rgb(238, 77, 45)" />
                  </div>
                  <span
                    className="text-[12px] sm:text-[12.8px] font-semibold"
                    style={{ color: "rgb(102, 102, 102)" }}
                  >
                    Ofertas Relâmpago
                  </span>
                </div>

                <div className="benefit flex flex-col items-center text-center gap-2">
                  <div className="benefit-icon h-11 w-11 rounded-full flex items-center justify-center">
                    <Tag size={20} color="rgb(238, 77, 45)" />
                  </div>
                  <span style={{ color: "rgb(102, 102, 102)", fontSize: "12.8px", fontWeight: 600 }}>
                    Descontos Reais
                  </span>
                </div>

                <div className="benefit flex flex-col items-center text-center gap-2">
                  <div className="benefit-icon h-11 w-11 rounded-full flex items-center justify-center">
                    <Gift size={20} color="rgb(238, 77, 45)" />
                  </div>
                  <span style={{ color: "rgb(102, 102, 102)", fontSize: "12.8px", fontWeight: 600 }}>
                    Cupons Diários
                  </span>
                </div>
              </div>
            )}

            {/* ✅ CORRIGIDO: removida div duplicada */}
            <div className="flex justify-center mt-7 sm:mt-8">
              <CTAButton
                href={`${slug}/go`}
                buttonColor={buttonColor}
                hasPixel={!!metaPixelId}
                text={buttonText}
                isWhatsApp={isWhatsApp}
              />
            </div>

            <p
              className="text-center mt-4 leading-relaxed"
              style={{ color: "rgb(102, 102, 102)", fontSize: "14px" }}
            >
              Após clicar no botão acima, clique na opção &quot;CONTINUAR&quot;
            </p>

            <div className="flex justify-center items-center gap-2 mt-6">
              <Lock size={16} color="rgb(34, 197, 94)" />
              <span className="font-semibold" style={{ color: "rgb(34, 197, 94)", fontSize: "15px" }}>
                Site seguro
              </span>
            </div>
          </div>
        </div>

        <footer className="pt-16 sm:pt-24 text-center" style={{ color: "rgb(153, 153, 153)", fontSize: "12px" }}>
          © 2026 Afiliado Analytics. Todos os direitos reservados.
        </footer>
      </main>
      ) : null}
    </>
  );
}
