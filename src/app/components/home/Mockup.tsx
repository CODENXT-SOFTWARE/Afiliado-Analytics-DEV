"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function Mockup() {
  return (
    <section className="relative overflow-hidden border-t border-white/[0.06] bg-dark-bg py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-aurora1 absolute left-[8%] top-[12%] h-[min(380px,55vw)] w-[min(380px,55vw)] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.14)_0%,transparent_68%)] blur-[42px]" />
        <div className="animate-aurora2 absolute bottom-[18%] right-[6%] h-[min(340px,50vw)] w-[min(340px,50vw)] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.14)_0%,transparent_68%)] blur-[48px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[size:56px_56px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      <div className="container relative z-10 mx-auto max-w-[1200px] px-4">
        <div className="relative z-20 mx-auto mb-10 max-w-4xl text-center sm:mb-12">
          <p className="mb-4 inline-flex items-center justify-center px-[12px] py-[6px] font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.16em] text-[#fb923c]">
            RESPONSIVIDADE
          </p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <h2 className="font-[var(--font-space-grotesk)] font-black leading-[0.98] tracking-[-2px]">
              <span className="block text-[clamp(1.85rem,5vw,3.25rem)] text-white/95">
                Para Computadores e
              </span>
              <span className="mt-1 block text-[clamp(1.85rem,5vw,3.25rem)] text-transparent bg-clip-text bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c]">
                Celulares!
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl font-['Inter'] text-[15px] leading-relaxed text-white/55 sm:text-[16px]">
              Tudo mais fácil e rápido, seja no computador ou no celular.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 36 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, delay: 0.08, ease: "easeOut" }}
          className="relative mx-auto max-w-5xl"
        >
          <div className="relative overflow-hidden rounded-[20px]">
            <Image
              src="/mockup.png"
              alt="Afiliado Analytics no notebook e no celular"
              width={1200}
              height={750}
              className="h-auto w-full object-contain"
              sizes="(max-width: 1280px) 100vw, 1200px"
              priority={false}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
