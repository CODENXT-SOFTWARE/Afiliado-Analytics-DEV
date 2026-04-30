"use client";

import { useEffect, useState } from "react";
import { Bell, IdCard, Megaphone, MessageCircle, ChevronRight, ShoppingBag, Wallet } from "lucide-react";
import ShopeeIntegrationCard from "./ShopeeIntegrationCard";
import MetaIntegrationCard from "./MetaIntegrationCard";
import MessagingChannelsCard from "./MessagingChannelsCard";
import MercadoLivreIntegrationCard from "./MercadoLivreIntegrationCard";
import MercadoPagoIntegrationCard from "./MercadoPagoIntegrationCard";
import ShippingProfileCard from "./ShippingProfileCard";
import NotificacoesCard from "./NotificacoesCard";
import { MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";

export type SectionKey =
  | "shopee"
  | "mercadolivre"
  | "meta"
  | "evolution"
  | "mercadopago"
  | "notificacoes"
  | null;

type ConfiguracoesClientProps = {
  initialAppId: string;
  initialHasKey: boolean;
  initialLast4: string | null;
  /** Abre o bloco Mercado Livre (ex.: link da Lista ML com ?ml=1). */
  initialOpenMl?: boolean;
  /** Credenciais opcionais da API de desenvolvedor (profiles). */
  initialMlClientId?: string;
  initialMlHasSecret?: boolean;
  initialMlSecretLast4?: string | null;
  metaHasToken: boolean;
  metaLast4: string | null;
};

const CARDS: {
  key: SectionKey;
  title: string;
  description: string;
  icon: React.ElementType;
  /** Oculta o card na grelha (rota/API podem continuar a existir). */
  hidden?: boolean;
}[] = [
  {
    key: "shopee",
    title: "Integração Shopee",
    description: "API Shopee.",
    icon: IdCard,
  },
  {
    key: "mercadolivre",
    title: "Integração ML",
    description: "Etiqueta em uso e token da extensão",
    icon: ShoppingBag,
  },
  {
    key: "meta",
    title: "Meta Ads",
    description: "Token de acesso para campanhas e ATI",
    icon: Megaphone,
  },
  {
    key: "evolution",
    title: "Integrações",
    description: "Instâncias WhatsApp e bots Telegram",
    icon: MessageCircle,
  },
  {
    key: "mercadopago",
    title: "Infoprodutor",
    description: "Conecte suas formas de pagamento.",
    icon: Wallet,
  },
  {
    key: "notificacoes",
    title: "Ativar notificação",
    description: "",
    icon: Bell,
  },
];

/** Colunas alinhadas ao número de cards visíveis — evita “buraco” (ex.: 3 itens em grelha de 4 colunas). */
function integrationCardsGridClass(visibleCount: number) {
  const base = "grid gap-4";
  if (visibleCount <= 1) return `${base} grid-cols-1`;
  if (visibleCount === 2) return `${base} grid-cols-1 sm:grid-cols-2`;
  if (visibleCount === 3) return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`;
  return `${base} grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`;
}

export default function ConfiguracoesClient({
  initialAppId,
  initialHasKey,
  initialLast4,
  initialOpenMl,
  initialMlClientId = "",
  initialMlHasSecret = false,
  initialMlSecretLast4 = null,
  metaHasToken,
  metaLast4,
}: ConfiguracoesClientProps) {
  const [openSection, setOpenSection] = useState<SectionKey>(
    MERCADOLIVRE_UX_COMING_SOON ? null : initialOpenMl ? "mercadolivre" : null,
  );
  const visibleCards = CARDS.filter((c) => !c.hidden);

  // Se o usuário voltou do callback OAuth do Mercado Pago, abre o card MP
  // automaticamente para mostrar o banner de sucesso/erro.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("mp")) setOpenSection("mercadopago");
  }, []);

  return (
    <div className="space-y-6">
      {/* Grid de cards */}
      <div className={integrationCardsGridClass(visibleCards.length)}>
        {visibleCards.map(({ key, title, description, icon: Icon }) => {
          const mlCardBlocked = MERCADOLIVRE_UX_COMING_SOON && key === "mercadolivre";
          if (mlCardBlocked) {
            return (
              <div
                key={key ?? "ml-blocked"}
                className="flex w-full min-w-0 cursor-not-allowed items-start gap-4 rounded-xl border border-dark-border bg-dark-card p-4 text-left opacity-90"
                role="group"
                aria-disabled="true"
                aria-label={`${title} — em breve`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold text-text-primary">
                    <span>{title}</span>
                    <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Em breve
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-text-secondary/50" aria-hidden />
              </div>
            );
          }
          return (
            <button
              key={key ?? "null"}
              type="button"
              onClick={() => setOpenSection(openSection === key ? null : key)}
              className={`flex w-full min-w-0 items-start gap-4 rounded-xl border bg-dark-card p-4 text-left transition-all hover:border-shopee-orange/50 hover:bg-dark-card/90 ${
                openSection === key ? "border-shopee-orange/60 ring-1 ring-shopee-orange/20" : "border-dark-border"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-dark-bg text-shopee-orange">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-text-primary">{title}</p>
                <p className="text-xs text-text-secondary mt-0.5">{description}</p>
              </div>
              <ChevronRight
                className={`h-5 w-5 shrink-0 text-text-secondary transition-transform ${openSection === key ? "rotate-90" : ""}`}
              />
            </button>
          );
        })}
      </div>

      {/* Conteúdo do card selecionado */}
      {openSection === "shopee" && (
        <div className="animate-in fade-in duration-200">
          <ShopeeIntegrationCard
            initialAppId={initialAppId}
            initialHasKey={initialHasKey}
            initialLast4={initialLast4}
          />
        </div>
      )}
      {openSection === "mercadolivre" && !MERCADOLIVRE_UX_COMING_SOON && (
        <div className="animate-in fade-in duration-200">
          <MercadoLivreIntegrationCard
            initialClientId={initialMlClientId}
            initialHasSecret={initialMlHasSecret}
            initialSecretLast4={initialMlSecretLast4}
          />
        </div>
      )}
      {openSection === "meta" && (
        <div className="animate-in fade-in duration-200">
          <MetaIntegrationCard initialHasToken={metaHasToken} initialLast4={metaLast4} />
        </div>
      )}
      {openSection === "evolution" && (
        <div className="animate-in fade-in duration-200">
          <MessagingChannelsCard />
        </div>
      )}
      {openSection === "mercadopago" && (
        <div className="animate-in fade-in duration-200 space-y-4">
          <MercadoPagoIntegrationCard />
          <ShippingProfileCard />
        </div>
      )}
      {openSection === "notificacoes" && (
        <div className="animate-in fade-in duration-200">
          <NotificacoesCard />
        </div>
      )}
    </div>
  );
}
