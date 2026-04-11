-- Secções promocionais (benefícios, depoimentos, etc.): visibilidade e títulos editáveis no dashboard.
alter table public.capture_sites
  add column if not exists promo_sections_enabled boolean not null default true;

alter table public.capture_sites
  add column if not exists promo_section_titles jsonb not null default '{}'::jsonb;

comment on column public.capture_sites.promo_sections_enabled is
  'Quando false, esconde blocos de benefícios/prova social nos templates VIP que suportam.';
comment on column public.capture_sites.promo_section_titles is
  'Títulos opcionais: { "benefits", "testimonials", "in_group" } (strings).';
