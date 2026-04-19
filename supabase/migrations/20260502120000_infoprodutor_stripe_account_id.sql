-- Rastreamento da conta Stripe que criou cada produto. Permite detectar
-- produtos "órfãos" quando o usuário troca pra outra conta Stripe:
--   * profiles.stripe_account_id = conta atualmente conectada
--   * produtos_infoprodutor.stripe_account_id = conta onde o produto foi criado
-- Se as duas divergem, mostramos um badge "Conta anterior" + botão "Recriar nesta conta".

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_account_id text;

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS stripe_account_id text;
