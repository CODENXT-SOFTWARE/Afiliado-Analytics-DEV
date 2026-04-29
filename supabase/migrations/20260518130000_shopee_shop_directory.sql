-- ── Diretório de lojas Shopee (cache de logos) ──────────────────────────────
-- Populado pelo cron (rota `/api/cron/shopee-trends`) via `shopeeOfferV2`. Cresce
-- lentamente: cada run só adiciona/atualiza lojas que aparecem nas ofertas
-- vigentes. Logo + nome ficam disponíveis pra UI exibir junto da agregação de
-- vendas das lojas.

CREATE TABLE IF NOT EXISTS public.shopee_shop_directory (
  shop_id     BIGINT PRIMARY KEY,
  shop_name   TEXT NOT NULL,
  image_url   TEXT,
  rating_star NUMERIC(3, 2),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup case-insensitive por nome quando não temos o id (snapshot só guarda
-- shop_name canônico vindo do produto, e podemos cruzar pelo nome também).
CREATE INDEX IF NOT EXISTS shopee_shop_directory_name_idx
  ON public.shopee_shop_directory (LOWER(shop_name));

ALTER TABLE public.shopee_shop_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopee_shop_directory_select_authenticated ON public.shopee_shop_directory;
CREATE POLICY shopee_shop_directory_select_authenticated
  ON public.shopee_shop_directory
  FOR SELECT
  TO authenticated
  USING (true);
