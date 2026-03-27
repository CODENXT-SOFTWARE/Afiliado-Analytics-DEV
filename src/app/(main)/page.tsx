"use client";

import { useState, useEffect } from "react";
import Testimonials from "../components/home/Testimonials";
import Faq from "../components/home/Faq";
import Pricing from "../components/home/Pricing";
import FeaturesSection from "../components/home/Features";
import Mockup from "../components/home/Mockup";
import { Play } from "lucide-react";
import { motion } from "framer-motion"; // 📦 Importando o Framer Motion

import Link from "next/link";
import Image from "next/image";

const integrations = [
  "Shopee",
  "Meta Ads",
  "WhatsApp"
];

export default function HomePage() {
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroHeight = document.querySelector("section")?.clientHeight || 0;
      setShowWhatsApp(window.scrollY > heroHeight);
    };

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = () => setPrefersReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="relative bg-dark-bg text-text-secondary">

      {/* ══════ HERO ══════ */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden">
        
        {/* Auroras */}
        <div className="animate-aurora1 pointer-events-none absolute left-[15%] top-[10%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.18)_0%,transparent_65%)] blur-[40px]" />
        <div className="animate-aurora2 pointer-events-none absolute right-[10%] top-[30%] h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.18)_0%,transparent_65%)] blur-[50px]" />
        <div className="animate-aurora3 pointer-events-none absolute bottom-[10%] left-[40%] h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(6,182,212,0.12)_0%,transparent_65%)] blur-[45px]" />

        {/* Grids de Fundo */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:72px_72px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.65)_100%)]" />

        <div className="relative z-10 mx-auto max-w-4xl px-6 py-32 text-center">
          
          {/* Pill "#1 no Brasil" - ANIMADA */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="animate-floatx inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2 font-['Inter'] text-[13px] font-semibold text-white/85 backdrop-blur-[16px] mb-[36px]"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#e24c30] shadow-[0_0_10px_#e24c30]" />
            🔥 A plataforma #1 para afiliados no Brasil
          </motion.div>

          {/* Título Principal - ANIMADO */}
          <motion.h1 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            className="mb-[28px] font-[var(--font-space-grotesk)] font-black leading-[0.95] tracking-[-3px]"
          >
            <span className="block text-[clamp(3.2rem,9vw,6.5rem)] text-white/95">
              Chega de
            </span>
            <span className="block text-[clamp(3.2rem,9vw,6.5rem)] text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">
              adivinhar.
            </span>
            <span className="mt-2 block text-[clamp(2.4rem,7vw,5rem)] text-white/92">
              Comece a <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#a855f7] to-[#e24c30]">escalar.</span>
            </span>
          </motion.h1>

          {/* Subtítulo - ANIMADO */}
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
            className="mx-auto mb-[44px] max-w-[560px] font-['Inter'] text-[clamp(1rem,2.5vw,1.2rem)] font-normal leading-[1.75] text-white/65"
          >
            O único ecossistema com{" "}
            <strong className="font-bold text-white">10 ferramentas poderosas</strong>{" "}
            que os super afiliados usam para faturar mais, trabalhar menos e{" "}
            <strong className="font-bold text-[#ff7a54]">dominar qualquer nicho.</strong>
          </motion.p>

          {/* Botões - ANIMADOS */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
            className="mb-[60px] flex flex-col items-center justify-center gap-[14px] min-[520px]:flex-row"
          >
            <Link
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-[#e24c30] to-[#ff6b35] px-[42px] py-[17px] font-['Inter'] text-[clamp(1rem,2.5vw,1.1rem)] font-extrabold text-white shadow-[0_8px_32px_rgba(226,76,48,0.5)] no-underline transition-all duration-200 hover:-translate-y-[3px] hover:shadow-[0_8px_40px_rgba(226,76,48,0.55)]"
            >
              Ver Planos
              <span className="text-[18px] leading-none">→</span>
            </Link>

            {/* <button
              onClick={() => scrollToSection("demo")}
              className="inline-flex items-center gap-[10px] rounded-full border border-white/12 bg-white/5 px-[38px] py-[17px] font-['Inter'] text-[clamp(1rem,2.5vw,1.05rem)] font-bold text-white backdrop-blur-[16px] transition-all duration-200 hover:-translate-y-[3px]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#e24c30]/90 text-white">
                <Play className="h-[11px] w-[11px] fill-current" />
              </span>
              Ver Demo
            </button> */}
          </motion.div>

          {/* Mouse Scroll Indicator - ANIMADO */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ duration: 1, delay: 1 }}
            className="animate-floatx flex flex-col items-center gap-2"
          >
            <div className="flex h-9 w-6 justify-center rounded-xl border-2 border-white/25 pt-1.5">
              <div className="h-2 w-1 rounded-sm bg-shopee-orange" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════ INTEGRAÇÕES ══════ */}
      <section className="relative overflow-hidden border-y border-white/5 py-8 bg-[linear-gradient(90deg,#1f1f26b7_0%,#23232a4a_20%,#2b24318b_50%,#23232a4f_80%,#1f1f2680_100%)]">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.018)_0%,rgba(255,255,255,0.005)_45%,rgba(0,0,0,0.10)_100%)]" />

        <div className="container relative mx-auto px-4">
          <motion.p 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="mb-5 text-center text-[11px] font-semibold uppercase tracking-[0.25em] text-white/60"
          >
            Integra com as maiores plataformas
          </motion.p>

          <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-x-10 gap-y-3">
            {integrations.map((brand, i) => (
              <motion.span
                key={brand}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.15 }}
                className="cursor-default text-[15px] font-extrabold text-white/50 transition-all duration-200 hover:-translate-y-[1px] hover:text-white/90 hover:drop-shadow-[0_0_20px_rgba(226,76,48,0.45)]"
              >
                {brand}
              </motion.span>
            ))}
          </div>
        </div>
      </section>

      {/* ══════ SEÇÃO DEMO ══════ */}
      {/* <section id="demo" className="relative overflow-hidden py-15 sm:py-20">
        
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.07)_0%,transparent_65%)]" />

        <div className="container relative z-10 mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="mb-[56px] text-center"
            >
              <span className="mb-[14px] block font-['Inter'] text-[12px] font-bold uppercase tracking-[0.18em] text-[#fb923c]">
                Como funciona
              </span>

              <h2 className="mb-4 font-[var(--font-space-grotesk)] text-[clamp(1.9rem,5vw,3.2rem)] font-black leading-[1.1] tracking-[-1.5px] text-white">
                Veja em <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">2 minutos</span> como
                <br className="hidden sm:block" /> afiliados estão faturando mais
              </h2>

              <p className="mx-auto max-w-[640px] font-['Inter'] text-[17px] leading-[1.75] text-white/60">
                Uma demo completa mostrando como as 10 ferramentas trabalham
                juntas para multiplicar seus resultados.
              </p>
            </motion.div>

            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              whileInView={{ opacity: 1, scale: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
              className="mx-auto max-w-[860px]"
            >
              <div className="group relative overflow-hidden rounded-[24px] border border-white/12 shadow-[0_0_80px_rgba(226,76,48,0.22),0_40px_80px_rgba(0,0,0,0.5)] transition-all duration-300 hover:-translate-y-[6px] hover:border-[#e24c30]/35 hover:shadow-[0_0_100px_rgba(226,76,48,0.28),0_40px_90px_rgba(0,0,0,0.55)]">
                
               
                <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(ellipse_at_50%_40%,rgba(226,76,48,0.16)_0%,rgba(124,58,237,0.10)_45%,transparent_72%)]" />
                <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,transparent_14%,transparent_86%,rgba(0,0,0,0.12)_100%)]" />

                <div className="relative z-0 w-full pb-[56.25%]">
                  <iframe
                    className="absolute left-0 top-0 h-full w-full"
                    src="https://www.youtube.com/embed/xGeHHUcIi64"
                    title="Demonstração Afiliado Analytics"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section> */}

      <FeaturesSection />
      <Mockup />
      <Testimonials />
      <Pricing />
      <Faq />

      {/* ══════ BOTÃO WHATSAPP ══════ */}
      {showWhatsApp && (
        <div className="fixed bottom-6 right-6 z-50">
          <a
            href="https://wa.me/5579999407366"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Fale conosco no WhatsApp"
            onMouseEnter={() => setIsExpanded(true)}
            onMouseLeave={() => setIsExpanded(false)}
            onFocus={() => setIsExpanded(true)}
            onBlur={() => setIsExpanded(false)}
            className={`
              relative flex h-16 items-center overflow-hidden rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-white transition-all duration-300 ease-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-4 focus:ring-[#25D366]/50
              ${prefersReducedMotion ? "" : "animate-fade-in-up"}
              ${isExpanded ? "max-w-[230px] shadow-[0_12px_28px_rgba(37,211,102,0.4)]" : "max-w-[64px] shadow-[0_8px_24px_rgba(37,211,102,0.3)]"}
            `}
          >
            <div className="flex h-16 w-16 shrink-0 items-center justify-center">
              <Image
                src="/iconewhatsapp.svg"
                alt="WhatsApp"
                width={32}
                height={32}
                className={`transition-transform duration-300 ${
                  isExpanded ? "scale-100" : "scale-110"
                }`}
                unoptimized
              />
            </div>

            <span
              className={`whitespace-nowrap pr-5 text-sm font-semibold transition-all duration-300 ease-out ${
                isExpanded ? "translate-x-0 opacity-100" : "pointer-events-none -translate-x-2 opacity-0"
              }`}
            >
              Fale conosco
            </span>
          </a>

          <div
            className={`absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-xl transition-all duration-300 ease-out ${
              isExpanded && !prefersReducedMotion ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
            }`}
          >
            <div className="relative">
              Precisa de ajuda?
              <div className="absolute -bottom-2 right-4 h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-gray-800" />
            </div>
          </div>
        </div>
      )}

      {/* ══════ KEYFRAMES CUSTOMIZADOS ══════ */}
      {/* Aqui ficam apenas as animações infinitas de fundo */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes aurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.1); }
          66% { transform: translate(-30px, 20px) scale(0.95); }
        }
        .animate-aurora1 { animation: aurora 8s ease-in-out infinite; }
        .animate-aurora2 { animation: aurora 11s ease-in-out infinite reverse; }
        .animate-aurora3 { animation: aurora 9s ease-in-out infinite 2s; }

        @keyframes floatx {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-floatx { animation: floatx 3.5s ease-in-out infinite; }

        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.4s ease-out forwards; }

        @media (prefers-reduced-motion: reduce) {
          .animate-aurora1, .animate-aurora2, .animate-aurora3, 
          .animate-floatx, .animate-fade-in-up {
            animation: none !important;
          }
          * { transition-duration: 0.01ms !important; }
        }
      `}} />
    </div>
  );
}