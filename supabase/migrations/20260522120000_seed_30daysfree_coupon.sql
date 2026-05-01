-- ====================================================================
-- Seed: cupom de trial 30DAYSFREE (30 dias)
--
-- Idempotente: ON CONFLICT não altera cupom já existente.
-- ====================================================================

INSERT INTO public.trial_coupons (code, duration_days, is_active, max_uses, uses_count)
VALUES ('30DAYSFREE', 30, true, 99999, 0)
ON CONFLICT (code) DO NOTHING;
