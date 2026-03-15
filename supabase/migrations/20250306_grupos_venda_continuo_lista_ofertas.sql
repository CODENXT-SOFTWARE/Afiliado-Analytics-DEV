-- Disparo 24h por lista de ofertas: usa produtos já salvos (minha_lista_ofertas) em vez de buscar na API por keyword.
ALTER TABLE grupos_venda_continuo
  ADD COLUMN IF NOT EXISTS lista_ofertas_id uuid REFERENCES listas_ofertas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupos_venda_continuo_lista_ofertas
  ON grupos_venda_continuo(lista_ofertas_id) WHERE lista_ofertas_id IS NOT NULL;
