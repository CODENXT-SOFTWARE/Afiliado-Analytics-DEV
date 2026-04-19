/**
 * Envia notificações de venda Stripe ao vendedor e ao comprador via webhook n8n
 * dedicado (STRIPE_WEBHOOK_NOTIFICACOES). O n8n roteia internamente com base em
 * `tipoAcao: "vendedor" | "comprador"` e usa a instância Evolution do vendedor
 * pra mandar o WhatsApp.
 *
 * IMPORTANTE: este helper NÃO modifica a integração Evolution. Só LÊ a instância
 * (`evolution_instances`) e o WhatsApp do vendedor (`profiles.shipping_sender_whatsapp`).
 */

import { createClient as createServiceClient } from "@supabase/supabase-js";

export type InfoprodNotificationTipo = "vendedor" | "comprador";

type Result = { ok: true } | { ok: false; reason: string };

function onlyDigits(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\D/g, "");
}

function getAdminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createServiceClient(url, key);
}

/**
 * Resolve a instância Evolution do vendedor a partir do WhatsApp da loja.
 * Usado como fonte de `nomeInstancia` + `hash` nas notificações.
 */
async function resolveSellerInstance(userId: string): Promise<
  | { ok: true; nomeInstancia: string; hash: string; sellerWhatsappDigits: string }
  | { ok: false; reason: string }
> {
  const supabase = getAdminSupabase();
  if (!supabase) return { ok: false, reason: "Supabase service role não configurado" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("shipping_sender_whatsapp")
    .eq("id", userId)
    .single();
  if (profileError) return { ok: false, reason: `Perfil não encontrado: ${profileError.message}` };
  const sellerWhatsappDigits = onlyDigits(profile?.shipping_sender_whatsapp as string | null | undefined);
  if (sellerWhatsappDigits.length < 10) {
    return { ok: false, reason: "Vendedor sem WhatsApp configurado em Configurações" };
  }

  const { data: instances, error: instError } = await supabase
    .from("evolution_instances")
    .select("nome_instancia, numero_whatsapp, hash")
    .eq("user_id", userId);
  if (instError) return { ok: false, reason: `Erro lendo instâncias: ${instError.message}` };

  const match = (instances ?? []).find((row) => {
    const digits = onlyDigits(row.numero_whatsapp as string | null | undefined);
    if (!digits) return false;
    return digits.endsWith(sellerWhatsappDigits) || sellerWhatsappDigits.endsWith(digits);
  });

  if (!match?.nome_instancia || !match?.hash) {
    return {
      ok: false,
      reason:
        "Nenhuma instância Evolution conectada com o mesmo número do WhatsApp da loja. Conecte em Integração WhatsApp.",
    };
  }

  return {
    ok: true,
    nomeInstancia: String(match.nome_instancia),
    hash: String(match.hash),
    sellerWhatsappDigits,
  };
}

/**
 * Dispara UMA notificação no webhook n8n dedicado (STRIPE_WEBHOOK_NOTIFICACOES).
 * Payload: { tipoAcao, nomeInstancia, hash, numeroDestino, mensagem }
 */
export async function sendInfoprodNotification(params: {
  userId: string;
  tipoAcao: InfoprodNotificationTipo;
  numeroDestino: string; // livre — será normalizado pra dígitos
  mensagem: string;
}): Promise<Result> {
  const webhookUrl = (process.env.STRIPE_WEBHOOK_NOTIFICACOES ?? "").trim();
  if (!webhookUrl) {
    return { ok: false, reason: "STRIPE_WEBHOOK_NOTIFICACOES não configurado" };
  }

  const instance = await resolveSellerInstance(params.userId);
  if (!instance.ok) return { ok: false, reason: instance.reason };

  const numeroDestinoDigits = onlyDigits(params.numeroDestino);
  if (!numeroDestinoDigits || numeroDestinoDigits.length < 10) {
    return { ok: false, reason: `numeroDestino inválido: "${params.numeroDestino}"` };
  }

  const payload = {
    tipoAcao: params.tipoAcao,
    nomeInstancia: instance.nomeInstancia,
    hash: instance.hash,
    numeroDestino: numeroDestinoDigits,
    mensagem: params.mensagem,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, reason: `n8n retornou ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}` };
    }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Falha ao chamar n8n" };
  }

  return { ok: true };
}

/**
 * Atalho usado no webhook da Stripe: dispara as duas notificações (vendedor +
 * comprador) em paralelo. Se o comprador não tiver telefone, pula só essa.
 */
export async function notifyPurchase(params: {
  userId: string;
  sellerMessage: string;
  buyerMessage: string;
  buyerPhone: string | null;
}): Promise<{ seller: Result; buyer: Result | null }> {
  // Vendedor: destino = seu próprio WhatsApp (detectado via resolveSellerInstance)
  const instance = await resolveSellerInstance(params.userId);
  if (!instance.ok) {
    return {
      seller: { ok: false, reason: instance.reason },
      buyer: params.buyerPhone ? { ok: false, reason: instance.reason } : null,
    };
  }

  const sellerPromise = sendInfoprodNotification({
    userId: params.userId,
    tipoAcao: "vendedor",
    numeroDestino: instance.sellerWhatsappDigits,
    mensagem: params.sellerMessage,
  });

  const buyerPromise: Promise<Result> | Promise<null> = params.buyerPhone
    ? sendInfoprodNotification({
        userId: params.userId,
        tipoAcao: "comprador",
        numeroDestino: params.buyerPhone,
        mensagem: params.buyerMessage,
      })
    : Promise.resolve(null);

  const [seller, buyer] = await Promise.all([sellerPromise, buyerPromise]);
  return { seller, buyer };
}
