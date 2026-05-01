"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, useMotionValueEvent } from "framer-motion";
import {
  BarChart2, MousePointerClick, Link2, TrendingUp,
  LayoutTemplate, ShoppingBag, Bell, Calculator,
  Zap, ArrowLeftRight,
  User,
} from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

const features = [
  {
    icon: TrendingUp,
    tag: "ANALYTICS",
    title: "Tráfego Inteligente (ATI)",
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
    tag: "Automação",
    title: "Automação de Grupos",
    description:
      "Gerencie listas de transmissão e dispare ofertas automaticamente para seus grupos de WhatsApp.",
  },
  {
    icon: ArrowLeftRight,
    tag: "Espelhamento",
    title: "Espelhamento de Grupos",
    description:
      "Espelhe ofertas de outros grupos para os seus: o conteúdo chega nos seus grupos com seu link de afiliado e mídia preservada.",
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
  {
    icon: User,
    tag: "IA",
    title: "Gerador de Especialistas",
    description:
      "Gere especialistas para seus grupos de WhatsApp com nossa IA. Faça o seu especialista usar seus produtos.",
  }
];

function ScrollWrapper({ feature, index }: { feature: (typeof features)[number], index: number }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(true);
  const [inFocus, setInFocus] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { scrollYProgress } = useScroll({
    target: wrapperRef,
    offset: ["start end", "end start"],
  });

  const scale = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], [0.85, 1, 1, 0.85]);
  const opacity = useTransform(scrollYProgress, [0, 0.45, 0.55, 1], [0.3, 1, 1, 0.3]);

  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (isMobile) return;
    const distance = Math.abs(latest - 0.5);
    if (distance < 0.15) {
      if (!inFocus) setInFocus(true);
    } else {
      if (inFocus) setInFocus(false);
    }
  });

  return (
    <div ref={wrapperRef} className="w-full shrink-0 lg:flex-auto lg:shrink">
      <motion.div
        style={isMobile ? undefined : { scale, opacity }}
        className="w-full h-full origin-center will-change-transform"
      >
        <FeatureCard feature={feature} isMobile={isMobile} inFocus={inFocus} index={index} />
      </motion.div>
    </div>
  );
}

const spinKeyframes = `
@keyframes border-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
`;

function FeatureCard({ feature, isMobile, inFocus, index }: { feature: (typeof features)[number], isMobile: boolean, inFocus: boolean, index: number }) {
  const Icon = feature.icon;
  const cardRef = useRef<HTMLDivElement>(null);
  const displayIndex = String(index + 1).padStart(2, "0");

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [5, -5]), { damping: 20, stiffness: 150 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-5, 5]), { damping: 20, stiffness: 150 });

  // No mobile, forçamos o destaque para todos os cards conforme pedido
  const active = isMobile || inFocus;

  function handleMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
    if (isMobile) return;
    const rect = currentTarget.getBoundingClientRect();
    x.set((clientX - rect.left) / rect.width - 0.5);
    y.set((clientY - rect.top) / rect.height - 0.5);
  }

  function handleMouseLeave() {
    if (isMobile) return;
    x.set(0);
    y.set(0);
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: spinKeyframes }} />
      <motion.div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={isMobile ? undefined : { rotateX, rotateY, transformPerspective: 1000 }}
        className="relative flex h-full flex-col overflow-hidden rounded-[24px] p-[1.5px] group w-full transition-shadow duration-700"
      >
        <div
          className={`absolute inset-[-40%] z-0 transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-70"
            }`}
          style={{
            background: "conic-gradient(from 0deg, transparent 0%, #FF6B00 10%, transparent 20%, transparent 50%, #FF6B00 60%, transparent 70%)",
            animation: "border-spin 4s linear infinite",
          }}
        />
        <div className={`absolute inset-0 rounded-[24px] z-[1] pointer-events-none transition-all duration-500 ${active
          ? "shadow-[inset_0_0_0_1.5px_rgba(255,107,0,0.5)]"
          : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)] group-hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.13)]"
          }`} />

        <div className={`relative z-[2] flex h-full flex-col rounded-[22.5px] overflow-hidden transition-colors duration-700 ${active ? "bg-[#1e1e24]" : "bg-[#16161c] group-hover:bg-[#1c1c24]"
          }`}>
          <div className="relative flex flex-col h-full p-7 lg:p-9">
            <div className={`absolute top-3 right-5 lg:top-4 lg:right-7 font-[var(--font-space-grotesk)] text-[5rem] lg:text-[7rem] font-black leading-none select-none pointer-events-none transition-all duration-700 ${active
              ? "text-[#FF6B00]/[0.06]"
              : "text-white/[0.02] group-hover:text-white/[0.04]"
              }`}>
              {displayIndex}
            </div>

            <div className={`absolute bottom-4 left-5 w-[60px] h-[60px] pointer-events-none transition-opacity duration-700 ${active ? "opacity-[0.12]" : "opacity-[0.04] group-hover:opacity-[0.07]"
              }`}>
              <svg viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
                {[0, 15, 30, 45].map(cx =>
                  [0, 15, 30, 45].map(cy => (
                    <circle key={`${cx}-${cy}`} cx={cx + 7.5} cy={cy + 7.5} r="1.2" fill="#FF6B00" />
                  ))
                )}
              </svg>
            </div>

            <div className="relative z-10 flex flex-col h-full gap-5">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-[2px] transition-all duration-500 ${active
                  ? "bg-[#FF6B00]/10 text-[#FF6B00] border border-[#FF6B00]/30"
                  : "bg-white/[0.03] text-white/30 border border-white/[0.06] group-hover:text-white/45 group-hover:border-white/10"
                  }`}>
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${active ? "bg-[#FF6B00] shadow-[0_0_6px_rgba(255,107,0,0.6)]" : "bg-white/20"
                    }`} />
                  {feature.tag}
                </span>
                <span className={`font-[var(--font-space-grotesk)] text-[11px] font-semibold tracking-[3px] transition-colors duration-500 ${active ? "text-[#FF6B00]/40" : "text-white/10 group-hover:text-white/15"
                  }`}>
                  {displayIndex}/{String(features.length).padStart(2, "0")}
                </span>
              </div>

              <div className="flex items-center gap-5 mt-1">
                <div className="relative flex-shrink-0">
                  <div
                    className={`relative flex h-[56px] w-[56px] items-center justify-center rounded-full border transition-all duration-700 ${active ? "scale-110 border-[#FF6B00]/40 shadow-[0_0_20px_rgba(255,107,0,0.2)]" : "border-white/[0.08] group-hover:border-[#FF6B00]/30"
                      }`}
                  >
                    <div className={`absolute inset-0 rounded-full transition-all duration-700 ${active
                      ? "bg-gradient-to-br from-[#FF6B00]/25 to-[#FF6B00]/5"
                      : "bg-gradient-to-br from-white/[0.06] to-white/[0.02] group-hover:from-[#FF6B00]/12 group-hover:to-[#FF6B00]/3"
                      }`} />
                    <Icon className="h-6 w-6 text-[#FF6B00] relative z-10" strokeWidth={1.8} />
                  </div>
                  <div className={`absolute inset-0 blur-[20px] rounded-full transition-opacity duration-700 ${active ? "bg-[#FF6B00]/25 opacity-100" : "bg-[#FF6B00]/10 opacity-0 group-hover:opacity-60"
                    }`} />
                </div>

                <h3 className={`font-[var(--font-space-grotesk)] text-[1.35rem] lg:text-[1.65rem] font-bold tracking-[-0.03em] leading-[1.15] transition-colors duration-500 ${active ? "text-white" : "text-white/80 group-hover:text-white"
                  }`}>
                  {feature.title}
                </h3>
              </div>

              <div className="relative h-[1px] w-full">
                <div className={`absolute left-0 top-0 h-full bg-gradient-to-r from-[#FF6B00] via-[#FF6B00]/40 to-transparent transition-all duration-700 ${active ? "w-full opacity-50" : "w-1/4 opacity-15 group-hover:w-3/4 group-hover:opacity-30"
                  }`} />
              </div>

              <p className={`text-[0.98rem] lg:text-[1.05rem] leading-[1.75] tracking-[0.005em] transition-all duration-500 ${active ? "text-white/70" : "text-[#6b6b78] group-hover:text-white/50"
                }`}>
                {feature.description}
              </p>
            </div>
          </div>
        </div>

        <div className={`absolute -inset-[1px] rounded-[25px] pointer-events-none z-0 transition-opacity duration-700 ${active ? "opacity-100" : "opacity-0"
          }`}
          style={{ boxShadow: "0 0 60px -10px rgba(255,107,0,0.2), 0 0 120px -30px rgba(255,107,0,0.1)" }}
        />
      </motion.div>
    </>
  );
}

export default function FeaturesHybrid() {
  const [emblaRef] = useEmblaCarousel({ loop: true, align: "center" }, [
    Autoplay({ delay: 3500, stopOnInteraction: false })
  ]);

  return (
    <section id="features" className="relative bg-dark-bg text-white font-['Inter'] scroll-mt-24 overflow-x-clip transition-colors duration-500">
      <div className="container relative mx-auto px-6 flex flex-col lg:flex-row z-10 max-w-[1400px]">
        {/* TITULO E DESCRIÇÃO - Centralizados no mobile */}
        <div className="w-full lg:w-[50%] h-auto lg:h-screen lg:sticky lg:top-0 flex flex-col items-center lg:items-start justify-center pt-16 pb-8 lg:pt-0 lg:pb-0 lg:pr-16 z-10">
          <div className="space-y-8 text-center lg:text-left">
            <div className="inline-flex flex-col">
              <h2 className="font-[var(--font-space-grotesk)] text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.04em] text-white">
                Um arsenal completo<br />
                <span className="text-[#ff6b35]">para afiliados sérios.</span>
              </h2>
            </div>

            <div className="space-y-6">
              <p className="font-['Inter'] text-[16px] leading-[1.8] text-white/60 max-w-[400px] mx-auto lg:mx-0">
                Analytics, automação, IA e links — tudo integrado para você escalar suas vendas na Shopee sem abrir 12 abas differentes.
              </p>
            </div>
          </div>
        </div>

        {/* CARDS - Carrossel no mobile, Scroll Sticky no desktop */}
        <div className="w-full lg:w-[50%] relative z-20 pb-16 lg:pb-0">
          
          {/* Versão Desktop (Scroll Vertical) */}
          <div className="hidden lg:flex flex-col gap-[20vh] pt-[50vh] pb-[50vh]">
            {features.map((feature, idx) => (
              <ScrollWrapper key={`desktop-${idx}`} feature={feature} index={idx} />
            ))}
          </div>

          {/* Versão Mobile (Embla Carousel) */}
          <div className="lg:hidden w-full overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {features.map((feature, idx) => (
                <div key={`mobile-${idx}`} className="flex-[0_0_85%] min-w-0 px-3">
                  <FeatureCard feature={feature} isMobile={true} inFocus={false} index={idx} />
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}