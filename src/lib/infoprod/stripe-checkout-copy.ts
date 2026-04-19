/**
 * Texto customizado que anexamos aos Payment Links da Stripe (InfoP).
 * Inclui WhatsApp (se configurado), endereço da loja (se é pickup) e linhas
 * de CTA com emojis pra chamar atenção no checkout.
 */

import Stripe from "stripe";

export type DeliveryMode = {
  allowShipping: boolean;
  allowPickup: boolean;
};

export type SenderSnapshot = {
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  uf: string | null;
};

const SHIPPING_RATE_NAME_SHIPPING = "Correios";
const SHIPPING_RATE_NAME_PICKUP = "Retirar na loja";

export const SHIPPING_RATE_DISPLAY_NAMES = {
  shipping: SHIPPING_RATE_NAME_SHIPPING,
  pickup: SHIPPING_RATE_NAME_PICKUP,
} as const;

/** Converte telefone/whatsapp livre em URL wa.me (55 + DDD + número). */
export function toWhatsAppUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (!digits) return null;
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

/** Endereço curto do remetente pra exibir no checkout pickup. */
export function formatSenderAddressShort(s: SenderSnapshot | null): string {
  if (!s) return "";
  const streetPart = [s.street, s.number ? `nº ${s.number}` : null, s.complement].filter(Boolean).join(" ");
  const city = [s.city, s.uf].filter(Boolean).join("/");
  return [streetPart, s.neighborhood, city].filter(Boolean).join(", ");
}

/** Monta a mensagem do submit (aparece abaixo do botão Pagar). */
export function buildSubmitMessage(
  waUrl: string | null,
  mode: DeliveryMode,
  senderAddress: string,
): string | null {
  const lines: string[] = [];
  if (waUrl) {
    lines.push(`💬 Dúvidas? Fale com a loja no WhatsApp: ${waUrl}`);
  }
  if (mode.allowPickup && senderAddress) {
    lines.push(`📍 Retirada disponível: ${senderAddress}`);
  }
  if (lines.length === 0) return null;
  return lines.join("\n");
}

/** Mensagem pós-pagamento (tela de confirmação). */
export function buildHostedConfirmationMessage(
  waUrl: string | null,
  mode: DeliveryMode,
  senderAddress: string,
): string | null {
  const lines: string[] = ["Seu pagamento foi aprovado! 🎉"];
  if (mode.allowPickup && senderAddress && !mode.allowShipping) {
    lines.push(`Retire seu produto em: ${senderAddress}`);
  }
  if (waUrl) {
    lines.push(`Para dúvidas, fale no WhatsApp: ${waUrl}`);
  }
  if (lines.length <= 1 && !waUrl) return null;
  return lines.join("\n\n");
}

/** Monta o objeto custom_text pro Payment Link. */
export function buildPaymentLinkCustomText(
  waUrl: string | null,
  mode: DeliveryMode = { allowShipping: true, allowPickup: false },
  senderAddress = "",
): Stripe.PaymentLinkCreateParams.CustomText | undefined {
  const submit = buildSubmitMessage(waUrl, mode, senderAddress);
  if (!submit) return undefined;
  return { submit: { message: submit } };
}

export function buildAfterCompletion(
  waUrl: string | null,
  mode: DeliveryMode = { allowShipping: true, allowPickup: false },
  senderAddress = "",
): Stripe.PaymentLinkCreateParams.AfterCompletion | undefined {
  const msg = buildHostedConfirmationMessage(waUrl, mode, senderAddress);
  if (!msg) return undefined;
  return {
    type: "hosted_confirmation",
    hosted_confirmation: { custom_message: msg },
  };
}

/**
 * Enriquece a descrição do produto com uma linha de CTA pro WhatsApp.
 * Preserva a descrição original do usuário — só adiciona/atualiza a linha WA no final.
 */
export function buildStripeProductDescription(userDescription: string | null, waUrl: string | null): string | null {
  const base = (userDescription ?? "").trim();
  if (!waUrl) return base || null;
  const ctaLine = `💬 Dúvidas? WhatsApp: ${waUrl}`;
  if (!base) return ctaLine;
  return `${base}\n\n${ctaLine}`;
}
