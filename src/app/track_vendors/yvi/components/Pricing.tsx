'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useLoginModal } from '@/app/components/auth/LoginModalProvider'
import type { SubscriptionPlanTone } from '@/lib/plan-entitlements'

/** Alterna /voando1.png e /voando2.png a cada 500 ms (efeito GIF). */
function AlternatingAstronaut() {
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setFrame((f) => (f === 0 ? 1 : 0))
    }, 500)
    return () => window.clearInterval(id)
  }, [])

  const COMMON =
    "absolute inset-0 z-0 pointer-events-none select-none object-contain mix-blend-screen drop-shadow-[0_18px_40px_rgba(255,107,53,0.35)] light:mix-blend-multiply light:drop-shadow-[0_18px_40px_rgba(234,88,12,0.28)] "

  return (
    <motion.div
      className="pointer-events-none relative z-10 mx-auto mb-4 aspect-square w-[clamp(160px,18vw,240px)]"
      initial={{ opacity: 0, y: '42%' }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      <Image
        src="/voando1.png"
        alt=""
        width={1024}
        height={1024}
        priority={false}
        className={`${COMMON} ${frame === 0 ? 'opacity-95' : 'opacity-0'}`}
      />
      <Image
        src="/voando2.png"
        alt=""
        width={1024}
        height={1024}
        priority={false}
        className={`${COMMON} ${frame === 1 ? 'opacity-95' : 'opacity-0'}`}
      />
    </motion.div>
  )
}

type SubscriptionPlan = {
  name: string
  monthly: number
  monthlyAnchor: number
  quarterlyTotal: number
  ctaMonthly: string
  ctaQuarterly: string
  valorMensal: string
  valorTrimestral: string
  popular: boolean
  tone: 'inicial' | 'padrao' | 'pro'
  features: string[]
  /** Substitui o % OFF calculado no badge trimestral (ex.: marketing 10% vs ~11,1% matemático). */
  quarterlySavePctOverride?: number
  /** Valor “/mês” no trimestral quando o copy de marketing difere do arredondamento de `quarterlyTotal/3`. */
  quarterlyEquivalentMonthly?: number
}

type CustomPlan = {
  name: string
  tagline: string
  price: string
  cta: string
  href: string
  features: string[]
}

const subscriptionPlans: SubscriptionPlan[] = [
  {
    name: 'Inicial',
    monthly: 47.9,
    monthlyAnchor: 67.9,
    quarterlyTotal: 127.9,
    ctaMonthly: 'Começar no Inicial',
    ctaQuarterly: 'Garantir Inicial trimestral',
    valorMensal: 'https://pay.kiwify.com.br/AsmPxQv?afid=LTZwD8Uy',
    valorTrimestral: 'https://pay.kiwify.com.br/JlH396G?afid=LTZwD8Uy',
    popular: false,
    tone: 'inicial',
    features: [
      'Análise de comissões',
      'Análise de cliques',
      'Redirecionador de Links',
      'Gerador de links Shopee',
      'Site de captura: 1',
      'Automação de Grupos: 1 grupo',
      'Instâncias conectadas: 1',
      'Minha lista de oferta',
      'Automação Telegram: ilimitado',
      'Apenas Shopee',
    ],
  },
  {
    name: 'Padrão',
    monthly: 127.9,
    monthlyAnchor: 167.9,
    quarterlyTotal: 297.9,
    ctaMonthly: 'Começar no Padrão',
    ctaQuarterly: 'Garantir Padrão trimestral',
    valorMensal: 'https://pay.kiwify.com.br/hzhlBau?afid=LTZwD8Uy',
    valorTrimestral: 'https://pay.kiwify.com.br/6dNguFg?afid=LTZwD8Uy',
    popular: false,
    tone: 'padrao',
    features: [
      'Análise de comissões',
      'Análise de cliques',
      'Redirecionador de Links',
      'Gerador de links Shopee',
      'Tráfego Inteligente (ATI)',
      'Custo Real de Leads do WhatsApp',
      'Criar campanha no Meta',
      'Automação de Grupos: ilimitado',
      'Disparos de ofertas: ilimitado',
      'Espelhamento de Grupos: 10',
      'Site de captura: 5',
      'Instâncias conectadas: 2',
      'Infoprodutor',
      'Minha lista de oferta',
      'Shopee, Amazon e Mercado Livre',
      'Análise de ofertas relâmpago',
      'Automação Telegram: ilimitado',
      'Tendências Shopee',
    ],
  },
  {
    name: 'Pro',
    monthly: 197.9,
    monthlyAnchor: 297.9,
    quarterlyTotal: 527.9,
    ctaMonthly: 'Começar no Pro',
    ctaQuarterly: 'Garantir Pro trimestral',
    valorMensal: 'https://pay.kiwify.com.br/Kqrzgpp?afid=LTZwD8Uy',
    valorTrimestral: 'https://pay.kiwify.com.br/tdDRvEF?afid=LTZwD8Uy',
    quarterlySavePctOverride: 10,
    quarterlyEquivalentMonthly: 175.96,
    popular: true,
    tone: 'pro',
    features: [
      'Tudo do plano Padrão',
      'Gerador de Criativo: 2 vídeos',
      'Gerador de Especialistas: 100 Afiliado Coins',
      'Disparos de ofertas: ilimitado',
      'Espelhamento de Grupos: ilimitado',
    ],
  },
]

const customPlan: CustomPlan = {
  name: 'Personalizado',
  tagline: 'Para operações maiores que precisam de mais controle, suporte e escala.',
  price: 'Sob consulta',
  cta: 'Falar com especialista',
  href: 'https://wa.me/5579999407366',
  features: [
    'Tudo do plano Pro',
    'Automação de Grupos: Personalizado',
    'Instâncias conectadas: Personalizado',
    'Ajustes sob medida para sua operação',
  ],
}

function formatBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatPercent(value: number) {
  return value.toFixed(1).replace('.', ',')
}

function getPlanMeta(plan: SubscriptionPlan) {
  const quarterlyCompare = plan.monthly * 3
  const quarterlySave = quarterlyCompare - plan.quarterlyTotal
  const quarterlySavePct = (quarterlySave / quarterlyCompare) * 100
  const equivalentMonthly = plan.quarterlyTotal / 3
  const monthlySave = plan.monthlyAnchor - plan.monthly
  const monthlySavePct = (monthlySave / plan.monthlyAnchor) * 100

  return {
    quarterlyCompare,
    quarterlySave,
    quarterlySavePct,
    equivalentMonthly,
    monthlySave,
    monthlySavePct,
  }
}

const freeTrialFeatures = [
  'Análise de comissões',
  'Análise de cliques',
  'Redirecionador de Links',
  'Gerador de links Shopee',
  'Site de captura: 1',
  'Automação de Grupos: 1 grupo',
  'Instâncias conectadas: 1',
  'Minha lista de oferta',
  'Automação Telegram: ilimitado',
  'Apenas Shopee',
]

function FreeTrialCard({ onStart, index }: { onStart: () => void; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.12, ease: 'easeOut' }}
      className="h-full"
    >
      <div className="group relative flex h-full flex-col overflow-hidden rounded-[24px] border border-[rgba(52,211,153,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,0.07)_0%,rgba(6,78,59,0.20)_100%)] px-[22px] py-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-[16px] transition-all duration-300 ease-in hover:-translate-y-[6px] hover:border-[rgba(52,211,153,0.35)] hover:shadow-[0_24px_50px_rgba(16,185,129,0.12)]">
        <div className="pointer-events-none absolute left-[18px] right-[18px] top-0 h-[2px] rounded-[999px] bg-[linear-gradient(90deg,rgba(52,211,153,0),rgba(52,211,153,0.55),rgba(226,76,48,0.12),rgba(52,211,153,0))]" />
        <div className="relative mb-[16px] flex min-h-[46px] flex-col gap-1">
          <h3 className="font-[var(--font-space-grotesk)] text-[22px] font-extrabold text-[#fff]">
            Trial 3 dias
          </h3>

        </div>

        <div className="relative mb-[22px] flex min-h-[100px] flex-col justify-center rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-[18px]">
          <p className="mb-1 font-['Inter'] text-[11px] font-semibold uppercase tracking-[0.1em] text-[rgba(255,255,255,0.55)]">
            Sem cartão de crédito
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <span className="font-[var(--font-space-grotesk)] text-[clamp(2.1rem,4vw,2.8rem)] font-black text-[#fff]">
              R$ 0
            </span>
            <span className="pb-1 font-['Inter'] text-[14px] text-[rgba(255,255,255,0.72)]">/ 3 dias</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="relative mb-[22px] flex min-h-[54px] w-full items-center justify-center rounded-[14px] border border-[rgba(52,211,153,0.35)] bg-[linear-gradient(180deg,rgba(16,185,129,0.22)_0%,rgba(6,95,70,0.35)_100%)] px-[15px] text-center font-['Inter'] text-[15px] font-bold text-[#fff] transition-all duration-[220ms] ease-in hover:-translate-y-[3px] hover:border-[rgba(52,211,153,0.5)]"
        >
          Começar no Trial
        </button>

        <div className="relative mb-[16px] flex items-center gap-[8px]">
          <span className="h-[8px] w-[8px] rounded-full bg-[#34d399]" />
          <p className="font-['Inter'] text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]">
            O que você recebe
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col gap-[8px] p-0">
          {freeTrialFeatures.map((feature, j) => (
            <li
              key={j}
              className="flex gap-[8px] font-['Inter'] text-[13.5px] leading-[1.5] text-[rgba(255,255,255,0.88)]"
            >
              <span className="mt-[1px] shrink-0 font-black text-[rgba(52,211,153,0.9)]">✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

function BillingSelector({
  quarterly,
  setQuarterly,
  biggestSaving,
  compact = false,
}: {
  quarterly: boolean
  setQuarterly: (value: boolean) => void
  biggestSaving: number
  compact?: boolean
}) {
  const btnMin = compact ? 'min-h-[46px] py-[7px]' : 'min-h-[58px] py-[10px]'
  const labelMain = compact ? 'text-[13px]' : 'text-[14px]'
  const labelSub = compact ? 'mt-[2px]' : 'mt-[3px]'

  return (
    <div className="flex justify-center">
      <div className={compact ? 'w-full max-w-[400px]' : 'w-full max-w-[440px]'}>
        <p
          className={`${compact ? 'mb-[6px]' : 'mb-[10px]'} text-center font-['Inter'] ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.14em] text-[rgba(255, 255, 255, 0.65)]`}
        >
          Escolha entre mensal e trimestral.
        </p>

        <div
          className={`relative grid grid-cols-2 rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06)_0%,rgba(255,255,255,0.03)_100%)] ${compact ? 'p-[3px]' : 'p-[4px]'} shadow-[0_10px_30px_rgba(0,0,0,0.20)] backdrop-blur-[16px]`}
        >
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{
              x: quarterly ? '100%' : '0%',
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="pointer-events-none absolute left-[5px] top-[5px] h-[calc(100%-10px)] w-[calc(50%-5px)] rounded-[14px] border-[1px] border-[rgba(237,95,65,0.85)] bg-[linear-gradient(135deg,rgba(255,255,255,0.16)_0%,rgba(237,95,65,0.10)_45%,rgba(255,255,255,0.07)_100%)] shadow-[0_0_0_1px_rgba(237,95,65,0.10),0_10px_24px_rgba(0,0,0,0.18),0_0_22px_rgba(237,95,65,0.10)]"
          />

          <button
            type="button"
            onClick={() => setQuarterly(false)}
            aria-pressed={!quarterly}
            className={`relative z-[1] flex ${btnMin} flex-col items-center justify-center rounded-[14px] px-[14px] text-center transition-all duration-300 ${!quarterly ? 'scale-[0.985]' : ''
              }`}
          >
            <span
              className={`inline-flex items-center gap-[7px] font-['Inter'] ${labelMain} font-extrabold transition-all duration-300 ${!quarterly ? 'text-[#fff]' : 'text-[rgba(255,255,255,0.72)]'
                }`}
            >
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] rounded-full transition-all duration-300 ${!quarterly
                    ? 'bg-[#ED5F41] shadow-[0_0_0_4px_rgba(237,95,65,0.14),0_0_12px_rgba(237,95,65,0.55)]'
                    : 'bg-transparent shadow-none'
                  }`}
              />
              Mensal
            </span>

            <span
              className={`${labelSub} font-['Inter'] text-[11px] transition-all duration-300 ${!quarterly
                  ? 'text-[rgba(255,255,255,0.80)]'
                  : 'text-[rgba(255,255,255,0.42)]'
                }`}
            >
              Preço padrão
            </span>
          </button>

          <button
            type="button"
            onClick={() => setQuarterly(true)}
            aria-pressed={quarterly}
            className={`relative z-[1] flex ${btnMin} flex-col items-center justify-center rounded-[14px] px-[14px] text-center transition-all duration-300 ${quarterly ? 'scale-[0.985]' : ''
              }`}
          >
            <span
              className={`inline-flex items-center gap-[7px] font-['Inter'] ${labelMain} font-extrabold transition-all duration-300 ${quarterly ? 'text-[#fff]' : 'text-[rgba(255,255,255,0.72)]'
                }`}
            >
              <span
                aria-hidden="true"
                className={`h-[7px] w-[7px] rounded-full transition-all duration-300 ${quarterly
                    ? 'bg-[#ED5F41] shadow-[0_0_0_4px_rgba(237,95,65,0.14),0_0_12px_rgba(237,95,65,0.55)]'
                    : 'bg-transparent shadow-none'
                  }`}
              />
              Trimestral
            </span>

            <span
              className={`${labelSub} inline-flex items-center rounded-full px-[8px] py-[3px] font-['Inter'] ${compact ? 'text-[9px]' : 'text-[10px]'} font-extrabold uppercase tracking-[0.04em] transition-all duration-300 ${quarterly
                  ? 'bg-[linear-gradient(135deg,#e24c30,#ff7a54)] text-[#fff] shadow-[0_8px_18px_rgba(226,76,48,0.24)]'
                  : 'bg-[rgba(251,146,60,0.10)] text-[#ffb38f]'
                }`}
            >
              Economize até {formatPercent(biggestSaving)}%
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

function PlanCard({
  plan,
  quarterly,
  index,
  locked = false,
  compact = false,
}: {
  plan: SubscriptionPlan
  quarterly: boolean
  index: number
  locked?: boolean
  /** Modal Minha Conta: menos padding e tipografia pra caber sem scroll interno. */
  compact?: boolean
}) {
  const meta = getPlanMeta(plan)
  const quarterlyOffPct =
    plan.quarterlySavePctOverride ?? meta.quarterlySavePct
  const currentHref = quarterly ? plan.valorTrimestral : plan.valorMensal
  const currentCTA = quarterly ? plan.ctaQuarterly : plan.ctaMonthly
  const isPopular = plan.popular

  const priceToneClass =
    plan.tone === 'inicial'
      ? 'bg-[rgba(52,211,153,0.12)] text-[#8be9c0]'
      : plan.tone === 'padrao'
      ? 'bg-[rgba(168,85,247,0.14)] text-[#d9b8ff]'
      : 'bg-[rgba(6,182,212,0.12)] text-[#8be9f8]'

  const bulletToneClass =
    plan.tone === 'inicial'
      ? 'text-[rgba(52,211,153,0.78)]'
      : plan.tone === 'padrao'
      ? 'text-[rgba(168,85,247,0.72)]'
      : 'text-[rgba(6,182,212,0.68)]'

  const pcPad = compact ? 'px-[14px] py-[16px]' : 'px-[24px] py-[28px]'
  const pcPadNorm = compact ? 'px-[14px] py-[16px]' : 'px-[22px] py-[28px]'
  const pcRoundOut = compact ? 'rounded-[18px]' : 'rounded-[26px]'
  const pcRoundOutPx = compact ? 'p-[1px]' : 'p-[2px]'
  const pcRoundIn = compact ? 'rounded-[20px]' : 'rounded-[24px]'
  const pcRoundNorm = compact ? 'rounded-[18px]' : 'rounded-[24px]'
  const pcTitlePop = compact ? 'text-[21px]' : 'text-[31px]'
  const pcTitleNorm = compact ? 'text-[18px]' : 'text-[24px]'
  const pcPriceBox = compact
    ? 'relative mb-[10px] flex flex-col justify-center rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-[11px]'
    : 'relative mb-[24px] flex flex-col justify-center min-h-[130px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] p-[18px]'
  const pcPriceBoxNorm = compact
    ? 'relative mb-[12px] flex flex-col justify-center rounded-[14px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-[11px]'
    : 'relative mb-[24px] flex flex-col justify-center min-h-[130px] rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-[18px]'
  const pcPriceNum = compact
    ? 'font-[var(--font-space-grotesk)] text-[clamp(1.45rem,3vw,1.85rem)] font-black text-[#fff]'
    : 'font-[var(--font-space-grotesk)] text-[clamp(2.3rem,5vw,3rem)] font-black text-[#fff]'
  const pcPriceNumNorm = compact
    ? 'font-[var(--font-space-grotesk)] text-[clamp(1.45rem,3vw,1.8rem)] font-black text-[#fff]'
    : 'font-[var(--font-space-grotesk)] text-[clamp(2rem,4vw,2.55rem)] font-black text-[#fff]'
  const pcMbHead = compact ? 'mb-[10px]' : 'mb-[20px]'
  const pcMinHead = compact ? 'min-h-0' : 'min-h-[46px]'
  const pcCtaMb = compact ? 'mb-[12px]' : 'mb-[24px]'
  const pcCtaH = compact ? 'min-h-[42px]' : 'min-h-[54px]'
  const pcCtaTxt = compact ? 'text-[14px]' : 'text-[16px]'
  const pcCtaTxtNorm = compact ? 'text-[13px]' : 'text-[15px]'
  const pcFeatHeadMb = compact ? 'mb-[8px]' : 'mb-[18px]'
  const pcFeatGap = compact ? 'gap-[4px]' : 'gap-[8px]'
  const pcFeatLi = compact
    ? "flex gap-[6px] font-['Inter'] text-[12px] leading-[1.35] text-[rgba(255,255,255,0.86)]"
    : "flex gap-[8px] font-['Inter'] text-[13.5px] leading-[1.5] text-[rgba(255,255,255,0.86)]"
  const pcFeatLiPop = compact
    ? "flex gap-[6px] font-['Inter'] text-[12px] leading-[1.35] text-[rgba(255,255,255,0.9)]"
    : "flex gap-[8px] font-['Inter'] text-[13.5px] leading-[1.5] text-[rgba(255,255,255,0.9)]"
  const pcBadge = compact
    ? "shrink-0 rounded-full bg-[linear-gradient(135deg,#e24c30,#ff7a54)] px-[8px] py-[4px] font-['Inter'] text-[9px] font-extrabold tracking-[0.05em] text-[#fff] shadow-[0_8px_24px_rgba(226,76,48,0.28)]"
    : "shrink-0 rounded-full bg-[linear-gradient(135deg,#e24c30,#ff7a54)] px-[14px] py-[6px] font-['Inter'] text-[11px] font-extrabold tracking-[0.05em] text-[#fff] shadow-[0_8px_24px_rgba(226,76,48,0.28)]"

  if (isPopular) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-50px' }}
        transition={{ duration: 0.5, delay: index * 0.15, ease: 'easeOut' }}
        className="h-full"
      >
        {/* Pro Card: Adicionado as classes group, transition-all, duration-300, ease-in, hover:-translate-y-[6px] e hover:shadow para dar o efeito de subir */}
        <div
          className={`group relative h-full ${pcRoundOut} bg-[linear-gradient(135deg,rgba(226,76,48,0.98)_0%,rgba(168,85,247,0.92)_50%,rgba(226,76,48,0.95)_100%)] ${pcRoundOutPx} shadow-[0_0_45px_rgba(226,76,48,0.20),0_0_90px_rgba(124,58,237,0.14)] transition-all duration-300 ease-in hover:-translate-y-[6px] hover:shadow-[0_24px_50px_rgba(226,76,48,0.25)]`}
        >
          <div className={`relative flex h-full flex-col overflow-hidden ${pcRoundIn} border border-[rgba(255,255,255,0.08)] bg-[#242431] ${pcPad}`}>
            <div className="pointer-events-none absolute inset-[1px] rounded-[23px] bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.008)_100%)]" />
            <div className="pointer-events-none absolute -right-[80px] -top-[80px] h-[220px] w-[220px] rounded-full bg-[radial-gradient(circle,rgba(226,76,48,0.16)_0%,transparent_70%)]" />
            <div className="pointer-events-none absolute -bottom-[60px] -left-[60px] h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(124,58,237,0.12)_0%,transparent_70%)]" />

            <div className={`relative ${pcMbHead} flex ${pcMinHead} items-center justify-between gap-[12px]`}>
              <h3
                className={`font-[var(--font-space-grotesk)] ${pcTitlePop} font-extrabold bg-[linear-gradient(90deg,#ffffff_0%,#ffd9cf_20%,#ffffff_40%,#ffffff_100%)] [background-size:220%_100%] bg-clip-text text-transparent [animation:shimmer_3s_linear_infinite] light:!animate-none light:!bg-none light:bg-clip-border light:!text-zinc-900`}
              >
                {plan.name}
              </h3>

              <div className={pcBadge}>⭐ MAIS POPULAR</div>
            </div>

            <div className={pcPriceBox}>
              {quarterly ? (
                <>
                  <p
                    className={`${compact ? 'mb-[4px]' : 'mb-[8px]'} font-['Inter'] ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.68)]`}
                  >
                    Cobrança trimestral
                  </p>

                  <p className={`font-['Inter'] ${compact ? 'text-[12px]' : 'text-[13px]'} text-[rgba(255,255,255,0.48)] line-through`}>
                    De {formatBRL(meta.quarterlyCompare)}
                  </p>

                  <div className="mt-[2px] flex flex-wrap items-end gap-[6px]">
                    <span className={pcPriceNum}>{formatBRL(plan.quarterlyTotal)}</span>
                    <span
                      className={`${compact ? 'pb-[4px] text-[12px]' : 'pb-[7px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.82)]`}
                    >
                      por 3 meses
                    </span>
                  </div>

                  <p
                    className={`${compact ? 'mt-[4px] text-[12px]' : 'mt-[8px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.82)]`}
                  >
                    Equivale a{' '}
                    {formatBRL(
                      plan.quarterlyEquivalentMonthly ?? meta.equivalentMonthly
                    )}
                    /mês
                  </p>

                  <div
                    className={`${compact ? 'mt-[6px] px-[10px] py-[5px] text-[11px]' : 'mt-[12px] px-[12px] py-[7px] text-[12px]'} inline-flex rounded-full bg-[rgba(255,255,255,0.08)] font-['Inter'] font-extrabold text-[#ffd7cb] w-fit`}
                  >
                    Economize {formatBRL(meta.quarterlySave)} no trimestre ({formatPercent(quarterlyOffPct)}% OFF)
                  </div>
                </>
              ) : (
                <>
                  <p
                    className={`${compact ? 'mb-[4px]' : 'mb-[8px]'} font-['Inter'] ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.68)]`}
                  >
                    Cobrança mensal
                  </p>

                  <p className={`font-['Inter'] ${compact ? 'text-[12px]' : 'text-[13px]'} text-[rgba(255,255,255,0.48)] line-through`}>
                    De {formatBRL(plan.monthlyAnchor)}
                  </p>

                  <div className="mt-[2px] flex flex-wrap items-end gap-[6px]">
                    <span className={pcPriceNum}>{formatBRL(plan.monthly)}</span>
                    <span
                      className={`${compact ? 'pb-[4px] text-[12px]' : 'pb-[7px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.82)]`}
                    >
                      /mês
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Ajuste do botão: min-h-[54px] e flex centralizado para garantir mesma altura em ambos */}
            {locked ? (
              <div
                role="status"
                aria-label="Este é o seu plano atual"
                className={`relative ${pcCtaMb} flex ${pcCtaH} cursor-not-allowed items-center justify-center rounded-[12px] border border-white/20 bg-white/[0.06] px-[12px] text-center font-['Inter'] ${compact ? 'text-[13px]' : 'text-[15px]'} font-semibold text-[rgba(255,255,255,0.45)]`}
              >
                Plano atual
              </div>
            ) : (
              <a
                href={currentHref}
                className={`relative ${pcCtaMb} flex ${pcCtaH} items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,#e24c30,#ff7a54)] px-[12px] text-center font-['Inter'] ${pcCtaTxt} font-extrabold text-[#fff] shadow-[0_12px_30px_rgba(226,76,48,0.35)] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[3px]`}
              >
                {currentCTA}
              </a>
            )}

            <div className={`relative ${pcFeatHeadMb} flex items-center gap-[8px]`}>
              <span className={`${compact ? 'h-[6px] w-[6px]' : 'h-[8px] w-[8px]'} rounded-full bg-[#fb923c]`} />
              <p
                className={`font-['Inter'] ${compact ? 'text-[10px]' : 'text-[11px]'} uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]`}
              >
                O que você recebe
              </p>
            </div>

            <ul className={`relative m-0 flex list-none flex-col ${pcFeatGap} p-0`}>
              {plan.features.map((feature, j) => (
                <li key={j} className={pcFeatLiPop}>
                  <span className="mt-[1px] shrink-0 font-black text-[#fb923c]">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: 'easeOut' }}
      className="h-full"
    >
      {/* Subscription Card (não-popular): paddings reduzidos pra caber Padrão (16 features). */}
      <div
        className={`group relative flex h-full flex-col overflow-hidden ${pcRoundNorm} border ${pcPadNorm} backdrop-blur-[16px] transition-all duration-300 ease-in hover:-translate-y-[6px] hover:border-[rgba(255,255,255,0.16)] hover:shadow-[0_24px_50px_rgba(0,0,0,0.35)] shadow-[0_10px_40px_rgba(0,0,0,0.22),inset_0_1px_0_rgba(255,255,255,0.03)] ${plan.tone === 'inicial'
            ? 'border-[rgba(52,211,153,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(6,78,59,0.18)_100%)]'
            : plan.tone === 'padrao'
            ? 'border-[rgba(168,85,247,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(44,28,78,0.18)_100%)]'
            : 'border-[rgba(34,211,238,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.065)_0%,rgba(31,63,89,0.14)_100%)]'
          }`}
      >
        <div
          className={`pointer-events-none absolute left-[18px] right-[18px] top-0 h-[2px] rounded-[999px] ${plan.tone === 'inicial'
              ? 'bg-[linear-gradient(90deg,rgba(52,211,153,0),rgba(52,211,153,0.55),rgba(226,76,48,0.12),rgba(52,211,153,0))]'
              : plan.tone === 'padrao'
              ? 'bg-[linear-gradient(90deg,rgba(168,85,247,0),rgba(168,85,247,0.55),rgba(226,76,48,0.18),rgba(168,85,247,0))]'
              : 'bg-[linear-gradient(90deg,rgba(6,182,212,0),rgba(6,182,212,0.45),rgba(168,85,247,0.15),rgba(6,182,212,0))]'
            }`}
        />

        <div
          className={`pointer-events-none absolute -right-[40px] -top-[60px] h-[140px] w-[140px] rounded-full ${plan.tone === 'inicial'
              ? 'bg-[radial-gradient(circle,rgba(52,211,153,0.10)_0%,transparent_70%)]'
              : plan.tone === 'padrao'
              ? 'bg-[radial-gradient(circle,rgba(168,85,247,0.10)_0%,transparent_70%)]'
              : 'bg-[radial-gradient(circle,rgba(6,182,212,0.08)_0%,transparent_70%)]'
            }`}
        />

        <div className={`relative ${pcMbHead} flex ${pcMinHead} items-center`}>
          <h3 className={`font-[var(--font-space-grotesk)] ${pcTitleNorm} font-extrabold text-[#fff]`}>
            {plan.name}
          </h3>
        </div>

        <div className={pcPriceBoxNorm}>
          {quarterly ? (
            <>
              <p
                className={`${compact ? 'mb-[4px]' : 'mb-[8px]'} font-['Inter'] ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.66)]`}
              >
                Cobrança trimestral
              </p>

              <p className={`font-['Inter'] ${compact ? 'text-[12px]' : 'text-[13px]'} text-[rgba(255,255,255,0.45)] line-through`}>
                De {formatBRL(meta.quarterlyCompare)}
              </p>

              <div className="mt-[2px] flex flex-wrap items-end gap-[6px]">
                <span className={pcPriceNumNorm}>{formatBRL(plan.quarterlyTotal)}</span>
                <span
                  className={`${compact ? 'pb-[3px] text-[12px]' : 'pb-[5px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.76)]`}
                >
                  por 3 meses
                </span>
              </div>

              <p
                className={`${compact ? 'mt-[4px] text-[12px]' : 'mt-[8px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.78)]`}
              >
                Equivale a {formatBRL(meta.equivalentMonthly)}/mês
              </p>

              <div
                className={`${compact ? 'mt-[6px] px-[8px] py-[4px] text-[11px]' : 'mt-[12px] px-[10px] py-[6px] text-[12px]'} inline-flex rounded-full font-['Inter'] font-bold w-fit ${priceToneClass}`}
              >
                Economize {formatBRL(meta.quarterlySave)} ({formatPercent(quarterlyOffPct)}% OFF)
              </div>
            </>
          ) : (
            <>
              <p
                className={`${compact ? 'mb-[4px]' : 'mb-[8px]'} font-['Inter'] ${compact ? 'text-[11px]' : 'text-[12px]'} font-semibold uppercase tracking-[0.08em] text-[rgba(255,255,255,0.66)]`}
              >
                Cobrança mensal
              </p>

              <p className={`font-['Inter'] ${compact ? 'text-[12px]' : 'text-[13px]'} text-[rgba(255,255,255,0.45)] line-through`}>
                De {formatBRL(plan.monthlyAnchor)}
              </p>

              <div className="mt-[2px] flex flex-wrap items-end gap-[6px]">
                <span className={pcPriceNumNorm}>{formatBRL(plan.monthly)}</span>
                <span
                  className={`${compact ? 'pb-[3px] text-[12px]' : 'pb-[5px] text-[14px]'} font-['Inter'] text-[rgba(255,255,255,0.72)]`}
                >
                  /mês
                </span>
              </div>
            </>
          )}
        </div>

        {/* Ajuste do botão: min-h-[54px] e flex centralizado para garantir mesma altura */}
        {locked ? (
          <div
            role="status"
            aria-label="Este é o seu plano atual"
            className={`relative ${pcCtaMb} flex ${pcCtaH} cursor-not-allowed items-center justify-center ${compact ? 'rounded-[12px]' : 'rounded-[14px]'} border border-white/15 bg-white/[0.05] px-[12px] text-center font-['Inter'] ${pcCtaTxtNorm} font-semibold text-[rgba(255,255,255,0.45)]`}
          >
            Plano atual
          </div>
        ) : (
          <a
            href={currentHref}
            className={`relative ${pcCtaMb} flex ${pcCtaH} items-center justify-center ${compact ? 'rounded-[12px]' : 'rounded-[14px]'} border px-[12px] text-center font-['Inter'] ${pcCtaTxtNorm} font-bold text-[#fff] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[3px] hover:border-[rgba(255,255,255,0.22)] hover:bg-[rgba(255,255,255,0.14)] ${plan.tone === 'inicial'
                ? 'border-[rgba(52,211,153,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(16,185,129,0.10)_100%)]'
                : plan.tone === 'padrao'
                ? 'border-[rgba(168,85,247,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(168,85,247,0.08)_100%)]'
                : 'border-[rgba(6,182,212,0.14)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08)_0%,rgba(6,182,212,0.06)_100%)]'
              }`}
          >
            {currentCTA}
          </a>
        )}

        <div className={`relative ${pcFeatHeadMb} flex items-center gap-[8px]`}>
          <span
            className={`${compact ? 'h-[6px] w-[6px]' : 'h-[8px] w-[8px]'} rounded-full ${plan.tone === 'inicial' ? 'bg-[#34d399]' : plan.tone === 'padrao' ? 'bg-[#a855f7]' : 'bg-[#22d3ee]'}`}
          />
          <p
            className={`font-['Inter'] ${compact ? 'text-[10px]' : 'text-[11px]'} uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]`}
          >
            O que você recebe
          </p>
        </div>

        <ul className={`m-0 flex list-none flex-col ${pcFeatGap} p-0`}>
          {plan.features.map((feature, j) => (
            <li key={j} className={pcFeatLi}>
              <span className={`mt-[1px] shrink-0 font-black ${bulletToneClass}`}>✓</span>
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

export type PricingPlansEmbedProps = {
  /** Quando coincide com `plan.tone`, o CTA vira “Plano atual” (sem link). */
  currentPlanTone?: SubscriptionPlanTone | null
  /**
   * Se a assinatura ativa (mesmo tier) é mensal ou trimestral.
   * `null` = não inferido → não trava por período (permite ex.: mensal→trimestral no mesmo plano).
   */
  userSubscriptionBillingQuarterly?: boolean | null
  /** Assinantes logados: oculta o card Trial 3 dias. */
  hideFreeTrial?: boolean
  /** Layout mais denso (modal Minha Conta), sem scroll interno na maioria dos viewports. */
  compact?: boolean
  className?: string
}

/** Mesmos cartões e toggle mensal/trimestral da home — para reutilizar em modal (ex.: Minha Conta). */
export function PricingPlansEmbed({
  currentPlanTone = null,
  userSubscriptionBillingQuarterly = null,
  hideFreeTrial = false,
  compact = false,
  className = '',
}: PricingPlansEmbedProps) {
  const [quarterly, setQuarterly] = useState(false)
  const { openTrialSignup } = useLoginModal()

  const biggestSaving = useMemo(() => {
    const values = subscriptionPlans.map((plan) => getPlanMeta(plan).quarterlySavePct)
    return Math.max(...values)
  }, [])

  return (
    <div className={className}>
      <BillingSelector
        quarterly={quarterly}
        setQuarterly={setQuarterly}
        biggestSaving={biggestSaving}
        compact={compact}
      />
      <div
        className={`mx-auto grid w-full min-w-0 grid-cols-1 items-stretch ${compact && hideFreeTrial ? 'md:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'} ${compact ? 'mt-4 gap-[12px]' : 'mt-6 gap-[20px]'}`}
      >
        {!hideFreeTrial && <FreeTrialCard onStart={openTrialSignup} index={0} />}
        {subscriptionPlans.map((plan, index) => {
          const sameTone = currentPlanTone != null && plan.tone === currentPlanTone
          const billingKnown = userSubscriptionBillingQuarterly !== null
          const locked =
            sameTone &&
            billingKnown &&
            userSubscriptionBillingQuarterly === quarterly
          return (
            <PlanCard
              key={plan.name}
              plan={plan}
              quarterly={quarterly}
              index={hideFreeTrial ? index : index + 1}
              locked={locked}
              compact={compact}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="relative px-[28px] py-10 sm:py-18 bg-dark-bg transition-colors duration-500"
    >

      <div className="pointer-events-none absolute left-1/2 top-[30%] h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(ellipse,rgba(124,58,237,0.12)_0%,transparent_65%)] blur-[40px]" />


      <div className="relative mx-auto max-w-[1480px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="mb-[30px] text-center relative z-10"
        >
          <AlternatingAstronaut />
          {/* ── Glow laranja agora amarrado ao título ── */}
          <div
            className="pointer-events-none absolute left-1/2 top-[35%] -translate-x-1/2 -translate-y-1/2 h-[450px] w-[1300px] z-0"
            style={{
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,90,20,0.18), transparent 70%)',
              filter: 'blur(60px)',
            }}
            aria-hidden="true"
          />


          <h2 className="relative z-10 mb-[16px] font-[var(--font-space-grotesk)] text-[clamp(1.9rem,5vw,3.4rem)] font-black leading-[1.1] tracking-[-1.5px] text-[#fff]">
            Escolha o plano ideal para{' '}
            <span className="relative inline-block align-baseline">
             
              <span className="relative z-10 bg-gradient-to-r from-[#ff6b35] via-[#e24c30] to-[#ff9a6c] bg-clip-text text-transparent">
                vender mais
              </span>
            </span>
            <br /> com previsibilidade
          </h2>

          <p className="relative z-10 mx-auto mb-[35px] max-w-[560px] font-['Inter'] text-[17px] leading-[1.7] text-[rgba(255,255,255,0.64)]">
            Você tem 7 dias de garantia incondicional ou seu dinheiro de volta.
          </p>

          <PricingPlansEmbed currentPlanTone={null} hideFreeTrial={false} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="mx-auto mt-[24px] max-w-[920px]"
        >
          <div className="relative overflow-hidden rounded-[24px] border border-[rgba(255,255,255,0.1)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.03)_100%)] px-[28px] py-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-[16px]">
            <div className="pointer-events-none absolute -right-[60px] -top-[60px] h-[180px] w-[180px] rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.08)_0%,transparent_70%)]" />

            <div className="grid grid-cols-1 gap-[24px] md:grid-cols-[1.1fr_0.9fr] md:items-center">
              <div className="relative">
                <h3 className="mb-[8px] font-[var(--font-space-grotesk)] text-[24px] font-extrabold text-[#fff]">
                  {customPlan.name}
                </h3>

                <p className="mb-[18px] max-w-[520px] font-['Inter'] text-[14px] leading-[1.7] text-[rgba(255,255,255,0.68)]">
                  {customPlan.tagline}
                </p>

                <div className="mb-[18px]">
                  <span className="font-[var(--font-space-grotesk)] text-[clamp(1.8rem,4vw,2.2rem)] font-black text-[#fff]">
                    {customPlan.price}
                  </span>
                </div>

                <a
                  href={customPlan.href}
                  className="inline-flex rounded-[12px] bg-[linear-gradient(135deg,#ffffff,#dbeafe)] px-[18px] py-[13px] font-['Inter'] text-[15px] font-extrabold text-[#161621] no-underline transition-all duration-[220ms] ease-in hover:-translate-y-[3px]"
                >
                  {customPlan.cta}
                </a>
              </div>

              <div className="relative rounded-[18px] border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] p-[22px]">
                <p className="mb-[14px] font-['Inter'] text-[11px] uppercase tracking-[0.12em] text-[rgba(255,255,255,0.8)]">
                  Indicado para:
                </p>

                <ul className="m-0 flex list-none flex-col gap-[10px] p-0">
                  {customPlan.features.map((ft, j) => (
                    <li
                      key={j}
                      className="flex gap-[10px] font-['Inter'] text-[14px] text-[rgba(255,255,255,0.84)]"
                    >
                      <span className="mt-[1px] shrink-0 font-black text-[rgba(6,182,212,0.75)]">
                        ✓
                      </span>
                      {ft}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-50px' }}
          transition={{ duration: 0.6, delay: 0.35, ease: 'easeOut' }}
          className="mx-auto mt-[40px] max-w-[620px] rounded-[18px] border border-[rgba(255,255,255,0.12)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.03)_100%)] p-[28px_24px] text-center shadow-[0_10px_40px_rgba(0,0,0,0.22)] backdrop-blur-[16px]"
        >
          <div className="mx-auto mb-[12px] flex h-[88px] w-[88px] items-center justify-center">
            <Image
              src="/7days.png"
              alt="Selo de garantia de 7 dias — satisfação garantida, risco zero"
              width={120}
              height={120}
              className="object-contain drop-shadow-[0_6px_20px_rgba(0,0,0,0.35)]"
            />
          </div>

          <h4 className="mb-[8px] font-[var(--font-space-grotesk)] text-[17px] font-extrabold text-[#fff]">
            Garantia Incondicional de 7 Dias
          </h4>

          <p className="font-['Inter'] text-[14px] leading-[1.7] text-[rgba(255,255,255,0.58)]">
            Não ficou satisfeito? Devolvemos 100% sem burocracia, sem perguntas. O risco é todo nosso.
          </p>
        </motion.div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes shimmer {
              from { background-position: 200% 0; }
              to { background-position: -20% 0; }
            }
          `,
        }}
      />
    </section>
  )
}