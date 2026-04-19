-- Webhook Stripe por usuário (criado programaticamente ao conectar a chave).
-- Cada usuário tem um endpoint dedicado em /api/webhooks/stripe/infoprod/[userId],
-- com signing secret próprio — usamos `stripe_webhook_secret` para validar eventos.
--
-- Fluxo: POST /api/settings/stripe (save key) → stripe.webhookEndpoints.create
-- armazena endpoint_id + secret; DELETE apaga o endpoint via Stripe API.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_webhook_endpoint_id text,
  ADD COLUMN IF NOT EXISTS stripe_webhook_secret       text;
