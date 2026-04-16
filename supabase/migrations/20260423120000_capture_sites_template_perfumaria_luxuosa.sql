-- Template de captura "Perfumaria luxuosa" (beleza / luxo escuro).
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
    'market_master',
    'perfumaria_luxuosa',
    'em_branco'
  ));
