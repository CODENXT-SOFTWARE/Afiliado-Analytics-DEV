-- Listas nomeadas de grupos (como na Calculadora GPL): cada lista tem nome e contém N grupos
CREATE TABLE IF NOT EXISTS listas_grupos_venda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES evolution_instances(id) ON DELETE CASCADE,
  nome_lista text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_grupos_venda_user ON listas_grupos_venda(user_id);
CREATE INDEX IF NOT EXISTS idx_listas_grupos_venda_instance ON listas_grupos_venda(instance_id);

ALTER TABLE listas_grupos_venda ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "listas_grupos_venda_select_own" ON listas_grupos_venda;
CREATE POLICY "listas_grupos_venda_select_own" ON listas_grupos_venda FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_grupos_venda_insert_own" ON listas_grupos_venda;
CREATE POLICY "listas_grupos_venda_insert_own" ON listas_grupos_venda FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "listas_grupos_venda_delete_own" ON listas_grupos_venda;
CREATE POLICY "listas_grupos_venda_delete_own" ON listas_grupos_venda FOR DELETE USING (auth.uid() = user_id);

-- Grupos passam a pertencer a uma lista (lista_id nullable para compatibilidade)
ALTER TABLE grupos_venda ADD COLUMN IF NOT EXISTS lista_id uuid REFERENCES listas_grupos_venda(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_grupos_venda_lista ON grupos_venda(lista_id);
-- Permite o mesmo grupo em listas diferentes; evita duplicata na mesma lista
ALTER TABLE grupos_venda DROP CONSTRAINT IF EXISTS grupos_venda_user_id_instance_id_group_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupos_venda_lista_group ON grupos_venda(lista_id, group_id) WHERE lista_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_grupos_venda_legacy ON grupos_venda(user_id, instance_id, group_id) WHERE lista_id IS NULL;

-- Disparo contínuo: múltiplos por usuário, cada um ligado a uma lista
ALTER TABLE grupos_venda_continuo ADD COLUMN IF NOT EXISTS lista_id uuid REFERENCES listas_grupos_venda(id) ON DELETE CASCADE;
-- Remover apenas a constraint UNIQUE(user_id); o índice é removido junto
ALTER TABLE grupos_venda_continuo DROP CONSTRAINT IF EXISTS grupos_venda_continuo_user_id_key;
CREATE INDEX IF NOT EXISTS idx_grupos_venda_continuo_lista ON grupos_venda_continuo(lista_id);
