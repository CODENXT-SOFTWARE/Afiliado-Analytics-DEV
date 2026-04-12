-- Modelo "Em Branco": página totalmente personalizável (tema em JSON).
ALTER TABLE public.capture_sites
  ADD COLUMN IF NOT EXISTS blank_canvas_json jsonb;

COMMENT ON COLUMN public.capture_sites.blank_canvas_json IS
  'Tema da página Em Branco (cores, tipografia, animação, hero, CTA). Null fora deste modelo.';

ALTER TABLE public.capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_page_template_check;

ALTER TABLE public.capture_sites
  ADD CONSTRAINT capture_sites_page_template_check
  CHECK (page_template IN (
    'classic',
    'vip_rosa',
    'vip_terroso',
    'vinho_rose',
    'the_new_chance',
    'aurora_ledger',
    'jardim_floral',
    'em_branco'
  ));
