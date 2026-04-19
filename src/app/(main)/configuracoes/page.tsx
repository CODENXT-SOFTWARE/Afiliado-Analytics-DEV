import Link from "next/link";
import { ArrowLeft, ExternalLink, MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "../../../../utils/supabase/server";
import ChangePasswordClient from "../../components/account/ChangePasswordClient";
import ConfiguracoesClient from "./ConfiguracoesClient";

const kiwifyLoginUrl = "https://dashboard.kiwify.com/login?lang=pt";
const whatsappUrl = "https://wa.me/5579999144028";
const supportEmail = "suporte@afiliadoeses.com";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams?: Promise<{ ml?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const initialOpenMl = sp.ml === "1";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Não incluir meta_access_token_last4 na query principal para não quebrar se a migração ainda não foi rodada
  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "subscription_status, plan_name, email, shopee_app_id, shopee_api_key_last4, mercadolivre_client_id, mercadolivre_client_secret_last4",
    )
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.subscription_status !== "active") {
    redirect("/minha-conta/renovar");
  }

  // Busca status do Meta separadamente (falha suave se colunas não existirem)
  let metaHasToken = false;
  let metaLast4: string | null = null;
  const { data: metaRow, error: metaError } = await supabase
    .from("profiles")
    .select("meta_access_token_last4")
    .eq("id", user.id)
    .single();
  if (!metaError && metaRow?.meta_access_token_last4) {
    metaHasToken = true;
    metaLast4 = metaRow.meta_access_token_last4;
  }

  // Status da Stripe (falha suave enquanto migração não for aplicada)
  let stripeHasKey = false;
  let stripeLast4: string | null = null;
  let stripeHasPublishableKey = false;
  let stripePublishableLast4: string | null = null;
  const { data: stripeRow, error: stripeError } = await supabase
    .from("profiles")
    .select("stripe_secret_key_last4, stripe_publishable_key")
    .eq("id", user.id)
    .single();
  if (!stripeError && stripeRow?.stripe_secret_key_last4) {
    stripeHasKey = true;
    stripeLast4 = stripeRow.stripe_secret_key_last4;
  }
  const pkValue = (stripeRow as { stripe_publishable_key?: string | null } | null)?.stripe_publishable_key ?? null;
  if (pkValue) {
    stripeHasPublishableKey = true;
    stripePublishableLast4 = pkValue.slice(-4);
  }

  return (
    <div className="bg-dark-bg min-h-[calc(100vh-4rem)] text-text-secondary">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-text-primary font-heading">
            Minha Conta
          </h1>
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-shopee-orange transition-opacity hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para o Dashboard
          </Link>
        </div>

        {/* Cards: Shopee, Meta Ads, Evolution API — ao clicar abre o conteúdo */}
        <ConfiguracoesClient
          initialAppId={profile.shopee_app_id ?? ""}
          initialHasKey={!!profile.shopee_api_key_last4}
          initialLast4={profile.shopee_api_key_last4 ?? null}
          initialOpenMl={initialOpenMl}
          initialMlClientId={profile.mercadolivre_client_id ?? ""}
          initialMlHasSecret={!!profile.mercadolivre_client_secret_last4}
          initialMlSecretLast4={profile.mercadolivre_client_secret_last4 ?? null}
          metaHasToken={metaHasToken}
          metaLast4={metaLast4}
          stripeHasKey={stripeHasKey}
          stripeLast4={stripeLast4}
          stripeHasPublishableKey={stripeHasPublishableKey}
          stripePublishableLast4={stripePublishableLast4}
        />

        <div className="mt-8 mb-8 rounded-lg border border-dark-border bg-dark-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-text-primary font-heading">
            Perfil e Segurança
          </h2>
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-md border border-dark-border bg-dark-bg p-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  E-mail
                </label>
                <p className="text-base">{user.email}</p>
              </div>
            </div>

            <div className="flex flex-col rounded-md border border-dark-border bg-dark-bg p-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary">
                  Senha
                </label>
                <p className="text-base">************</p>
              </div>
              <div className="mt-4">
                <ChangePasswordClient />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-dark-border bg-dark-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold text-text-primary font-heading">
            Gerenciamento de Assinatura
          </h2>
          <div className="space-y-4">
            <div className="rounded-md border border-dark-border bg-dark-bg p-4">
              <label className="block text-sm font-medium text-text-secondary">
                Plano Atual
              </label>
              <p className="text-base font-semibold text-text-primary">
                {profile.plan_name || "Não informado"}
              </p>
            </div>
            <div>
              <Link
                href={kiwifyLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md bg-shopee-orange px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              >
                Gerenciar Assinatura na Kiwify
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        <div className="mt-8 rounded-2xl bg-gradient-to-br from-shopee-orange/50 via-emerald-500/40 to-cyan-500/40 p-[1px] shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
          <div className="relative overflow-hidden rounded-2xl bg-dark-card/85 p-4 sm:p-5 md:p-6 backdrop-blur-sm">
            <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-shopee-orange/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-emerald-500/10 blur-2xl" />

            <div className="flex flex-col gap-4 sm:gap-5 md:gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-none md:max-w-2xl">
                <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-text-primary font-heading">
                  Suporte
                </h2>
                <p className="mt-1 text-sm sm:text-base text-text-primary">
                  Precisa de ajuda? Nossa equipe está aqui para ajudar.
                </p>
                <div className="mt-2 flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                  <p className="text-xs sm:text-sm text-text-secondary">
                    Horário de atendimento: Seg–Sex, 8h às 18h
                  </p>
                  <p className="text-xs sm:text-sm text-text-secondary">
                    Para dúvidas detalhadas, envie para{" "}
                    <span className="text-shopee-orange">{supportEmail}</span> —
                    respondemos em até 24h úteis.
                  </p>
                </div>
              </div>

              <div className="flex w-full md:w-auto items-center justify-stretch md:justify-end">
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                >
                  <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
                  Iniciar Chat com Suporte
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
