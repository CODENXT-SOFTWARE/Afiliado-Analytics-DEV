"use client";

import { useEffect } from "react";
import { ensureSubscribed } from "@/lib/push/client";

declare global {
  interface Window {
    __pwaDeferredInstall?: Event & { prompt: () => Promise<void> };
  }
}

export function PwaServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      window.__pwaDeferredInstall = e as Window["__pwaDeferredInstall"];
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (process.env.NODE_ENV !== "production" && !isLocal) return;

    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        if (cancelled) return;
        // Quando o usuário já concedeu permissão (ex.: PWA instalado e já
        // ativou em outra sessão), garantimos que o servidor tenha a
        // subscription mais recente. Idempotente — só faz POST se mudou.
        ensureSubscribed().catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
