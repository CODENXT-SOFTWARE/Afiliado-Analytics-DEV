-- Bots Telegram conectados pelo usuário (espelha conceito de evolution_instances).
-- Token guardado em texto puro. UNIQUE global no token impede o mesmo bot ser
-- cadastrado em duas contas diferentes.

CREATE TABLE IF NOT EXISTS telegram_bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bot_token text NOT NULL,
  bot_username text NOT NULL,
  bot_name text NOT NULL DEFAULT '',
  webhook_secret text NOT NULL,
  webhook_set_at timestamptz,
  webhook_last_error text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bot_token)
);

CREATE INDEX IF NOT EXISTS idx_telegram_bots_user_id ON telegram_bots(user_id);

ALTER TABLE telegram_bots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "telegram_bots_select_own" ON telegram_bots;
CREATE POLICY "telegram_bots_select_own"
  ON telegram_bots FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_bots_insert_own" ON telegram_bots;
CREATE POLICY "telegram_bots_insert_own"
  ON telegram_bots FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_bots_update_own" ON telegram_bots;
CREATE POLICY "telegram_bots_update_own"
  ON telegram_bots FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "telegram_bots_delete_own" ON telegram_bots;
CREATE POLICY "telegram_bots_delete_own"
  ON telegram_bots FOR DELETE USING (auth.uid() = user_id);
