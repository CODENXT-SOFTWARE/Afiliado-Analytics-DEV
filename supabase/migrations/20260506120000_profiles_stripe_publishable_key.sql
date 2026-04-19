-- Publishable key (pk_live_... / pk_test_...) do afiliado na conta Stripe dele.
-- Diferente da secret_key (usada no servidor pra criar PaymentIntents), a publishable
-- é segura pra expor no client-side e é obrigatória pro Payment Element inline
-- renderizar corretamente o formulário de cartão/PIX/Boleto.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_publishable_key text;
