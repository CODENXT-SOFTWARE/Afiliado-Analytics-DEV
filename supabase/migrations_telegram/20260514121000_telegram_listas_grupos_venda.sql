-- Listas nomeadas de grupos Telegram (espelha listas_grupos_venda).
-- bot_id substitui instance_id; toda lista pertence a um bot.

CREATE TABLE IF NOT EXISTS telegram_listas_grupos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_id uuid NOT NULL REFERENCES telegram_bots(id) ON DELETE CASCADE,
  nome_lista text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_listas_grupos_venda_user
  ON telegram_listas_grupos_venda(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_listas_grupos_venda_bot
  ON telegram_listas_grupos_venda(bot_id);

ALTER TABLE telegram_listas_grupos_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_listas_grupos_venda_select_own" ON telegram_listas_grupos_venda;
CREATE POLICY "telegram_listas_grupos_venda_select_own"
  ON telegram_listas_grupos_venda FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_listas_grupos_venda_insert_own" ON telegram_listas_grupos_venda;
CREATE POLICY "telegram_listas_grupos_venda_insert_own"
  ON telegram_listas_grupos_venda FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_listas_grupos_venda_update_own" ON telegram_listas_grupos_venda;
CREATE POLICY "telegram_listas_grupos_venda_update_own"
  ON telegram_listas_grupos_venda FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_listas_grupos_venda_delete_own" ON telegram_listas_grupos_venda;
CREATE POLICY "telegram_listas_grupos_venda_delete_own"
  ON telegram_listas_grupos_venda FOR DELETE USING (auth.uid() = user_id);
