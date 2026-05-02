-- ====================================================================
-- Seed: cupom de trial 3DAYSFREE
--
-- Trial reduzido pra 3 dias (novo default da home a partir desta data).
-- Idempotente.
-- ====================================================================

INSERT INTO public.trial_coupons (code, duration_days, is_active, max_uses, uses_count)
VALUES ('3DAYSFREE', 3, true, 99999, 0)
ON CONFLICT (code) DO NOTHING;
