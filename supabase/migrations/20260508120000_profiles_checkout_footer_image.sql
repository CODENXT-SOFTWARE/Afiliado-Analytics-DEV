-- Imagem de rodapé do checkout público — aparece abaixo do botão "Pagar".
-- Mesmo bucket da header image (infoprodutor-images), mesmo fluxo de upload.
-- Tipicamente usada para selos de segurança / garantia / propaganda extra.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_footer_image_url text;
