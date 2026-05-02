"use client";

import type { ReactNode } from "react";
import { UpgradePlanNotice } from "@/app/components/plan/UpgradePlanNotice";
import { subscriptionToneForPlanTier } from "@/lib/plan-entitlements";
import { usePlanEntitlements } from "./PlanEntitlementsContext";

/**
 * Features gateáveis no client-side.
 * O tier mínimo determina a copy do bloqueio (Pro-only vs Padrão+).
 */
type Feature =
  | "ati"
  | "criarCampanhaMeta"
  | "geradorCriativos"
  | "espelhamentogrupos"
  | "especialistagenerate"
  | "infoprodutor"
  | "tendenciasShopee"
  | "analiseOfertasRelampago"
  | "mercadoLivre"
  | "amazon";

const FEATURE_MIN_TIER: Record<Feature, "padrao" | "pro"> = {
  ati: "padrao",
  criarCampanhaMeta: "padrao",
  espelhamentogrupos: "padrao",
  infoprodutor: "padrao",
  tendenciasShopee: "padrao",
  analiseOfertasRelampago: "padrao",
  mercadoLivre: "padrao",
  amazon: "padrao",
  geradorCriativos: "pro",
  especialistagenerate: "pro",
};

type GateCopy = {
  title: string;
  description: string;
};

function copyForFeature(feature: Feature): GateCopy {
  if (FEATURE_MIN_TIER[feature] === "pro") {
    return {
      title: "Recurso exclusivo do Plano Pro",
      description:
        "Esta funcionalidade está disponível apenas para assinantes do Plano Pro. Faça upgrade para desbloquear todos os recursos avançados.",
    };
  }
  return {
    title: "Recurso dos Planos Padrão e Pro",
    description:
      "Esta funcionalidade está disponível a partir do Plano Padrão. Faça upgrade para desbloquear marketplaces, automações avançadas e tendências.",
  };
}

export default function ProFeatureGate({
  feature,
  children,
}: {
  feature: Feature;
  children: ReactNode;
}) {
  const { tier, entitlements, billingQuarterly, loading } = usePlanEntitlements();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
        Carregando...
      </div>
    );
  }

  if (entitlements && !entitlements[feature]) {
    const copy = copyForFeature(feature);
    const tone = subscriptionToneForPlanTier(tier);
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="w-full max-w-xl">
          <UpgradePlanNotice
            title={copy.title}
            description={copy.description}
            currentPlanToneForPricing={tone}
            userSubscriptionBillingQuarterly={billingQuarterly}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
