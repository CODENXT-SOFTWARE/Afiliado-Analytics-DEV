"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type CaptureOfertCarouselVariant = "aurora" | "light" | "classic";

export type CaptureOfertCarouselSlide = { src: string; alt: string };

export type CaptureOfertCarouselProps = {
  slides: CaptureOfertCarouselSlide[];
  variant?: CaptureOfertCarouselVariant;
  /** Texto pequeno acima do quadro */
  eyebrow?: string;
  /** Aurora: sangria para alinhar ao cartão com padding horizontal maior */
  bleed?: boolean;
  className?: string;
};

const VARIANT_UI: Record<
  CaptureOfertCarouselVariant,
  {
    bleedWrap: string;
    eyebrow: string;
    frame: string;
    dotActive: string;
    dotIdle: string;
    nav: string;
  }
> = {
  aurora: {
    bleedWrap: "w-[calc(100%+3.5rem)] max-w-[calc(100%+3.5rem)] -mx-7 sm:mx-0 sm:w-full sm:max-w-none",
    eyebrow: "text-zinc-500",
    frame: "border-white/10 bg-zinc-950/40 ring-white/5",
    dotActive: "bg-teal-400",
    dotIdle: "bg-zinc-600 hover:bg-zinc-500",
    nav: "border-white/15 bg-black/50 text-white hover:bg-black/65",
  },
  light: {
    bleedWrap: "w-full",
    eyebrow: "text-neutral-500",
    frame: "border-black/10 bg-white/80 ring-black/5 shadow-inner",
    dotActive: "bg-teal-500",
    dotIdle: "bg-neutral-300 hover:bg-neutral-400",
    nav: "border-black/10 bg-white/90 text-neutral-800 shadow-md hover:bg-white",
  },
  classic: {
    bleedWrap: "w-full",
    eyebrow: "text-neutral-500",
    frame: "border-black/[0.08] bg-white ring-0 shadow-inner",
    dotActive: "bg-orange-500",
    dotIdle: "bg-neutral-300 hover:bg-neutral-400",
    nav: "border-black/10 bg-white/95 text-neutral-800 shadow hover:bg-white",
  },
};

export default function CaptureOfertCarousel(props: CaptureOfertCarouselProps) {
  const { slides, variant = "light", eyebrow = "Destaques", bleed = false, className = "" } = props;
  const n = slides.length;
  const ui = VARIANT_UI[variant];

  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const onChange = () => setReduceMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduceMotion || n <= 1) return;
    const t = window.setInterval(() => setIndex((i) => (i + 1) % n), 4500);
    return () => window.clearInterval(t);
  }, [reduceMotion, n]);

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + n) % n);
    },
    [n],
  );

  if (n === 0) return null;

  const wrapBleed = bleed ? ui.bleedWrap : "w-full";

  return (
    <div
      className={`mt-5 ${wrapBleed} ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Ofertas em destaque"
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const start = touchStartX.current;
        const end = e.changedTouches[0]?.clientX;
        touchStartX.current = null;
        if (start == null || end == null) return;
        const dx = end - start;
        if (dx > 56) go(-1);
        else if (dx < -56) go(1);
      }}
    >
      <p className={`mb-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] ${ui.eyebrow}`}>
        {eyebrow}
      </p>
      <div className={`relative overflow-hidden rounded-2xl border shadow-inner ring-1 ${ui.frame}`}>
        <div
          className="flex"
          style={{
            transform: `translateX(-${index * 100}%)`,
            transition: reduceMotion ? "none" : "transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        >
          {slides.map((slide, slideIndex) => (
            <div
              key={`${slide.src}-${slideIndex}`}
              className="relative aspect-[4/3] w-full min-w-full shrink-0 max-sm:aspect-[3/4]"
              aria-hidden={slides[index]?.src !== slide.src}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                className="object-contain object-center p-0 sm:p-3"
                sizes="(max-width: 768px) 100vw, 448px"
                unoptimized={slide.src.startsWith("blob:")}
                priority={slideIndex === 0}
              />
            </div>
          ))}
        </div>

        {n > 1 ? (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              className={`absolute left-1 top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${ui.nav}`}
              aria-label="Oferta anterior"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              className={`absolute right-1 top-1/2 z-[2] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border backdrop-blur-md transition active:scale-95 ${ui.nav}`}
              aria-label="Próxima oferta"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.5} />
            </button>
          </>
        ) : null}
      </div>

      {n > 1 ? (
        <div className="mt-3 flex justify-center gap-1.5" role="tablist" aria-label="Indicadores do carrossel">
          {slides.map((slide, i) => (
            <button
              key={`dot-${slide.src}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Ir para oferta ${i + 1} de ${n}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? `w-5 ${ui.dotActive}` : `w-1.5 ${ui.dotIdle}`
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
