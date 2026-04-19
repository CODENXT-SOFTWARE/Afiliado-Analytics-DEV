-- Quais meios de pagamento ficam visíveis no checkout público do afiliado.
-- Se todos false, fallback pro `automatic_payment_methods` da Stripe no backend
-- (evita deixar o comprador sem nenhuma opção por engano de configuração).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_method_card boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_method_pix boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS checkout_method_boleto boolean DEFAULT true;
