-- WhatsApp do remetente — exibido no checkout Stripe dos produtos InfoP
-- (via custom_text.submit.message) e na tela de confirmação pós-pagamento.
-- Independente do `shipping_sender_phone` (que pode ser fixo/comercial).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS shipping_sender_whatsapp text;
