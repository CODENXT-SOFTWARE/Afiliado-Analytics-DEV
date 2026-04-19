-- Tamanho da imagem de rodapé do checkout: "full" | "medium" | "small".
-- Aplica só em desktop (largura >= md). No mobile sempre ocupa 100% pra não parecer sumida.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS checkout_footer_image_size text DEFAULT 'full';
