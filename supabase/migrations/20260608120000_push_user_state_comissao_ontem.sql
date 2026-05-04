-- Adiciona colunas pro novo fluxo do push "Comissão total".
--
-- Antes: o valor enviado vinha de `comissao_total`, populada pelo client
-- (dashboard) com o range filtrado pelo usuário — frequentemente "últimos
-- 6/7 dias" em vez do dia anterior. Quem não abria o app não recebia
-- número correto.
--
-- Agora: um cron server-side às 09:30 BRT chama a Shopee e grava o valor
-- de "ontem em BRT" em `comissao_ontem` (+ `comissao_ontem_data` para
-- referência/diagnóstico). Outro cron às 08:00 BRT zera ambas para evitar
-- que dado stale do dia anterior seja enviado caso a coleta falhe.
--
-- IMPORTANTE: a coluna antiga `comissao_total` permanece intocada durante
-- a transição. Permite rollback rápido (basta o cron das 10:30 voltar a
-- ler `comissao_total`) sem nova migration.

ALTER TABLE public.push_user_state
  ADD COLUMN IF NOT EXISTS comissao_ontem NUMERIC(14, 2);

ALTER TABLE public.push_user_state
  ADD COLUMN IF NOT EXISTS comissao_ontem_data DATE;

COMMENT ON COLUMN public.push_user_state.comissao_ontem IS
  'Comissão líquida total do dia anterior (BRT) coletada server-side via API Shopee. Usada pelo cron de push das 10:30 BRT.';

COMMENT ON COLUMN public.push_user_state.comissao_ontem_data IS
  'Data (BRT) a que `comissao_ontem` se refere. Usada para confirmar que o dado é do dia certo antes de enviar push.';
