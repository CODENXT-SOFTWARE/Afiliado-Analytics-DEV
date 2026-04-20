-- Gatilhos de venda e customização do botão Pagar no checkout InfoP.
-- Configurações globais por afiliado — aplicadas em todos os produtos dele.

ALTER TABLE public.profiles
  -- Botão Pagar
  ADD COLUMN IF NOT EXISTS checkout_pay_button_color       text NOT NULL DEFAULT '#635bff',
  ADD COLUMN IF NOT EXISTS checkout_pay_button_light_sweep boolean NOT NULL DEFAULT false,

  -- Gatilho 1 — Notificações de compra ("Maria de SP acabou de comprar")
  ADD COLUMN IF NOT EXISTS checkout_trigger_sale_notifications boolean NOT NULL DEFAULT false,

  -- Gatilho 2 — Cronômetro regressivo no topo
  ADD COLUMN IF NOT EXISTS checkout_trigger_countdown          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_countdown_minutes          integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS checkout_countdown_message          text    NOT NULL DEFAULT 'Não feche esta página!',
  ADD COLUMN IF NOT EXISTS checkout_countdown_expired_message  text    NOT NULL DEFAULT 'Última chance — compre agora!',

  -- Gatilho 3 — Estoque diminuindo
  ADD COLUMN IF NOT EXISTS checkout_trigger_stock  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_stock_initial  integer NOT NULL DEFAULT 12,

  -- Gatilho 4 — Visualizadores em tempo real
  ADD COLUMN IF NOT EXISTS checkout_trigger_viewers boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_viewers_min     integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS checkout_viewers_max     integer NOT NULL DEFAULT 200,

  -- Gatilho 5 — Selo de garantia abaixo do botão Pagar
  ADD COLUMN IF NOT EXISTS checkout_trigger_guarantee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkout_guarantee_text    text    NOT NULL DEFAULT 'Garantia de 7 dias. Se não gostar, devolvemos seu dinheiro.';

-- Sanidade numérica: limita os ranges pra não virar bagunça.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_checkout_countdown_minutes_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_checkout_countdown_minutes_check
  CHECK (checkout_countdown_minutes BETWEEN 1 AND 180);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_checkout_stock_initial_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_checkout_stock_initial_check
  CHECK (checkout_stock_initial BETWEEN 1 AND 9999);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_checkout_viewers_range_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_checkout_viewers_range_check
  CHECK (
    checkout_viewers_min BETWEEN 1 AND 9999
    AND checkout_viewers_max BETWEEN 1 AND 9999
    AND checkout_viewers_min <= checkout_viewers_max
  );
