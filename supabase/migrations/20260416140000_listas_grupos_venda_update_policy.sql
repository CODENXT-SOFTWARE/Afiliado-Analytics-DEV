-- Permitir renomear listas de grupos (Grupos de Venda) via API autenticada
DROP POLICY IF EXISTS "listas_grupos_venda_update_own" ON listas_grupos_venda;
CREATE POLICY "listas_grupos_venda_update_own"
  ON listas_grupos_venda FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
