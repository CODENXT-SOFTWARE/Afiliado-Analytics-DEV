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

/**
 * Dispara o evento de conversão 'Lead' no Meta Pixel se estiver configurado.
 */
export function trackPixelLead(pixelId: string | null | undefined) {
  if (typeof window !== "undefined" && pixelId) {
    const w = window as any;
    if (typeof w.fbq === "function") {
      w.fbq("track", "Lead");
    }
  }
}
