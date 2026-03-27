"use client";

import React, { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import type { EmblaCarouselType } from "embla-carousel";
import { motion } from "framer-motion";
import {
  BarChart2, MousePointerClick, Link2, TrendingUp,
  LayoutTemplate, ShoppingBag, Bell, Calculator,
  Zap, ChevronLeft, ChevronRight, ArrowRight,
} from "lucide-react";

const features = [
  {
    icon: TrendingUp,
    tag: "ANALYTICS",
    title: "Tráfego Inteligente (ATIA)",
    description:
      "Cruze dados do Meta e Shopee para validar criativos. Escale suas campanhas com o termômetro de performance Ruim, Bom ou Excelente.",
  },
  {
    icon: Zap,
    tag: "Automação",
    title: "Gerador de criativo",
    description:
      "Gere vídeos de achadinhos prontos para postar com nossa IA. Economize tempo e escale sua criação de conteúdo.",
  },
  {
    icon: Bell,
    tag: "Relatórios",
    title: "Grupos de venda",
    description:
      "Gerencie listas de transmissão e dispare ofertas automaticamente para seus grupos de WhatsApp.",
  },
  {
    icon: Calculator,
    tag: "Calculadora",
    title: "Calculadora GPL",
    description:
      "Monitore o custo por lead e as saídas. Descubra o prejuízo exato e projete sua receita real.",
  },
  {
    icon: LayoutTemplate,
    tag: "Conversão",
    title: "Site de Captura",
    description:
      "Crie páginas de captura de alta conversão em minutos. Sem precisar de programador.",
  },
  {
    icon: ShoppingBag,
    tag: "Produtos",
    title: "Criar campanha Meta",
    description:
      "Suba e gerencie seus anúncios sem precisar abrir o Meta Ads, controlando tudo direto pelo nosso painel.",
  },
  {
    icon: Link2,
    tag: "LINKS",
    title: "Gerador Link Shopee",
    description:
      "Gere links rastreáveis da Shopee com Sub IDs, sem precisar abrir o aplicativo. Salve os links e crie listas de ofertas.",
  },
  {
    icon: BarChart2,
    tag: "Analytics",
    title: "Análise de Comissões",
    description:
      "Visualize comissões, vendas e pedidos únicos com dashboards detalhados. Calcule ROI e CPA automaticamente.",
  },
  {
    icon: MousePointerClick,
    tag: "Rastreamento",
    title: "Análise de Cliques",
    description:
      "Analise minuciosamente o volume, a origem e os horários de pico dos seus cliques na Shopee.",
  },
  {
    icon: Link2,
    tag: "Links",
    title: "Redirecionador de Links",
    description:
      "Crie links curtos, amigáveis e evite o bloqueio em redes sociais alterando o destino.",
  },
];

// ─── Card ─────────────────────────────────────────────────────────────────────
function FeatureCard({ feature }: { feature: (typeof features)[number] }) {
  const Icon = feature.icon;

  return (
    <motion.div
      whileHover={{ y: -5 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="h-full group"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[26px] border border-white/20 bg-[#242427] p-[26px] backdrop-blur-xl transition-all duration-400 ease-out group-hover:border-[#EC5C3C]/55 group-hover:bg-[#2c2c30] group-hover:shadow-[0_12px_28px_rgba(236,92,60,0.10)]">

        {/* Linha de acento no topo — cresce de w-0 → w-full no hover */}
        <div className="absolute inset-x-0 top-0 h-[2px] w-0 bg-gradient-to-r from-[#EC5C3C] to-[#ff9a6c] rounded-t-[26px] transition-all duration-500 group-hover:w-full" />

        {/* Efeito de brilho sutil no topo ao passar o mouse */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#EC5C3C]/40 to-transparent opacity-0 transition-opacity duration-400 group-hover:opacity-100" />

        {/* Tag badge + seta */}
        <div className="mb-5 flex items-center justify-between">
          <span className="inline-flex items-center rounded-full border border-[#EC5C3C]/20 bg-[#EC5C3C]/10 px-[10px] py-[4px] font-['Inter'] text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fb923c]">
            {feature.tag}
          </span>
          {/* Seta aparece e desliza no hover */}
          <ArrowRight className="h-[14px] w-[14px] text-[#333333] opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[#EC5C3C]" />
        </div>

        {/* Ícone + Título */}
        <div className="mb-4 flex items-start gap-[14px]">
          <div className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-[#3d1f17] to-[#1e1210] shadow-[0_0_0_1px_rgba(236,92,60,0.12)] transition-all duration-400 group-hover:shadow-[0_0_10px_rgba(236,92,60,0.20)] group-hover:scale-105">
            <Icon className="h-[18px] w-[18px] text-[#EC5C3C]" />
          </div>

          <h3 className="m-0 pt-[2px] font-[var(--font-space-grotesk)] text-[15.5px] font-bold leading-snug tracking-tight text-zinc-100 group-hover:text-white transition-colors duration-300">
            {feature.title}
          </h3>
        </div>

        {/* Divisor gradiente */}
        <div className="mb-4 h-px w-full bg-gradient-to-r from-[#EC5C3C]/15 via-[#2a2a2a] to-transparent" />

        {/* Descrição em tom claro */}
        <p className="m-0 font-['Inter'] text-[13.5px] leading-[1.72] text-zinc-300 group-hover:text-zinc-100 transition-colors duration-300">
          {feature.description}
        </p>

      </div>
    </motion.div>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────
export default function FeaturesGridPunchy() {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: "center",
      containScroll: "trimSnaps",
      dragFree: true,
      loop: true,
      breakpoints: { "(min-width: 768px)": { align: "start" } },
    },
    [Autoplay({ delay: 4000, stopOnInteraction: false })]
  );

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo   = useCallback((i: number) => emblaApi?.scrollTo(i), [emblaApi]);

  const handleMouseEnter = useCallback(() => emblaApi?.plugins().autoplay.stop(), [emblaApi]);
  const handleMouseLeave = useCallback(() => emblaApi?.plugins().autoplay.play(),  [emblaApi]);

  const onInit = useCallback((api: EmblaCarouselType) => setScrollSnaps(api.scrollSnapList()), []);
  const onSelect = useCallback((api: EmblaCarouselType) => setSelectedIndex(api.selectedScrollSnap()), []);

  useEffect(() => {
    if (!emblaApi) return;
    onInit(emblaApi);
    onSelect(emblaApi);
    emblaApi.on("reInit", onInit).on("reInit", onSelect).on("select", onSelect);
  }, [emblaApi, onInit, onSelect]);

  return (
    <section id="features" className="relative overflow-hidden py-20 sm:py-28">

      {/* ── Background: glows + dot pattern escuro ── */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `radial-gradient(circle, #1e1e1e 1px, transparent 1px)`,
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute left-1/2 top-[-60px] h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(226,76,48,0.08)_0%,transparent_68%)] blur-[55px]" />
        <div className="absolute right-[-80px] top-1/2 h-[380px] w-[380px] -translate-y-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(255,107,53,0.05)_0%,transparent_70%)] blur-[45px]" />
        <div className="absolute bottom-[-40px] left-1/2 h-[280px] w-[600px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,rgba(236,92,60,0.04)_0%,transparent_70%)] blur-[40px]" />
      </div>

      <div className="container relative z-10 mx-auto max-w-[1320px] px-4">

        {/* ── HEADER ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <span className="mb-[14px] block font-['Inter'] text-[12px] font-bold uppercase tracking-[0.18em] text-[#fb923c]">
            Arsenal de Elite
          </span>

          <h2 className="mb-5 font-[var(--font-space-grotesk)] text-[clamp(2rem,5vw,3.1rem)] font-black leading-[1.08] tracking-[-1.5px] text-white">
            10 ferramentas{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">
              poderosas
            </span>
          </h2>

          <p className="mx-auto max-w-[580px] font-['Inter'] text-[16.5px] leading-[1.75] text-zinc-400">
            Tudo que você precisa para analisar, otimizar e escalar seus resultados no ecossistema Shopee.
          </p>
        </motion.div>

        {/* ── CARROSSEL ── */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="relative group/carousel md:px-14 lg:px-16"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="overflow-hidden cursor-grab active:cursor-grabbing py-5" ref={emblaRef}>
            <div className="flex -ml-4 md:-ml-5 lg:-ml-6">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="pl-4 md:pl-5 lg:pl-6 flex-[0_0_85%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%] xl:flex-[0_0_25%] min-w-0"
                >
                  <FeatureCard feature={feature} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Seta Anterior ── */}
          <button
            onClick={scrollPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 hidden md:flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[#EC5C3C]/30 bg-[#EC5C3C]/10 text-[#EC5C3C] backdrop-blur-sm transition-all duration-300 hover:bg-[#EC5C3C]/20 hover:border-[#EC5C3C]/60 hover:shadow-[0_0_22px_rgba(236,92,60,0.30)] z-20"
            aria-label="Item anterior"
          >
            <ChevronLeft className="h-[20px] w-[20px]" />
          </button>

          {/* ── Seta Próxima ── */}
          <button
            onClick={scrollNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 hidden md:flex h-[46px] w-[46px] items-center justify-center rounded-full border border-[#EC5C3C]/30 bg-[#EC5C3C]/10 text-[#EC5C3C] backdrop-blur-sm transition-all duration-300 hover:bg-[#EC5C3C]/20 hover:border-[#EC5C3C]/60 hover:shadow-[0_0_22px_rgba(236,92,60,0.30)] z-20"
            aria-label="Próximo item"
          >
            <ChevronRight className="h-[20px] w-[20px]" />
          </button>
        </motion.div>

        {/* ── DOTS ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-10 flex items-center justify-center gap-2"
        >
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              className={`rounded-full transition-all duration-300 ${
                index === selectedIndex
                  ? "w-7 h-[5px] bg-gradient-to-r from-[#EC5C3C] to-[#ff9a6c] shadow-[0_0_10px_rgba(236,92,60,0.65)]"
                  : "w-[5px] h-[5px] bg-[#2a2a2a] hover:bg-[#EC5C3C]/40"
              }`}
              aria-label={`Ir para a página ${index + 1}`}
            />
          ))}
        </motion.div>

      </div>
    </section>
  );
}