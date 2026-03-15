-- Listas de ofertas (cada lista tem nome e pertence ao usuário)
CREATE TABLE IF NOT EXISTS listas_ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_ofertas_user ON listas_ofertas(user_id);
ALTER TABLE listas_ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_ofertas_select_own" ON listas_ofertas;
CREATE POLICY "listas_ofertas_select_own" ON listas_ofertas FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_insert_own" ON listas_ofertas;
CREATE POLICY "listas_ofertas_insert_own" ON listas_ofertas FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_update_own" ON listas_ofertas;
CREATE POLICY "listas_ofertas_update_own" ON listas_ofertas FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_ofertas_delete_own" ON listas_ofertas;
CREATE POLICY "listas_ofertas_delete_own" ON listas_ofertas FOR DELETE USING (auth.uid() = user_id);

-- Itens da lista (produtos com preços reais da Shopee)
-- Preço = preço que era (original). Por = preço promoção (Shopee)
CREATE TABLE IF NOT EXISTS minha_lista_ofertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES listas_ofertas(id) ON DELETE CASCADE,
  image_url text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  price_original numeric(10,2),
  price_promo numeric(10,2),
  discount_rate numeric(5,2),
  converter_link text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE minha_lista_ofertas ADD COLUMN IF NOT EXISTS discount_rate numeric(5,2);
ALTER TABLE minha_lista_ofertas ADD COLUMN IF NOT EXISTS lista_id uuid REFERENCES listas_ofertas(id) ON DELETE CASCADE;
ALTER TABLE minha_lista_ofertas ADD COLUMN IF NOT EXISTS price_original numeric(10,2);
ALTER TABLE minha_lista_ofertas ADD COLUMN IF NOT EXISTS price_promo numeric(10,2);

-- Backfill: criar lista "Minha Lista" por usuário que tem itens e associar
INSERT INTO listas_ofertas (user_id, nome, created_at)
SELECT m.user_id, 'Minha Lista', now()
FROM (SELECT DISTINCT user_id FROM minha_lista_ofertas) m
WHERE NOT EXISTS (SELECT 1 FROM listas_ofertas l WHERE l.user_id = m.user_id AND l.nome = 'Minha Lista');

UPDATE minha_lista_ofertas m
SET lista_id = (SELECT l.id FROM listas_ofertas l WHERE l.user_id = m.user_id AND l.nome = 'Minha Lista' ORDER BY l.created_at ASC LIMIT 1)
WHERE m.lista_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'minha_lista_ofertas' AND column_name = 'price_typed') THEN
    UPDATE minha_lista_ofertas SET price_original = price_typed WHERE price_original IS NULL AND price_typed IS NOT NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'minha_lista_ofertas' AND column_name = 'price_discount') THEN
    UPDATE minha_lista_ofertas SET price_promo = price_discount WHERE price_promo IS NULL AND price_discount IS NOT NULL;
  END IF;
END $$;

ALTER TABLE minha_lista_ofertas DROP COLUMN IF EXISTS price_typed;
ALTER TABLE minha_lista_ofertas DROP COLUMN IF EXISTS price_discount;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM minha_lista_ofertas WHERE lista_id IS NULL LIMIT 1) THEN
    EXECUTE 'ALTER TABLE minha_lista_ofertas ALTER COLUMN lista_id SET NOT NULL';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_lista ON minha_lista_ofertas(lista_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_user ON minha_lista_ofertas(user_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_created ON minha_lista_ofertas(lista_id, created_at DESC);

ALTER TABLE minha_lista_ofertas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "minha_lista_ofertas_select_own" ON minha_lista_ofertas;
CREATE POLICY "minha_lista_ofertas_select_own" ON minha_lista_ofertas FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_insert_own" ON minha_lista_ofertas;
CREATE POLICY "minha_lista_ofertas_insert_own" ON minha_lista_ofertas FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_update_own" ON minha_lista_ofertas;
CREATE POLICY "minha_lista_ofertas_update_own" ON minha_lista_ofertas FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "minha_lista_ofertas_delete_own" ON minha_lista_ofertas;
CREATE POLICY "minha_lista_ofertas_delete_own" ON minha_lista_ofertas FOR DELETE USING (auth.uid() = user_id);

-- Histórico Shopee: preço original (preço que era) para enviar à lista
ALTER TABLE shopee_link_history ADD COLUMN IF NOT EXISTS price_shopee_original numeric(10,2);
