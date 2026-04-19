-- Personalização do checkout público por afiliado.
-- - checkout_theme_mode: "dark" | "light" (default "dark")
-- - checkout_header_image_url: imagem de banner mostrada no topo do /checkout/[slug]
--   (tipo propaganda). Upload vai pro bucket infoprodutor-images existente.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_theme_mode text DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS checkout_header_image_url text;
