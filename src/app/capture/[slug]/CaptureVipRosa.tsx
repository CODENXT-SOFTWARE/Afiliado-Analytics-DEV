"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Flame } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";
import { isWhatsAppUrl, trackPixelLead, useCaptureVipFonts } from "./capture-vip-shared";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "./capture-responsive-classes";
import { CaptureOfertCarouselIf } from "./CaptureOfertCarouselIf";
import { normalizeVipRosaCardsFromDb } from "@/lib/capture-promo-cards";
import { promoRosaGoogleFontHref, resolvePromoRosaUi } from "@/lib/capture-promo-rosa-ui";
import { CaptureRosaPromoLead } from "./CaptureRosaPromoLead";
import { CaptureFooterAfiliadoAnalyticsLink } from "./CaptureFooterAfiliadoAnalyticsLink";

function hexToRgbTriplet(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "182, 93, 120";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

type VipTheme = {
  primary: string;
  deep: string;
  bg: string;
  textMain: string;
  textSoft: string;
  cardBorder: string;
  progressTrackBorder: string;
  cardBg: string;
  benefitCardBg: string;
  topBarBg: string;
  headingFont: string;
  showDotPattern: boolean;
  containerRadius: string;
  ctaRadius: string;
  cardShadow: string;
  footerMuted: string;
};

/** Pastéis derivados de #fc00ab · #d2017a · #a3018f · #6e1279 (misturados com branco). */
const VIP_ROSA_THEME: VipTheme = {
  primary: "#e87ab8",
  deep: "#8b5f96",
  bg: "#fdf7fc",
  textMain: "#2d2030",
  textSoft: "#6f5f72",
  cardBorder: "rgba(232, 122, 184, 0.32)",
  progressTrackBorder: "rgba(139, 95, 150, 0.2)",
  cardBg: "#fffcfe",
  benefitCardBg: "#ffffff",
  topBarBg: "linear-gradient(92deg, #fceaf6 0%, #f4dff2 42%, #ecd6ee 100%)",
  headingFont: "'Playfair Display', serif",
  showDotPattern: true,
  containerRadius: "26px",
  ctaRadius: "9999px",
  cardShadow: "0 14px 42px rgba(110, 18, 121, 0.07), 0 2px 10px rgba(163, 1, 143, 0.05)",
  footerMuted: "#a08fa3",
};

const TOTAL_SPOTS = 60;

export default function CaptureVipRosa(props: CaptureVipLandingProps) {
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
    promoRosaUi,
    promoRosaCardImageUrls,
    metaPixelId,
  } = props;

  const promoOn = promoSectionsEnabled !== false;
  const benefitsHeading =
    (promoTitles?.benefits ?? "").trim() || "O que você vai encontrar:";
  const rosaBenefitRows = useMemo(() => normalizeVipRosaCardsFromDb(promoCards), [promoCards]);

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";

  const safeTitle = title.trim() || "Grupo VIP";
  const safeDesc =
    description.trim() ||
    "Entre no grupo e receba promoções, ofertas e descontos reais — antes de acabar.";
  const safeBtn = buttonText.trim() || "Quero entrar agora";
  const color = buttonColor || "#25D366";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const [eleganteFilledPct, setEleganteFilledPct] = useState(70);

  useCaptureVipFonts();

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    const t = setInterval(() => {
      setEleganteFilledPct((p) => Math.min(100, p + 1));
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const theme = VIP_ROSA_THEME;
  const rosaPct = eleganteFilledPct;
  const rosaSpotsRemaining = Math.max(0, Math.round((TOTAL_SPOTS * (100 - rosaPct)) / 100));

  const promoRosaResolved = useMemo(
    () =>
      resolvePromoRosaUi("vip_rosa", promoRosaUi, color, {
        primary: theme.primary,
        textMain: theme.textMain,
        textSoft: theme.textSoft,
        benefitCardBg: theme.benefitCardBg,
        bg: theme.bg,
      }),
    [promoRosaUi, color, theme.primary, theme.textMain, theme.textSoft, theme.benefitCardBg, theme.bg],
  );

  useEffect(() => {
    const href = promoRosaGoogleFontHref(promoRosaResolved.fontPreset);
    if (!href || typeof document === "undefined") return;
    const id = "capture-promo-rosa-font-vip";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [promoRosaResolved.fontPreset]);

  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes capture-vip-rosa-sweep {
            0% { transform: translateX(-130%) skewX(-12deg); }
            100% { transform: translateX(230%) skewX(-12deg); }
          }
          @keyframes capture-vip-rosa-blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.35; }
          }
          .capture-vip-rosa-cta-sheen {
            position: absolute;
            inset: -2px;
            z-index: 0;
            width: 42%;
            pointer-events: none;
            background: linear-gradient(
              105deg,
              transparent 0%,
              rgba(255, 255, 255, 0) 35%,
              rgba(255, 255, 255, 0.55) 50%,
              rgba(255, 255, 255, 0) 65%,
              transparent 100%
            );
            animation: capture-vip-rosa-sweep 2.6s ease-in-out infinite;
          }
          .capture-vip-rosa-ultimas {
            animation: capture-vip-rosa-blink 0.9s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .capture-vip-rosa-cta-sheen { animation: none !important; }
            .capture-vip-rosa-ultimas { animation: none !important; }
          }
        `,
        }}
      />
      <div
        className="min-h-screen"
        style={{
          fontFamily: "'Lato', sans-serif",
          backgroundColor: theme.bg,
          backgroundImage: theme.showDotPattern
            ? `radial-gradient(rgba(${hexToRgbTriplet(theme.primary)}, 0.12) 1px, transparent 1px)`
            : undefined,
          backgroundSize: theme.showDotPattern ? "20px 20px" : undefined,
          color: theme.textMain,
          padding: "58px 16px 110px",
        }}
      >
        <div
          className="fixed top-0 left-0 z-[1001] flex w-full items-center justify-center gap-2 border-b py-2.5 text-xs font-black uppercase tracking-wide shadow-sm backdrop-blur-[2px]"
          style={{
            background: theme.topBarBg,
            borderColor: "rgba(163, 1, 143, 0.12)",
            color: theme.textMain,
          }}
        >
          <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: theme.primary }} aria-hidden />
          Últimas vagas disponíveis
          <Flame className="h-3.5 w-3.5 shrink-0" style={{ color: theme.primary }} aria-hidden />
        </div>

        <div
          className="mx-auto w-full max-w-[420px] border px-5 pb-6 pt-7 text-center"
          style={{
            borderRadius: theme.containerRadius,
            background: theme.cardBg,
            borderColor: theme.cardBorder,
            boxShadow: theme.cardShadow,
          }}
        >
          <div
            className="mx-auto mb-3.5 flex h-[115px] w-[115px] items-center justify-center overflow-hidden rounded-full border-[3px] bg-white shadow-md"
            style={{ borderColor: `${theme.primary}8c` }}
          >
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt=""
                width={115}
                height={115}
                className="h-full w-full object-cover"
                unoptimized={logoUrl.startsWith("blob:")}
              />
            ) : (
              <span className="text-sm font-bold text-neutral-400">Logo</span>
            )}
          </div>

          <h1
            className={`mb-2.5 ${CAPTURE_TITLE_HERO} font-bold`}
            style={{
              fontFamily: theme.headingFont,
              color: theme.textMain,
            }}
          >
            {safeTitle}
          </h1>

          <CaptureOfertCarouselIf
            {...props}
            slot="below_title"
            variant="light"
            eyebrow="Destaques"
          />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_title"
            className="mb-3.5 w-full text-left"
          />

          <p
            className={`mb-3.5 px-0.5 ${CAPTURE_BODY} font-normal`}
            style={{ color: theme.textSoft }}
          >
            {safeDesc}
          </p>

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="above_cta"
            className="mb-3.5 w-full text-left"
          />

          <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

          <div className="my-2">
            <a
              href={ctaHref}
              onClick={() => trackPixelLead(metaPixelId)}
              className={`relative isolate ${CAPTURE_CTA_CLASS} uppercase font-black tracking-wide overflow-hidden shadow-lg transition-transform hover:-translate-y-0.5`}
              style={{
                borderRadius: theme.ctaRadius,
                backgroundColor: color,
                boxShadow: `0 6px 20px rgba(${r},${g},${b},0.4)`,
              }}
            >
              <span className="capture-vip-rosa-cta-sheen" aria-hidden />
              <span className="relative z-[1] flex min-w-0 flex-1 items-center justify-center gap-2 px-1">
                {showWa ? <FaWhatsapp className="text-xl shrink-0" aria-hidden /> : null}
                <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
              </span>
            </a>
            <p className="mt-2.5 text-xs font-extrabold" style={{ color: theme.deep }}>
              ✅ Grupo seguro — ofertas novas todos os dias
            </p>
          </div>

          <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_cta"
            className="mb-4 w-full text-left"
          />

          {rosaPct >= 100 ? (
            <p
              className="capture-vip-rosa-ultimas mb-2 text-center text-sm font-black uppercase tracking-widest text-red-600"
              role="status"
            >
              ÚLTIMAS VAGAS
            </p>
          ) : null}

          <div
            className="mb-4 mt-4 rounded-xl border px-4 py-3.5 text-left shadow-sm"
            style={{
              background: "linear-gradient(180deg, rgba(252, 0, 171, 0.06) 0%, rgba(110, 18, 121, 0.04) 100%)",
              borderColor: `${theme.primary}55`,
            }}
          >
            <div className="mb-2 flex items-start justify-between gap-2 text-sm font-black" style={{ color: theme.textMain }}>
              <span className="inline-flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]"
                  aria-hidden
                />
                Vagas preenchidas
              </span>
              <span className="shrink-0 tabular-nums" style={{ color: theme.deep }}>
                {rosaPct}%
              </span>
            </div>
            <div
              className="mb-2.5 h-2.5 w-full overflow-hidden rounded-full border bg-white/90"
              style={{ borderColor: theme.progressTrackBorder }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${rosaPct}%`,
                  background: "linear-gradient(90deg, #c9a3d4 0%, #e87ab8 45%, #f5b8e0 100%)",
                }}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 text-[13px] font-semibold">
              <span style={{ color: theme.textSoft }}>
                Restam <span style={{ color: theme.textMain }}>{rosaSpotsRemaining}</span> vagas
              </span>
              <span className="text-[11px] font-medium opacity-80" style={{ color: theme.textSoft }}>
                ao vivo
              </span>
            </div>
          </div>

          {promoOn ? (
            <div style={{ fontFamily: promoRosaResolved.fontFamilyCss }}>
              <p
                className="mb-3 text-left font-black uppercase tracking-wide"
                style={{ color: promoRosaResolved.headingColor, fontSize: promoRosaResolved.headingFontPx }}
              >
                {benefitsHeading}
              </p>

              <div className="mb-4 space-y-3.5 text-left">
                {rosaBenefitRows.map((row, i) => (
                  <div
                    key={`vip-rosa-benefit-${i}`}
                    className="flex items-start gap-3 rounded-xl p-3 shadow-sm border"
                    style={{
                      borderColor: promoRosaResolved.cardBorder,
                      backgroundColor: promoRosaResolved.cardBg,
                      borderLeftWidth: 3,
                      borderLeftStyle: "solid",
                      borderLeftColor: promoRosaResolved.leftAccent,
                    }}
                  >
                    <CaptureRosaPromoLead
                      row={row}
                      iconTint={theme.deep}
                      imagePublicUrl={promoRosaCardImageUrls?.[i] ?? null}
                    />
                    <div>
                      <h3
                        className="mb-1 font-black uppercase"
                        style={{ color: promoRosaResolved.titleColor, fontSize: promoRosaResolved.titleFontPx }}
                      >
                        {row.title}
                      </h3>
                      <p className="leading-snug" style={{ color: promoRosaResolved.bodyColor, fontSize: promoRosaResolved.bodyFontPx }}>
                        {row.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="card_end"
            className="mb-4 w-full text-left"
          />

          <footer
            className="mt-4 flex flex-col items-center gap-3 border-t pt-4 text-[11px]"
            style={{ borderColor: `${theme.primary}40`, color: theme.footerMuted }}
          >
            <div>
              <a
                href="https://afiliadoanalytics.com.br"
                target="_blank"
                rel="noopener noreferrer"
                className="font-extrabold no-underline hover:underline"
                style={{ color: theme.textMain }}
              >
                Política e termos
              </a>
            </div>
            <span
              className="rounded-full px-3.5 py-1.5 text-[11px] font-black text-white shadow-md"
              style={{
                background: "linear-gradient(135deg, #b89bc4 0%, #8b5f96 55%, #7a5490 100%)",
              }}
            >
              Feito com ❤️ por{" "}
              <CaptureFooterAfiliadoAnalyticsLink className="font-black text-white underline-offset-2 hover:underline" />
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
