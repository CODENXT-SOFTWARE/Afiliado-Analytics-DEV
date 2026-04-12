-- Estilos opcionais da secção promocional (cards estilo VIP Rosa / Em branco).
alter table public.capture_sites
  add column if not exists promo_rosa_ui jsonb;

comment on column public.capture_sites.promo_rosa_ui is
  'Overrides visuais opcionais: cores, tamanhos de fonte da secção promocional (rosa / em branco).';
