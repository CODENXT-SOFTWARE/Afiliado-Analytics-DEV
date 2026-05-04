"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const MOCKUP_ALT =
  "Afiliado Analytics no notebook e no celular";

const MOCKUP_IMG_CLASS =
  "h-auto w-full max-w-[min(100%,640px)] lg:max-w-none object-contain object-center lg:object-left drop-shadow-[0_40px_50px_rgba(0,0,0,0.65)] light:drop-shadow-[0_38px_46px_rgba(251,146,60,0.32),0_20px_36px_rgba(254,215,170,0.5)] max-h-[min(52vh,440px)] sm:max-h-[min(56vh,480px)] lg:max-h-[min(74vh,680px)] xl:max-h-[min(78vh,760px)] 2xl:max-h-[min(82vh,840px)]";

const MOCKUP_SIZES =
  "(max-width: 1024px) min(100vw, 640px), (max-width: 1536px) 72vw, min(92vw, 900px)";

/** Alterna mockup-sho / mockup-sho-2 a cada 500 ms (efeito estilo GIF). */
function AlternatingMockupImages() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0));
    }, 500);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="relative flex w-full justify-center lg:justify-start">
      <Image
        src="/mockup-sho.png"
        alt={MOCKUP_ALT}
        width={1400}
        height={875}
        className={`${MOCKUP_IMG_CLASS} ${
          frame === 0
            ? "relative z-[1] opacity-100"
            : "absolute inset-0 z-0 opacity-0 pointer-events-none"
        }`}
        sizes={MOCKUP_SIZES}
        priority={false}
        aria-hidden={frame !== 0}
      />
      <Image
        src="/mockup-sho-2.png"
        alt={MOCKUP_ALT}
        width={1400}
        height={875}
        className={`${MOCKUP_IMG_CLASS} ${
          frame === 1
            ? "relative z-[1] opacity-100"
            : "absolute inset-0 z-0 opacity-0 pointer-events-none"
        }`}
        sizes={MOCKUP_SIZES}
        priority={false}
        aria-hidden={frame !== 1}
      />
    </div>
  );
}

export default function Mockup() {
  return (
    <section
      className="relative py-20 sm:py-32 bg-dark-bg transition-colors duration-500"
    >
      {/* ── BLEED TOP: Glow roxo perfeitamente redondo que sangra para cima ── */}
      <div
        className="pointer-events-none absolute -top-48 left-[2%] z-20 h-[600px] w-[600px] animate-landing-glow-a-slow will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(140,82,255,0.15), transparent 70%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />

      {/* ── BLEED BOTTOM: Glow ciano perfeitamente redondo que sangra para baixo ── */}
      <div
        className="pointer-events-none absolute -bottom-48 right-[2%] z-20 h-[600px] w-[600px] animate-landing-glow-b-slow will-change-transform"
        style={{
          background: 'radial-gradient(circle, rgba(79,220,255,0.12), transparent 70%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />

      {/*
        Planeta laranja girando lentamente (sentido horário). Wrapper maior + máscara no
        fundo para não haver “tesourada” horizontal; degradê na base funde com a section
        Resultados (mesmo tom do bg-dark-bg).
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 overflow-hidden h-[clamp(322px,82vw,580px)] lg:h-[clamp(220px,52vw,580px)]"
        aria-hidden="true"
      >
        <motion.div
          className="absolute top-0 aspect-square w-[clamp(460px,118vw,1320px)]"
          style={{ left: "50%" }}
          initial={{ opacity: 0, y: "42%", x: "-50%" }}
          whileInView={{ opacity: 1, y: 0, x: "-50%" }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="relative h-full w-full animate-[spin_120s_linear_infinite] will-change-transform [mask-image:linear-gradient(180deg,#000_0%,#000_30%,transparent_82%)] [-webkit-mask-image:linear-gradient(180deg,#000_0%,#000_30%,transparent_82%)] [mask-size:100%_100%] lg:[mask-image:linear-gradient(180deg,#000_0%,#000_38%,transparent_96%)] lg:[-webkit-mask-image:linear-gradient(180deg,#000_0%,#000_38%,transparent_96%)]">
            <Image
              src="/planetasho.png"
              alt=""
              fill
              sizes="(max-width: 768px) 118vw, 1320px"
              priority={false}
              className="object-contain select-none opacity-90 mix-blend-screen light:mix-blend-multiply light:opacity-80"
            />
          </div>
        </motion.div>
      </div>

      {/* Sombra / degradê na transição → Resultados que falam por si */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[clamp(11rem,50vw,20rem)] lg:h-[clamp(5.5rem,26vw,13rem)] bg-[linear-gradient(180deg,transparent_0%,rgba(15,15,15,0.35)_18%,rgba(15,15,15,0.85)_46%,#0f0f0f_72%,#0f0f0f_100%)] lg:bg-[linear-gradient(180deg,transparent_0%,rgba(15,15,15,0.22)_22%,rgba(15,15,15,0.72)_58%,#0f0f0f_100%)] light:bg-[linear-gradient(180deg,transparent_0%,rgba(250,249,247,0.4)_18%,rgba(250,249,247,0.92)_46%,#faf9f7_72%,#faf9f7_100%)] lg:light:bg-[linear-gradient(180deg,transparent_0%,rgba(250,249,247,0.28)_24%,rgba(250,249,247,0.88)_62%,#faf9f7_100%)]"
        aria-hidden="true"
      />

      <div className="container relative z-10 mx-auto max-w-[1280px] px-6">
        <div className="flex flex-col-reverse lg:flex-row lg:items-center gap-10 lg:gap-12 xl:gap-14">

          {/* Mockup: largura limitada + altura máxima no desktop para não “estourar” a viewport */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative w-full lg:flex-1 lg:min-w-0 flex justify-center lg:justify-start"
          >
            <div className="pointer-events-none absolute -bottom-24 left-1/2 h-32 w-[70%] max-w-md -translate-x-1/2 -z-20 lg:left-[35%] lg:translate-x-[-50%]">
              <div className="h-full w-full rounded-[100%] bg-[#000000] opacity-75 blur-[72px] light:bg-[#fb923c] light:opacity-[0.45] animate-landing-glow-c will-change-transform" />
            </div>
            <div className="pointer-events-none absolute -bottom-12 left-1/2 h-16 w-[55%] max-w-sm -translate-x-1/2 -z-20 lg:left-[35%] lg:translate-x-[-50%]">
              <div className="h-full w-full rounded-[100%] bg-black opacity-85 blur-[36px] light:bg-[#fdba74] light:opacity-[0.5] animate-landing-glow-a will-change-transform" />
            </div>

            <motion.div
              animate={{ y: [-12, 12] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut"
              }}
              className="relative z-10 w-full max-w-[min(100%,520px)] lg:max-w-none flex justify-center lg:justify-start"
            >
              <AlternatingMockupImages />
            </motion.div>
          </motion.div>

          {/* Texto alinhado ao lado (coluna fixa, centralizada na altura do mockup) */}
          <div className="relative w-full shrink-0 overflow-visible lg:w-[min(100%,380px)] xl:w-[420px] text-center lg:text-left flex flex-col items-center lg:items-stretch justify-center">
            {/* Halo roxo (mesmo estilo do bleed topo da section) — só desktop, atrás do título/copy */}
            <div
              className="pointer-events-none absolute -top-28 left-1/2 z-0 hidden h-[600px] w-[600px] -translate-x-1/2 animate-landing-glow-a-slow will-change-transform lg:block"
              style={{
                background: 'radial-gradient(circle, rgba(140,82,255,0.15), transparent 70%)',
                filter: 'blur(50px)',
              }}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="relative z-10 space-y-6"
            >
              <h2 className="font-[var(--font-space-grotesk)] text-[clamp(2rem,4vw,3rem)] font-black leading-[1.1] tracking-[-0.04em] text-white">
                Sua operação será{" "}
                <span className="bg-gradient-to-br from-[#ff6b35] to-[#ff8c5a] bg-clip-text text-transparent">
                  de outro Planeta.
                </span>
              </h2>

              <p className="max-w-md mx-auto lg:mx-0 font-['Inter'] text-[17px] sm:text-[18px] leading-[1.75] text-white">
                A sua operação conta com um <strong className="font-bold text-orange-500/90">robozinho de outro planeta</strong> que mapeia toda a Shopee em busca de oportunidades reais. Ele te indica os <strong className="font-bold text-orange-500/90">melhores produtos</strong>, organiza seu fluxo e te ajuda a <strong className="font-medium text-white/90">faturar mais!</strong> 
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
