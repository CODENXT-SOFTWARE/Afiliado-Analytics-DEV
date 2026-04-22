"use client";

import { useEffect, useMemo, type CSSProperties } from "react";
import Image from "next/image";
import type { BlankCanvasConfig } from "@/lib/capture-blank-canvas";
import { fontCssStack, googleFontHref } from "@/lib/capture-blank-canvas";
import { isWhatsAppUrl } from "./capture-vip-shared";
import { FaWhatsapp } from "react-icons/fa";
import { ExternalLink } from "lucide-react";
import {
  CaptureEmBrancoCardMedia,
  CaptureEmBrancoPromoInCard,
  emBrancoMediaVisibleForSlots,
  emBrancoShowsAfterCta,
  type EmBrancoCardMediaBundle,
} from "./CaptureEmBrancoExtraBlocks";
import { handlePixelCTAClick, trackPixelLead } from "./capture-vip-shared";

export type CaptureBlankCanvasProps = {
  config: BlankCanvasConfig;
  title: string;
  description: string;
  buttonText: string;
  ctaHref: string;
  logoUrl: string | null;
  heroPublicUrl: string | null;
  previewMode?: boolean;
  /** Cor do botão ao nível do site (passo 1 no editor). Substitui `config.btnBg` no CTA e nos detalhes visuais associados. */
  siteButtonColor?: string | null;
  /** URL pública da imagem de fundo (quando `config.bgImageEnabled` e há `bgImagePath`). */
  bgImagePublicUrl?: string | null;
  /** Modelo Em branco: YouTube, carrossel e promo dentro do cartão (coluna). */
  emBrancoCardMedia?: EmBrancoCardMediaBundle | null;
  /** Meta Pixel ID para tracking de cliques. */
  metaPixelId?: string | null;
};

/** "r,g,b" para rgba() na animação do pulso — alinhado à cor real do CTA (não fixo em laranja). */
function rgbTripletForPulse(cssColor: string): string {
  const s = cssColor.trim();
  const hex6 = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex6) {
    const h = hex6[1];
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  }
  const hex3 = /^#([0-9a-f]{3})$/i.exec(s);
  if (hex3) {
    const h = hex3[1];
    return `${parseInt(h[0] + h[0], 16)},${parseInt(h[1] + h[1], 16)},${parseInt(h[2] + h[2], 16)}`;
  }
  const rgb = /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)/i.exec(s);
  if (rgb) {
    const r = Math.round(Math.min(255, Math.max(0, Number(rgb[1]))));
    const g = Math.round(Math.min(255, Math.max(0, Number(rgb[2]))));
    const b = Math.round(Math.min(255, Math.max(0, Number(rgb[3]))));
    return `${r},${g},${b}`;
  }
  return "37,211,102";
}

function animationCss(config: BlankCanvasConfig, pulseRgb: string): string {
  const pulse = config.btnPulse
    ? `
    @keyframes blank-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(${pulseRgb},0.5); } 50% { box-shadow: 0 0 0 16px rgba(${pulseRgb},0); } }
    .blank-cta-pulse { animation: blank-pulse 2s ease-out infinite; }
  `
    : "";

  let block = "";
  switch (config.animation) {
    case "fade_rise":
      block = `
        @keyframes blank-rise { from { opacity:0; transform: translateY(16px); } to { opacity:1; transform: translateY(0); } }
        .blank-card-anim { animation: blank-rise 0.7s cubic-bezier(0.22,1,0.36,1) both; }
      `;
      break;
    case "bounce_in":
      block = `
        @keyframes blank-bounce { 0% { opacity:0; transform: scale(0.92); } 60% { opacity:1; transform: scale(1.02); } 100% { transform: scale(1); } }
        .blank-card-anim { animation: blank-bounce 0.65s ease both; }
      `;
      break;
    case "float_card":
      block = `
        @keyframes blank-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
        .blank-card-anim { animation: blank-float 4.5s ease-in-out infinite; }
      `;
      break;
    case "pulse_cta":
      block = `
        @keyframes blank-rise { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        .blank-card-anim { animation: blank-rise 0.55s ease both; }
      `;
      break;
    case "shimmer_bg":
      block = `
        @keyframes blank-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
        .blank-shimmer { animation: blank-shimmer 10s ease infinite; }
      `;
      break;
    default:
      block = `.blank-card-anim {}`;
  }
  return block + pulse;
}

export default function CaptureBlankCanvas({
  config,
  title,
  description,
  buttonText,
  ctaHref,
  logoUrl,
  heroPublicUrl,
  previewMode,
  siteButtonColor,
  bgImagePublicUrl,
  emBrancoCardMedia,
  metaPixelId,
}: CaptureBlankCanvasProps) {
  const ctaSurfaceColor = siteButtonColor?.trim() ? siteButtonColor.trim() : config.btnBg;
  const pulseRgb = useMemo(() => rgbTripletForPulse(ctaSurfaceColor), [ctaSurfaceColor]);
  const hasBgImage = !!(config.bgImageEnabled && bgImagePublicUrl?.trim());
  const bgUrl = hasBgImage ? bgImagePublicUrl!.trim() : "";

  const href = googleFontHref(config.fontPreset);
  useEffect(() => {
    if (!href || typeof document === "undefined") return;
    const id = "blank-canvas-font";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }, [href]);

  const pageBgStyle = useMemo((): CSSProperties => {
    const fit = config.bgImageFit;
    const rep = config.bgImageRepeat;
    const pos = config.bgImagePosition;

    if (hasBgImage) {
      if (config.useSolidBg) {
        const scrim = `linear-gradient(180deg, color-mix(in srgb, ${config.solidBg} 72%, transparent), color-mix(in srgb, ${config.solidBg} 88%, transparent))`;
        return {
          backgroundImage: `${scrim}, url(${bgUrl})`,
          backgroundSize: `auto, ${fit}`,
          backgroundRepeat: `no-repeat, ${rep}`,
          backgroundPosition: `center, ${pos}`,
        };
      }
      const grad = `linear-gradient(${config.bgAngle}deg, color-mix(in srgb, ${config.bgFrom} 78%, transparent), color-mix(in srgb, ${config.bgTo} 82%, transparent))`;
      return {
        backgroundImage: `${grad}, url(${bgUrl})`,
        backgroundSize: `auto, ${fit}`,
        backgroundRepeat: `no-repeat, ${rep}`,
        backgroundPosition: `center, ${pos}`,
      };
    }

    if (config.useSolidBg) {
      if (config.animation === "shimmer_bg") {
        const solid = config.solidBg;
        return {
          backgroundImage: `linear-gradient(110deg, ${solid}, color-mix(in srgb, ${solid} 82%, white), ${solid}, color-mix(in srgb, ${solid} 90%, white))`,
          backgroundSize: "260% 260%",
        };
      }
      return { background: config.solidBg };
    }
    const grad = `linear-gradient(${config.bgAngle}deg, ${config.bgFrom}, ${config.bgTo})`;
    if (config.animation === "shimmer_bg") {
      return {
        backgroundImage: `linear-gradient(100deg, ${config.bgFrom}, ${config.bgTo}, ${config.bgFrom}, ${config.bgTo})`,
        backgroundSize: "240% 240%",
      };
    }
    return { background: grad };
  }, [config, hasBgImage, bgUrl]);

  const fontFamily = fontCssStack(config.fontPreset);
  const isWa = isWhatsAppUrl(ctaHref);
  const sticky = config.ctaPlacement === "bottom_sticky";
  /** No preview do dashboard o CTA não pode usar `fixed` (ancestro com transform/scroll); ancora-se ao painel. */
  const stickyDockInPreview = Boolean(previewMode && sticky);

  const cardStyle: CSSProperties = {
    width: "100%",
    maxWidth: config.maxContentWidthPx,
    margin: "0 auto",
    padding: "clamp(1.25rem, 4vw, 2rem)",
    borderRadius: config.cardRadiusPx,
    background: config.cardBg,
    border: `1px solid ${config.cardBorder}`,
    boxShadow: `0 24px 80px rgba(0,0,0,${config.cardShadowOpacity})`,
    backdropFilter: config.glassCard ? "blur(14px)" : undefined,
    WebkitBackdropFilter: config.glassCard ? "blur(14px)" : undefined,
    fontFamily,
  };

  const decorative = (
    <>
      {config.decorative === "dots" ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
          }}
          aria-hidden
        />
      ) : null}
      {config.decorative === "grid" ? (
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.25) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
          aria-hidden
        />
      ) : null}
      {config.decorative === "gradient_orbs" ? (
        <>
          <div
            className="pointer-events-none absolute -left-24 -top-20 h-64 w-64 rounded-full blur-3xl opacity-40"
            style={{ background: `radial-gradient(circle, ${ctaSurfaceColor} 0%, transparent 70%)` }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -right-20 bottom-0 h-72 w-72 rounded-full blur-3xl opacity-30"
            style={{ background: `radial-gradient(circle, ${config.bgTo} 0%, transparent 65%)` }}
            aria-hidden
          />
        </>
      ) : null}
    </>
  );

  const ctaBtn = (
    <a
      href={ctaHref}
      target={previewMode ? "_self" : "_blank"}
      rel={previewMode ? undefined : "noopener noreferrer"}
      onClick={(e) => handlePixelCTAClick(e, metaPixelId)}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition-transform hover:scale-[1.02] active:scale-[0.98] ${
        config.btnFullWidth ? "w-full" : "min-w-[200px]"
      } ${config.btnPulse ? "blank-cta-pulse" : ""}`}
      style={{
        background: ctaSurfaceColor,
        color: config.btnText,
        borderRadius: config.btnRadiusPx === 999 ? 9999 : config.btnRadiusPx,
        padding: "14px 28px",
        fontSize: 16,
        textDecoration: "none",
        boxShadow: config.btnPulse ? `0 8px 32px rgba(0,0,0,0.25)` : undefined,
      }}
    >
      {isWa ? <FaWhatsapp className="h-5 w-5 shrink-0" aria-hidden /> : <ExternalLink className="h-5 w-5 shrink-0" aria-hidden />}
      {buttonText}
    </a>
  );

  /** Com imagem de fundo, animar `background-position` move também a foto — desligamos o shimmer global. */
  const shimmerMotion = config.animation === "shimmer_bg" && !hasBgImage;

  /** `overflow-x-hidden` + `min-w-0`: evita scroll horizontal (tarja do body) por orbs/-mx ou filhos largos. */
  const mainShellClass = previewMode
    ? `relative flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-x-hidden overflow-y-auto ${shimmerMotion ? "blank-shimmer" : ""}`
    : `relative flex min-h-screen min-w-0 w-full flex-col overflow-x-hidden ${shimmerMotion ? "blank-shimmer" : ""}`;

  const contentColumnPad =
    sticky && !stickyDockInPreview ? "pb-28 sm:pb-32" : "";

  const styleBlock = (
    <style
      dangerouslySetInnerHTML={{
        __html: `
            ${animationCss(config, pulseRgb)}
            @media (prefers-reduced-motion: reduce) {
              .blank-card-anim, .blank-cta-pulse, .blank-shimmer { animation: none !important; }
            }
          `,
      }}
    />
  );

  const stickyBarStyle: CSSProperties = { paddingBottom: "max(12px, env(safe-area-inset-bottom))" };

  const stickyBar = (
    <div
      className={
        stickyDockInPreview
          ? "relative z-[20] shrink-0 border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md"
          : "fixed bottom-0 left-0 right-0 z-[20] border-t border-white/10 bg-black/35 px-4 py-3 backdrop-blur-md"
      }
      style={stickyBarStyle}
    >
      <div className="mx-auto flex max-w-lg justify-center">{ctaBtn}</div>
    </div>
  );

  const mainColumn = (
    <main className={mainShellClass} style={{ ...pageBgStyle, fontFamily }}>
      {styleBlock}
      {decorative}
      <div
        className={`relative z-[1] flex min-w-0 w-full flex-1 flex-col px-4 py-10 sm:py-14 ${contentColumnPad}`}
        style={{ justifyContent: config.textAlign === "center" ? "center" : "flex-start" }}
      >
        <div
          className={`blank-card-anim mx-auto w-full min-w-0 ${config.textAlign === "center" ? "text-center" : config.textAlign === "right" ? "text-right" : "text-left"}`}
          style={cardStyle}
        >
          {config.showLogo && logoUrl ? (
            <div
              className={`mb-6 flex ${config.textAlign === "center" ? "justify-center" : config.textAlign === "right" ? "justify-end" : "justify-start"}`}
            >
              <div className="relative h-[100px] w-[100px] overflow-hidden rounded-2xl bg-white/10 ring-1 ring-white/15">
                {logoUrl.startsWith("blob:") || logoUrl.startsWith("data:") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="h-full w-full object-contain p-2" />
                ) : (
                  <Image
                    src={logoUrl}
                    alt=""
                    fill
                    className="object-contain p-2"
                    sizes="100px"
                    priority={!previewMode}
                  />
                )}
              </div>
            </div>
          ) : null}

          {config.showHero && heroPublicUrl ? (
            <div
              className={`mb-6 overflow-hidden ${config.textAlign === "center" ? "mx-auto" : ""}`}
              style={{ borderRadius: config.heroRadiusPx, maxWidth: config.maxContentWidthPx - 32 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={heroPublicUrl} alt="" className="h-auto w-full object-cover" />
            </div>
          ) : null}

          <h1
            className="font-bold leading-tight tracking-tight"
            style={{ color: config.titleColor, fontSize: config.titleFontPx, textAlign: config.titleAlign }}
          >
            {title}
          </h1>

          {config.showSubtitle && config.subtitle.trim() ? (
            <p
              className="mt-2 font-medium"
              style={{
                color: config.subtitleColor,
                fontSize: config.subtitleFontPx,
                textAlign: config.titleAlign,
              }}
            >
              {config.subtitle}
            </p>
          ) : null}

          {emBrancoCardMedia && emBrancoMediaVisibleForSlots(emBrancoCardMedia, ["below_title"]) ? (
            <div className="mt-4 w-full min-w-0">
              <CaptureEmBrancoCardMedia {...emBrancoCardMedia} allowedSlots={["below_title"]} />
            </div>
          ) : null}

          <p
            className="mt-4 whitespace-pre-wrap leading-relaxed"
            style={{ color: config.descColor, fontSize: config.descFontPx, textAlign: config.textAlign }}
          >
            {description}
          </p>

          {emBrancoCardMedia && emBrancoMediaVisibleForSlots(emBrancoCardMedia, ["above_cta"]) ? (
            <div className="mt-6 w-full min-w-0">
              <CaptureEmBrancoCardMedia {...emBrancoCardMedia} allowedSlots={["above_cta"]} />
            </div>
          ) : null}

          {emBrancoCardMedia && sticky && emBrancoShowsAfterCta(emBrancoCardMedia) ? (
            <div className="mt-6 w-full min-w-0 space-y-6">
              <CaptureEmBrancoCardMedia {...emBrancoCardMedia} allowedSlots={["below_cta", "card_end"]} />
              <CaptureEmBrancoPromoInCard {...emBrancoCardMedia} />
            </div>
          ) : null}

          {!sticky ? <div className="mt-8 flex justify-center">{ctaBtn}</div> : null}

          {emBrancoCardMedia && !sticky && emBrancoShowsAfterCta(emBrancoCardMedia) ? (
            <div className="mt-8 w-full min-w-0 space-y-6">
              <CaptureEmBrancoCardMedia {...emBrancoCardMedia} allowedSlots={["below_cta", "card_end"]} />
              <CaptureEmBrancoPromoInCard {...emBrancoCardMedia} />
            </div>
          ) : null}
        </div>
      </div>
      {sticky && !stickyDockInPreview ? stickyBar : null}
    </main>
  );

  if (previewMode) {
    return (
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-x-hidden">
        {mainColumn}
        {stickyDockInPreview ? stickyBar : null}
      </div>
    );
  }

  return mainColumn;
}
