"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { Montserrat, Playfair_Display } from "next/font/google";
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

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-mm-body",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-mm-display",
  display: "swap",
});

const ACCENT = "#4C0DB4";
const HERO_TEXT = "#111827";

const DEFAULT_TRUST_HEADING = "Mas será que é confiável?";
const DEFAULT_TRUST_SUB =
  "Essas são algumas promoções que membros dos meus grupos já aproveitaram ↓";

const BRANDS: { src: string; alt: string; w: number; h: number }[] = [
  { src: "/mkmaster/NIKE.png", alt: "Nike", w: 77, h: 40 },
  { src: "/mkmaster/ADIDAS.png", alt: "Adidas", w: 65, h: 44 },
  { src: "/mkmaster/APPLE.png", alt: "Apple", w: 55, h: 55 },
  { src: "/mkmaster/NETSHOES.png", alt: "Netshoes", w: 113, h: 26 },
  { src: "/mkmaster/SAMSUNG.png", alt: "Samsung", w: 126, h: 42 },
  { src: "/mkmaster/GROWTH.png", alt: "Growth", w: 137, h: 42 },
  { src: "/mkmaster/MERCADO-LIVRE.png", alt: "Mercado Livre", w: 154, h: 40 },
  { src: "/mkmaster/AMAZON.png", alt: "Amazon", w: 132, h: 40 },
  { src: "/mkmaster/SHOPEE.png", alt: "Shopee", w: 124, h: 40 },
  { src: "/mkmaster/MAGALU.png", alt: "Magalu", w: 89, h: 31 },
];

const DEP_IDS = ["001", "002", "003", "004", "005", "007", "008", "009", "010", "011", "012", "013", "014"] as const;

function HeroTitle({ text, accent }: { text: string; accent: string }) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length >= 2) {
    return (
      <h1 className={CAPTURE_TITLE_HERO} style={{ color: HERO_TEXT, fontFamily: "var(--font-mm-display), serif" }}>
        <span className="block">{lines[0]}</span>
        <span className="mt-1 block" style={{ color: accent }}>
          {lines.slice(1).join(" ")}
        </span>
      </h1>
    );
  }
  return (
    <h1 className={CAPTURE_TITLE_HERO} style={{ color: HERO_TEXT, fontFamily: "var(--font-mm-display), serif" }}>
      {text}
    </h1>
  );
}

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
    <a
      href={ctaHref}
      className={`mm-cta-pulse ${CAPTURE_CTA_CLASS} rounded-xl font-bold shadow-lg transition-transform active:scale-[0.99]`}
      style={{
        backgroundColor: buttonColor,
        boxShadow: `0 10px 28px rgba(${r},${g},${b},0.38)`,
      }}
    >
      {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
      <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
    </a>
  );
}

function TrustHeading({ text }: { text: string }) {
  const t = text.trim();
  if (t === DEFAULT_TRUST_HEADING || t.toLowerCase() === "mas será que é confiável?") {
    return (
      <h2
        className="text-balance text-center text-[clamp(1.15rem,4.2vw,1.65rem)] font-bold leading-tight"
        style={{ color: HERO_TEXT, fontFamily: "var(--font-mm-display), serif" }}
      >
        Mas será que <span style={{ color: ACCENT }}>é confiável?</span>
      </h2>
    );
  }
  return (
    <h2
      className="text-balance text-center text-[clamp(1.15rem,4.2vw,1.65rem)] font-bold leading-tight"
      style={{ color: HERO_TEXT, fontFamily: "var(--font-mm-display), serif" }}
    >
      {t}
    </h2>
  );
}

export default function CaptureMarketMaster(props: CaptureVipLandingProps) {
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

  const safeTitle =
    title.trim() ||
    "Chega de pagar caro!\nAs melhores promoções e cupons você encontra aqui.";
  const safeDesc =
    description.trim() || "Entre nos grupos, ative as notificações e deixa que eu faço o resto 😉";
  const safeBtn = buttonText.trim() || "Quero acessar o grupo gratuito (Whatsapp)";
  const color = buttonColor || "#25D366";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const trustHeading = (promoTitles?.testimonials ?? "").trim() || DEFAULT_TRUST_HEADING;
  const trustSub = (promoTitles?.inGroup ?? "").trim() || DEFAULT_TRUST_SUB;
  const optionalBenefitsTitle = (promoTitles?.benefits ?? "").trim();
  const simpleLines = useMemo(() => normalizeSimpleFourLinesFromDb(promoCards), [promoCards]);

  const depSlides = useMemo(
    () => DEP_IDS.map((id) => ({ src: `/mkmaster/DEP-TUDO-NA-PROMO-${id}.webp`, alt: `Depoimento ${id}` })),
    [],
  );
  const [depIdx, setDepIdx] = useState(0);
  const depLen = depSlides.length;
  const goPrev = useCallback(() => {
    setDepIdx((i) => (i - 1 + depLen) % depLen);
  }, [depLen]);
  const goNext = useCallback(() => {
    setDepIdx((i) => (i + 1) % depLen);
  }, [depLen]);

  const brandTrack = useMemo(() => [...BRANDS, ...BRANDS], []);

  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes mm-cta-pulse {
            0%, 100% { transform: scale(1); box-shadow: 0 10px 28px rgba(${r},${g},${b},0.38); }
            50% { transform: scale(1.03); box-shadow: 0 14px 36px rgba(${r},${g},${b},0.48); }
          }
          .mm-cta-pulse {
            transform-origin: center;
            animation: mm-cta-pulse 1.85s ease-in-out infinite;
            will-change: transform;
          }
          @keyframes mm-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .mm-marquee-track {
            display: flex;
            align-items: center;
            gap: 3.5rem;
            width: max-content;
            animation: mm-marquee 42s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .mm-cta-pulse { animation: none !important; }
            .mm-marquee-track { animation: none !important; }
          }
          .mm-hero-bg {
            background-image: url('/mkmaster/BG-TUDO-NA-PROMO-MOBI-002.webp');
            background-size: cover;
            background-position: center top;
            background-repeat: no-repeat;
          }
          @media (min-width: 768px) {
            .mm-hero-bg {
              background-image: url('/mkmaster/BG-TUDO-NA-PROMO-PC-002.webp');
            }
          }
        `,
        }}
      />

      <div
        className={`${montserrat.variable} ${playfair.variable} min-h-screen overflow-x-hidden`}
        style={{
          fontFamily: 'var(--font-mm-body), ui-sans-serif, system-ui, sans-serif',
          color: HERO_TEXT,
        }}
      >
        <section className={`mm-hero-bg ${previewMode ? "relative" : ""} px-4 pb-10 pt-8 sm:pt-10`}>
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
            {logoUrl ? (
              <div className="mb-5 flex justify-center">
                <div
                  className="relative flex h-[88px] w-[88px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/80 bg-white shadow-md sm:h-[100px] sm:w-[100px]"
                  aria-label="Logo"
                >
                  <Image
                    src={logoUrl}
                    alt=""
                    fill
                    className="object-contain p-2.5"
                    sizes="100px"
                    unoptimized={logoUrl.startsWith("blob:")}
                    priority
                  />
                </div>
              </div>
            ) : null}

            <div className="relative h-[52px] w-full max-w-[360px] sm:h-[62px]">
              <Image
                src="/mkmaster/200-mil-pessoas-02.png"
                alt=""
                fill
                className="object-contain object-center"
                sizes="(max-width: 768px) 100vw, 360px"
                priority
              />
            </div>

            <div className="mt-6 w-full">
              <HeroTitle text={safeTitle} accent={ACCENT} />
            </div>

            <CaptureOfertCarouselIf {...props} slot="below_title" variant="light" eyebrow="Destaques" />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="below_title"
              className="mt-4 w-full"
              classNameEmbed="rounded-xl shadow-md"
            />

            <p className={`mt-5 ${CAPTURE_BODY}`} style={{ color: "#374151" }}>
              {safeDesc}
            </p>

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="above_cta"
              className="mt-6 w-full"
              classNameEmbed="rounded-xl shadow-md"
            />

            <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

            <div className="mt-8 w-full max-w-md">
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

            <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="below_cta"
              className="mt-6 w-full"
              classNameEmbed="rounded-xl shadow-md"
            />
          </div>

          <div className="mx-auto mt-10 w-full max-w-3xl px-0 sm:px-2">
            <div className="hidden md:block">
              <Image
                src="/mkmaster/IMAGENS-PRODUTOS-BG-PC-001.webp"
                alt=""
                width={360}
                height={360}
                className="h-auto max-w-[360px] flex items-center justify-center mx-auto"
                sizes="(max-width: 768px) 100vw, 360px"
              />
            </div>
            <div className="md:hidden">
              <Image
                src="/mkmaster/IMAGENS-PRODUTOS-BG-MOBI-004.webp"
                alt=""
                width={360}
                height={360}
                className="h-auto max-w-[360px] flex items-center justify-center mx-auto"
                sizes="(max-width: 768px) 100vw, 360px"
              />
            </div>
          </div>
        </section>

        <section className="border-y border-black/5 bg-zinc-100/90 py-6">
          <div className="relative overflow-hidden">
            <div className="mm-marquee-track py-1">
              {brandTrack.map((b, i) => (
                <div
                  key={`${b.src}-${i}`}
                  className="flex h-11 shrink-0 items-center justify-center sm:h-12"
                  style={{ minWidth: "6.5rem" }}
                >
                  <Image
                    src={b.src}
                    alt={b.alt}
                    width={b.w}
                    height={b.h}
                    className="max-h-10 w-auto max-w-[7.5rem] object-contain sm:max-h-11"
                  />
                </div>
              ))}
            </div>
          </div>
        </section>

        {promoOn ? (
          <section className="bg-gradient-to-b from-zinc-50 to-white px-4 py-12 sm:py-14">
            <div className="mx-auto w-full max-w-2xl">
              <TrustHeading text={trustHeading} />
              <p className={`mt-4 ${CAPTURE_BODY}`} style={{ color: "#4b5563" }}>
                {trustSub}
              </p>

              {optionalBenefitsTitle ? (
                <p className="mt-6 text-center text-sm font-bold text-zinc-800">{optionalBenefitsTitle}</p>
              ) : null}

              <ul className="mx-auto mt-4 max-w-md space-y-2.5 text-left text-sm font-medium text-zinc-700">
                {simpleLines.slice(0, 4).map((line, i) => (
                  <li key={`mm-line-${i}`} className="flex gap-2">
                    <span className="mt-0.5 font-bold" style={{ color: ACCENT }}>
                      ✓
                    </span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>

              <div className="relative mx-auto mt-8 w-full max-w-[360px]">
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-0 top-1/2 z-10 -translate-x-1 -translate-y-1/2 sm:-translate-x-2"
                  aria-label="Slide anterior"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="15.5" transform="matrix(-1 0 0 1 32 0)" fill={ACCENT} stroke="white" />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M19.4256 22.7965C19.8451 22.377 19.8451 21.6969 19.4256 21.2774L13.7404 15.5922L19.4256 9.90688C19.8451 9.48741 19.8451 8.80731 19.4256 8.38783C19.0062 7.96836 18.3261 7.96836 17.9066 8.38783L10.7023 15.5922L17.9066 22.7965C18.326 23.216 19.0062 23.216 19.4256 22.7965Z"
                      fill="white"
                    />
                  </svg>
                </button>

                <div className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-md">
                  <div className="relative aspect-[345/397] w-full">
                    <Image
                      src={depSlides[depIdx]!.src}
                      alt={depSlides[depIdx]!.alt}
                      fill
                      className="object-contain object-center p-1"
                      sizes="360px"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-0 top-1/2 z-10 -translate-y-1/2 translate-x-1 sm:translate-x-2"
                  aria-label="Próximo slide"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="15.5" fill={ACCENT} stroke="white" />
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M12.5744 22.7965C12.1549 22.377 12.1549 21.6969 12.5744 21.2774L18.2596 15.5922L12.5744 9.90688C12.1549 9.48741 12.1549 8.80731 12.5744 8.38783C12.9938 7.96836 13.6739 7.96836 14.0934 8.38783L21.2977 15.5922L14.0934 22.7965C13.674 23.216 12.9938 23.216 12.5744 22.7965Z"
                      fill="white"
                    />
                  </svg>
                </button>
              </div>

              <div className="mx-auto mt-10 w-full max-w-md">
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
            </div>
          </section>
        ) : null}

        <section className="px-4 pb-12 pt-4">
          <div className="mx-auto w-full max-w-2xl">
            <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />
            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="card_end"
              className="mt-6 w-full"
              classNameEmbed="rounded-xl shadow-md"
            />
          </div>

          <p className="mt-10 text-center text-[11px] text-zinc-500 sm:text-xs">
            © {new Date().getFullYear()}{" "}
            <CaptureFooterAfiliadoAnalyticsLink className="text-inherit underline-offset-2 hover:underline" />
          </p>
        </section>
      </div>
    </>
  );
}
