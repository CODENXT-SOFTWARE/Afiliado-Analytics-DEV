"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Flame } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import type { CaptureVipLandingProps } from "./capture-vip-types";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";
import { handlePixelCTAClick, isWhatsAppUrl } from "./capture-vip-shared";
import CaptureVipEntradaToasts from "./CaptureVipEntradaToasts";
import { CaptureYoutubeAtSlot } from "./CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS_UPPER,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "./capture-responsive-classes";
import { CaptureOfertCarouselIf } from "./CaptureOfertCarouselIf";
import { normalizeSimpleFourLinesFromDb } from "@/lib/capture-promo-cards";
import { CaptureFooterAfiliadoAnalyticsLink } from "./CaptureFooterAfiliadoAnalyticsLink";

const CARD = "#ffffff";
const TEXT = "#1c1917";
const MUTED = "#6b7280";
const RED = "#dc2626";
const ORANGE = "#f97316";
const ORANGE_50 = "rgba(249, 115, 22, 0.5)";
const LOGO_TILE_BG = "#fff7ed";
/** Sombra laranja em volta da roleta (drop-shadow). */
const WHEEL_ORANGE_GLOW =
  "drop-shadow(0 0 14px rgba(249, 115, 22, 0.55)) drop-shadow(0 0 28px rgba(249, 115, 22, 0.4)) drop-shadow(0 10px 36px rgba(234, 88, 12, 0.35))";

const CLICK_IMG = "/click.png";
/** Ficheiro em `public/90%.png` — codificar % na URL. */
const COUPON_IMG = "/90%25.png";

const SEGMENTS = 6;
const WIN_INDEX = 2;
const SEGMENT_DEG = 360 / SEGMENTS;
/** Centro do segmento vencedor (90%) em graus a partir do topo, horário. */
const WIN_CENTER_DEG = (WIN_INDEX + 0.5) * SEGMENT_DEG;
const FULL_SPINS = 5;

/**
 * Distância do centro aos números (px), ao longo da bisetriz de cada fatia.
 * Valor mais baixo evita que o texto ultrapasse a borda em mobile / após scale.
 */
const LABEL_RADIUS_PX = 58;

/** Cores por fatia: laranja → amarelo → preto (ciclo). */
const WHEEL_ORANGE = "#f97316";
const WHEEL_YELLOW = "#facc15";
const WHEEL_BLACK = "#171717";
const SLICE_DIVIDER = "rgba(255, 250, 245, 0.95)";

const WHEEL_SLICE_COLORS = [WHEEL_ORANGE, WHEEL_YELLOW, WHEEL_BLACK] as const;

/** Fatias com finas “bordas” claras entre elas (efeito pizza). */
function wheelConicGradient(): string {
  const parts: string[] = [];
  const gapDeg = 1.25;
  for (let i = 0; i < SEGMENTS; i++) {
    const a0 = i * SEGMENT_DEG;
    const a1 = (i + 1) * SEGMENT_DEG - gapDeg;
    const a2 = (i + 1) * SEGMENT_DEG;
    const c = WHEEL_SLICE_COLORS[i % 3];
    parts.push(`${c} ${a0}deg ${a1}deg`);
    parts.push(`${SLICE_DIVIDER} ${a1}deg ${a2}deg`);
  }
  return `conic-gradient(from 0deg, ${parts.join(", ")})`;
}

/** Seis fatias; índice 2 = 90% (para no ponteiro). */
const WHEEL_LABELS = ["15%", "25%", "90%", "10%", "20%", "8%"] as const;

function labelTextClass(i: number): string {
  const onBlack = i % 3 === 2;
  const base =
    "absolute left-1/2 top-1/2 z-[1] select-none whitespace-nowrap font-black leading-none tracking-tight";
  const color = onBlack ? "text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" : "text-neutral-950 drop-shadow-sm";
  return `${base} ${color}`;
}

const BENEFITS = [
  "Ofertas relâmpago antes de qualquer um",
  "Cupons exclusivos com até 80% OFF",
  "Frete grátis nas melhores lojas",
  "Alertas de promoções por tempo limitado",
] as const;

const PARTNER_LOGOS = [
  { src: "/logo-shopee_ae8b716c.png", alt: "Shopee" },
  { src: "/logo-mercadolivre_5d835dbf.png", alt: "Mercado Livre" },
  { src: "/logo-amazon_99ccd542.png", alt: "Amazon" },
] as const;

const MARQUEE_BAR_BG = "#b91c1c";

const MARQUEE_ITEMS = [
  "DESCONTOS INCRÍVEIS",
  "DESCONTOS REAIS",
  "GRUPO QUASE LOTADO",
  "ÚLTIMAS VAGAS",
  "CUPOM LIBERADO",
  "OFERTAS RELÂMPAGO",
  "ACHADINHOS TODO DIA",
  "FRETE GRÁTIS NA FAIXA",
  "SÓ HOJE",
  "ENTRA AGORA",
] as const;

function finalRotationDeg(): number {
  return FULL_SPINS * 360 + (360 - WIN_CENTER_DEG);
}

function CtaBlock(props: {
  ctaHref: string;
  buttonColor: string;
  safeBtn: string;
  showWa: boolean;
  r: number;
  g: number;
  b: number;
  className?: string;
  metaPixelId?: string | null;
}) {
  const { ctaHref, buttonColor, safeBtn, showWa, r, g, b, className = "", metaPixelId } = props;
  return (
    <>
      <a
        href={ctaHref}
        onClick={(e) => handlePixelCTAClick(e, metaPixelId)}
        className={`newchance-cta-pulse ${CAPTURE_CTA_CLASS_UPPER} font-black shadow-lg transition-transform hover:scale-[1.01] active:scale-[0.99] ${className}`}
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

export default function CaptureTheNewChance(props: CaptureVipLandingProps) {
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
    metaPixelId,
  } = props;

  const promoOn = promoSectionsEnabled !== false;
  const optionalBenefitsTitle = (promoTitles?.benefits ?? "").trim();
  const simpleLines = useMemo(() => normalizeSimpleFourLinesFromDb(promoCards), [promoCards]);

  const notifOn = notificationsEnabled !== false;
  const notifPos = notificationsPosition ?? "top_right";

  const safeTitle = title.trim() || "The New Chance";
  const safeDesc =
    description.trim() ||
    "Gire a roleta e garanta seu benefício exclusivo antes que acabe.";
  const safeBtn = (buttonText.trim() || "Entrar no grupo VIP").toUpperCase();
  const color = buttonColor || "#25D366";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const [phase, setPhase] = useState<"idle" | "spinning" | "won">("idle");
  const [rotation, setRotation] = useState(0);
  const [wheelVisible, setWheelVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setReduceMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (previewMode || !reduceMotion) return;
    setWheelVisible(false);
    setPhase("won");
  }, [previewMode, reduceMotion]);

  const spin = useCallback(() => {
    if (phase !== "idle") return;
    if (reduceMotion) {
      setWheelVisible(false);
      setPhase("won");
      return;
    }
    setPhase("spinning");
    requestAnimationFrame(() => {
      setRotation(finalRotationDeg());
    });
  }, [phase, reduceMotion]);

  useEffect(() => {
    if (phase !== "spinning") return;
    const id = window.setTimeout(() => {
      setWheelVisible(false);
      setPhase("won");
    }, 3680);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (phase !== "won" || reduceMotion) return;

    let cancelled = false;
    import("canvas-confetti")
      .then((mod) => {
        if (cancelled) return;
        const confetti = mod.default;
        const colors = ["#f97316", "#facc15", "#dc2626", "#ffffff", "#fbbf24", "#22c55e"];
        const base = {
          origin: { y: 0.32, x: 0.5 },
          colors,
          ticks: 220,
          gravity: 1.05,
        } as const;

        void confetti({
          ...base,
          particleCount: 80,
          spread: 100,
          startVelocity: 38,
          scalar: 1,
        });
        window.setTimeout(() => {
          if (cancelled) return;
          void confetti({
            ...base,
            particleCount: 55,
            spread: 120,
            startVelocity: 32,
            angle: 60,
            scalar: 0.95,
          });
        }, 180);
        window.setTimeout(() => {
          if (cancelled) return;
          void confetti({
            ...base,
            particleCount: 55,
            spread: 120,
            startVelocity: 32,
            angle: 120,
            scalar: 0.95,
          });
        }, 320);
      })
      .catch(() => {
        /* ignora se o chunk falhar */
      });

    return () => {
      cancelled = true;
    };
  }, [phase, reduceMotion]);

  const marqueeStrip = MARQUEE_ITEMS.join("     •     ");

  return (
    <>
      <CaptureVipEntradaToasts variant="coupon" disabled={!notifOn} position={notifPos} />
      <style
        dangerouslySetInnerHTML={{
          __html: `
          /* Pulso só na imagem CLICK (sem translate — evita descentrar no mockup/mobile) */
          @keyframes newchance-click-img-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
          }
          .newchance-click-img-pulse {
            transform-origin: center center;
            animation: newchance-click-img-pulse 1.25s ease-in-out infinite;
            will-change: transform;
          }
          @keyframes newchance-coupon-pulse {
            0%, 100% { transform: scale(1); filter: brightness(1); }
            50% { transform: scale(1.03); filter: brightness(1.05); }
          }
          .newchance-coupon-pulse {
            animation: newchance-coupon-pulse 1.4s ease-in-out infinite;
            will-change: transform;
          }
          @keyframes newchance-cta-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.045); }
          }
          .newchance-cta-pulse {
            transform-origin: center;
            animation: newchance-cta-pulse 1.6s ease-in-out infinite;
          }
          @keyframes newchance-fade-in {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .newchance-prize-wrap {
            animation: newchance-fade-in 0.55s ease-out forwards;
          }
          @keyframes newchance-marquee {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .newchance-marquee-inner {
            display: flex;
            width: max-content;
            animation: newchance-marquee 32s linear infinite;
          }
          @media (prefers-reduced-motion: reduce) {
            .newchance-click-img-pulse, .newchance-coupon-pulse, .newchance-cta-pulse { animation: none !important; }
            .newchance-prize-wrap { animation: none !important; opacity: 1; transform: none; }
            .newchance-marquee-inner { animation: none !important; transform: none; }
          }
        `,
        }}
      />
      <div
        className="fixed left-0 right-0 top-0 z-[1002] overflow-hidden border-b border-red-900/30 shadow-md"
        style={{ backgroundColor: MARQUEE_BAR_BG }}
        role="presentation"
      >
        <div className="newchance-marquee-inner py-2.5">
          <span className="shrink-0 px-6 text-xs font-black uppercase tracking-wider text-white sm:text-sm">
            {marqueeStrip}
          </span>
          <span className="shrink-0 px-6 text-xs font-black uppercase tracking-wider text-white sm:text-sm" aria-hidden>
            {marqueeStrip}
          </span>
        </div>
      </div>

      <div
        className="min-h-screen px-4 pb-16 pt-[3.25rem] sm:pt-14"
        style={{
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: `linear-gradient(180deg, #ffffff 0%, ${ORANGE_50} 42%, rgba(253, 224, 71, 0.45) 100%)`,
          color: TEXT,
        }}
      >
        <div
          className="mx-auto flex w-full max-w-md flex-col items-stretch gap-5 rounded-[28px] border px-4 py-8 shadow-xl sm:px-6 sm:py-10"
          style={{
            backgroundColor: CARD,
            borderColor: "rgba(249, 115, 22, 0.22)",
            boxShadow:
              "0 25px 50px -12px rgba(249, 115, 22, 0.14), 0 0 0 1px rgba(255,255,255,0.95) inset",
          }}
        >
          <div className="flex justify-center">
            <div
              className="flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-2xl shadow-md ring-4 ring-white"
              style={{ backgroundColor: LOGO_TILE_BG }}
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt=""
                  width={100}
                  height={100}
                  className="h-full w-full object-contain p-2"
                  unoptimized={logoUrl.startsWith("blob:")}
                />
              ) : (
                <span className="text-xs font-bold" style={{ color: ORANGE }}>
                  Logo
                </span>
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
            classNameEmbed="shadow-md"
          />

          <p className={CAPTURE_BODY} style={{ color: MUTED }}>
            {safeDesc}
          </p>

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="above_cta"
            className="w-full"
            classNameEmbed="shadow-md"
          />

          <CaptureOfertCarouselIf {...props} slot="above_cta" variant="light" eyebrow="Destaques" />

          {/* Roleta ou prêmio — sem scale no wrapper (evita cortar o CLICK com overflow-x-hidden no preview/mobile) */}
          <div className="relative overflow-x-visible py-2 px-0.5 sm:px-0">
            {wheelVisible ? (
              <div
                className="relative mx-auto w-full max-w-[min(100%,218px)] sm:max-w-[min(100%,292px)]"
                style={{
                  opacity: phase === "won" ? 0 : 1,
                  transition: "opacity 0.45s ease",
                  pointerEvents: phase === "won" ? "none" : "auto",
                }}
              >
                <div
                  className="pointer-events-none absolute left-1/2 top-0 z-30 -translate-x-1/2"
                  style={{ marginTop: "-2px" }}
                  aria-hidden
                >
                  <svg width="32" height="26" viewBox="0 0 32 26" fill="none">
                    <path
                      d="M16 26L2 5h28L16 26Z"
                      fill="#f59e0b"
                      stroke="#fef3c7"
                      strokeWidth="2"
                    />
                    <path d="M16 8v6" stroke="#78350f" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>

                <button
                  type="button"
                  onClick={spin}
                  disabled={phase !== "idle"}
                  className="relative mx-auto flex aspect-square w-full max-w-[min(100%,218px)] cursor-pointer flex-col items-center justify-center overflow-visible rounded-full border-0 bg-transparent p-0 shadow-none outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-orange-500 disabled:cursor-not-allowed sm:max-w-[308px]"
                  style={{ filter: WHEEL_ORANGE_GLOW }}
                  aria-label="Girar a roleta"
                >
                  <div
                    className="pointer-events-none absolute inset-0 rounded-full p-[5px]"
                    style={{
                      background: "linear-gradient(145deg, #fef08a 0%, #f97316 38%, #ea580c 72%, #fbbf24 100%)",
                      boxShadow:
                        "0 10px 36px rgba(0,0,0,0.28), 0 0 24px rgba(249, 115, 22, 0.45), inset 0 1px 0 rgba(255,255,255,0.5)",
                    }}
                  >
                    <div
                      className="h-full w-full rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.35)]"
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition:
                          reduceMotion || phase !== "spinning"
                            ? "none"
                            : "transform 3.45s cubic-bezier(0.12, 0.85, 0.15, 1)",
                        background: wheelConicGradient(),
                        border: "3px solid #0a0a0a",
                      }}
                    >
                      <div
                        className="absolute left-1/2 top-1/2 z-[5] h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-amber-100 bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500 shadow-[0_4px_14px_rgba(0,0,0,0.3),inset_0_2px_6px_rgba(255,255,255,0.45)] sm:h-[3.25rem] sm:w-[3.25rem]"
                        aria-hidden
                      />
                      {WHEEL_LABELS.map((label, i) => {
                        const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2;
                        const r = LABEL_RADIUS_PX;
                        return (
                          <span
                            key={i}
                            className={`${labelTextClass(i)} text-[clamp(9px,2.9vw,18px)] sm:text-[clamp(11px,3.4vw,20px)]`}
                            style={{
                              transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-${r}px) rotate(90deg)`,
                            }}
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {phase === "idle" ? (
                    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-[4%]">
                      <div className="newchance-click-img-pulse w-[min(216px,100%)] max-w-[236px] sm:w-[min(264px,100%)] sm:max-w-[280px]">
                        <Image
                          src={CLICK_IMG}
                          alt=""
                          width={200}
                          height={88}
                          className="h-auto w-full object-contain object-center drop-shadow-lg"
                          priority
                        />
                      </div>
                    </div>
                  ) : null}
                </button>

                <p className="mt-4 text-center text-xs font-semibold" style={{ color: MUTED }}>
                  Toque em{" "}
                  <span className="font-extrabold" style={{ color: ORANGE }}>
                    CLICK
                  </span>{" "}
                  para girar — parece que a sorte está do seu lado…
                </p>
              </div>
            ) : null}

            {phase === "won" ? (
              <div className="newchance-prize-wrap flex flex-col items-center gap-5 px-1">
                <p className="text-center text-sm font-extrabold" style={{ color: RED }}>
                  Você ganhou!
                </p>
                <div className="newchance-coupon-pulse relative w-full max-w-[300px]">
                  <Image
                    src={COUPON_IMG}
                    alt="Cupom 90% de desconto"
                    width={600}
                    height={600}
                    className="h-auto w-full object-contain drop-shadow-xl"
                    priority
                  />
                </div>
                <div className="w-full max-w-sm">
                  <CtaBlock
                    ctaHref={ctaHref}
                    buttonColor={color}
                    safeBtn={safeBtn}
                    showWa={showWa}
                    r={r}
                    g={g}
                    b={b}
                    metaPixelId={metaPixelId}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {promoOn ? (
            <>
              <div className="flex justify-center">
                <div
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-md"
                  style={{ backgroundColor: RED }}
                >
                  <Flame className="h-4 w-4 shrink-0" aria-hidden />
                  Últimas vagas no grupo!
                </div>
              </div>

              {optionalBenefitsTitle ? (
                <p className="text-center text-sm font-extrabold leading-snug" style={{ color: TEXT }}>
                  {optionalBenefitsTitle}
                </p>
              ) : null}

              <div className="flex flex-col gap-3">
                {BENEFITS.map((line, i) => (
                  <div
                    key={`newchance-line-${i}`}
                    className="flex items-start gap-3 rounded-2xl border border-amber-200/90 bg-white px-4 py-3.5 shadow-sm"
                  >
                    <div
                      className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${RED}14` }}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} style={{ color: RED }} aria-hidden />
                    </div>
                    <p className="text-left text-sm font-semibold leading-snug" style={{ color: TEXT }}>
                      {simpleLines[i] ?? line}
                    </p>
                  </div>
                ))}
              </div>

              <div
                className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-5"
                style={{ boxShadow: "0 1px 0 rgba(253, 224, 71, 0.35) inset" }}
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
            </>
          ) : null}

          <div className="border-t border-amber-200/70 pt-6">
            <CtaBlock
              ctaHref={ctaHref}
              buttonColor={color}
              safeBtn={safeBtn}
              showWa={showWa}
              r={r}
              g={g}
              b={b}
              metaPixelId={metaPixelId}
            />
          </div>

          <CaptureOfertCarouselIf {...props} slot="below_cta" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="below_cta"
            className="w-full"
            classNameEmbed="shadow-md"
          />

          <CaptureOfertCarouselIf {...props} slot="card_end" variant="light" eyebrow="Destaques" />

          <CaptureYoutubeAtSlot
            url={youtubeUrl}
            position={youtubePosition}
            slot="card_end"
            className="w-full"
            classNameEmbed="shadow-md"
          />

          <p className="text-center text-[11px]" style={{ color: "#9ca3af" }}>
            © {new Date().getFullYear()}{" "}
            <CaptureFooterAfiliadoAnalyticsLink className="text-inherit underline-offset-2 hover:underline" />
          </p>
        </div>
      </div>
    </>
  );
}
