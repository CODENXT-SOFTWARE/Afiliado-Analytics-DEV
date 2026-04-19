-- Mensagem de agradecimento personalizada por produto Stripe.
-- Enviada no WhatsApp do comprador após a compra, via webhook STRIPE_WEBHOOK_NOTIFICACOES.
-- Aceita texto livre + links (WhatsApp auto-linkifica URLs).

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS thank_you_message text;
