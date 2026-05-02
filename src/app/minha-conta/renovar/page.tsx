// app/minha-conta/renovar/page.tsx
import Link from 'next/link'
import Image from 'next/image'
import { ExternalLink } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../utils/supabase/server'
import { LogoutButton } from './LogoutButton'
import RenewPlansSection from './RenewPlansSection'
import { subscriptionToneForPlanTier, type PlanTier } from '@/lib/plan-entitlements'

const kiwifyLoginUrl = 'https://dashboard.kiwify.com/login?lang=pt'
const whatsappUrl = 'https://wa.me/5579999144028'



export default async function RenewPage({
  searchParams,
}: {
  searchParams: Promise<{ precisa_plano?: string }>
}) {
  const sp = await searchParams
  const precisaPlano = sp.precisa_plano === '1'

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_status, plan_tier, trial_access_until')
    .eq('id', user.id)
    .single()

  const trialUntil = profile?.trial_access_until
    ? new Date(profile.trial_access_until as string).getTime()
    : 0
  const trialExpired =
    profile?.plan_tier === 'trial' &&
    trialUntil > 0 &&
    trialUntil < Date.now()

  // Igual ao `dashboard/page.tsx`: com trial expirado não pode mandar de volta ao dashboard
  // só porque `subscription_status` ainda é `active` (cron ainda não pôs `canceled`).
  if (
    !error &&
    profile?.subscription_status === 'active' &&
    !precisaPlano &&
    !trialExpired
  ) {
    redirect('/dashboard')
  }

  const upgradeMode = Boolean(
    !error && profile?.subscription_status === 'active' && precisaPlano
  )

  // Tone do plano atual pra `PricingPlansEmbed` marcar o card correspondente
  // como "atual" (mesmo padrão usado no modal "Planos e preços" do dashboard).
  // Trial / sem plano → tone "inicial" (default seguro).
  const currentPlanTone = subscriptionToneForPlanTier(
    (profile?.plan_tier as PlanTier) ?? 'inicial',
  )

  return (
    <div className="bg-dark-bg min-h-screen flex flex-col items-center font-sans p-4 py-8">
      {/* Logo */}
      <Image
        src="/logo.png"
        alt="Afiliado Analytics"
        width={240}
        height={40}
        priority
        className="object-contain mb-6"
      />

      {/* Aviso compacto + ações secundárias */}
      <div className="w-full max-w-[1480px] mb-6">
        <div className="bg-dark-card border border-dark-border rounded-2xl shadow-md overflow-hidden">
          <div className="px-6 py-6 flex flex-col items-center text-center gap-4 sm:flex-row sm:items-center sm:text-left sm:gap-6">
            <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 flex items-center justify-center">
              <Image
                src="/sadsho3.png"
                alt=""
                width={96}
                height={96}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-text-primary mb-1">
                {upgradeMode ? 'Recurso do plano pago' : 'Sua assinatura expirou'}
              </h1>
              <p className="text-text-secondary text-sm leading-relaxed">
                {upgradeMode ? (
                  'Esta área faz parte dos planos Padrão ou Pro. Escolha um plano abaixo para desbloquear.'
                ) : (
                  <>
                    Seu acesso ao dashboard foi pausado. Escolha um plano abaixo para voltar a usar as ferramentas.{' '}
                    <span className="block sm:inline mt-1 sm:mt-0 text-base font-bold text-shopee-orange">
                      Use o mesmo e-mail da sua conta ao pagar na Kiwify.
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
              {upgradeMode ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dark-border bg-dark-bg/60 px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/5"
                >
                  Voltar ao dashboard
                </Link>
              ) : (
                <Link
                  href={kiwifyLoginUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-dark-border bg-dark-bg/60 px-4 py-2 text-sm font-semibold text-text-primary transition-colors hover:bg-white/5"
                >
                  Gerenciar na Kiwify
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
              <LogoutButton />
            </div>
          </div>
        </div>
      </div>

      {/* Cards de planos — mesmo componente usado no modal "Planos e preços"
          do dashboard. Toggle Mensal/Trimestral, destaque MAIS POPULAR no Pro,
          card do plano atual fica marcado quando aplicável. */}
      <div className="w-full max-w-[1480px]">
        <RenewPlansSection currentPlanTone={currentPlanTone} />
      </div>

      {/* Rodapé com suporte */}
      <p className="mt-6 text-sm text-text-secondary">
        Dúvidas?{' '}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-shopee-orange hover:underline font-medium"
        >
          Chame no WhatsApp
        </a>
      </p>

      {/* Copyright */}
      <p className="mt-4 text-xs text-text-secondary/60">
        © 2026 Afiliado Analytics. Todos os direitos reservados.
      </p>
    </div>
  )
}
