-- PATCH: corrige o FK lista_id de telegram_grupos_venda.
-- Original: ON DELETE CASCADE → apagaria grupos descobertos quando a lista fosse deletada.
-- Correto:  ON DELETE SET NULL → mantém os grupos (vieram do webhook), apenas desvincula da lista.
--
-- Postgres autogenera nome do FK como <table>_<col>_fkey por padrão.
-- Se o nome divergir no seu banco, ajuste a primeira linha.

ALTER TABLE telegram_grupos_venda
  DROP CONSTRAINT IF EXISTS telegram_grupos_venda_lista_id_fkey;

ALTER TABLE telegram_grupos_venda
  ADD CONSTRAINT telegram_grupos_venda_lista_id_fkey
  FOREIGN KEY (lista_id)
  REFERENCES telegram_listas_grupos_venda(id)
  ON DELETE SET NULL;
