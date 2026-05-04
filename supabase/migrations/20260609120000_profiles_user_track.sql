-- Adiciona coluna `user_track` em `profiles` para identificar a origem
-- do cadastro. Populada apenas quando o usuário chega via uma página
-- de "vendedora" (ex.: /track_vendors/yvi/?track=yvi). Cadastro normal
-- pela home padrão deixa o campo NULL.
--
-- Fluxo:
--   1. Usuário acessa /track_vendors/<vendor>/?track=<nome>
--   2. Client seta cookie `signup_track=<nome>` (TTL 30 dias).
--   3. No POST /api/auth/signup-trial, lemos o cookie e gravamos aqui.
--
-- Tipo TEXT (sem enum) porque o conjunto de vendors muda com frequência
-- — fazer enum exigiria migration cada vez que entra/sai vendedor.
-- Validação de formato é feita server-side (regex `^[a-zA-Z0-9_-]{1,40}$`).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_track TEXT;

COMMENT ON COLUMN public.profiles.user_track IS
  'Nome do vendor/origem do cadastro (ex.: "yvi", "brenda"). NULL = cadastro veio da home padrão. Populado a partir do cookie `signup_track` no momento do POST /api/auth/signup-trial.';

-- Índice parcial: só indexa quando preenchido. Otimiza relatórios do tipo
-- "quantos cadastros vieram da Yvi" sem custar nada para os NULL (maioria).
CREATE INDEX IF NOT EXISTS idx_profiles_user_track
  ON public.profiles (user_track)
  WHERE user_track IS NOT NULL;
