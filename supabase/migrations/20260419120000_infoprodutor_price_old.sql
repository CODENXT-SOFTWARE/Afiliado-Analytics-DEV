-- Preço antigo opcional (oferta: de X por Y) — Infoprodutor + snapshot nas listas.

ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS price_old numeric(10,2);

ALTER TABLE public.minha_lista_ofertas_info
  ADD COLUMN IF NOT EXISTS price_old numeric(10,2);
