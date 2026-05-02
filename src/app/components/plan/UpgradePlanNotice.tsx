"use client";

import Image from "next/image";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { PricingPlansEmbed } from "@/app/components/home/Pricing";
import type { SubscriptionPlanTone } from "@/lib/plan-entitlements";

/**
 * Aviso de upgrade (mesmo padrão visual de Minha Conta / Configurações):
 * faixa com mascote, CTA "Ver planos" abre modal com `PricingPlansEmbed`.
 */
export function UpgradePlanNotice({
  title,
  description,
  onClose,
  currentPlanToneForPricing,
  userSubscriptionBillingQuarterly,
}: {
  title: string;
  description: string;
  /** Quando omitido, o botão "Fechar" não aparece (uso como gate permanente). */
  onClose?: () => void;
  currentPlanToneForPricing: SubscriptionPlanTone;
  userSubscriptionBillingQuarterly: boolean | null;
}) {
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const modalTitleId = useId();

  return (
    <>
      <div className="flex min-h-[112px] items-stretch overflow-hidden rounded-xl border border-shopee-orange/30 bg-shopee-orange/5 light:border-orange-200/55 light:bg-orange-50">
        <div className="relative w-[clamp(72px,18vw,132px)] shrink-0 self-stretch bg-transparent">
          <Image
            src="/sadsho.png"
            alt=""
            fill
            sizes="132px"
            className="object-contain object-center p-0.5 md:hidden"
          />
          <Image
            src="/sadsho2.png"
            alt=""
            fill
            sizes="132px"
            className="hidden object-contain object-center p-0.5 md:block"
          />
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center p-4 pl-3 sm:pl-4">
          <p className="font-semibold text-shopee-orange">{title}</p>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPricingModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-shopee-orange px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-shopee-orange/25 transition hover:opacity-90"
            >
              Ver planos
            </button>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-text-secondary transition hover:text-text-primary"
              >
                Fechar
              </button>
            )}
          </div>
        </div>
      </div>

      {pricingModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-8 pb-12 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={modalTitleId}
        >
          <button
            type="button"
            className="fixed inset-0 cursor-default"
            aria-label="Fechar modal"
            onClick={() => setPricingModalOpen(false)}
          />
          <div className="relative z-[101] my-auto w-full max-w-[min(1480px,calc(100vw-2rem))] overflow-x-hidden rounded-2xl border border-dark-border bg-dark-bg p-4 shadow-2xl sm:p-6">
            <button
              type="button"
              onClick={() => setPricingModalOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-text-secondary transition hover:bg-dark-card hover:text-text-primary"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
            <h2
              id={modalTitleId}
              className="mb-4 pr-10 font-heading text-lg font-bold text-text-primary sm:text-xl"
            >
              Planos e preços
            </h2>
            <PricingPlansEmbed
              currentPlanTone={currentPlanToneForPricing}
              userSubscriptionBillingQuarterly={userSubscriptionBillingQuarterly}
              hideFreeTrial
              compact
              className="pb-1"
            />
          </div>
        </div>
      )}
    </>
  );
}
