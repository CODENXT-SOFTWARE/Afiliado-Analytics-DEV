-- Carrossel opcional de ofertas (imagens no Storage + posição na página).
-- `ofert_carousel_image_paths` é um JSON array de até 4 strings (caminhos no bucket) ou null por índice (slots 0–3).

ALTER TABLE public.capture_sites
  ADD COLUMN IF NOT EXISTS ofert_carousel_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.capture_sites
  ADD COLUMN IF NOT EXISTS ofert_carousel_position text NOT NULL DEFAULT 'below_title';

ALTER TABLE public.capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_ofert_carousel_position_check;

ALTER TABLE public.capture_sites
  ADD CONSTRAINT capture_sites_ofert_carousel_position_check
  CHECK (ofert_carousel_position IN ('below_title', 'above_cta', 'below_cta'));

ALTER TABLE public.capture_sites
  ADD COLUMN IF NOT EXISTS ofert_carousel_image_paths jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_ofert_carousel_paths_len_check;

ALTER TABLE public.capture_sites
  ADD CONSTRAINT capture_sites_ofert_carousel_paths_len_check
  CHECK (jsonb_array_length(ofert_carousel_image_paths) <= 4);
