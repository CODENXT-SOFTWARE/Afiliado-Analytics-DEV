"use client";

import { useEffect } from "react";

export function useCaptureVipFonts() {
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
}

export function isWhatsAppUrl(raw: string) {
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase();
    return h.includes("whatsapp.com") || h === "wa.me";
  } catch {
    return /whatsapp|wa\.me/i.test(raw);
  }
}

/** Interface mínima do fbq para evitar `any` e satisfazer o ESLint. */
interface WindowWithFbq extends Window {
  fbq?: (...args: unknown[]) => void;
}

/**
 * Handler de clique para botões CTA com rastreamento do Meta Pixel.
 *
 * O problema de timing: quando o usuário clica em um <a href="...">, o
 * navegador navega imediatamente e pode interromper o envio do fbq antes
 * que o request HTTP chegue aos servidores do Facebook.
 *
 * Solução: interceptamos o clique, disparamos o fbq e aguardamos 150ms
 * antes de navegar — tempo suficiente para o request de rastreamento sair.
 * Isso espelha exatamente o que plataformas de anúncio como Google Tag
 * Manager fazem internamente.
 */
export function handlePixelCTAClick(
  e: React.MouseEvent<HTMLAnchorElement>,
  pixelId: string | null | undefined,
) {
  if (typeof window === "undefined" || !pixelId) return;
  const w = window as WindowWithFbq;
  if (typeof w.fbq !== "function") return;

  const href = (e.currentTarget as HTMLAnchorElement).href;
  const isNewTab =
    e.ctrlKey || e.metaKey || e.shiftKey || e.currentTarget.target === "_blank";

  // Se abrir em nova aba, só dispara e não interfere na navegação
  if (isNewTab) {
    w.fbq("track", "Lead");
    return;
  }

  // Para a navegação imediata, dispara o pixel e navega após 150ms
  e.preventDefault();
  w.fbq("track", "Lead");
  setTimeout(() => {
    window.location.href = href;
  }, 150);
}

/**
 * Compatibilidade retroativa: dispara Lead sem controle de timing.
 * Use handlePixelCTAClick em novos botões sempre que possível.
 */
export function trackPixelLead(pixelId: string | null | undefined) {
  if (typeof window !== "undefined" && pixelId) {
    const w = window as WindowWithFbq;
    if (typeof w.fbq === "function") {
      w.fbq("track", "Lead");
    }
  }
}

