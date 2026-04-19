/**
 * Cria / apaga o webhook da Stripe programaticamente (via API), por usuário.
 *
 * - O endpoint do webhook é `/api/webhooks/stripe/infoprod/[userId]` no nosso app.
 * - A URL pública é montada a partir de `NEXT_PUBLIC_APP_URL` (fallback: `APP_URL`).
 * - Escutamos apenas `checkout.session.completed` (evento que marca a venda).
 * - Retornamos endpoint_id + secret pra salvar em `profiles`.
 */

import Stripe from "stripe";

export const STRIPE_WEBHOOK_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  "checkout.session.completed",
  "payment_intent.succeeded",
];

export function getAppPublicUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXT_PUBLIC_BASE_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  return (candidates[0] ?? "").replace(/\/+$/, "");
}

export function buildWebhookUrl(userId: string, base?: string): string | null {
  const root = (base ?? getAppPublicUrl()).replace(/\/+$/, "");
  if (!root) return null;
  return `${root}/api/webhooks/stripe/infoprod/${userId}`;
}

export type EnsureWebhookResult =
  | { ok: true; endpointId: string; secret: string; reused: boolean }
  | { ok: false; reason: string };

/**
 * Garante que exista um webhook Stripe pro usuário — se não existir, cria.
 * Se `existingEndpointId` é passado, tenta revalidar antes de criar um novo.
 * IMPORTANTE: o `secret` só vem no CREATE (Stripe nunca devolve depois).
 */
export async function ensureWebhookForUser(params: {
  stripeKey: string;
  userId: string;
  existingEndpointId: string | null;
  publicBaseUrl?: string;
}): Promise<EnsureWebhookResult> {
  const { stripeKey, userId, existingEndpointId, publicBaseUrl } = params;
  const webhookUrl = buildWebhookUrl(userId, publicBaseUrl);
  if (!webhookUrl) {
    return {
      ok: false,
      reason:
        "URL pública do app não configurada. Defina NEXT_PUBLIC_APP_URL no .env (ou rode em produção na Vercel).",
    };
  }

  const stripe = new Stripe(stripeKey);

  // Se já existe, só verifica se ainda está vivo e com a URL certa. Se sim, reusa.
  // (O secret em si não conseguimos recuperar — mas se existingEndpointId + secret já estão
  //  no banco, o chamador não vai chamar isso; ele só chama quando precisa recriar.)
  if (existingEndpointId) {
    try {
      const endpoint = await stripe.webhookEndpoints.retrieve(existingEndpointId);
      const events = (endpoint?.enabled_events ?? []) as string[];
      const hasAllEvents = STRIPE_WEBHOOK_EVENTS.every((e) => events.includes(e));
      if (endpoint && endpoint.url === webhookUrl && endpoint.status !== "disabled" && hasAllEvents) {
        // Sem secret de retorno — o chamador deve manter o secret antigo.
        return { ok: true, endpointId: endpoint.id, secret: "", reused: true };
      }
      // Divergiu (URL, status ou eventos) — apaga pra recriar limpo
      try {
        await stripe.webhookEndpoints.del(existingEndpointId);
      } catch {
        /* ignore */
      }
    } catch {
      /* Endpoint já não existe; segue criando um novo */
    }
  }

  try {
    const created = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: STRIPE_WEBHOOK_EVENTS,
      description: `Infoprodutor (Afiliado Analytics) — notificações WhatsApp de venda`,
      metadata: { app: "afiliado-analytics", feature: "infoprodutor", user_id: userId },
    });
    return {
      ok: true,
      endpointId: created.id,
      // `secret` só vem no create (undefined em versões menores, mas sempre presente na criação de endpoint raiz).
      secret: (created.secret as string) ?? "",
      reused: false,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao criar webhook Stripe";
    return { ok: false, reason: msg };
  }
}

/** Apaga o webhook na Stripe (best-effort — não falha o fluxo principal). */
export async function deleteWebhookSafely(stripeKey: string, endpointId: string | null): Promise<void> {
  if (!endpointId) return;
  try {
    const stripe = new Stripe(stripeKey);
    await stripe.webhookEndpoints.del(endpointId);
  } catch {
    /* ignore — o usuário pode remover manualmente no painel da Stripe */
  }
}
