-- Adiciona o desconto exclusivo Amazon Prime (% de off na 1ª compra ou Prime)
-- nos itens da lista e no histórico. Esses dados vêm da PDP enriquecida no
-- momento da geração do link e são exibidos no card e no texto enviado para
-- grupos junto com cupom/desconto regular.

ALTER TABLE minha_lista_ofertas_amazon
  ADD COLUMN IF NOT EXISTS prime_discount_percent numeric(5,2);

ALTER TABLE amazon_link_history
  ADD COLUMN IF NOT EXISTS prime_discount_percent numeric(5,2);
