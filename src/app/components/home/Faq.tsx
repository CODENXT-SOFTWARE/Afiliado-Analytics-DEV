'use client'

import { useState } from 'react'
import { motion } from 'framer-motion' // 📦 Importando o Framer Motion

const FAQS = [
  {
    q: 'Preciso ter conhecimento técnico para usar a plataforma?',
    a: 'De forma alguma! A plataforma foi criada para simplificar a sua vida. Desde a criação de Páginas de Captura em minutos (sem código) até o nosso Gerador de Criativos com IA, tudo é intuitivo. Nossa ferramenta de Tráfego Inteligente (ATI) inclusive te diz se a sua performance está Ruim, Boa ou Excelente de forma visual.',
  },
  {
    q: 'Como a plataforma me ajuda a vender mais na Shopee?',
    a: 'Nosso arsenal cobre toda a jornada. Você pode gerar links rastreáveis com Sub IDs sem abrir o app, analisar minuciosamente a origem dos seus cliques, visualizar painéis detalhados de comissões e até criar links curtos que evitam bloqueios nas redes sociais. Tudo isso projetado para você entender o que funciona e escalar o que dá lucro.',
  },
  {
    q: 'Como funciona a ferramenta de Grupos de Venda?',
    a: 'É uma solução de automação focada em produtividade. Em vez de enviar mensagens manualmente, você gerencia suas listas de transmissão e programa disparos automáticos de ofertas para todos os seus grupos de WhatsApp de uma só vez, economizando horas do seu dia.',
  },
  {
    q: 'A Calculadora GPL funciona para quais tipos de campanha?',
    a: 'Ela é ideal para quem precisa ter controle absoluto do caixa. Com ela, você monitora o Custo Por Lead Real (CPL) e as saídas, descobrindo exatamente onde está o prejuízo e projetando sua receita real. Combinado com nosso recurso de Análise de Comissões, você passa a calcular seu ROI e CPA no automático.',
  },
  {
    q: 'Qual é o tempo de garantia da plataforma?',
    a: 'Você tem 7 dias de garantia incondicional. Você pode assinar, testar todas as 11 ferramentas (inclusive subir campanhas Meta direto do nosso painel e Espelhamento de Grupos) e, se achar que não ajudou a otimizar seus resultados, basta solicitar o cancelamento e devolvemos 100% do seu dinheiro, sem burocracia.',
  },
]

export default function Faq() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <section id="faq" className="relative overflow-hidden bg-[#18181B] pt-20 pb-24 px-5 md:px-7 md:pt-[100px] md:pb-[120px]">
      {/* Background glow laranja para seguir o padrão do projeto */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(238,95,63,0.06)_0%,transparent_65%)] blur-[50px]" />

      <div className="container relative mx-auto px-6 max-w-[1300px] z-10">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-[1fr_1.5fr] lg:gap-24">

          {/* ── HEADER À ESQUERDA (Mesma Altura) ── */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="flex flex-col h-full justify-between pt-2"
          >
            <div>

              <h2 className="mb-6 font-[var(--font-space-grotesk)] text-[clamp(2.5rem,4vw,3.5rem)] font-black leading-[1.05] tracking-tight text-white">
                Sua resposta está{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF7A54] via-[#EE5F3F] to-[#D04526] drop-shadow-[0_0_15px_rgba(238,95,63,0.2)]">
                  aqui
                </span>
              </h2>

              <p className="mb-10 max-w-[480px] font-['Inter'] text-[17px] leading-[1.75] text-white/50">
                Respondemos as principais dúvidas para que você tome a melhor decisão com total confiança e escale suas campanhas sem medo.
              </p>
            </div>

            {/* ── BOX DE SUPORTE ── */}
            <div className="mt-8 rounded-[20px] border border-white/5 bg-[#242427] p-6 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-colors hover:border-[#EE5F3F]/20">
              <p className="font-['Inter'] text-[15px] text-white/50">
                Ficou alguma dúvida específica?{' '}
                <a
                  href="https://wa.me/5579999407366"
                  className="mt-2 block font-bold text-[#EE5F3F] hover:text-[#ffb09e] transition-colors"
                >
                  Fale com nosso suporte →
                </a>
              </p>
            </div>
          </motion.div>

          {/* ── LISTA DE FAQS À DIREITA ── */}
          <div className="flex flex-col gap-4">
            {FAQS.map((faq, i) => {
              const open = openFaq === i

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
                >
                  <div
                    onClick={() => setOpenFaq(open ? null : i)}
                    className={`
                      group cursor-pointer overflow-hidden rounded-[24px] transition-all duration-500
                      backdrop-blur-xl
                      ${open
                        ? 'border border-[#EE5F3F]/40 shadow-[0_10px_40px_rgba(0,0,0,0.5),0_0_20px_rgba(238,95,63,0.15)] bg-[#242427]'
                        : 'border border-white/5 bg-[#242427] hover:border-[#EE5F3F]/20 hover:bg-[#2C2C30]'}
                    `}
                  >
                    {/* Linha Fina Flutuante Superior */}
                    <div className={`h-[1px] w-full bg-gradient-to-r from-transparent via-[#EE5F3F] to-transparent opacity-0 transition-opacity duration-500 ${open ? 'opacity-40' : 'group-hover:opacity-20'}`} />

                    {/* Cabeçalho do Acordeão */}
                    <div className="flex items-center justify-between gap-6 p-6 sm:px-8 sm:py-7">
                      <span className={`font-[var(--font-space-grotesk)] text-[18px] font-bold leading-[1.4] tracking-tight flex-1 transition-colors duration-300 ${open ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                        {faq.q}
                      </span>

                      {/* Ícone Minimalista */}
                      <div
                        className={`
                          flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-all duration-500
                          ${open
                            ? 'bg-gradient-to-br from-[#EE5F3F] to-[#D04526] border-transparent text-white rotate-45 shadow-[0_4px_20px_rgba(238,95,63,0.4)]'
                            : 'bg-transparent border-white/10 text-[#EE5F3F] group-hover:bg-[#EE5F3F]/10 group-hover:border-[#EE5F3F]/30 rotate-0'}
                        `}
                      >
                        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
                          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>

                    {/* Conteúdo Acordeão */}
                    <div
                      className="transition-all duration-500 ease-in-out"
                      style={{
                        maxHeight: open ? '400px' : '0px',
                        opacity: open ? 1 : 0,
                      }}
                    >
                      <div className="pb-8 px-6 sm:px-8 font-['Inter'] text-[16px] leading-[1.8] text-white/50">
                        {faq.a}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}