"use client";

import Image from "next/image";
import { Check, Flame } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import type { CaptureVipLandingProps } from "./capture-vip-types";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";
import { isWhatsAppUrl } from "./capture-vip-shared";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS_UPPER,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "./capture-responsive-classes";
import { CaptureOfertCarouselIf } from "./CaptureOfertCarouselIf";

const BG = "#FFF5F7";
const CARD = "#ffffff";
const TEXT = "#1c1917";
const MUTED = "#6b7280";
const RED = "#dc2626";
const PINK_LOGO_BG = "#FBCFE8";

const BENEFITS = [
  "Ofertas relâmpago antes de qualquer um",
  "Cupons exclusivos com até 80% OFF",
  "Frete grátis nas melhores lojas",
  "Alertas de promoções por tempo limitado",
] as const;

/** Logos em `public/` — nomes fixos para cache estável. */
const PARTNER_LOGOS = [
  { src: "/logo-shopee_ae8b716c.png", alt: "Shopee" },
  { src: "/logo-mercadolivre_5d835dbf.png", alt: "Mercado Livre" },
  { src: "/logo-amazon_99ccd542.png", alt: "Amazon" },
] as const;

function CtaBlock(props: {
  ctaHref: string;
  buttonColor: string;
  safeBtn: string;
  showWa: boolean;
  r: number;
  g: number;
  b: number;
}) {
  const { ctaHref, buttonColor, safeBtn, showWa, r, g, b } = props;
  return (
    <>
      <a
        href={ctaHref}
        className={`capture-vinho-rose-cta-pulse ${CAPTURE_CTA_CLASS_UPPER} font-black shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99]`}
        style={{
          backgroundColor: buttonColor,
          boxShadow: `0 8px 24px rgba(${r},${g},${b},0.35)`,
        }}
      >
        {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
        <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
      </a>
      <p className="mt-2.5 text-center text-xs font-medium" style={{ color: MUTED }}>
        100% gratuito • Sem spam • Saia quando quiser
      </p>
    </>
  );
}

export default function CaptureVipVinhoRose(props: CaptureVipLandingProps) {
  const {
    title,
    description,
    buttonText,
    ctaHref,
    logoUrl,
    buttonColor,
    youtubeUrl,
    youtubePosition,
    previewMode = false,
    notificationsEnabled,
    notificationsPosition,
  } = props;

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";

  const safeTitle = title.trim() || "Grupo VIP";
  const safeDesc =
    description.trim() ||
    "Entre no grupo gratuito e receba ofertas antes de acabar.";
  const safeBtn = (buttonText.trim() || "Entrar no grupo VIP").toUpperCase();
  const color = buttonColor || "#25D366";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes capture-vinho-rose-cta-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.045); }
          }
          .capture-vinho-rose-cta-pulse {
            transform-origin: center;
            animation: capture-vinho-rose-cta-pulse 1.6s ease-in-out infinite;
            will-change: transform;
          }
          @media (prefers-reduced-motion: reduce) {
            .capture-vinho-rose-cta-pulse { animation: none !important; }
          }
        `,
        }}
      />
      <div
        className="min-h-screen px-4 pb-16 pt-10 sm:pt-12"
        style={{
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          backgroundColor: BG,
          color: TEXT,
        }}
      >
        <div className="mx-auto flex w-full max-w-md flex-col items-stretch gap-5">
          {/* Logo */}
          <div className="flex justify-center">
            <div
              className="flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-2xl shadow-md"
              style={{ backgroundColor: PINK_LOGO_BG }}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt=""
                  width={104}
                  height={104}
                  className="h-full w-full object-contain p-2"
                  unoptimized={logoUrl.startsWith("blob:")}
                />
              ) : (
                <span className="text-xs font-bold text-rose-700/70">Logo</span>
              )}
            </div>
          </div>

          <h1 className={CAPTURE_TITLE_HERO}>{safeTitle}</h1>

          <CaptureOfertCarouselIf {...props} slot="below_title" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_title"
            className="w-full"
            classNameEmbed="shadow-lg"
          />

          <p className={CAPTURE_BODY} style={{ color: MUTED }}>
            {safeDesc}
          </p>

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="above_cta"
            className="w-full"
            classNameEmbed="shadow-lg"
          />

          <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

          <CtaBlock
            ctaHref={ctaHref}
            buttonColor={color}
            safeBtn={safeBtn}
            showWa={showWa}
            r={r}
            g={g}
            b={b}
          />

          <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_cta"
            className="w-full"
            classNameEmbed="shadow-lg"
          />

          <div className="flex justify-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md"
              style={{ backgroundColor: RED }}
            >
              <Flame className="h-4 w-4 shrink-0" aria-hidden />
              Últimas 2 vagas no grupo!
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {BENEFITS.map((line) => (
              <div
                key={line}
                className="flex items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-sm"
                style={{
                  backgroundColor: CARD,
                  borderColor: "rgba(0,0,0,0.06)",
                }}
              >
                <div
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${RED}18` }}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: RED }} aria-hidden />
                </div>
                <p className="text-left text-sm font-semibold leading-snug" style={{ color: TEXT }}>
                  {line}
                </p>
              </div>
            ))}
          </div>

          <div
            className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border px-4 py-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.65)",
              borderColor: "rgba(0,0,0,0.06)",
            }}
          >
            {PARTNER_LOGOS.map((p) => (
              <div
                key={p.src}
                className="relative flex h-10 w-[7.25rem] items-center justify-center sm:h-11 sm:w-[8rem]"
              >
                <Image
                  src={p.src}
                  alt={p.alt}
                  width={160}
                  height={48}
                  className="h-10 w-auto max-h-10 max-w-full object-contain object-center sm:h-11 sm:max-h-11"
                  sizes="(max-width: 640px) 116px, 128px"
                />
              </div>
            ))}
          </div>

          <div className="border-t border-black/5 pt-6">
            <CtaBlock
              ctaHref={ctaHref}
              buttonColor={color}
              safeBtn={safeBtn}
              showWa={showWa}
              r={r}
              g={g}
              b={b}
            />
          </div>

          <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="card_end"
            className="w-full"
            classNameEmbed="shadow-lg"
          />

          <p className="text-center text-[11px]" style={{ color: "#9ca3af" }}>
            © {new Date().getFullYear()} Afiliado Analytics
          </p>
        </div>
      </div>
    </>
  );
}
