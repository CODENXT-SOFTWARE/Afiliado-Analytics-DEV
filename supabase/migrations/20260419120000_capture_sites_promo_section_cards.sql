-- Textos dos cards de benefícios / depoimentos por modelo VIP (JSONB: array de objetos).
alter table public.capture_sites
  add column if not exists promo_section_cards jsonb null;

comment on column public.capture_sites.promo_section_cards is
  'Conteúdo dos cards da secção promocional: formato depende de page_template (array de objetos).';
