-- Template visual da página pública (classic = card atual; vip_* = layouts longform).
ALTER TABLE public.capture_sites
  ADD COLUMN IF NOT EXISTS page_template text NOT NULL DEFAULT 'classic';

ALTER TABLE public.capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_page_template_check;

ALTER TABLE public.capture_sites
  ADD CONSTRAINT capture_sites_page_template_check
  CHECK (page_template IN ('classic', 'vip_rosa', 'vip_terroso'));
