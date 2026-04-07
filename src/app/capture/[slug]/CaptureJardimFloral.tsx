"use client";

import Image from "next/image";
import { Heart, Sparkles } from "lucide-react";
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

const ROSE_DARK = "#9f1239";
const ROSE_DEEP = "#831843";
const ROSE_SOFT = "#fbcfe8";
const ROSE_MIST = "#fdf2f8";
const WHITE = "#ffffff";

/** Plano de fundo fotográfico (mobile: cover · desktop: repeat). */
const JARDIM_BG_IMAGE = "/campflor.png";

const BULLETS = [
  "Achadinhos fofos e cupons que parecem presente",
  "Sem pressa feia: você entra quando quiser",
  "Tudo num clima leve — como conversar com amiga",
] as const;

/** Flor estilizada (SVG artístico). */
function FlorDeco({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="60" cy="60" r="8" fill={ROSE_SOFT} opacity="0.9" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx="60"
          cy="38"
          rx="14"
          ry="22"
          fill={ROSE_SOFT}
          opacity="0.55"
          transform={`rotate(${deg} 60 60)`}
        />
      ))}
      <circle cx="60" cy="60" r="10" fill={ROSE_DARK} opacity="0.15" />
    </svg>
  );
}

function FlorPequena({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M32 12c4 8 8 12 12 12s8-4 12-12c0 10-4 18-12 22 8 4 12 12 12 22-8-4-12-4-12-4s-4 0-12 4c0-10 4-18 12-22-8-4-12-12-12-22Z"
        fill={ROSE_SOFT}
        opacity="0.5"
      />
      <circle cx="32" cy="28" r="6" fill={ROSE_DARK} opacity="0.2" />
    </svg>
  );
}

export default function CaptureJardimFloral(props: CaptureVipLandingProps) {
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

  const safeTitle = title.trim() || "Um cantinho só seu no grupo";
  const safeDesc =
    description.trim() ||
    "Flores, ofertas leves e aquele carinho de quem te avisa antes da promoção sumir. Vem com calma — a porta está aberta.";
  const safeBtn = buttonText.trim() || "Entrar no grupo";
  const color = buttonColor || "#e11d48";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());
  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes jardim-float {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-8px) rotate(3deg); }
          }
          @keyframes jardim-sparkle {
            0%, 100% { opacity: 0.35; transform: scale(1); }
            50% { opacity: 0.85; transform: scale(1.08); }
          }
          .jardim-deco-float { animation: jardim-float 7s ease-in-out infinite; }
          .jardim-deco-float-delay { animation: jardim-float 9s ease-in-out infinite 1.2s; }
          .jardim-sparkle { animation: jardim-sparkle 2.8s ease-in-out infinite; }
          @media (prefers-reduced-motion: reduce) {
            .jardim-deco-float, .jardim-deco-float-delay, .jardim-sparkle { animation: none !important; }
            .jardim-cta-pulse { animation: none !important; }
          }

          @keyframes jardim-cta-pulse-anim {
            0%, 100% {
              transform: scale(1);
              box-shadow:
                0 10px 32px rgba(${r}, ${g}, ${b}, 0.36),
                0 0 0 3px rgba(255, 255, 255, 0.55),
                0 0 0 0 rgba(${r}, ${g}, ${b}, 0.35);
            }
            50% {
              transform: scale(1.045);
              box-shadow:
                0 14px 40px rgba(${r}, ${g}, ${b}, 0.48),
                0 0 0 4px rgba(255, 255, 255, 0.65),
                0 0 0 12px rgba(${r}, ${g}, ${b}, 0);
            }
          }
          .jardim-cta-pulse {
            transform-origin: center;
            animation: jardim-cta-pulse-anim 2.2s ease-in-out infinite;
            will-change: transform;
          }

          .jardim-floral-surface {
            position: relative;
            isolation: isolate;
            background-color: ${ROSE_MIST};
            background-image: url("${JARDIM_BG_IMAGE}");
            background-position: center top;
            background-size: cover;
            background-repeat: no-repeat;
            background-attachment: scroll;
          }
          .jardim-floral-surface::before {
            content: "";
            position: ${previewMode ? "absolute" : "fixed"};
            inset: 0;
            z-index: 0;
            pointer-events: none;
            background: linear-gradient(
              165deg,
              rgba(255, 255, 255, 0.5) 0%,
              rgba(253, 242, 248, 0.42) 45%,
              rgba(252, 207, 232, 0.4) 100%
            );
          }
          @media (min-width: 768px) {
            .jardim-floral-surface {
              background-size: auto;
              background-repeat: repeat;
              background-position: top left;
            }
          }
        `,
        }}
      />

      <div
        className={`jardim-floral-surface ${previewMode ? "min-h-full" : "min-h-screen"} overflow-x-hidden px-4 pb-14 pt-10 sm:pt-14`}
        style={{
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Apple Color Emoji", sans-serif',
          color: ROSE_DEEP,
        }}
      >
        {/* No preview do dashboard: absolute (não fixed), senão o véu e as flores ancoram à viewport e “somem” do mockup). */}
        <div
          className={`pointer-events-none inset-0 z-[1] overflow-hidden ${previewMode ? "absolute" : "fixed"}`}
          aria-hidden
        >
          <div
            className="absolute -right-16 top-24 h-72 w-72 rounded-full opacity-[0.18] blur-3xl md:opacity-[0.12]"
            style={{ background: `radial-gradient(circle, ${ROSE_SOFT} 0%, transparent 70%)` }}
          />
          <div
            className="absolute -left-20 top-1/3 h-64 w-64 rounded-full opacity-[0.15] blur-3xl md:opacity-[0.1]"
            style={{ background: `radial-gradient(circle, #fce7f3 0%, transparent 68%)` }}
          />
          <FlorDeco className="jardim-deco-float absolute -left-6 top-16 h-28 w-28 opacity-45 sm:left-4 md:opacity-35" />
          <FlorDeco className="jardim-deco-float-delay absolute -right-4 top-40 h-32 w-32 opacity-40 sm:right-8 md:opacity-30" />
          <FlorPequena className="absolute left-[12%] top-[46%] h-14 w-14 opacity-35 md:opacity-25" />
          <FlorPequena className="jardim-deco-float absolute right-[18%] bottom-[28%] h-16 w-16 opacity-30 md:opacity-22" />
        </div>

        <div className="relative z-[2] mx-auto w-full max-w-md">
          {/* Moldura tipo cartão postal */}
          <div
            className="rounded-[2rem] border-2 p-[3px] shadow-xl"
            style={{
              borderColor: `${ROSE_SOFT}`,
              background: `linear-gradient(135deg, ${WHITE}, ${ROSE_MIST})`,
              boxShadow: `0 24px 60px -12px rgba(131, 24, 67, 0.12), 0 0 0 1px rgba(255,255,255,0.8) inset`,
            }}
          >
            <div
              className="rounded-[1.85rem] px-5 py-1 sm:px-3 sm:py-4"
              style={{
                background: `linear-gradient(180deg, rgba(255,255,255,0.97) 0%, ${ROSE_MIST} 100%)`,
              }}
            >
              <div className="flex justify-center gap-1.5 text-rose-400">
                <Heart className="jardim-sparkle h-4 w-4 fill-current" strokeWidth={0} />
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                <Heart
                  className="jardim-sparkle h-4 w-4 fill-current"
                  style={{ animationDelay: "0.5s" }}
                  strokeWidth={0}
                />
              </div>

              <p
                className="mt-3 text-center text-[11px] font-semibold uppercase tracking-[0.35em]"
                style={{ color: ROSE_DARK, opacity: 0.75 }}
              >
                Jardim de ofertas
              </p>

              {logoUrl ? (
                <div className="mt-6 flex justify-center">
                  <div
                    className="relative h-[100px] w-[100px] overflow-hidden rounded-3xl border-2 shadow-md"
                    style={{
                      borderColor: ROSE_SOFT,
                      backgroundColor: WHITE,
                      boxShadow: `0 12px 28px rgba(159, 18, 57, 0.08)`,
                    }}
                  >
                    <Image src={logoUrl} alt="Logo" fill className="object-contain p-2.5" sizes="100px" />
                  </div>
                </div>
              ) : null}

              <h1
                className={`mt-6 ${CAPTURE_TITLE_HERO}`}
                style={{ color: ROSE_DEEP }}
              >
                {safeTitle}
              </h1>

              <CaptureOfertCarouselIf {...props} slot="below_title" variant="light" eyebrow="Destaques" />

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="below_title"
                className="mt-4 w-full"
              />

              <div className="mx-auto mt-4 flex justify-center gap-2" aria-hidden>
                {[0, 1, 2, 2, 1, 0].map((s, i) => (
                  <span
                    key={i}
                    className="rounded-full"
                    style={{
                      width: s === 0 ? 6 : s === 1 ? 8 : 10,
                      height: s === 0 ? 6 : s === 1 ? 8 : 10,
                      backgroundColor: s === 2 ? ROSE_DARK : ROSE_SOFT,
                      opacity: s === 2 ? 0.35 : 0.55,
                    }}
                  />
                ))}
              </div>

              <p
                className={`mt-5 ${CAPTURE_BODY}`}
                style={{ color: `${ROSE_DEEP}`, opacity: 0.82 }}
              >
                {safeDesc}
              </p>

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="above_cta"
                className="mt-6 w-full"
              />

              <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

              <div className="mt-7 flex w-full flex-col items-stretch">
                <a
                  href={ctaHref}
                  className={`jardim-cta-pulse ${CAPTURE_CTA_CLASS} rounded-full font-bold transition-transform active:scale-[0.98]`}
                  style={{
                    backgroundColor: `rgb(${r},${g},${b})`,
                  }}
                >
                  {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
                  <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
                </a>
                <p
                  className="mt-4 w-full text-center text-[13px] font-medium leading-relaxed"
                  style={{ color: ROSE_DEEP, opacity: 0.52 }}
                >
                  Grátis - Sem spam - Só carinho e oferta boa
                </p>
              </div>

              <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="below_cta"
                className="mt-6 w-full"
              />

              <ul className="mt-8 space-y-4">
                {BULLETS.map((line, i) => (
                  <li key={i} className="flex gap-3.5">
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                      style={{
                        backgroundColor: ROSE_DARK,
                        boxShadow: `0 4px 12px rgba(159, 18, 57, 0.25)`,
                      }}
                    >
                      ✿
                    </span>
                    <p className="text-sm font-medium leading-snug" style={{ color: ROSE_DEEP, opacity: 0.88 }}>
                      {line}
                    </p>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex w-full flex-col items-stretch">
                <a
                  href={ctaHref}
                  className={`jardim-cta-pulse ${CAPTURE_CTA_CLASS} rounded-full font-bold transition-transform active:scale-[0.98]`}
                  style={{
                    backgroundColor: `rgb(${r},${g},${b})`,
                    animationDelay: "0.35s",
                  }}
                >
                  {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
                  <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
                </a>
              </div>

              <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />

              <CaptureYoutubeAtSlot
                url={youtubeUrl}
                position={youtubePosition}
                slot="card_end"
                className="mt-8 w-full"
                eyebrow="Um vídeo rapidinho"
                eyebrowClassName="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-rose-900/55"
              />
            </div>
          </div>

          <p
            className="mt-8 text-center text-[11px] leading-relaxed"
            style={{ color: ROSE_DEEP, opacity: 0.45 }}
          >
            © {new Date().getFullYear()} Afiliado Analytics · feito com flores (de verdade são pixels)
          </p>
        </div>
      </div>
    </>
  );
}
