-- ====================================================================
-- Migration: plan_tier, checkout_url, video_export_usage
-- SEGURO para rodar em produção — tudo usa IF NOT EXISTS / IF EXISTS.
-- ====================================================================

-- 1) plan_tier em profiles (default = 'padrao' para migrar todos os existentes)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'padrao';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_tier_check
  CHECK (plan_tier = ANY (ARRAY['legacy'::text, 'padrao'::text, 'pro'::text, 'staff'::text]));

-- 2) checkout_url em subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS checkout_url text;

-- 3) Tabela de controle de exports de vídeo por dia
CREATE TABLE IF NOT EXISTS public.video_export_usage (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  export_day  date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Índice para consulta rápida: quantos exports o user fez hoje
CREATE INDEX IF NOT EXISTS idx_video_export_usage_user_day
  ON public.video_export_usage (user_id, export_day);

-- RLS
ALTER TABLE public.video_export_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own exports" ON public.video_export_usage;
CREATE POLICY "Users can view own exports"
  ON public.video_export_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own exports" ON public.video_export_usage;
CREATE POLICY "Users can insert own exports"
  ON public.video_export_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);
