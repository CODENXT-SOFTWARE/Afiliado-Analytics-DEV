"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function Mockup() {
  return (
    <section
      className="relative py-20 sm:py-32 bg-dark-bg transition-colors duration-500"
    >
      {/* ── BLEED TOP: Glow roxo perfeitamente redondo que sangra para cima ── */}
      <div
        className="pointer-events-none absolute -top-48 left-[2%] h-[600px] w-[600px] z-20"
        style={{
          background: 'radial-gradient(circle, rgba(140,82,255,0.15), transparent 70%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />

      {/* ── BLEED BOTTOM: Glow ciano perfeitamente redondo que sangra para baixo ── */}
      <div
        className="pointer-events-none absolute -bottom-48 right-[2%] h-[600px] w-[600px] z-20"
        style={{
          background: 'radial-gradient(circle, rgba(79,220,255,0.12), transparent 70%)',
          filter: 'blur(70px)',
        }}
        aria-hidden="true"
      />


      <div className="container relative z-10 mx-auto max-w-[1400px] px-6">
        <div className="flex flex-col-reverse lg:flex-row items-center lg:items-start gap-12 lg:gap-16">

          {/* LADO ESQUERDO: MOCKUP COM FOCO ABSOLUTO (65%) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="relative w-full lg:w-[65%]"
          >
            {/* SOMBRA ESTÁTICA PROFUNDA (Sangra para a seção inferior) */}
            <div className="absolute -bottom-32 left-1/2 -translate-x-1/2 w-[80%] h-40 bg-[#000000] blur-[80px] rounded-[100%] pointer-events-none -z-20 opacity-80" />
            <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[60%] h-20 bg-black blur-[40px] rounded-[100%] pointer-events-none -z-20 opacity-90" />

            <motion.div
              animate={{ y: [-15, 15] }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                repeatType: "mirror",
                ease: "easeInOut"
              }}
              className="relative z-10"
            >
              {/* NOTA: A aura traseira foi removida a pedido do usuário para focar 100% na imagem */}
              <div className="relative">
                <Image
                  src="/mockup.png"
                  alt="Afiliado Analytics no notebook e no celular"
                  width={1400}
                  height={875}
                  className="h-auto w-full object-contain drop-shadow-[0_50px_60px_rgba(0,0,0,0.7)]"
                  sizes="(max-width: 1024px) 100vw, 1100px"
                  priority={false}
                />
              </div>
            </motion.div>
          </motion.div>

          {/* LADO DIREITO: TEXTO REFINADO E EDITORIAL (35%) */}
          <div className="w-full lg:w-[35%] text-center lg:text-left flex flex-col items-center lg:items-end ">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className="space-y-6"
            >
              <h2 className="font-[var(--font-space-grotesk)] text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[1.1] tracking-[-0.04em] text-white">
                Sua operação na{" "}
                <span className="bg-gradient-to-br from-[#ff6b35] to-[#ff8c5a] bg-clip-text text-transparent">
                  Palma da Mão.
                </span>
              </h2>

              <p className="max-w-md mx-auto lg:ml-auto font-['Inter'] text-[18px] leading-[1.8] text-white/50">
                Uma interface <strong className="font-medium text-white/90">100% adaptável</strong> projetada para o afiliado moderno. Monitore seu faturamento e gerencie seus links com a mesma fluidez e controle, seja no conforto do desktop ou direto pelo celular.
              </p>
            </motion.div>
          </div>

        </div>
      </div>
    </section>
  );
}
