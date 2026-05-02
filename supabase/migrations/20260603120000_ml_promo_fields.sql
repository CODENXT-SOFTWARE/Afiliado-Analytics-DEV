-- Adiciona campos de promo/atratividade da PDP do Mercado Livre nos itens
-- da lista e no histórico. Esses dados vêm do enriquecimento da PDP no
-- momento da geração do link e são exibidos no card e no texto enviado
-- para grupos.
--
-- Campos:
--   coupon_percent              — cupom em % (ex.: 8 → "Cupom 8% OFF")
--   coupon_amount               — cupom em valor R$ (alternativa ao percentual)
--   pix_discount_percent        — desconto exclusivo Pix em % (ex.: 4 → "no Pix 4% OFF")
--   is_full                     — produto entrega via FULL (logística ML)
--   free_shipping               — frete grátis disponível
--   installments_count          — quantidade de parcelas (ex.: 4 → "4x sem juros")
--   installment_amount          — valor de cada parcela em R$
--   installments_free_interest  — true se as parcelas são sem juros

ALTER TABLE minha_lista_ofertas_ml
  ADD COLUMN IF NOT EXISTS coupon_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS pix_discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_full boolean,
  ADD COLUMN IF NOT EXISTS free_shipping boolean,
  ADD COLUMN IF NOT EXISTS installments_count smallint,
  ADD COLUMN IF NOT EXISTS installment_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS installments_free_interest boolean;

ALTER TABLE mercadolivre_link_history
  ADD COLUMN IF NOT EXISTS coupon_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS pix_discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS is_full boolean,
  ADD COLUMN IF NOT EXISTS free_shipping boolean,
  ADD COLUMN IF NOT EXISTS installments_count smallint,
  ADD COLUMN IF NOT EXISTS installment_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS installments_free_interest boolean;
