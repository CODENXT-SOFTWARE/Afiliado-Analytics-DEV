"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Download, ExternalLink } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import PwaInstallHintModal from "@/app/components/PwaInstallHintModal";
import { runPwaInstallFlow } from "@/lib/pwa-install-flow";
import { CAPTURE_PUBLIC_DOMAIN } from "@/lib/capture-load-site";

/** Mesmo link do suporte via WhatsApp. */
export const SUPPORT_WHATSAPP_HREF = "https://wa.me/5579999144028";

/** Playlist de tutoriais (mesmo link do menu lateral do dashboard). */
export const TUTORIAL_PLAYLIST_HREF =
  "https://www.youtube.com/playlist?list=PLt2etInlvKH1mUwYrUMOp8mBNcNsFh3WO";

const STAGGER_MS = 50;

export default function MainFloatingActions() {
  const pathname = usePathname() ?? "";
  const isCapture = pathname.startsWith("/capture");
  const isHome = pathname === "/";
  const menuId = useId();

  /** URL limpa no subdomínio público (rewrite → /capture/...): não mostrar tutorial. */
  const [slugOnCapturePublicHost, setSlugOnCapturePublicHost] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const host = window.location.hostname.toLowerCase();
    const path = window.location.pathname || "/";
    if (host !== CAPTURE_PUBLIC_DOMAIN.toLowerCase()) {
      setSlugOnCapturePublicHost(false);
      return;
    }
    if (path === "/" || path === "") {
      setSlugOnCapturePublicHost(false);
      return;
    }
    setSlugOnCapturePublicHost(/^\/[^/]+(\/go)?\/?$/.test(path));
  }, [pathname]);

  const showTutorialMenuItem = !isHome && !slugOnCapturePublicHost;

  const [pastHero, setPastHero] = useState(false);
  const [open, setOpen] = useState(false);
  const [installHintFab, setInstallHintFab] = useState<"standalone" | "browser" | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mq.matches);
    const onChange = () => setPrefersReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isHome) {
      setPastHero(true);
      return;
    }
    const onScroll = () => {
      const heroHeight = document.querySelector("section")?.clientHeight ?? 0;
      setPastHero(window.scrollY > heroHeight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, close]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /** Rotas /capture/… e URLs limpas no subdomínio público (/<slug>, /<slug>/go) — sem FAB de menu. */
  if (isCapture || slugOnCapturePublicHost) {
    return null;
  }

  if (isHome && !pastHero) {
    return null;
  }

  const motion = prefersReducedMotion;

  const itemClass = () =>
    [
      "group flex min-h-[44px] w-[min(92vw,260px)] items-center gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold shadow-lg sm:w-[240px]",
      "transition-[transform,opacity] duration-300 ease-out",
      motion
        ? open
          ? "opacity-100"
          : "pointer-events-none opacity-0"
        : open
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0",
    ].join(" ");

  const itemStyle = (delayIndex: number): React.CSSProperties | undefined =>
    motion || !open
      ? undefined
      : { transitionDelay: `${(2 - delayIndex) * STAGGER_MS}ms` };

  return (
    <>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className={[
          "fixed inset-0 z-[49] bg-black/30 backdrop-blur-[3px] transition-opacity duration-300 md:bg-black/25",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
        onClick={close}
      />

      <div ref={rootRef} className="fixed bottom-6 right-6 z-50">
        <div
          className={[
            "absolute bottom-[calc(100%+12px)] right-0 flex flex-col items-end gap-2.5",
            "origin-bottom-right transition-[transform,opacity] duration-300 ease-out",
            open ? "pointer-events-auto scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0",
          ].join(" ")}
          id={menuId}
          role="menu"
          aria-label="Ajuda e contato"
        >
          {showTutorialMenuItem ? (
            <a
              href={TUTORIAL_PLAYLIST_HREF}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className={[
                itemClass(),
                "border border-white/12 bg-zinc-900/95 text-white shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-md hover:border-white/22 hover:bg-zinc-800/98 hover:shadow-xl active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
              ].join(" ")}
              style={itemStyle(2)}
              tabIndex={open ? 0 : -1}
              onClick={close}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 transition-colors group-hover:bg-white/15">
                <ExternalLink className="h-4 w-4" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="text-[13px] font-bold tracking-tight">Acessar Tutorial</span>
                <span className="text-[11px] font-normal text-white/55">Playlist no YouTube</span>
              </span>
            </a>
          ) : null}

          <button
            type="button"
            role="menuitem"
            className={[
              itemClass(),
              "cursor-pointer border-0 bg-gradient-to-br from-[#e24c30] to-[#ff6b35] text-white shadow-[0_14px_36px_rgba(226,76,48,0.42)] hover:shadow-[0_18px_42px_rgba(226,76,48,0.52)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            ].join(" ")}
            style={itemStyle(1)}
            tabIndex={open ? 0 : -1}
            onClick={async () => {
              const result = await runPwaInstallFlow();
              if (result === "standalone") setInstallHintFab("standalone");
              else if (result === "browser") setInstallHintFab("browser");
              close();
            }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <Download className="h-5 w-5" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left leading-tight">
              <span className="text-[13px] font-bold tracking-tight">Baixar o app</span>
              <span className="text-[11px] font-normal text-white/90">Instalar Afiliado Analytics</span>
            </span>
          </button>

          <a
            href={SUPPORT_WHATSAPP_HREF}
            target="_blank"
            rel="noopener noreferrer"
            role="menuitem"
            className={[
              itemClass(),
              "bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white shadow-[0_14px_36px_rgba(37,211,102,0.4)] hover:shadow-[0_18px_42px_rgba(37,211,102,0.5)] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200/90 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
            ].join(" ")}
            style={itemStyle(0)}
            tabIndex={open ? 0 : -1}
            onClick={close}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20">
              <FaWhatsapp className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="text-[13px] font-bold tracking-tight">Suporte no WhatsApp</span>
              <span className="text-[11px] font-normal text-white/90">Fale com a gente</span>
            </span>
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls={menuId}
          aria-label={
            open
              ? "Fechar menu de ajuda"
              : showTutorialMenuItem
                ? "Abrir menu de ajuda — tutorial, app e WhatsApp"
                : "Abrir menu de ajuda — app e WhatsApp"
          }
          className={[
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/18 bg-zinc-900/92 text-white shadow-[0_10px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md transition-all duration-300 ease-out",
            "hover:border-[#e24c30]/40 hover:shadow-[0_14px_44px_rgba(226,76,48,0.28)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/55 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
            open ? "scale-105 ring-2 ring-[#e24c30]/45 ring-offset-2 ring-offset-zinc-950" : "hover:scale-[1.04] active:scale-[0.97]",
            motion ? "" : "animate-fade-in-up",
          ].join(" ")}
        >
          <Image
            src="/favicon-32x32.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 rounded-md object-contain"
            priority
            unoptimized
          />
          <span
            className={[
              "pointer-events-none absolute -right-1 -top-1 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/25 bg-gradient-to-br from-[#e24c30] to-[#c73d26] text-[11px] font-bold text-white shadow-md transition-transform duration-300",
              open ? "rotate-90" : "",
            ].join(" ")}
            aria-hidden
          >
            {open ? "×" : "+"}
          </span>
        </button>
      </div>

      <PwaInstallHintModal hint={installHintFab} onClose={() => setInstallHintFab(null)} />
    </>
  );
}
