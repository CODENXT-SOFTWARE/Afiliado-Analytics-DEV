-- Dimensões físicas do produto para cotação de frete dinâmica (SuperFrete).
-- Usado no checkout pra calcular o valor real baseado no CEP do comprador
-- + CEP do afiliado (profiles.shipping_sender_cep).

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS peso_g integer,
  ADD COLUMN IF NOT EXISTS altura_cm numeric(6,2),
  ADD COLUMN IF NOT EXISTS largura_cm numeric(6,2),
  ADD COLUMN IF NOT EXISTS comprimento_cm numeric(6,2);
