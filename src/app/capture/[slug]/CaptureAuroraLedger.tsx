"use client";

import { useMemo, type ReactNode } from "react";
import Image from "next/image";
import { Clock } from "lucide-react";
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
import { AURORA_CARD_DEFAULTS, normalizeAuroraCardsFromDb } from "@/lib/capture-promo-cards";

const ACCENT = "#5eead4";
const AMBER = "#fbbf24";

const PARTNER_LOGOS = [
  { src: "/logo-shopee_ae8b716c.png", alt: "Shopee" },
  { src: "/logo-mercadolivre_5d835dbf.png", alt: "Mercado Livre" },
  { src: "/logo-amazon_99ccd542.png", alt: "Amazon" },
] as const;

function CtaButton(props: {
  href: string;
  children: ReactNode;
  r: number;
  g: number;
  b: number;
  className?: string;
}) {
  const { href, children, r, g, b, className = "" } = props;
  return (
    <a
      href={href}
      className={`capture-aurora-cta relative ${CAPTURE_CTA_CLASS_UPPER} overflow-hidden font-black tracking-[0.12em] transition-transform hover:scale-[1.02] active:scale-[0.98] ${className}`}
      style={{
        backgroundColor: `rgb(${r},${g},${b})`,
        boxShadow: `0 12px 40px rgba(${r},${g},${b},0.38)`,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.35) 50%, transparent 60%)`,
          backgroundSize: "200% 100%",
        }}
        aria-hidden
      />
      <span className="relative z-[1] flex min-w-0 w-full items-center justify-center gap-2 px-1">
        {children}
      </span>
    </a>
  );
}

export default function CaptureAuroraLedger(props: CaptureVipLandingProps) {
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
    promoAuroraAvatarUrls,
  } = props;

  const promoOn = promoSectionsEnabled !== false;
  const testimonialsHeading =
    (promoTitles?.testimonials ?? "").trim() || "Quem já economizou no grupo";
  const auroraRows = useMemo(() => normalizeAuroraCardsFromDb(promoCards), [promoCards]);

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";

  const safeTitle = title.trim() || "O grupo que o feed esconde.";
  const safeDesc =
    description.trim() ||
    "Entre na sala onde afiliados e compradores inteligentes pegam ofertas, cupons e links limpos — antes que a promoção esfrie.";
  const safeBtn = (buttonText.trim() || "Quero entrar na sala").toUpperCase();
  const color = buttonColor || "#10b981";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());
  return (
    <>
      <CaptureVipEntradaToasts disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes capture-aurora-float-a {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.35; }
            50% { transform: translate(12%, -8%) scale(1.08); opacity: 0.55; }
          }
          @keyframes capture-aurora-float-b {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.28; }
            50% { transform: translate(-10%, 10%) scale(1.12); opacity: 0.5; }
          }
          @keyframes capture-aurora-float-c {
            0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.22; }
            50% { transform: translate(6%, 14%) scale(1.05); opacity: 0.42; }
          }
          @keyframes capture-aurora-pulse-dot {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(0.92); }
          }
          @keyframes capture-aurora-cta-glow {
            0%, 100% { box-shadow: 0 12px 40px rgba(${r},${g},${b},0.32); }
            50% { box-shadow: 0 16px 52px rgba(${r},${g},${b},0.5); }
          }
          .capture-aurora-cta {
            animation: capture-aurora-cta-glow 2.8s ease-in-out infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .capture-aurora-orb-a, .capture-aurora-orb-b, .capture-aurora-orb-c { animation: none !important; }
            .capture-aurora-live-dot { animation: none !important; }
            .capture-aurora-cta { animation: none !important; }
          }
        `,
        }}
      />

      <div
        className="relative min-h-screen overflow-x-hidden pb-12 text-zinc-100 sm:pb-14"
        style={{
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          backgroundColor: "#030712",
        }}
      >
        {/* Aurora de fundo */}
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          <div
            className="capture-aurora-orb-a absolute -left-1/4 top-0 h-[min(90vw,520px)] w-[min(90vw,520px)] rounded-full blur-[100px]"
            style={{
              background: `radial-gradient(circle at 30% 30%, ${ACCENT} 0%, transparent 65%)`,
              animation: "capture-aurora-float-a 18s ease-in-out infinite",
            }}
          />
          <div
            className="capture-aurora-orb-b absolute -right-1/4 top-1/3 h-[min(85vw,480px)] w-[min(85vw,480px)] rounded-full blur-[110px]"
            style={{
              background: `radial-gradient(circle at 70% 40%, #a78bfa 0%, transparent 68%)`,
              animation: "capture-aurora-float-b 22s ease-in-out infinite",
            }}
          />
          <div
            className="capture-aurora-orb-c absolute bottom-0 left-1/3 h-[min(70vw,400px)] w-[min(70vw,400px)] rounded-full blur-[90px]"
            style={{
              background: `radial-gradient(circle at 50% 50%, ${AMBER} 0%, transparent 70%)`,
              animation: "capture-aurora-float-c 20s ease-in-out infinite",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.06)_0%,_transparent_55%)]" />
        </div>

        <div className="relative z-[1] mx-auto flex w-full max-w-md flex-col px-4 pb-6 pt-8 sm:pt-12">
          {/* Eyebrow */}
          <div className="mb-6 flex justify-center">
            <div
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-widest text-zinc-300 backdrop-blur-md"
              style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)" }}
            >
              <span
                className="capture-aurora-live-dot h-2 w-2 rounded-full bg-emerald-400"
                style={{ animation: "capture-aurora-pulse-dot 1.8s ease-in-out infinite" }}
              />
              Convite ativo • vaga liberada
            </div>
          </div>

          {/* Cartão principal */}
          <article
            className="rounded-[1.75rem] border border-white/[0.09] bg-white/[0.05] px-7 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:p-8"
            style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 80px rgba(0,0,0,0.45)" }}
          >
            {logoUrl ? (
              <div className="mb-6 flex justify-center">
                <div className="relative h-[92px] w-[92px] overflow-hidden rounded-2xl border border-white/10 bg-white/[0.08] shadow-lg ring-1 ring-white/5">
                  <Image src={logoUrl} alt="Logo" fill className="object-contain p-2" sizes="92px" />
                </div>
              </div>
            ) : null}

            <h1
              className={`${CAPTURE_TITLE_HERO} font-black text-white sm:text-4xl`}
              style={{ fontFamily: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif" }}
            >
              {safeTitle}
            </h1>

            <CaptureOfertCarouselIf
              {...props}
              slot="below_title"
              variant="aurora"
              eyebrow="Achados que rolam na sala"
              bleed
            />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="below_title"
              className="mt-6 w-full"
            />

            <CaptureOfertCarouselIf
              {...props}
              slot="above_cta"
              variant="aurora"
              eyebrow="Achados que rolam na sala"
              bleed
            />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="above_cta"
              className="mt-6 w-full"
            />

            <div className="mt-6">
              <CtaButton href={ctaHref} r={r} g={g} b={b}>
                {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
                <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
              </CtaButton>
              <p className="mt-3 text-center text-xs text-zinc-500">
                Depois do toque, confirme em <span className="font-semibold text-zinc-400">Continuar</span> no
                WhatsApp.
              </p>
            </div>

            <CaptureOfertCarouselIf
              {...props}
              slot="below_cta"
              variant="aurora"
              eyebrow="Achados que rolam na sala"
              bleed
            />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="below_cta"
              className="mt-6 w-full"
            />

            <p className={`mt-6 ${CAPTURE_BODY} text-zinc-400 sm:text-base`}>{safeDesc}</p>

            {/* Gatilho editorial (copy fixa do template) */}
            <p
              className="mt-5 border-l-2 pl-4 text-sm italic leading-snug text-zinc-500"
              style={{ borderColor: ACCENT }}
            >
              O algoritmo mostra depois.{" "}
              <span className="font-semibold not-italic text-zinc-300">Quem está dentro vê primeiro.</span>
            </p>

            {/* Barra de urgência suave */}
            <div className="mt-6">
              <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                <span className="flex items-center gap-1.5 normal-case text-zinc-500">
                  <Clock className="h-3.5 w-3.5 text-red-400/85" aria-hidden />
                  <span className="uppercase tracking-wide">Status do grupo</span>
                </span>
                <span className="text-xs font-bold uppercase tracking-wide text-red-400">Quase lotado</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div
                  className="h-full w-[93%] rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${ACCENT}, #ef4444)`,
                    boxShadow: `0 0 14px rgba(239,68,68,0.45), 0 0 8px rgba(94,234,212,0.25)`,
                  }}
                />
              </div>
            </div>

            {/* Depoimentos (fictícios — ilustração de prova social) */}
            {promoOn ? (
              <div className="mt-8">
                <p className="mb-4 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">
                  {testimonialsHeading}
                </p>
                <ul className="space-y-5" aria-label="Depoimentos de participantes">
                  {auroraRows.map((text, i) => {
                    const fallback =
                      AURORA_CARD_DEFAULTS[Math.min(i, AURORA_CARD_DEFAULTS.length - 1)]!.defaultAvatar;
                    const imgSrc = promoAuroraAvatarUrls?.[i] ?? fallback;
                    return (
                      <li key={`aurora-t-${i}`} className="flex gap-4">
                        <div
                          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-md ring-1 ring-teal-400/25"
                          style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)" }}
                        >
                          <Image
                            src={imgSrc}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="48px"
                            unoptimized={imgSrc.startsWith("blob:") || imgSrc.startsWith("http")}
                          />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                            {String(i + 1).padStart(2, "0")}
                          </p>
                          <p className="font-bold text-zinc-100">
                            {text.name}
                            <span className="font-medium text-zinc-500"> · {text.city}</span>
                          </p>
                          <p className="mt-1.5 text-sm leading-snug text-zinc-400">
                            <span className="text-teal-400/90" aria-hidden>
                              “
                            </span>
                            {text.quote}
                            <span className="text-teal-400/90" aria-hidden>
                              ”
                            </span>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="mt-8">
              <CtaButton href={ctaHref} r={r} g={g} b={b}>
                {showWa ? <FaWhatsapp className="text-2xl shrink-0" aria-hidden /> : null}
                <span className={CAPTURE_CTA_LABEL}>{safeBtn}</span>
              </CtaButton>
              <p className="mt-3 text-center text-xs text-zinc-500">
                Depois do toque, confirme em <span className="font-semibold text-zinc-400">Continuar</span> no
                WhatsApp.
              </p>
            </div>

            <CaptureOfertCarouselIf
              {...props}
              slot="card_end"
              variant="aurora"
              eyebrow="Achados que rolam na sala"
              bleed
            />

            <CaptureYoutubeAtSlot
              url={youtubeUrl}
              position={youtubePosition}
              slot="card_end"
              className="mt-8 w-full"
              eyebrow="Veja em 30 segundos por que entram"
            />
          </article>

          {/* Passos + prova social leve */}
          <section className="mt-8 rounded-2xl border border-white/[0.07] bg-black/20 px-5 py-5 backdrop-blur-md">
            <p className="text-center text-xs font-bold uppercase tracking-widest text-zinc-500">
              O que acontece agora
            </p>
            <ol className="mt-4 space-y-3 text-sm text-zinc-400">
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-black text-teal-300">
                  1
                </span>
                <span>
                  Você entra na conversa certa — sem baixar app estranho e sem criar senha.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-black text-teal-300">
                  2
                </span>
                <span>As ofertas passam a chegar onde você já vive: direto no seu WhatsApp.</span>
              </li>
            </ol>
          </section>

          {/* Logos */}
          <div className="mt-8">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
              Achados nas plataformas que você já usa
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-6 opacity-80 grayscale-[0.35]">
              {PARTNER_LOGOS.map((p) => (
                <Image
                  key={p.src}
                  src={p.src}
                  alt={p.alt}
                  width={100}
                  height={32}
                  className="h-7 w-auto object-contain brightness-125"
                />
              ))}
            </div>
          </div>

          <footer className="mt-10 text-center text-[11px] leading-relaxed text-zinc-600">
            © {new Date().getFullYear()} Afiliado Analytics. Página segura • dados usados só para contagem de
            visitas.
          </footer>
        </div>

      </div>
    </>
  );
}
