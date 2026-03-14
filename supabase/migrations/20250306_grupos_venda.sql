-- Grupos de Venda: grupos WhatsApp salvos por usuário para disparo de ofertas Shopee
CREATE TABLE IF NOT EXISTS grupos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES evolution_instances(id) ON DELETE CASCADE,
  group_id text NOT NULL,
  group_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, instance_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_grupos_venda_user ON grupos_venda(user_id);
CREATE INDEX IF NOT EXISTS idx_grupos_venda_instance ON grupos_venda(instance_id);

ALTER TABLE grupos_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grupos_venda_select_own" ON grupos_venda;
CREATE POLICY "grupos_venda_select_own"
  ON grupos_venda FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "grupos_venda_insert_own" ON grupos_venda;
CREATE POLICY "grupos_venda_insert_own"
  ON grupos_venda FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "grupos_venda_delete_own" ON grupos_venda;
CREATE POLICY "grupos_venda_delete_own"
  ON grupos_venda FOR DELETE
  USING (auth.uid() = user_id);
