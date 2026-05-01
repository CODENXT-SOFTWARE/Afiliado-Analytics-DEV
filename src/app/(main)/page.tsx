"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Testimonials from "../components/home/Testimonials";
import Faq from "../components/home/Faq";
import Pricing from "../components/home/Pricing";
import FeaturesSection from "../components/home/Features";
import Mockup from "../components/home/Mockup";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import NasaParticles from "../components/home/NasaParticles";

import FloatingDollars from "../components/home/FloatingDollars";
import IntegrationsMarquee from "../components/home/IntegrationsMarquee";
import { useTheme } from "../components/theme/ThemeProvider";


const PARTICLE_COLORS = ["#ff6b35", "#ac58ea", "#B2B1B3"];

export default function HomePage() {

  const { theme } = useTheme();
  const isLight = theme === 'light';
  const vturbContainerRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [showHeavy, setShowHeavy] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Fundo 3D (R3F) - Adiado para não travar o início
    const heavyTimer = setTimeout(() => {
      setShowHeavy(true);
    }, 4500);


    // DELAY V-TURB: Garantir que o script seja processado após o elemento estar no DOM
    const vturbTimer = setTimeout(() => {
      const scriptSrc = "https://scripts.converteai.net/1a08de6e-5582-4e59-9343-8ad1f2dfcbb5/players/69cbd3db50cfd93acabf9083/v4/player.js";
      const container = vturbContainerRef.current;

      if (container) {
        // Garantir que a tag do player esteja presente
        if (!container.querySelector("vturb-smartplayer")) {
          container.innerHTML = '<vturb-smartplayer id="vid-69cbd3db50cfd93acabf9083" style="display:block;margin:0 auto;width:100%;height:100%;"></vturb-smartplayer>';
        }

        // Forçar o carregamento do script para inicializar o player
        // Removemos instâncias anteriores para evitar conflitos se necessário, mas o principal é garantir a execução
        const existingScript = document.querySelector(`script[src="${scriptSrc}"]`);
        if (existingScript) {
          existingScript.remove();
        }

        const s = document.createElement("script");
        s.src = `${scriptSrc}?v=${Date.now()}`; // Cache buster para forçar re-execução
        s.async = true;
        document.head.appendChild(s);
      }
    }, 1500);

    return () => {
      clearTimeout(heavyTimer);
      clearTimeout(vturbTimer);
    };
  }, []);



  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative bg-dark-bg text-text-secondary overflow-clip transition-colors duration-500">

      {/* ══════ HERO ══════ */}
      <section className="relative min-h-screen pt-[120px] pb-20 overflow-hidden flex flex-col justify-center">

        {/* Fundo oficial via tsparticles (NASA) apenas no Hero */}
        <div className="absolute inset-0 z-0 h-full w-full">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 3.0, delay: 0.5 }}
            className="w-full h-full"
            style={{ willChange: 'opacity' }}
          >
            <NasaParticles />
          </motion.div>
        </div>
        {/* Auroras */}
        <div className="animate-aurora1 pointer-events-none absolute left-[-10%] top-[-10%] h-[400px] w-[400px] lg:h-[700px] lg:w-[700px] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.15)_0%,transparent_60%)] light:bg-[radial-gradient(circle,rgba(226,76,48,0.08)_0%,transparent_60%)] blur-[60px] z-0" style={{ willChange: 'transform' }} />
        <div className="animate-aurora2 pointer-events-none absolute right-[-5%] top-[20%] h-[300px] w-[300px] lg:h-[600px] lg:w-[600px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12)_0%,transparent_60%)] light:bg-[radial-gradient(circle,rgba(168,85,247,0.06)_0%,transparent_60%)] blur-[60px] z-0" style={{ willChange: 'transform' }} />

        {/* Grids de Fundo */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(15,15,20,0.8)_100%)] light:bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(255,255,255,0.7)_100%)] z-0" />

        <div className="container relative z-10 mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center max-w-[1400px]">

          {/* Left Column: Text & CTAs */}
          <div className="flex flex-col items-center lg:items-start text-center lg:text-left pt-10 lg:pt-0">


            {/* Título Principal - ANIMADO */}
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
              className="mb-4 lg:mb-6 font-[var(--font-space-grotesk)] font-extrabold leading-[1.1] lg:leading-[1.05] tracking-tight"
            >
              <span className="block text-[clamp(2rem,8vw,2.8rem)] lg:text-[clamp(2.4rem,3.8vw,4rem)] text-text-primary lg:whitespace-nowrap">
                Chega de adivinhar,
              </span>
              <span className="mt-1 lg:mt-2 block text-[clamp(2rem,8vw,2.8rem)] lg:text-[clamp(2.4rem,3.8vw,4rem)] text-text-primary/90 lg:whitespace-nowrap">
                comece a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] via-[#e24c30] to-[#ff9a6c]">escalar.</span>
              </span>
            </motion.h1>

            {/* Subtítulo - ANIMADO */}
            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="mb-10 max-w-[560px] font-['Inter'] text-[clamp(1.05rem,1.2vw,1.15rem)] font-light leading-relaxed text-text-secondary"
            >
              O único ecossistema com <strong className="font-semibold text-text-primary">12 ferramentas poderosas</strong> que os super afiliados usam para faturar mais, trabalhar menos e <strong className="font-semibold text-[#ff7a54]">dominar qualquer nicho.</strong>
            </motion.p>

            {/* Botões - ANIMADOS */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center gap-5 w-full justify-center lg:justify-start"
            >
              <Link
                href="#pricing"
                className="group relative inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#e24c30] to-[#ff6b35] h-[60px] px-8 font-['Inter'] text-[1.05rem] font-bold text-white shadow-[0_8px_25px_rgba(226,76,48,0.35)] transition-all duration-300 hover:shadow-[0_8px_35px_rgba(226,76,48,0.55)] hover:-translate-y-1 w-full sm:w-auto overflow-hidden"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out rounded-full" />
                <span className="relative z-10 flex items-center gap-2">
                  Ver Planos <span className="text-xl leading-none group-hover:translate-x-1 transition-transform">→</span>
                </span>
              </Link>

              <button
                onClick={() => scrollToSection("demo")}
                className="group relative inline-flex items-center justify-center gap-3 rounded-full border border-[#e24c30] h-[60px] pr-8 pl-3 font-['Inter'] text-[1.05rem] font-bold text-text-primary transition-all duration-300 hover:bg-[#e24c30]/10 hover:border-[#ff6b35] w-full sm:w-auto"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#e24c30] to-[#ff6b35] shadow-[0_0_10px_rgba(226,76,48,0.3)]">
                  <svg width="10" height="12" viewBox="0 0 14 16" fill="none" xmlns="http://www.w3.org/2000/svg" className="ml-0.5 z-10">
                    <path d="M13.2087 6.4673C14.2638 7.02537 14.2638 8.52845 13.2087 9.08652L2.57147 14.7118C1.58334 15.2344 0.395874 14.5186 0.395874 13.3992L0.395874 2.15467C0.395874 1.03525 1.58334 0.319409 2.57147 0.842045L13.2087 6.4673Z" fill="white" />
                  </svg>
                </div>
                <span className="relative tracking-wide">
                  Ver Demo
                </span>
              </button>
            </motion.div>

            {/* Ícones de Confiança / Social Proof */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
              className="mt-8 lg:mt-12 flex flex-col sm:flex-row items-center sm:items-start gap-4"
            >
              <div className="flex -space-x-3">
                <img src="https://i.pravatar.cc/100?img=11" alt="Avatar User" className="w-[38px] h-[38px] rounded-full border-[2.5px] border-dark-bg object-cover relative z-40" />
                <img src="https://i.pravatar.cc/100?img=33" alt="Avatar User" className="w-[38px] h-[38px] rounded-full border-[2.5px] border-dark-bg object-cover relative z-30" />
                <img src="https://i.pravatar.cc/100?img=47" alt="Avatar User" className="w-[38px] h-[38px] rounded-full border-[2.5px] border-dark-bg object-cover relative z-20" />
                <img src="https://i.pravatar.cc/100?img=12" alt="Avatar User" className="w-[38px] h-[38px] rounded-full border-[2.5px] border-dark-bg object-cover relative z-10" />
              </div>
              <div className="flex flex-col items-center sm:items-start text-sm">
                <div className="flex items-center gap-1 mb-1">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-3.5 h-3.5 text-[#FFB800]" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
                <span className="font-['Inter'] font-medium text-text-secondary">
                  Utilizado por <strong className="text-text-primary">+5.000 afiliados</strong>
                </span>
              </div>
            </motion.div>
          </div>

          {/* Coluna Direita: Elemento Visual Dinâmico */}
          <div className="relative w-full h-[350px] sm:h-[450px] lg:h-[550px] flex items-center justify-center mt-8 lg:mt-0 lg:ml-auto lg:translate-x-12">
            <div className="relative w-full max-w-[320px] sm:max-w-[420px] lg:max-w-[520px] h-full flex items-center justify-center">

              {/* 3D Floating Dollars - Carregado com atraso (Desktop only) */}
              <div className="hidden lg:block absolute inset-0 pointer-events-none">
                {showHeavy && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 1.5 }}
                    className="w-full h-full"
                  >
                    <FloatingDollars />
                  </motion.div>
                )}
              </div>

              {/* 2D CSS Dollars - Mobile/Tablet only (lightweight) */}
              <div className="lg:hidden absolute inset-0 pointer-events-none z-20" style={{ overflow: 'visible' }}>
                {[
                  { top: '-2%', left: '-3%', size: 26, rotate: -18, delay: 0.8, anim: 'mobile-dollar-1' },
                  { top: '4%', right: '-2%', size: 28, rotate: 22, delay: 1.2, anim: 'mobile-dollar-2' },
                  { top: '37%', left: '-6%', size: 22, rotate: -30, delay: 1.6, anim: 'mobile-dollar-3' },
                  { top: '41%', right: '-5%', size: 26, rotate: 15, delay: 2.0, anim: 'mobile-dollar-4' },
                  { top: '77%', left: '0%', size: 24, rotate: 25, delay: 2.4, anim: 'mobile-dollar-5' },
                  { top: '74%', right: '1%', size: 20, rotate: -12, delay: 2.8, anim: 'mobile-dollar-1' },
                ].map((d, i) => (
                  <motion.span
                    key={`mobile-dollar-${i}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1.2, delay: d.delay, ease: 'easeOut' }}
                    className={`absolute font-extrabold text-[#ff6b35] light:text-[#EE4D2D] drop-shadow-[0_2px_8px_rgba(255,107,53,0.5)] light:drop-shadow-[0_2px_12px_rgba(238,77,45,0.4)] ${d.anim}`}
                    style={{
                      top: d.top,
                      left: 'left' in d ? d.left : undefined,
                      right: 'right' in d ? d.right : undefined,
                      fontSize: `${d.size}px`,
                      transform: `rotate(${d.rotate}deg)`,
                      textShadow: isLight ? '0 0 15px rgba(238,77,45,0.3)' : '0 0 12px rgba(255,107,53,0.4)',
                    }}
                  >
                    $
                  </motion.span>
                ))}
              </div>


              {/* Imagem Central */}
              <div className="relative z-10 w-full h-full flex items-center justify-center pointer-events-none">
                {/* AURA SOLAR: Surgimento mais enérgico (Amanhecer acelerado) */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 2.0, delay: 1.4, ease: "linear" }}
                  className="absolute inset-0 flex items-center justify-center"
                >




                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%] w-[110%] lg:w-[125%] aspect-square bg-[#ff6b35]/25 light:bg-[#ff6b35]/15 rounded-full blur-[45px] lg:blur-[60px] z-0" />
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[52%] w-[75%] aspect-square bg-orange-500/40 light:bg-orange-500/20 rounded-full blur-[15px] z-0 shadow-[0_0_30px_rgba(255,107,53,0.3)]" />
                </motion.div>

                {/* PERSONAGEM: Movimento lento e fluido (Foco total da GPU aqui) */}
                <motion.div
                  initial={{ opacity: 0, y: 80 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 3.2,
                    delay: 1.0,
                    ease: [0.1, 1, 0.2, 1]
                  }}
                  className="relative w-full h-full flex items-center justify-center"
                  style={{ willChange: 'transform, opacity' }}
                >
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[45%] w-[55%] h-[75%] bg-black/30 light:bg-black/5 rounded-full blur-[50px] z-0 pointer-events-none" />

                  <Image
                    src="/hero/corpo hero.webp"
                    alt="Personagem Hero"
                    fill
                    priority
                    fetchPriority="high"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 800px"
                    className="object-contain relative z-10"
                  />
                </motion.div>
              </div>

              {/* Arco de Ícones Animados em Sequência */}
              <FloatingBubble
                src="/hero/robo.webp"
                alt="Robot"
                className="top-[18%] lg:top-[14%] left-[2%] lg:left-[-9%]"
                sizeClass="w-[75px] lg:w-[130px]"
                animateClass="animate-float-icon-1"
                delay={1.2}
              />
              <FloatingBubble
                src="/hero/amazom.webp"
                alt="Amazon"
                className="top-[-3%] left-[12%]"
                sizeClass="w-[70px] lg:w-[115px]"
                animateClass="animate-float-icon-2"
                delay={2.0}
              />
              <FloatingBubble
                src="/hero/sho.webp"
                alt="Shopee"
                className="top-[-15%] left-[50%] -translate-x-1/2"
                sizeClass="w-[85px] lg:w-[115px]"
                animateClass="animate-float-icon-1"
                delay={2.8}
              />
              <FloatingBubble
                src="/hero/mercado.webp"
                alt="Mercado"
                className="top-[-3%] right-[10%]"
                sizeClass="w-[70px] lg:w-[115px]"
                animateClass="animate-float-icon-5"
                delay={3.6}
              />
              <FloatingBubble
                src="/hero/dash.webp"
                alt="Dashboard"
                className="top-[17%] right-[2%] lg:right-[-12%]"
                sizeClass="w-[65px] lg:w-[125px]"
                animateClass="animate-float-icon-3"
                delay={4.4}
              />



            </div>
          </div>
        </div>
      </section>

      <IntegrationsMarquee />

      {/* ══════ SEÇÃO DEMO (THE NEURAL DECK) ══════ */}
      <section
        id="demo"
        className="relative py-32 sm:py-48 z-20"
      >
        {/* Radial Glow — posicionado para sangrar na próxima seção */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -bottom-48"
          style={{ background: 'radial-gradient(circle at 72% 40%, rgba(255,80,20,.15), transparent 38%)' }}
        />

        {/* Fundo Cinemático Complexo */}
        <div className="pointer-events-none absolute inset-x-0 top-0 -bottom-48">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-[#e24c30]/05 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-[#a855f7]/03 rounded-full blur-[150px]" />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] contrast-150" />
        </div>

        <div className="container relative z-10 mx-auto px-6 max-w-[1400px]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">

            {/* Esquerda: Painel de Controle HUD */}
            <div className="lg:col-span-5 flex flex-col items-center lg:items-start text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="space-y-8"
              >
                <div className="flex flex-col text-center lg:text-left">
                  <h2 className="font-[var(--font-space-grotesk)] text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.04em] text-white">
                    <span className="lg:whitespace-nowrap">A Plataforma que</span> <br />
                    <span className="text-[#ff6b35]">Transforma seu Resultado.</span>
                  </h2>
                </div>

                <div className="space-y-6">
                  <p className="font-['Inter'] text-[16px] leading-[1.8] text-white/60">
                    Assista ao vídeo e descubra como o Afiliado Analytics utiliza dados em tempo real para escalar sua operação com precisão cirúrgica.
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Direita: O Player (Estilo Consistente com o Hero) */}
            <div className="lg:col-span-7 relative">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="relative z-10"
              >
                {/* Aura Laranja (Mesma do Hero) */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] aspect-square bg-[#ff6b35]/12 rounded-full blur-[90px] pointer-events-none -z-10" />

                {/* Container Principal do Vídeo */}
                <div className="relative group">
                  <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-black shadow-[0_30px_80px_rgba(0,0,0,0.8)] transition-all duration-500 group-hover:border-[#ff6b35]/30">
                    {/* Vídeo */}
                    <div className="relative z-10 w-full pb-[56.25%] overflow-hidden">
                      <div ref={vturbContainerRef} className="absolute inset-0 h-full w-full" />
                    </div>
                  </div>

                  {/* Badge de Tour */}
                  <div className="absolute -top-4 -left-4 bg-[#ff6b35] text-black font-black text-[10px] px-4 py-2 rounded-lg uppercase tracking-tighter shadow-xl z-20">
                    Tour da Plataforma
                  </div>
                </div>
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      <FeaturesSection />
      <Mockup />
      <Testimonials />
      <Pricing />
      <Faq />

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes aurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 20px) scale(0.95); }
        }
        .animate-aurora1 { animation: aurora 8s ease-in-out infinite; }
        .animate-aurora2 { animation: aurora 11s ease-in-out infinite reverse; }

        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-15px); }
        }
        @keyframes float-side {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(5px, -10px); }
        }
        .animate-float-icon-1 { animation: float 4.2s ease-in-out infinite; animation-delay: 0.2s; }
        .animate-float-icon-2 { animation: float 3.8s ease-in-out infinite; animation-delay: 0.5s; }
        .animate-float-icon-3 { animation: float 4.5s ease-in-out infinite; animation-delay: 0.1s; }
        .animate-float-icon-5 { animation: float 4s ease-in-out infinite; animation-delay: 0.3s; }

        /* Mobile 2D Dollar Animations */
        @keyframes mobileDollarFloat1 {
          0%, 100% { transform: translateY(0) rotate(-18deg); }
          50% { transform: translateY(-10px) rotate(-14deg); }
        }
        @keyframes mobileDollarFloat2 {
          0%, 100% { transform: translateY(0) rotate(22deg); }
          50% { transform: translateY(-12px) rotate(26deg); }
        }
        @keyframes mobileDollarFloat3 {
          0%, 100% { transform: translateY(0) rotate(-30deg); }
          50% { transform: translateY(-8px) rotate(-26deg); }
        }
        @keyframes mobileDollarFloat4 {
          0%, 100% { transform: translateY(0) rotate(15deg); }
          50% { transform: translateY(-14px) rotate(19deg); }
        }
        @keyframes mobileDollarFloat5 {
          0%, 100% { transform: translateY(0) rotate(25deg); }
          50% { transform: translateY(-11px) rotate(29deg); }
        }
        .mobile-dollar-1 { animation: mobileDollarFloat1 4.2s ease-in-out infinite; }
        .mobile-dollar-2 { animation: mobileDollarFloat2 3.8s ease-in-out infinite; }
        .mobile-dollar-3 { animation: mobileDollarFloat3 4.5s ease-in-out infinite; }
        .mobile-dollar-4 { animation: mobileDollarFloat4 3.6s ease-in-out infinite; }
        .mobile-dollar-5 { animation: mobileDollarFloat5 4.0s ease-in-out infinite; }
      `}} />
    </div>
  );
}

interface FloatingBubbleProps {
  src: string;
  alt: string;
  className: string;
  sizeClass?: string;
  animateClass?: string;
  delay?: number;
}

function FloatingBubble({ src, alt, className, sizeClass = "w-[75px] lg:w-[100px]", animateClass = "", delay = 0 }: FloatingBubbleProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 15, filter: "blur(5px)" }}
      animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
      transition={{
        duration: 1.8,
        delay: delay,
        ease: [0.22, 1, 0.36, 1] // easeOutQuart suave e sereno
      }}



      className={`absolute z-20 aspect-square rounded-full bg-[#ff6b35]/20 backdrop-blur-[8px] border border-[#ff6b35]/30 shadow-[inset_0_4px_12px_rgba(255,255,255,0.25),0_15px_35px_rgba(0,0,0,0.5),0_0_20px_rgba(255,107,53,0.15)] flex items-center justify-center overflow-hidden transition-all duration-500 hover:scale-110 hover:bg-[#ff6b35]/30 hover:shadow-[0_0_30px_rgba(255,107,53,0.3)] ${sizeClass} ${className} ${animateClass}`}
      style={{ willChange: 'transform, opacity' }}
    >
      <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,107,53,0.1)_0%,transparent_70%)] pointer-events-none" />
      <img
        src={src}
        alt={alt}
        className="w-[65%] h-[65%] object-contain relative z-10 drop-shadow-[0_5px_15px_rgba(0,0,0,0.3)]"
      />
    </motion.div>
  );
}