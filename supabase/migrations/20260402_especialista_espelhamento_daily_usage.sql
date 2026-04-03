-- Contagens diárias usadas em getUsageSnapshot (plan-server) /api/me/entitlements
-- Colunas alinhadas a .eq("generated_at"|"espelhado_at", utcTodayYmd()) — string YYYY-MM-DD compatível com tipo date

CREATE TABLE IF NOT EXISTS public.especialistagenerate_usage (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at date NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_especialistagenerate_usage_user_day
  ON public.especialistagenerate_usage (user_id, generated_at);

ALTER TABLE public.especialistagenerate_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "especialistagenerate_usage_select_own" ON public.especialistagenerate_usage;
CREATE POLICY "especialistagenerate_usage_select_own"
  ON public.especialistagenerate_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "especialistagenerate_usage_insert_own" ON public.especialistagenerate_usage;
CREATE POLICY "especialistagenerate_usage_insert_own"
  ON public.especialistagenerate_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.espelhamentogrupos_usage (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  espelhado_at  date NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_espelhamentogrupos_usage_user_day
  ON public.espelhamentogrupos_usage (user_id, espelhado_at);

ALTER TABLE public.espelhamentogrupos_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "espelhamentogrupos_usage_select_own" ON public.espelhamentogrupos_usage;
CREATE POLICY "espelhamentogrupos_usage_select_own"
  ON public.espelhamentogrupos_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "espelhamentogrupos_usage_insert_own" ON public.espelhamentogrupos_usage;
CREATE POLICY "espelhamentogrupos_usage_insert_own"
  ON public.espelhamentogrupos_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
