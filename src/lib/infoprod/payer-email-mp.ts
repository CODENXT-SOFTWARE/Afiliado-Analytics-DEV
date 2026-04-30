/**
 * Checkout Infoprodutor: e-mail do comprador é opcional na UI, mas a API do
 * Mercado Pago exige `payer.email`. Quando não há e-mail válido, geramos um
 * endereço sintético estável a partir do WhatsApp (formato válido).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Domínio público do produto — só para satisfazer o formato exigido pelo MP. */
const PLACEHOLDER_DOMAIN = "ordenacao.afiliadoanalytics.com.br";

export function parseOptionalBuyerEmail(raw: string): string | null {
  const t = raw.trim().slice(0, 200);
  if (!t) return null;
  return EMAIL_RE.test(t) ? t.toLowerCase() : null;
}

export function payerEmailForMercadoPago(rawBuyerEmail: string, whatsappDigits: string): string {
  const parsed = parseOptionalBuyerEmail(rawBuyerEmail);
  if (parsed) return parsed;
  const d = whatsappDigits.replace(/\D/g, "");
  const suffix = d.length >= 10 ? d.slice(-11) : d.padStart(11, "0").slice(-11);
  return `wa.${suffix}@${PLACEHOLDER_DOMAIN}`;
}
