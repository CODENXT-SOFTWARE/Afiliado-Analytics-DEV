"use client";

import { motion } from "framer-motion";
import Image from "next/image";

const integrations = [
  { name: "Mercado Livre", logo: "/icons-integracoes/icon-mercado-livre.svg", scale: 1.2, mobileScale: 1.1 },
  { name: "Shopee", logo: "/icons-integracoes/shopee-icon-laranja.svg", scale: 0.9, mobileScale: 0.9 },
  { name: "Amazon", logo: "/icons-integracoes/icon-amazon.svg", scale: 1.55, mobileScale: 1.45 },
  { name: "Meta", logo: "/icons-integracoes/icon-meta.svg", scale: 1.25, mobileScale: 1.2 },
  { name: "WhatsApp", logo: "/icons-integracoes/icon-whatsapp.svg", scale: 0.9, mobileScale: 0.9 },
  { name: "Telegram", logo: "/icons-integracoes/icon-telegram.svg", scale: 0.9, mobileScale: 0.9 },
];

export default function IntegrationsMarquee() {
  return (
    <section className="relative z-20 py-5 md:py-6 overflow-hidden">
      {/* Background Deck */}
      <div className="absolute inset-0 bg-[#e24c30]" />

      {/* Noise Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.15] mix-blend-overlay pointer-events-none bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />

      {/* Topological/Grid Pattern Synergy */}
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`, backgroundSize: '32px 32px' }}
      />


      <div className="container mx-auto px-0 md:px-6 relative z-10">
        <div className="flex flex-col items-center">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-6 flex items-center gap-4"
          >
            <div className="h-[2px] w-12 force-bg-white" />
            <h3 className="font-['Inter'] text-[12px] font-black uppercase tracking-[0.6em] force-white">
              Integrações
            </h3>
            <div className="h-[2px] w-12 force-bg-white" />
          </motion.div>

          {/* ── DESKTOP VIEW: Static Grid (Show items once) ── */}
          <div className="hidden md:flex flex-wrap justify-center items-center gap-28 w-full max-w-6xl">
            {integrations.map((item, i) => (
              <motion.div
                key={item.name}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.08 }}
                className="relative shrink-0 transition-transform duration-500 hover:scale-110"
              >
                <Image
                  src={item.logo}
                  alt={item.name}
                  width={80}
                  height={80}
                  className="w-[80px] h-[80px] object-contain"
                  style={{ transform: `scale(${item.scale})` }}
                />
              </motion.div>
            ))}
          </div>

          {/* ── MOBILE VIEW: Infinite Marquee (Show items duplicated) ── */}
          <div className="flex md:hidden w-full overflow-hidden">
            <div className="flex animate-marquee gap-20 items-center">
              {[...integrations, ...integrations].map((item, i) => (
                <div key={`${item.name}-${i}`} className="shrink-0">
                  <Image
                    src={item.logo}
                    alt={item.name}
                    width={56}
                    height={56}
                    className="w-[56px] h-[56px] object-contain"
                    style={{ transform: `scale(${item.mobileScale})` }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: flex;
          width: max-content;
          animation: marquee 20s linear infinite;
        }
      `}</style>
    </section>
  );
}
