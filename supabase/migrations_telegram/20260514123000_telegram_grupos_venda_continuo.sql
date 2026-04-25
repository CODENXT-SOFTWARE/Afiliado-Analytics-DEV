-- Disparo contínuo Telegram (espelha grupos_venda_continuo CONSOLIDADO).
-- Inclui de uma vez: keywords, lista_ofertas (Shopee), lista_ofertas_ml (ML),
-- lista_ofertas_info (Infoprodutor), keyword_pool_indices, horario_inicio/fim.
-- bot_id substitui instance_id; lista_id aponta pra telegram_listas_grupos_venda.
-- Catálogos (listas_ofertas, listas_ofertas_ml, listas_ofertas_info) são compartilhados.

CREATE TABLE IF NOT EXISTS telegram_grupos_venda_continuo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES telegram_listas_grupos_venda(id) ON DELETE CASCADE,
  lista_ofertas_id uuid REFERENCES listas_ofertas(id) ON DELETE SET NULL,
  lista_ofertas_ml_id uuid REFERENCES listas_ofertas_ml(id) ON DELETE SET NULL,
  lista_ofertas_info_id uuid REFERENCES listas_ofertas_info(id) ON DELETE SET NULL,
  keywords jsonb NOT NULL DEFAULT '[]',
  keyword_pool_indices jsonb NOT NULL DEFAULT '{}'::jsonb,
  sub_id_1 text NOT NULL DEFAULT '',
  sub_id_2 text NOT NULL DEFAULT '',
  sub_id_3 text NOT NULL DEFAULT '',
  horario_inicio text,
  horario_fim text,
  ativo boolean NOT NULL DEFAULT false,
  proximo_indice integer NOT NULL DEFAULT 0,
  ultimo_disparo_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_ativo
  ON telegram_grupos_venda_continuo(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_lista
  ON telegram_grupos_venda_continuo(lista_id);
CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_lista_ofertas
  ON telegram_grupos_venda_continuo(lista_ofertas_id) WHERE lista_ofertas_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_lista_ofertas_ml
  ON telegram_grupos_venda_continuo(lista_ofertas_ml_id) WHERE lista_ofertas_ml_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tg_grupos_venda_continuo_lista_info
  ON telegram_grupos_venda_continuo(lista_ofertas_info_id) WHERE lista_ofertas_info_id IS NOT NULL;

COMMENT ON COLUMN telegram_grupos_venda_continuo.keyword_pool_indices IS
  'Mapa keyword -> contador (não negativo): produto escolhido = pool[n % pool.length] a cada disparo.';

ALTER TABLE telegram_grupos_venda_continuo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tg_grupos_venda_continuo_select_own" ON telegram_grupos_venda_continuo;
CREATE POLICY "tg_grupos_venda_continuo_select_own"
  ON telegram_grupos_venda_continuo FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tg_grupos_venda_continuo_insert_own" ON telegram_grupos_venda_continuo;
CREATE POLICY "tg_grupos_venda_continuo_insert_own"
  ON telegram_grupos_venda_continuo FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "tg_grupos_venda_continuo_update_own" ON telegram_grupos_venda_continuo;
CREATE POLICY "tg_grupos_venda_continuo_update_own"
  ON telegram_grupos_venda_continuo FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "tg_grupos_venda_continuo_delete_own" ON telegram_grupos_venda_continuo;
CREATE POLICY "tg_grupos_venda_continuo_delete_own"
  ON telegram_grupos_venda_continuo FOR DELETE USING (auth.uid() = user_id);
