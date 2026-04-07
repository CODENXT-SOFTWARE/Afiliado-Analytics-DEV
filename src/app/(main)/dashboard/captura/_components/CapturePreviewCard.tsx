"use client";

import Image from "next/image";
import { ExternalLink, Gift, Tag, Zap } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import ScarcityPreview from "./ScarcityPreview";
import { LayoutVariant } from "../_lib/types";
import { parseColorToRgb } from "../_lib/captureUtils";
import { CaptureYoutubeAtSlot } from "@/app/capture/[slug]/CaptureYoutubeAtSlot";
import {
  CAPTURE_BODY,
  CAPTURE_CTA_CLASS,
  CAPTURE_CTA_LABEL,
  CAPTURE_TITLE_HERO,
} from "@/app/capture/[slug]/capture-responsive-classes";
import { OfertCarouselAtSlot } from "@/app/capture/[slug]/CaptureOfertCarouselIf";
import type { CaptureBlockPosition } from "@/lib/capture-block-position";
import { normalizeYoutubePosition } from "@/lib/capture-block-position";
import type { OfertCarouselPosition } from "@/lib/capture-ofert-carousel";
import { normalizeOfertCarouselPosition } from "@/lib/capture-ofert-carousel";

function isWhatsAppLink(rawUrl: string) {
  const s = (rawUrl || "").trim().toLowerCase();
  if (!s) return false;

  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase();
    return host === "wa.me" || host.endsWith("whatsapp.com");
  } catch {
    return s.includes("wa.me") || s.includes("whatsapp.com");
  }
}

export default function CapturePreviewCard(props: {
  title: string;
  description: string;
  buttonColor: string;
  layoutVariant: LayoutVariant;
  logoSrc: string | null; // pode ser blob:... ou URL pública
  buttonText: string;
  buttonUrl: string;
  youtubeUrl?: string;
  youtubePosition?: CaptureBlockPosition;
  ofertCarouselEnabled?: boolean;
  ofertCarouselPosition?: OfertCarouselPosition;
  ofertCarouselImageUrls?: string[];
}) {
  const {
    title,
    description,
    buttonColor,
    layoutVariant,
    logoSrc,
    buttonText,
    buttonUrl,
    youtubeUrl,
    youtubePosition,
    ofertCarouselEnabled = false,
    ofertCarouselPosition,
    ofertCarouselImageUrls = [],
  } = props;

  const safeTitle = title.trim() || "Grupo VIP";
  const safeDesc = description.trim() || "Clique no botão abaixo para acessar.";
  const safeColor = buttonColor || "#25D366";

  const safeButtonText = buttonText.trim() || "Entrar no Grupo VIP";
  const showWhatsIcon = isWhatsAppLink(buttonUrl);

  const { r, g, b } = parseColorToRgb(safeColor);
  const isBlobLogo = !!logoSrc && logoSrc.startsWith("blob:");
  const yt = (youtubeUrl ?? "").trim();
  const ytPos = normalizeYoutubePosition(youtubePosition);

  return (
    <div className="rounded-lg border border-dark-border overflow-hidden bg-dark-card">
      <div className="px-4 py-3 border-b border-dark-border flex items-center justify-between">
        <div className="text-sm font-semibold text-text-primary">Preview (igual ao público)</div>
        <div className="text-xs text-text-secondary">Tempo real</div>
      </div>

      <div className="p-6 bg-dark-bg">
        <div className="flex justify-center">
          <div className="transform origin-top scale-[0.88]">
            <div
              className="w-[440px] max-w-[calc(100vw-3rem)] px-4 sm:px-9 py-9 sm:py-11"
              style={{
                backgroundColor: "#FEFDFC",
                border: "1px solid rgba(0,0,0,0.04)",
                borderRadius: "32px",
                boxShadow: "rgba(31, 38, 135, 0.12) 0px 8px 32px 0px",
              }}
            >
              {/* 1) Logo */}
              {logoSrc && (
                <div className="flex justify-center mb-6">
                  <div
                    className="h-[130px] w-[130px] rounded-2xl flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: "rgb(255, 255, 255)" }}
                    aria-label="Logo"
                  >
                    <Image
                      src={logoSrc}
                      alt="Logo"
                      width={130}
                      height={130}
                      sizes="130px"
                      className="h-full w-full object-contain"
                      unoptimized={isBlobLogo}
                      priority={false}
                    />
                  </div>
                </div>
              )}

              {/* 2) Título */}
              <h1 className={CAPTURE_TITLE_HERO} style={{ color: "rgb(31, 31, 31)" }}>
                {safeTitle}
              </h1>

              <OfertCarouselAtSlot
                enabled={ofertCarouselEnabled && ofertCarouselImageUrls.length > 0}
                imageUrls={ofertCarouselImageUrls}
                position={normalizeOfertCarouselPosition(ofertCarouselPosition)}
                slot="below_title"
                variant="classic"
                eyebrow="Destaques"
              />

              <CaptureYoutubeAtSlot
                url={yt}
                position={ytPos}
                slot="below_title"
                className="mt-4 w-full"
              />

              {/* 3) Descrição */}
              <p
                className={`${CAPTURE_BODY} mt-4 max-w-sm mx-auto font-semibold`}
                style={{ color: "rgb(60, 60, 60)" }}
              >
                {safeDesc}
              </p>

              {/* 4) Conteúdo dinâmico */}
              {layoutVariant === "scarcity" ? (
                <ScarcityPreview />
              ) : (
                <div className="grid grid-cols-3 gap-3 sm:gap-4 mt-6 sm:mt-7">
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: "rgb(235, 235, 235)" }}>
                      <Zap size={20} color="rgb(238, 77, 45)" />
                    </div>
                    <span
                      className="text-[11px] sm:text-[12.8px] font-semibold whitespace-nowrap"
                      style={{ color: "rgb(102, 102, 102)" }}
                    >
                      Ofertas Relâmpago
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: "rgb(235, 235, 235)" }}>
                      <Tag size={20} color="rgb(238, 77, 45)" />
                    </div>
                    <span className="text-[12px] sm:text-[12.8px] font-semibold" style={{ color: "rgb(102, 102, 102)" }}>
                      Descontos Reais
                    </span>
                  </div>

                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="h-11 w-11 rounded-full flex items-center justify-center" style={{ background: "rgb(235, 235, 235)" }}>
                      <Gift size={20} color="rgb(238, 77, 45)" />
                    </div>
                    <span className="text-[12px] sm:text-[12.8px] font-semibold" style={{ color: "rgb(102, 102, 102)" }}>
                      Cupons Diários
                    </span>
                  </div>
                </div>
              )}

              <CaptureYoutubeAtSlot
                url={yt}
                position={ytPos}
                slot="above_cta"
                className="mt-6 sm:mt-7 w-full"
              />

              <OfertCarouselAtSlot
                enabled={ofertCarouselEnabled && ofertCarouselImageUrls.length > 0}
                imageUrls={ofertCarouselImageUrls}
                position={normalizeOfertCarouselPosition(ofertCarouselPosition)}
                slot="above_cta"
                variant="classic"
                eyebrow="Destaques"
              />

              {/* 5) Botão */}
              <div className="flex justify-center mt-7 sm:mt-8">
                <button
                  type="button"
                  className={`${CAPTURE_CTA_CLASS} font-extrabold transition-transform duration-200 ease-out hover:scale-[1.01]`}
                  style={{
                    backgroundColor: safeColor,
                    color: "rgb(255, 255, 255)",
                    borderRadius: "16px",
                    boxShadow: `0 16px 34px rgba(${r}, ${g}, ${b}, 0.28)`,
                  }}
                >
                  {showWhatsIcon ? (
                    <FaWhatsapp size={25} color="#fff" aria-hidden />
                  ) : (
                    <ExternalLink size={20} aria-hidden />
                  )}

                  <span className={CAPTURE_CTA_LABEL}>{safeButtonText}</span>
                </button>
              </div>

              <OfertCarouselAtSlot
                enabled={ofertCarouselEnabled && ofertCarouselImageUrls.length > 0}
                imageUrls={ofertCarouselImageUrls}
                position={normalizeOfertCarouselPosition(ofertCarouselPosition)}
                slot="below_cta"
                variant="classic"
                eyebrow="Destaques"
              />

              <CaptureYoutubeAtSlot
                url={yt}
                position={ytPos}
                slot="below_cta"
                className="mt-5 w-full"
              />

              <OfertCarouselAtSlot
                enabled={ofertCarouselEnabled && ofertCarouselImageUrls.length > 0}
                imageUrls={ofertCarouselImageUrls}
                position={normalizeOfertCarouselPosition(ofertCarouselPosition)}
                slot="card_end"
                variant="classic"
                eyebrow="Destaques"
              />

              <CaptureYoutubeAtSlot
                url={yt}
                position={ytPos}
                slot="card_end"
                className="mt-5 w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
