-- Grupos Telegram descobertos pelo bot (espelha grupos_venda).
-- chat_id é text (Telegram pode passar de 2^53 em supergrupos).
-- Upsert pelo webhook receiver via UNIQUE(bot_id, chat_id).
-- descoberto_em / ultima_mensagem_em são extras pra UX (não existem no original).

CREATE TABLE IF NOT EXISTS telegram_grupos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  lista_id uuid REFERENCES telegram_listas_grupos_venda(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  descoberto_em timestamptz NOT NULL DEFAULT now(),
  ultima_mensagem_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_id, chat_id)
);

CREATE INDEX IF NOT EXISTS idx_telegram_grupos_venda_user
  ON telegram_grupos_venda(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_grupos_venda_bot
  ON telegram_grupos_venda(bot_id);
CREATE INDEX IF NOT EXISTS idx_telegram_grupos_venda_lista
  ON telegram_grupos_venda(lista_id);

ALTER TABLE telegram_grupos_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_grupos_venda_select_own" ON telegram_grupos_venda;
CREATE POLICY "telegram_grupos_venda_select_own"
  ON telegram_grupos_venda FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_grupos_venda_insert_own" ON telegram_grupos_venda;
CREATE POLICY "telegram_grupos_venda_insert_own"
  ON telegram_grupos_venda FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_grupos_venda_update_own" ON telegram_grupos_venda;
CREATE POLICY "telegram_grupos_venda_update_own"
  ON telegram_grupos_venda FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_grupos_venda_delete_own" ON telegram_grupos_venda;
CREATE POLICY "telegram_grupos_venda_delete_own"
  ON telegram_grupos_venda FOR DELETE USING (auth.uid() = user_id);
