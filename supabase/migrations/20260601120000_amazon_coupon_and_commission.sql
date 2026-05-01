-- Adiciona cupom (% ou R$) e percentual de comissão estimada da Amazon
-- nos itens da lista. Esses campos vêm da SERP/PDP enriquecida no momento
-- da geração e são exibidos no card e no texto enviado para grupos.

ALTER TABLE minha_lista_ofertas_amazon
  ADD COLUMN IF NOT EXISTS coupon_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS affiliate_commission_pct numeric(5,2);

ALTER TABLE amazon_link_history
  ADD COLUMN IF NOT EXISTS coupon_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS coupon_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS affiliate_commission_pct numeric(5,2);
