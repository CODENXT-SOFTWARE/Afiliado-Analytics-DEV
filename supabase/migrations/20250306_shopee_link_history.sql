-- Histórico de links gerados (Gerador de Links Shopee) por usuário
CREATE TABLE IF NOT EXISTS shopee_link_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  short_link text NOT NULL,
  origin_url text NOT NULL DEFAULT '',
  sub_id_1 text NOT NULL DEFAULT '',
  sub_id_2 text NOT NULL DEFAULT '',
  sub_id_3 text NOT NULL DEFAULT '',
  observation text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  slug text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  commission_rate numeric(5,4) NOT NULL DEFAULT 0,
  commission_value numeric(10,2) NOT NULL DEFAULT 0,
  price_shopee numeric(10,2),
  price_shopee_original numeric(10,2),
  price_shopee_discount_rate numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Garantir colunas de preço para quem já tinha a tabela antes
ALTER TABLE shopee_link_history ADD COLUMN IF NOT EXISTS price_shopee numeric(10,2);
ALTER TABLE shopee_link_history ADD COLUMN IF NOT EXISTS price_shopee_original numeric(10,2);
ALTER TABLE shopee_link_history ADD COLUMN IF NOT EXISTS price_shopee_discount_rate numeric(5,2);

CREATE INDEX IF NOT EXISTS idx_shopee_link_history_user_created ON shopee_link_history(user_id, created_at DESC);

ALTER TABLE shopee_link_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shopee_link_history_select_own" ON shopee_link_history;
CREATE POLICY "shopee_link_history_select_own"
  ON shopee_link_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopee_link_history_insert_own" ON shopee_link_history;
CREATE POLICY "shopee_link_history_insert_own"
  ON shopee_link_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "shopee_link_history_delete_own" ON shopee_link_history;
CREATE POLICY "shopee_link_history_delete_own"
  ON shopee_link_history FOR DELETE
  USING (auth.uid() = user_id);
