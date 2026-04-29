-- ── Diretório de categorias Shopee (cache de nomes) ─────────────────────────
-- Populado pelo cron `/api/cron/shopee-trends` via `shopeeOfferV2`. Permite
-- resolver `category_id` → nome legível no servidor, sem que o client precise
-- chamar `/api/shopee/categories` separadamente (e pagar latência + risco
-- de intersect vazio quando categoria do produto não estiver no fetch do client).

CREATE TABLE IF NOT EXISTS public.shopee_category_directory (
  category_id BIGINT PRIMARY KEY,
  name        TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shopee_category_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shopee_category_directory_select_authenticated ON public.shopee_category_directory;
CREATE POLICY shopee_category_directory_select_authenticated
  ON public.shopee_category_directory
  FOR SELECT
  TO authenticated
  USING (true);
