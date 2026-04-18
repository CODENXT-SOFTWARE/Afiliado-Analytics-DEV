-- Cruzamento ATI × Produtos Stripe via SubId (feature InfoP).
--   * Cada produto Stripe ganha um `stripe_subid` (ex: "whey-protein") único por usuário.
--   * Cada ad do Meta pode ter um SubId InfoP em `ati_ad_infop_sub` (espelho do
--     `ati_ad_shopee_sub`, não mexemos na Shopee).
--   * O cruzamento na tela de Trackeamento faz match entre o subId do ad e o
--     stripe_subid do produto → soma receita Stripe por ad.

-- ── SubId no produto Stripe ─────────────────────────────────────────────────────
ALTER TABLE public.produtos_infoprodutor
  ADD COLUMN IF NOT EXISTS stripe_subid text;

-- Unique por usuário (ignora NULL — produtos antigos sem subId continuam válidos)
CREATE UNIQUE INDEX IF NOT EXISTS produtos_infoprodutor_user_subid_uk
  ON public.produtos_infoprodutor (user_id, stripe_subid)
  WHERE stripe_subid IS NOT NULL;

-- ── Mapeamento ad → SubId InfoP (espelho de ati_ad_shopee_sub) ──────────────────
CREATE TABLE IF NOT EXISTS public.ati_ad_infop_sub (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_id       text NOT NULL,
  infop_sub_id text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_id),
  UNIQUE (user_id, infop_sub_id)
);

CREATE INDEX IF NOT EXISTS idx_ati_ad_infop_sub_user ON public.ati_ad_infop_sub(user_id);

ALTER TABLE public.ati_ad_infop_sub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ati_ad_infop_sub_select" ON public.ati_ad_infop_sub;
CREATE POLICY "ati_ad_infop_sub_select" ON public.ati_ad_infop_sub
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ati_ad_infop_sub_insert" ON public.ati_ad_infop_sub;
CREATE POLICY "ati_ad_infop_sub_insert" ON public.ati_ad_infop_sub
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "ati_ad_infop_sub_update" ON public.ati_ad_infop_sub;
CREATE POLICY "ati_ad_infop_sub_update" ON public.ati_ad_infop_sub
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ati_ad_infop_sub_delete" ON public.ati_ad_infop_sub;
CREATE POLICY "ati_ad_infop_sub_delete" ON public.ati_ad_infop_sub
  FOR DELETE USING (auth.uid() = user_id);
