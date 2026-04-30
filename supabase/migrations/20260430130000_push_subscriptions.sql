-- ── Web Push Notifications ──────────────────────────────────────────────────
-- Persistência das subscrições do PushManager (uma por dispositivo/origem) e
-- do estado leve necessário para os crons montarem mensagens personalizadas
-- (ex.: "Comissão total: R$ X" às 08:10 BRT).
--
-- A entrega é feita pelos endpoints `/api/cron/push?slug=...` (cron Vercel) e
-- pelo webhook do Mercado Pago (`/api/webhooks/mercadopago`) — em ambos os
-- casos com o service role, fora do RLS.

-- 1) Subscrições: cada dispositivo (browser/PWA) gera um endpoint único.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON public.push_subscriptions (user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- O usuário consegue ver/remover suas próprias subscrições. Inserções vêm da
-- API (`/api/push/subscribe`) que valida o usuário antes de gravar; mantemos
-- a policy de INSERT também restrita ao próprio user_id por segurança.
DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own
  ON public.push_subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_insert_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_insert_own
  ON public.push_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own
  ON public.push_subscriptions
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 2) Estado leve para personalizar pushes (uma linha por usuário). A comissão
-- total mostrada no dashboard é calculada client-side a partir do CSV/IDB —
-- sincronizamos o último valor calculado aqui pra que o cron das 08:10 BRT
-- consiga referenciá-lo. Sem dado, o cron envia uma mensagem genérica de
-- fallback ("Acompanhe seu desempenho 📊").
CREATE TABLE IF NOT EXISTS public.push_user_state (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  comissao_total    NUMERIC(14, 2),
  comissao_period   TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.push_user_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS push_user_state_select_own ON public.push_user_state;
CREATE POLICY push_user_state_select_own
  ON public.push_user_state
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS push_user_state_insert_own ON public.push_user_state;
CREATE POLICY push_user_state_insert_own
  ON public.push_user_state
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS push_user_state_update_own ON public.push_user_state;
CREATE POLICY push_user_state_update_own
  ON public.push_user_state
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
