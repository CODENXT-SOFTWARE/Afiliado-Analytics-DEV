"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  Ticket,
  Home,
  ShoppingBag,
  Zap,
  CheckCircle,
  Flame,
  Clock,
  Shield,
  Star,
} from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import type { PageTemplate } from "@/app/(main)/dashboard/captura/_lib/types";
import { parseColorToRgb } from "@/app/(main)/dashboard/captura/_lib/captureUtils";

const BENEFITS: { Icon: typeof Ticket; title: string; body: string }[] = [
  {
    Icon: Ticket,
    title: "Cupons que funcionam",
    body: "Cupons testados e atualizados pra você economizar na finalização da compra.",
  },
  {
    Icon: Home,
    title: "Casa e decoração",
    body: "Organização, cozinha, utilidades e decoração com preço bom e qualidade.",
  },
  {
    Icon: ShoppingBag,
    title: "Moda e beleza",
    body: "Achados de roupas, acessórios e beleza com desconto real pra aproveitar.",
  },
  {
    Icon: Zap,
    title: "Ofertas relâmpago",
    body: "Promoções que acabam rápido — você recebe antes e pega as melhores.",
  },
  {
    Icon: CheckCircle,
    title: "Links verificados",
    body: "Somente oportunidades de lojas confiáveis, pra comprar com segurança.",
  },
];

/** Layout VIP terroso (referência Metric): cards com emoji, fundo creme, barra e CTA específicos. */
const TERROSO_BENEFITS: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "📦",
    title: "Links de produtos todo dia",
    body: "Acesso aos links das melhores ofertas dos marketplaces",
  },
  {
    emoji: "💸",
    title: "Descontos de até 70%",
    body: "Economia real em produtos selecionados a dedo para você",
  },
  {
    emoji: "🎟️",
    title: "Cupons Secretos",
    body: "Acesso a cupons exclusivos que só a nossa comunidade tem",
  },
  {
    emoji: "🔥",
    title: "Os melhores produtos com os melhores preços",
    body: "Casa, beleza, eletrônicos e muito mais",
  },
];

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

const VIP_ROSA_THEME: VipTheme = {
  primary: "#B65D78",
  deep: "#3B1E2A",
  bg: "#F6EFEA",
  textMain: "#2f2527",
  textSoft: "#6f6064",
  cardBorder: "rgba(182, 93, 120, 0.22)",
  progressTrackBorder: "rgba(59, 30, 42, 0.10)",
  cardBg: "#ffffff",
  benefitCardBg: "#ffffff",
  topBarBg: "linear-gradient(135deg, #3B1E2A 0%, #1a0f14 100%)",
  headingFont: "'Playfair Display', serif",
  showDotPattern: true,
  containerRadius: "24px",
  ctaRadius: "9999px",
  cardShadow: "0 10px 30px rgba(59, 30, 42, 0.12)",
  footerMuted: "#9e8a8a",
};

function isWhatsAppUrl(raw: string) {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return h.includes("whatsapp.com") || h === "wa.me";
  } catch {
    return /whatsapp|wa\.me/i.test(raw);
  }
}

export default function CaptureVipLanding(props: {
  variant: Exclude<PageTemplate, "classic">;
  title: string;
  description: string;
  buttonText: string;
  /** Público: /slug/go — preview: pode ser # ou URL externa */
  ctaHref: string;
  logoUrl: string | null;
  buttonColor: string;
  /** Desliga animação de vagas/toast (preview no dashboard) */
  previewMode?: boolean;
}) {
  const {
    variant,
    title,
    description,
    buttonText,
    ctaHref,
    logoUrl,
    buttonColor,
    previewMode = false,
  } = props;

  const safeTitle = title.trim() || "Grupo VIP";
  const safeDesc =
    description.trim() ||
    "Entre no grupo e receba promoções, ofertas e descontos reais — antes de acabar.";
  const safeBtn = buttonText.trim() || "Quero entrar agora";
  const color = buttonColor || "#25D366";
  const { r, g, b } = parseColorToRgb(color);
  const showWa =
    previewMode || isWhatsAppUrl(ctaHref) || /\/go\/?(\?.*)?$/i.test(ctaHref.trim());

  const [spotsLeft, setSpotsLeft] = useState(42);
  const totalSpots = 60;
  const minSpots = 12;

  useEffect(() => {
    const id = "capture-vip-fonts";
    if (!document.getElementById(id)) {
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href =
        "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Lato:wght@300;400;700;900&display=swap";
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    if (previewMode) return;
    const t = setInterval(() => {
      setSpotsLeft((s) => (s > minSpots ? s - 1 : 42));
    }, 2200);
    return () => clearInterval(t);
  }, [previewMode]);

  const pct = useMemo(() => {
    const filled = Math.max(0, totalSpots - spotsLeft);
    return Math.min(99, Math.max(1, Math.round((filled / totalSpots) * 100)));
  }, [spotsLeft]);

  const displaySpots = previewMode ? 18 : spotsLeft;

  if (variant === "vip_terroso") {
    return (
      <>
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

            <h1 className="text-center text-xl font-bold leading-tight" style={{ color: TERROSO.text }}>
              {safeTitle}
            </h1>

            <p className="text-center text-sm font-medium" style={{ color: TERROSO.textMuted }}>
              {safeDesc}
            </p>

            <div className="w-full">
              <a
                href={ctaHref}
                className="flex w-full items-center justify-center rounded-2xl py-4 text-lg font-extrabold tracking-wide text-white no-underline transition-transform duration-300 hover:scale-[1.01]"
                style={{
                  background: `linear-gradient(135deg, ${TERROSO.ctaFrom} 0%, ${TERROSO.ctaTo} 100%)`,
                  boxShadow: TERROSO.ctaShadow,
                }}
              >
                {showWa ? <FaWhatsapp className="mr-2.5 text-xl" aria-hidden /> : null}
                {safeBtn.toUpperCase()}
              </a>
            </div>

            <div
              className="flex items-center gap-2 rounded-xl border px-5 py-3 text-base font-semibold"
              style={{
                background: "rgb(255, 255, 255)",
                borderColor: TERROSO.scarcityBorder,
                color: TERROSO.text,
              }}
            >
              <Clock className="h-5 w-5 shrink-0" style={{ color: TERROSO.accent }} aria-hidden />
              <span>
                ⏳ Vagas restantes:{" "}
                <span className="text-2xl font-extrabold" style={{ color: TERROSO.accent }}>
                  {displaySpots}
                </span>
              </span>
            </div>

            <div className="mt-2 w-full space-y-3">
              <h2
                className="text-center text-sm font-bold uppercase tracking-widest"
                style={{ color: TERROSO.accent }}
              >
                No grupo você vai encontrar:
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {TERROSO_BENEFITS.map((row) => (
                  <div
                    key={row.title}
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

  const theme = VIP_ROSA_THEME;
  const rosaPct = previewMode ? 70 : pct;

  return (
    <>
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
          className="fixed top-0 left-0 z-[1001] flex w-full items-center justify-center gap-2 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-md"
          style={{
            background: theme.topBarBg,
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
            className="mb-2.5 text-2xl leading-snug md:text-[26px] font-bold"
            style={{
              fontFamily: theme.headingFont,
              color: theme.textMain,
            }}
          >
            {safeTitle}
          </h1>

          <p className="mb-3.5 px-0.5 text-sm font-normal leading-relaxed" style={{ color: theme.textSoft }}>
            {safeDesc}
          </p>

          <div className="my-2">
            <a
              href={ctaHref}
              className="relative flex w-full items-center justify-center overflow-hidden py-4 text-base font-black uppercase tracking-wide text-white no-underline shadow-lg transition-transform hover:-translate-y-0.5"
              style={{
                borderRadius: theme.ctaRadius,
                backgroundColor: color,
                boxShadow: `0 6px 20px rgba(${r},${g},${b},0.4)`,
              }}
            >
              {showWa ? <FaWhatsapp className="mr-2.5 text-xl" aria-hidden /> : null}
              {safeBtn}
            </a>
            <p className="mt-2.5 text-xs font-extrabold" style={{ color: theme.deep }}>
              ✅ Grupo seguro — ofertas novas todos os dias
            </p>
          </div>

          <div
            className="mb-4 mt-4 rounded-xl border px-4 py-3.5 text-left shadow-sm"
            style={{
              background: `${theme.bg}b3`,
              borderColor: `${theme.primary}47`,
            }}
          >
            <div className="mb-2 flex justify-between text-sm font-black" style={{ color: theme.textMain }}>
              <span>Vagas preenchidas</span>
              <span style={{ color: theme.deep }}>{rosaPct}%</span>
            </div>
            <div
              className="mb-2.5 h-2.5 w-full overflow-hidden rounded-full border bg-white"
              style={{ borderColor: theme.progressTrackBorder }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${rosaPct}%`,
                  background: `linear-gradient(90deg, ${theme.deep} 0%, ${theme.primary} 100%)`,
                }}
              />
            </div>
            <div className="text-right text-[13px] font-bold" style={{ color: theme.textSoft }}>
              Restam apenas <span style={{ color: theme.textMain }}>{displaySpots}</span> vagas
            </div>
          </div>

          <p className="mb-3 text-left text-[13px] font-black uppercase tracking-wide" style={{ color: theme.textMain }}>
            O que você vai encontrar:
          </p>

          <div className="mb-4 space-y-3.5 text-left">
            {BENEFITS.map(({ Icon, title: bt, body }) => (
              <div
                key={bt}
                className="flex items-start gap-3 rounded-xl p-3 shadow-sm border border-black/5"
                style={{
                  borderLeft: `3px solid ${theme.primary}`,
                  backgroundColor: theme.benefitCardBg,
                }}
              >
                <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ color: theme.deep }} aria-hidden />
                <div>
                  <h3 className="mb-1 text-[13px] font-black uppercase" style={{ color: theme.textMain }}>
                    {bt}
                  </h3>
                  <p className="text-[13px] leading-snug" style={{ color: theme.textSoft }}>
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <footer
            className="mt-4 flex flex-col items-center gap-3 border-t pt-4 text-[11px]"
            style={{ borderColor: `${theme.primary}40`, color: theme.footerMuted }}
          >
            <div>
              <a href="https://afiliadoanalytics.com.br" className="font-extrabold no-underline" style={{ color: theme.textMain }}>
                Política e termos
              </a>
            </div>
            <span className="rounded-full px-3.5 py-1.5 text-[11px] font-black text-white shadow-md" style={{ background: theme.deep }}>
              Feito com ❤️ por Afiliado Analytics
            </span>
          </footer>
        </div>
      </div>
    </>
  );
}
