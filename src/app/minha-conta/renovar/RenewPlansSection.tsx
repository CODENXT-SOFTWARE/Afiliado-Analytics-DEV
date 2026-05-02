'use client'

/**
 * Wrapper client-side do `PricingPlansEmbed` pra usar dentro de Server
 * Components (essa página é renderizada no servidor pra ler o profile do
 * Supabase). O `PricingPlansEmbed` chama `useLoginModal` internamente —
 * por isso precisamos do `LoginModalProvider` na árvore.
 *
 * Em `/minha-conta/renovar` o user já está logado, então o trigger de
 * trial-signup do `FreeTrialCard` nem é renderizado (passamos `hideFreeTrial`).
 * O provider tá aqui só pra satisfazer o contrato do hook.
 */

import { LoginModalProvider } from '@/app/components/auth/LoginModalProvider'
import { PricingPlansEmbed } from '@/app/components/home/Pricing'
import type { SubscriptionPlanTone } from '@/lib/plan-entitlements'

export default function RenewPlansSection({
  currentPlanTone,
}: {
  currentPlanTone: SubscriptionPlanTone
}) {
  return (
    <LoginModalProvider>
      <PricingPlansEmbed
        currentPlanTone={currentPlanTone}
        userSubscriptionBillingQuarterly={null}
        hideFreeTrial
        compact
      />
    </LoginModalProvider>
  )
}
