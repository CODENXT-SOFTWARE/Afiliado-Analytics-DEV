"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Cormorant_Garamond, Playfair_Display } from "next/font/google";
import { FaWhatsapp } from "react-icons/fa";
import type { CaptureVipLandingProps } from "./capture-vip-types";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";
import { isWhatsAppUrl } from "./capture-vip-shared";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "./capture-responsive-classes";
import { CaptureOfertCarouselIf } from "./CaptureOfertCarouselIf";
import { CaptureFooterAfiliadoAnalyticsLink } from "./CaptureFooterAfiliadoAnalyticsLink";
import { normalizeSimpleFourLinesFromDb } from "@/lib/capture-promo-cards";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lux-display",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lux-body",
  display: "swap",
});

/** Caminho seguro para ficheiros com espaços no nome. */
function luxPath(file: string) {
  return `/luxuoso/${encodeURIComponent(file)}`;
}

const BRANDS_MINI = [
  { file: "mercado-livre-logo-png_seeklogo-264236.webp", alt: "Mercado Livre", w: 160, h: 48 },
  { file: "Shopee-logo-scaled.webp", alt: "Shopee", w: 160, h: 48 },
  { file: "amazon-logo-amazon-icon-transparent-free-png.png", alt: "Amazon", w: 140, h: 48 },
] as const;

const PRODUCT_STRIP = [
  "kerastase.png",
  "WhatsApp-Image-2026-01-27-at-15.30.58.jpeg",
  "WhatsApp-Image-2026-01-27-at-15.56.33.jpeg",
  "WhatsApp-Image-2026-01-27-at-15.57.32.jpeg",
] as const;

const CATALOG_FILES = [
  "WhatsApp-Image-2026-03-04-at-20.17.13.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.15.49.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.10.31.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.10.30.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.17.51.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.15.22.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.10.30-1.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.11.50.jpeg",
  "WhatsApp-Image-2026-03-04-at-20.17.13 (1).jpeg",
] as const;

const GOLD = "#c9a962";
const GOLD_SOFT = "rgba(201, 169, 98, 0.22)";
const CREAM = "#f4efe4";
const MUTED = "#9a9188";
const INK = "#0c0b0a";
/** Faixa tipo “breaking news” no topo. */
const TICKER_ORANGE = "#ea580c";

function CtaLux(props: {
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
    <a
      href={ctaHref}
      className={`lux-cta-pulse ${CAPTURE_CTA_CLASS} rounded-full border-2 font-semibold tracking-wide`}
      style={{
        background: `linear-gradient(165deg, rgba(${r},${g},${b},0.95) 0%, rgb(${Math.max(0, r - 35)},${Math.max(0, g - 35)},${Math.max(0, b - 35)}) 100%)`,
        borderColor: GOLD_SOFT,
        color: CREAM,
        boxShadow: `0 0 0 1px rgba(201,169,98,0.35), 0 18px 40px rgba(0,0,0,0.45)`,
      }}
    >
      {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
      <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
    </a>
  );
}

function SocialCounterLux() {
  const [n, setN] = useState(6895);
  useEffect(() => {
    const id = window.setInterval(() => setN((v) => v + 1), 3000);
    return () => window.clearInterval(id);
  }, []);
  const fmt = useCallback((v: number) => v.toLocaleString("pt-BR"), []);
  return (
    <p
      className="text-center text-[13px] sm:text-sm"
      style={{ color: MUTED, fontFamily: "var(--font-lux-body), serif" }}
    >
      +<span style={{ color: GOLD, fontWeight: 700 }}>{fmt(n)}</span> pessoas já estão aproveitando e economizando
    </p>
  );
}

export default function CapturePerfumariaLuxuosa(props: CaptureVipLandingProps) {
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
    promoSectionsEnabled,
    promoTitles,
    promoCards,
  } = props;

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";
  const promoOn = promoSectionsEnabled !== false;

  const safeTitle = title.trim() || "Grupo Beleza de LUXO";
  const safeDesc =
    description.trim() ||
    "Achadinhos selecionados com carinho para você cuidar da sua beleza e do seu lar sem pagar caro 🏡💄💕";
  const safeBtn = buttonText.trim() || "Entrar no grupo";
  const color = buttonColor || "#5c1a2e";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const eyebrow = (promoTitles?.benefits ?? "").trim();
  const tickerMessage =
    eyebrow || "Economize em perfumes e cosméticos de marca todos os dias 💄✨";
  const brandsHeading = (promoTitles?.testimonials ?? "").trim();
  const handleLine = (promoTitles?.inGroup ?? "").trim();

  const simpleLines = useMemo(() => normalizeSimpleFourLinesFromDb(promoCards), [promoCards]);
  /** Várias repetições por segmento para a largura do track ≥ viewport (evita “faixa vazia” em ecrãs largos). */
  const miniTrack = useMemo(() => {
    const segment = [
      ...BRANDS_MINI,
      ...BRANDS_MINI,
      ...BRANDS_MINI,
      ...BRANDS_MINI,
      ...BRANDS_MINI,
      ...BRANDS_MINI,
    ];
    return [...segment, ...segment];
  }, []);
  const stripTrack = useMemo(() => {
    const segment = [
      ...PRODUCT_STRIP,
      ...PRODUCT_STRIP,
      ...PRODUCT_STRIP,
      ...PRODUCT_STRIP,
    ];
    return [...segment, ...segment];
  }, []);

  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes lux-cta-pulse {
            0%, 100% { box-shadow: 0 0 0 1px rgba(201,169,98,0.35), 0 18px 40px rgba(0,0,0,0.45); transform: scale(1); }
            50% { box-shadow: 0 0 0 1px rgba(201,169,98,0.55), 0 0 0 10px rgba(201,169,98,0.08), 0 22px 48px rgba(0,0,0,0.55); transform: scale(1.02); }
          }
          .lux-cta-pulse {
            animation: lux-cta-pulse 2.4s ease-in-out infinite;
            will-change: transform, box-shadow;
          }
          @keyframes lux-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .lux-marquee-track {
            display: flex;
            align-items: center;
            gap: 3rem;
            width: max-content;
            animation: lux-marquee 22s linear infinite;
          }
          .lux-marquee-slow {
            animation-duration: 32s;
          }
          @keyframes lux-ticker {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .lux-ticker-track {
            display: flex;
            width: max-content;
            animation: lux-ticker 22s linear infinite;
          }
          .lux-marquee-clip {
            width: 100%;
            min-width: 0;
          }
          @media (prefers-reduced-motion: reduce) {
            .lux-cta-pulse { animation: none !important; }
            .lux-marquee-track { animation: none !important; }
            .lux-marquee-clip {
              display: flex;
              justify-content: center;
            }
            .lux-ticker-track { animation: none !important; }
          }
          .lux-grain {
            pointer-events: none;
            position: ${previewMode ? "absolute" : "fixed"};
            inset: 0;
            z-index: 0;
            opacity: 0.04;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          }
        `,
        }}
      />

      <div
        className={`${playfair.variable} ${cormorant.variable} relative min-h-screen
         overflow-x-hidden`}
        style={{
          background: `radial-gradient(ellipse 120% 80% at 50% -10%, rgba(201,169,98,0.12) 0%, transparent 45%), linear-gradient(180deg, #141210 0%, ${INK} 38%, #080706 100%)`,
          color: CREAM,
          fontFamily: 'var(--font-lux-body), "Cormorant Garamond", Georgia, serif',
        }}
      >
        <div className="lux-grain" aria-hidden />

        <div className={`relative z-[1] ${previewMode ? "" : ""}`}>
          {/* Faixa marquee laranja (topo) */}
          <header
            className="relative z-[2] overflow-hidden border-b border-black/20 py-2.5 shadow-sm"
            style={{ backgroundColor: TICKER_ORANGE }}
          >
            <div className="lux-ticker-track items-center">
              <span
                className="shrink-0 whitespace-nowrap px-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-white sm:text-xs"
                style={{ fontFamily: "var(--font-lux-display), serif" }}
              >
                {tickerMessage}
                <span className="mx-5 text-white/60">·</span>
              </span>
              <span
                className="shrink-0 whitespace-nowrap px-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-white sm:text-xs"
                style={{ fontFamily: "var(--font-lux-display), serif" }}
                aria-hidden
              >
                {tickerMessage}
                <span className="mx-5 text-white/60">·</span>
              </span>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-lg 
          flex-col items-stretch px-4 pb-14 pt-8 md:pt-12">
              {logoUrl ? (
                <div className="mb-6 flex justify-center">
                  <div
                    className="relative h-20 w-20 overflow-hidden rounded-full border md:h-[5.5rem] md:w-[5.5rem]"
                    style={{ borderColor: GOLD_SOFT, boxShadow: `0 0 0 2px ${GOLD_SOFT}` }}
                  >
                    <Image
                      src={logoUrl}
                      alt=""
                      fill
                      className="object-contain p-2"
                      sizes="88px"
                      unoptimized={logoUrl.startsWith("blob:")}
                    />
                  </div>
                </div>
              ) : null}

              <p
                className="text-center text-base font-medium md:text-lg"
                style={{ color: GOLD, fontFamily: "var(--font-lux-display), serif" }}
              >
                {handleLine || "👩‍🦰 @sua_loja"}
              </p>

              <h1
                className={`mt-4 ${CAPTURE_TITLE_HERO}`}
                style={{
                  color: CREAM,
                  fontFamily: "var(--font-lux-display), serif",
                  fontWeight: 600,
                  letterSpacing: "-0.02em",
                }}
              >
                {safeTitle}
              </h1>

              <CaptureOfertCarouselIf {...props} slot="below_title" variant="aurora" eyebrow="Destaques" />

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="below_title"
                className="mt-5 w-full"
                classNameEmbed="rounded-xl border border-white/10 shadow-xl"
              />

              <p
                className={`mt-5 ${CAPTURE_BODY}`}
                style={{ color: MUTED, fontSize: "clamp(0.95rem, 2.8vw, 1.1rem)", lineHeight: 1.55 }}
              >
                {safeDesc}
              </p>

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="above_cta"
                className="mt-6 w-full"
                classNameEmbed="rounded-xl border border-white/10 shadow-xl"
              />

              <CaptureOfertCarouselIf {...props} slot="above_cta" variant="aurora" eyebrow="Destaques" />

              <div className="mt-8 w-full">
                <CtaLux
                  ctaHref={ctaHref}
                  buttonColor={color}
                  safeBtn={safeBtn}
                  showWa={showWa}
                  r={r}
                  g={g}
                  b={b}
                />
              </div>

              <CaptureOfertCarouselIf {...props} slot="below_cta" variant="aurora" eyebrow="Destaques" />

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="below_cta"
                className="mt-6 w-full"
                classNameEmbed="rounded-xl border border-white/10 shadow-xl"
              />

              <div
                className="mt-10 space-y-3 rounded-xl border px-5 py-6 text-left"
                style={{
                  borderColor: "rgba(201,169,98,0.2)",
                  background: "linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.2) 100%)",
                }}
              >
                {simpleLines.slice(0, 5).map((line, i) => (
                  <p
                    key={`lux-line-${i}`}
                    className="text-[0.95rem] leading-snug sm:text-base"
                    style={{ color: CREAM, fontFamily: "var(--font-lux-body), serif" }}
                  >
                    {line}
                  </p>
                ))}
              </div>
          </div>

          {/* Faixa marketplaces — w-full para não herdar largura limitada de colunas acima */}
          <section
            className="relative z-[1] mt-4 w-full min-w-0 border-y py-5"
            style={{ borderColor: "rgba(201,169,98,0.12)", background: "rgba(0,0,0,0.35)" }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-16 z-[2]"
              style={{
                background: "linear-gradient(90deg, #0c0b0a 0%, transparent 100%)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-16 z-[2]"
              style={{
                background: "linear-gradient(270deg, #0c0b0a 0%, transparent 100%)",
              }}
            />
            <div className="lux-marquee-clip overflow-hidden">
              <div className="lux-marquee-track items-center py-1">
                {miniTrack.map((b, i) => (
                  <div key={`${b.file}-${i}`} className="flex h-12 shrink-0 items-center opacity-80">
                    <Image
                      src={luxPath(b.file)}
                      alt={b.alt}
                      width={b.w}
                      height={b.h}
                      className="h-9 w-auto max-w-[140px] object-contain brightness-110 contrast-95 sm:h-10"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="relative z-[1] mt-4 px-4">
              <SocialCounterLux />
            </div>
          </section>

          {promoOn ? (
            <section className="relative z-[1] px-4 py-12 sm:py-16">
              <div className="mx-auto max-w-5xl">
                <div className="mx-auto mb-10 max-w-2xl text-center">
                  <div
                    className="mx-auto mb-3 h-px w-16"
                    style={{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)` }}
                  />
                  <h2
                    className="text-balance text-lg font-semibold uppercase tracking-[0.18em] sm:text-xl"
                    style={{ color: CREAM, fontFamily: "var(--font-lux-display), serif" }}
                  >
                    {brandsHeading || "MARCAS E PRODUTOS QUE VOCÊ ENCONTRA SÓ AQUI 👇"}
                  </h2>
                </div>

                <div className="lux-marquee-clip overflow-hidden" style={{ borderColor: GOLD_SOFT }}>
                  <div className="lux-marquee-track lux-marquee-slow">
                    {stripTrack.map((file, i) => (
                      <div key={`${file}-${i}`} className="flex h-[100px] shrink-0 items-center sm:h-[120px]">
                        <Image
                          src={luxPath(file)}
                          alt=""
                          width={200}
                          height={200}
                          className="h-[88px] rounded-full border border-white/10 shadow-lg w-auto max-w-[200px] object-contain opacity-90 sm:h-[112px] sm:max-w-[240px]"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="catalogo-lux mx-auto mt-12 max-w-[1100px]">
                  <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-2">
                    {CATALOG_FILES.map((file) => (
                      <div
                        key={file}
                        className="group relative overflow-hidden rounded-2xl border shadow-lg transition-transform duration-300 hover:-translate-y-1"
                        style={{
                          borderColor: "rgba(201,169,98,0.15)",
                          boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
                        }}
                      >
                        <div className="relative aspect-square w-full bg-zinc-900/80">
                          <Image
                            src={luxPath(file)}
                            alt=""
                            fill
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                            sizes="(max-width: 768px) 50vw, 33vw"
                          />
                          <div
                            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                            style={{
                              background:
                                "linear-gradient(180deg, transparent 40%, rgba(12,11,10,0.55) 100%)",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mx-auto mt-12 max-w-md">
                  <CtaLux
                    ctaHref={ctaHref}
                    buttonColor={color}
                    safeBtn={safeBtn}
                    showWa={showWa}
                    r={r}
                    g={g}
                    b={b}
                  />
                </div>
              </div>
            </section>
          ) : null}

          <section className="relative z-[1] border-t px-4 py-10" style={{ borderColor: "rgba(201,169,98,0.12)" }}>
            <div className="mx-auto max-w-2xl">
              <CaptureOfertCarouselIf {...props} slot="card_end" variant="aurora" eyebrow="Destaques" />
              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="card_end"
                className="mt-6 w-full"
                classNameEmbed="rounded-xl border border-white/10 shadow-xl"
              />
            </div>

            <div className="mx-auto mt-10 max-w-lg text-center">
              <p
                className="text-[12px] leading-relaxed sm:text-sm"
                style={{ color: MUTED, fontFamily: "var(--font-lux-body), serif" }}
              >
                Todos os direitos reservados
                <br />
                © {new Date().getFullYear()}{" "}
                <CaptureFooterAfiliadoAnalyticsLink className="text-inherit underline-offset-2 hover:text-[#c9a962]" />
                <br />
                <span className="text-[#c9a962]/80">🔒 Site seguro</span>
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
