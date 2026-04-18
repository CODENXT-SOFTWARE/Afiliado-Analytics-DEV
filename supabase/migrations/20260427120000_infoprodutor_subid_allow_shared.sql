-- Permite que múltiplos produtos Stripe compartilhem o mesmo SubId.
-- O cruzamento em Trackeamento passa a agregar vendas de todos os produtos
-- vinculados ao mesmo subId (ex.: variações/upsells no mesmo bucket).

DROP INDEX IF EXISTS produtos_infoprodutor_user_subid_uk;

-- Mantém um índice não-único pra acelerar as consultas por subid.
CREATE INDEX IF NOT EXISTS produtos_infoprodutor_user_subid_idx
  ON public.produtos_infoprodutor (user_id, stripe_subid)
  WHERE stripe_subid IS NOT NULL;
