-- Policy de UPDATE em ati_campaign_tags.
-- A tabela foi criada em 20250306 sem policy de UPDATE, o que funcionava para
-- fluxos que só faziam INSERT puro. Mas o endpoint /api/ati/campaign-tags usa
-- `supabase.upsert()` com `onConflict` — operação que, no caminho de conflito,
-- vira INSERT ... ON CONFLICT DO UPDATE. Sem policy de UPDATE + RLS ON, o
-- Postgres nega com "new row violates row-level security policy (USING expression)".
--
-- Com tag nova (ex.: "Tráfego para InfoP") em campanha já marcada com outra
-- tag, o caminho problemático era acionado. Adicionar a policy resolve sem
-- tocar em nada da lógica existente.

DROP POLICY IF EXISTS "ati_campaign_tags_update_own" ON public.ati_campaign_tags;
CREATE POLICY "ati_campaign_tags_update_own"
  ON public.ati_campaign_tags
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
