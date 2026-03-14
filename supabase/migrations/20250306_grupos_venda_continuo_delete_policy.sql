-- Permite o usuário deletar seus próprios registros de disparo contínuo
DROP POLICY IF EXISTS "grupos_venda_continuo_delete_own" ON grupos_venda_continuo;
CREATE POLICY "grupos_venda_continuo_delete_own"
  ON grupos_venda_continuo FOR DELETE
  USING (auth.uid() = user_id);
