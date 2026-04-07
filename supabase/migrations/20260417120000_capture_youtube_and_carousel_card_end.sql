-- Posição do YouTube + 4ª opção "fim do card" no carrossel (alinhado ao YouTube).

ALTER TABLE capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_ofert_carousel_position_check;

ALTER TABLE capture_sites
  ADD CONSTRAINT capture_sites_ofert_carousel_position_check
  CHECK (ofert_carousel_position IN ('below_title', 'above_cta', 'below_cta', 'card_end'));

ALTER TABLE capture_sites
  ADD COLUMN IF NOT EXISTS youtube_position text NOT NULL DEFAULT 'above_cta';

ALTER TABLE capture_sites
  DROP CONSTRAINT IF EXISTS capture_sites_youtube_position_check;

ALTER TABLE capture_sites
  ADD CONSTRAINT capture_sites_youtube_position_check
  CHECK (youtube_position IN ('below_title', 'above_cta', 'below_cta', 'card_end'));

-- Layouts onde o vídeo ficava no final do bloco principal (comportamento anterior).
UPDATE capture_sites
SET youtube_position = 'card_end'
WHERE page_template IN ('jardim_floral', 'aurora_ledger');
