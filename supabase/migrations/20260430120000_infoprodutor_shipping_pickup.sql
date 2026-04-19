-- Modo de entrega por produto Stripe:
--   * allow_shipping: aceita envio (Correios) — default true pra não quebrar produtos existentes.
--   * allow_pickup: aceita retirada na loja — default false.
--   * shipping_cost: valor do frete em BRL (quando allow_shipping = true e cobra frete).
-- Na criação do Payment Link, geramos ShippingRates dinâmicas na Stripe e
-- anexamos em `shipping_options` para o cliente escolher.

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS allow_shipping boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_pickup   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shipping_cost  numeric(10,2);

-- Garante pelo menos um modo de entrega ativo.
ALTER TABLE public.produtos_infoprodutor
  DROP CONSTRAINT IF EXISTS produtos_infoprodutor_has_delivery_check;
ALTER TABLE public.produtos_infoprodutor
  ADD CONSTRAINT produtos_infoprodutor_has_delivery_check
  CHECK (allow_shipping = true OR allow_pickup = true);
