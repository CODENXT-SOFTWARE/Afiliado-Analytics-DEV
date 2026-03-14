-- Disparo contínuo: um registro por usuário (instance + keywords + ativo + próximo índice)
CREATE TABLE IF NOT EXISTS grupos_venda_continuo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES evolution_instances(id) ON DELETE CASCADE,
  keywords jsonb NOT NULL DEFAULT '[]',
  sub_id_1 text NOT NULL DEFAULT '',
  sub_id_2 text NOT NULL DEFAULT '',
  sub_id_3 text NOT NULL DEFAULT '',
  ativo boolean NOT NULL DEFAULT false,
  proximo_indice integer NOT NULL DEFAULT 0,
  ultimo_disparo_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_grupos_venda_continuo_ativo ON grupos_venda_continuo(ativo) WHERE ativo = true;

ALTER TABLE grupos_venda_continuo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grupos_venda_continuo_select_own" ON grupos_venda_continuo;
CREATE POLICY "grupos_venda_continuo_select_own"
  ON grupos_venda_continuo FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "grupos_venda_continuo_insert_own" ON grupos_venda_continuo;
CREATE POLICY "grupos_venda_continuo_insert_own"
  ON grupos_venda_continuo FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "grupos_venda_continuo_update_own" ON grupos_venda_continuo;
CREATE POLICY "grupos_venda_continuo_update_own"
  ON grupos_venda_continuo FOR UPDATE
  USING (auth.uid() = user_id);
