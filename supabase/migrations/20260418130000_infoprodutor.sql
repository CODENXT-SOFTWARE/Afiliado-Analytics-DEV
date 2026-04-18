-- Ferramenta "Infoprodutor": o utilizador cadastra produtos próprios (foto, título,
-- descrição e link de venda) e monta listas que reutiliza na Automação de Grupos,
-- sem depender de API de afiliados ou busca automática.

-- ── Catálogo de produtos do utilizador (editáveis/removíveis) ────────────────────
CREATE TABLE IF NOT EXISTS public.produtos_infoprodutor (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  image_url   text,
  link        text NOT NULL,
  price       numeric(10,2),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produtos_infoprodutor_user
  ON public.produtos_infoprodutor (user_id, created_at DESC);

ALTER TABLE public.produtos_infoprodutor ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS produtos_infoprodutor_select_own ON public.produtos_infoprodutor;
CREATE POLICY produtos_infoprodutor_select_own ON public.produtos_infoprodutor
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS produtos_infoprodutor_insert_own ON public.produtos_infoprodutor;
CREATE POLICY produtos_infoprodutor_insert_own ON public.produtos_infoprodutor
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS produtos_infoprodutor_update_own ON public.produtos_infoprodutor;
CREATE POLICY produtos_infoprodutor_update_own ON public.produtos_infoprodutor
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS produtos_infoprodutor_delete_own ON public.produtos_infoprodutor;
CREATE POLICY produtos_infoprodutor_delete_own ON public.produtos_infoprodutor
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Listas do Infoprodutor ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.listas_ofertas_info (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_listas_ofertas_info_user
  ON public.listas_ofertas_info (user_id, created_at DESC);

ALTER TABLE public.listas_ofertas_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS listas_ofertas_info_select_own ON public.listas_ofertas_info;
CREATE POLICY listas_ofertas_info_select_own ON public.listas_ofertas_info
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS listas_ofertas_info_insert_own ON public.listas_ofertas_info;
CREATE POLICY listas_ofertas_info_insert_own ON public.listas_ofertas_info
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS listas_ofertas_info_update_own ON public.listas_ofertas_info;
CREATE POLICY listas_ofertas_info_update_own ON public.listas_ofertas_info
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS listas_ofertas_info_delete_own ON public.listas_ofertas_info;
CREATE POLICY listas_ofertas_info_delete_own ON public.listas_ofertas_info
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Itens da lista (snapshot denormalizado — mesmo padrão de minha_lista_ofertas_ml) ──
CREATE TABLE IF NOT EXISTS public.minha_lista_ofertas_info (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lista_id     uuid NOT NULL REFERENCES public.listas_ofertas_info(id) ON DELETE CASCADE,
  produto_id   uuid REFERENCES public.produtos_infoprodutor(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  description  text,
  image_url    text,
  link         text NOT NULL,
  price        numeric(10,2),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_info_lista
  ON public.minha_lista_ofertas_info (lista_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_info_user
  ON public.minha_lista_ofertas_info (user_id);
CREATE INDEX IF NOT EXISTS idx_minha_lista_ofertas_info_created
  ON public.minha_lista_ofertas_info (lista_id, created_at DESC);

ALTER TABLE public.minha_lista_ofertas_info ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS minha_lista_ofertas_info_select_own ON public.minha_lista_ofertas_info;
CREATE POLICY minha_lista_ofertas_info_select_own ON public.minha_lista_ofertas_info
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS minha_lista_ofertas_info_insert_own ON public.minha_lista_ofertas_info;
CREATE POLICY minha_lista_ofertas_info_insert_own ON public.minha_lista_ofertas_info
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS minha_lista_ofertas_info_update_own ON public.minha_lista_ofertas_info;
CREATE POLICY minha_lista_ofertas_info_update_own ON public.minha_lista_ofertas_info
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS minha_lista_ofertas_info_delete_own ON public.minha_lista_ofertas_info;
CREATE POLICY minha_lista_ofertas_info_delete_own ON public.minha_lista_ofertas_info
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ── Integração com disparo contínuo ─────────────────────────────────────────────
ALTER TABLE public.grupos_venda_continuo
  ADD COLUMN IF NOT EXISTS lista_ofertas_info_id uuid
    REFERENCES public.listas_ofertas_info(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_grupos_venda_continuo_lista_info
  ON public.grupos_venda_continuo (lista_ofertas_info_id)
  WHERE lista_ofertas_info_id IS NOT NULL;

-- ── Bucket público para imagens dos produtos Infoprodutor ───────────────────────
-- Service role faz upload/delete via endpoint; leitura é pública (links no WhatsApp).
INSERT INTO storage.buckets (id, name, public)
VALUES ('infoprodutor-images', 'infoprodutor-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Infoprodutor images public read" ON storage.objects;
CREATE POLICY "Infoprodutor images public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'infoprodutor-images');
