"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Clock, Shield, Star } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import type { CaptureVipLandingProps } from "./capture-vip-types";
import { isWhatsAppUrl, useCaptureVipFonts } from "./capture-vip-shared";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "./capture-responsive-classes";
import { CaptureOfertCarouselIf } from "./CaptureOfertCarouselIf";
import { normalizeVipTerrosoCardsFromDb } from "@/lib/capture-promo-cards";

const TERROSO = {
  accent: "rgb(160, 117, 90)",
  accentRgb: "160, 117, 90",
  ctaFrom: "rgb(184, 134, 92)",
  ctaTo: "rgba(184, 134, 92, 0.867)",
  ringPurple: "rgb(155, 93, 229)",
  bg: "rgb(245, 237, 228)",
  text: "rgb(26, 26, 46)",
  textMuted: "rgba(26, 26, 46, 0.7)",
  textFooter: "rgba(26, 26, 46, 0.6)",
  textFooterFaint: "rgba(26, 26, 46, 0.35)",
  textLink: "rgba(26, 26, 46, 0.45)",
  cardBorder: "rgba(160, 117, 90, 0.19)",
  scarcityBorder: "rgba(160, 117, 90, 0.25)",
  cardShadow: "rgba(0, 0, 0, 0.06) 0px 2px 8px",
  ctaShadow: "rgba(184, 134, 92, 0) 0px 0px 0px 0px, rgba(184, 134, 92, 0.267) 0px 0px 10px",
} as const;

const MIN_SPOTS = 12;

export default function CaptureVipTerroso(props: CaptureVipLandingProps) {
  const {
    title,
    description,
    buttonText,
    ctaHref,
    logoUrl,
    youtubeUrl,
    youtubePosition,
    previewMode = false,
    notificationsEnabled,
    notificationsPosition,
    promoSectionsEnabled,
    promoTitles,
    promoCards,
  } = props;

  const promoOn = promoSectionsEnabled !== false;
  const inGroupHeading =
    (promoTitles?.inGroup ?? "").trim() || "No grupo você vai encontrar:";
  const terrosoRows = useMemo(() => normalizeVipTerrosoCardsFromDb(promoCards), [promoCards]);

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";

  const safeTitle = title.trim() || "Grupo VIP";
  const safeDesc =
    description.trim() ||
    "Entre no grupo e receba promoções, ofertas e descontos reais — antes de acabar.";
  const safeBtn = buttonText.trim() || "Quero entrar agora";
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const [spotsLeft, setSpotsLeft] = useState(42);
  const [spotsPulse, setSpotsPulse] = useState(false);
  const prevSpotsRef = useRef(42);

  useCaptureVipFonts();

  useEffect(() => {
    const t = setInterval(() => {
      setSpotsLeft((s) => (s > MIN_SPOTS ? s - 1 : 42));
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (spotsLeft < prevSpotsRef.current) {
      setSpotsPulse(true);
      const id = window.setTimeout(() => setSpotsPulse(false), 700);
      prevSpotsRef.current = spotsLeft;
      return () => window.clearTimeout(id);
    }
    prevSpotsRef.current = spotsLeft;
  }, [spotsLeft]);

  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes capture-vip-terroso-cta-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.06); }
          }
          .capture-vip-terroso-cta-pulse {
            transform-origin: center;
            animation: capture-vip-terroso-cta-pulse 1.6s ease-in-out infinite;
            will-change: transform;
          }
          @keyframes capture-vip-terroso-spots-down {
            0% { color: rgb(160, 117, 90); transform: scale(1); }
            45% { color: rgb(220, 38, 38); transform: scale(1.12); }
            100% { color: rgb(160, 117, 90); transform: scale(1); }
          }
          .capture-vip-terroso-spots-value {
            color: rgb(160, 117, 90);
          }
          .capture-vip-terroso-spots-down {
            animation: capture-vip-terroso-spots-down 0.65s ease-out 1 both;
          }
          @keyframes capture-vip-terroso-hourglass-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          .capture-vip-terroso-hourglass {
            display: inline-block;
            transform-origin: 50% 55%;
            animation: capture-vip-terroso-hourglass-spin 12s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .capture-vip-terroso-cta-pulse { animation: none !important; }
            .capture-vip-terroso-hourglass { animation: none !important; }
            .capture-vip-terroso-spots-down {
              animation: none !important;
              color: rgb(220, 38, 38) !important;
              transition: color 0.2s ease;
            }
          }
        `,
        }}
      />
      <div
        className="relative isolate flex min-h-screen flex-col items-center"
        style={{
          fontFamily: "'Lato', sans-serif",
          colorScheme: "light",
          color: TERROSO.text,
          backgroundColor: TERROSO.bg,
          backgroundImage: `linear-gradient(135deg, rgba(${TERROSO.accentRgb}, 0.094) 0%, ${TERROSO.bg} 50%, ${TERROSO.bg} 100%)`,
          backgroundRepeat: "no-repeat",
          paddingTop: "42px",
          paddingBottom: "48px",
        }}
      >
        <div
          className="fixed top-0 left-0 z-[1001] w-full py-2.5 text-center text-sm font-bold tracking-wide text-white"
          style={{ background: TERROSO.accent }}
        >
          <span className="animate-pulse">🔥 Grupo quase lotado!</span>
        </div>

        <div className="mx-auto flex w-full max-w-md flex-col items-center gap-6 px-5 py-8">
          <div
            className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full p-[3px]"
            style={{
              background: `linear-gradient(135deg, ${TERROSO.accent}, ${TERROSO.ringPurple})`,
            }}
          >
            <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Perfil"
                  width={112}
                  height={112}
                  className="h-full w-full object-cover"
                  unoptimized={logoUrl.startsWith("blob:")}
                />
              ) : (
                <span className="text-xs font-semibold text-neutral-400">Logo</span>
              )}
            </div>
          </div>

          <h1 className={`${CAPTURE_TITLE_HERO} font-bold`} style={{ color: TERROSO.text }}>
            {safeTitle}
          </h1>

          <CaptureOfertCarouselIf {...props} slot="below_title" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_title"
            className="w-full"
          />

          <p className={`${CAPTURE_BODY} font-medium`} style={{ color: TERROSO.textMuted }}>
            {safeDesc}
          </p>

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="above_cta"
            className="w-full"
          />

          <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

          <div className="w-full">
            <a
              href={ctaHref}
              className={`capture-vip-terroso-cta-pulse ${CAPTURE_CTA_CLASS} text-lg font-extrabold tracking-wide transition-opacity hover:opacity-95 active:opacity-90`}
              style={{
                background: `linear-gradient(135deg, ${TERROSO.ctaFrom} 0%, ${TERROSO.ctaTo} 100%)`,
                boxShadow: TERROSO.ctaShadow,
              }}
            >
              {showWa ? <FaWhatsapp className="text-xl shrink-0" aria-hidden /> : null}
              <span className={CAPTURE_CTA_LABEL}>{safeBtn.toUpperCase()}</span>
            </a>
          </div>

          <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_cta"
            className="w-full"
          />

          <div
            className="flex w-full flex-col items-center rounded-xl border px-4 py-3.5 text-center sm:px-5 sm:py-3.5"
            style={{
              background: "rgb(255, 255, 255)",
              borderColor: TERROSO.scarcityBorder,
              color: TERROSO.text,
            }}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              <Clock className="h-5 w-5 shrink-0" style={{ color: TERROSO.accent }} aria-hidden />
              <span className="capture-vip-terroso-hourglass text-[1.125rem] leading-none" aria-hidden>
                ⏳
              </span>
              <span className="text-[13px] font-semibold leading-snug sm:text-[15px]">Vagas restantes</span>
            </div>
            <p
              className={`capture-vip-terroso-spots-value mt-2.5 w-full text-center text-[clamp(1.85rem,9vw,2.35rem)] font-extrabold tabular-nums leading-none tracking-tight sm:mt-2 sm:text-[clamp(1.75rem,5vw,2.1rem)] ${
                spotsPulse ? "capture-vip-terroso-spots-down" : ""
              }`}
            >
              {spotsLeft}
            </p>
          </div>

          {promoOn ? (
            <div className="mt-2 w-full space-y-3">
              <h2
                className="text-center text-sm font-bold uppercase tracking-widest"
                style={{ color: TERROSO.accent }}
              >
                {inGroupHeading}
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {terrosoRows.map((row, i) => (
                  <div
                    key={`terroso-benefit-${i}`}
                    className="flex flex-col items-center gap-1 rounded-xl px-4 py-4 text-center"
                    style={{
                      background: "rgb(255, 255, 255)",
                      border: `1px solid ${TERROSO.cardBorder}`,
                      boxShadow: TERROSO.cardShadow,
                    }}
                  >
                    <span className="text-3xl" aria-hidden>
                      {row.emoji}
                    </span>
                    <p className="text-sm font-bold" style={{ color: TERROSO.text }}>
                      {row.title}
                    </p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(26, 26, 46, 0.6)" }}>
                      {row.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: TERROSO.textFooter }}>
            <Shield className="h-4 w-4 shrink-0" aria-hidden />
            <span>Grupo seguro e verificado</span>
          </div>

          <p
            className="mt-4 max-w-md px-4 text-center text-xs leading-relaxed"
            style={{ color: TERROSO.textFooter }}
          >
            ⚠️ Vagas limitadas | Oferta válida apenas enquanto houver vagas.
          </p>

          <div className="flex items-center gap-1 pb-4 text-xs" style={{ color: TERROSO.textFooter }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5 fill-current"
                style={{ color: TERROSO.accent }}
                aria-hidden
              />
            ))}
            <span className="ml-1">+2.400 membros satisfeitos</span>
          </div>

          <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="card_end"
            className="w-full"
          />

          <div className="pb-2 text-center text-xs" style={{ color: TERROSO.textFooterFaint }}>
            Feito com{" "}
            <span style={{ color: "rgb(233, 30, 140)" }} aria-hidden>
              ❤️
            </span>{" "}
            no{" "}
            <a
              href="https://afiliadoanalytics.com.br"
              target="_blank"
              rel="noopener noreferrer"
              className="underline transition-opacity hover:opacity-80"
              style={{ color: TERROSO.textLink }}
            >
              Afiliado Analytics
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
