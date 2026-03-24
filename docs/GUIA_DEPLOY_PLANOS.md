# Guia de Deploy - Sistema de Planos (Padrão / Pro)

Este guia explica passo a passo como subir o sistema de planos em produção **sem derrubar nenhum acesso existente**.

---

## Resumo do que foi feito

| O que | Onde |
|-------|------|
| Coluna `plan_tier` em profiles (default `padrao`) | Migration SQL |
| Coluna `checkout_url` em subscriptions | Migration SQL |
| Tabela `video_export_usage` (controle diário) | Migration SQL |
| Catálogo de checkout links / plan IDs | `src/lib/kiwify-plan-catalog.ts` |
| Webhook atualizado (resolve tier, salva checkout_url) | `src/app/api/kiwify-webhooks/route.ts` |
| Limites por plano (entitlements) | `src/lib/plan-entitlements.ts` |
| Helpers de servidor | `src/lib/plan-server.ts` |
| Guards de API (ATI, Meta, Vídeo, Evolution, etc.) | Várias rotas em `src/app/api/` |
| Frontend: sidebar com cadeado, gating de páginas Pro | Layout + ProFeatureGate |
| API para o frontend consultar plano | `/api/me/entitlements` |

---

## Passo 1: Rodar a Migration SQL no Supabase

> **IMPORTANTE**: Este passo deve ser feito ANTES de fazer o deploy do código na Vercel.

1. Abra o **Supabase Dashboard** do seu projeto
2. Vá em **SQL Editor** (menu lateral esquerdo)
3. Clique em **New Query**
4. Copie e cole **TODO** o conteúdo do arquivo:
   ```
   supabase/migrations/20250317_plan_tier_checkout_url_video_usage.sql
   ```
5. Clique em **Run** (botão verde no canto superior direito)
6. Aguarde aparecer **"Success. No rows returned"** — isso é normal, são comandos DDL

### O que essa migration faz:

- Adiciona a coluna `plan_tier` na tabela `profiles` com valor padrão `'padrao'`
  - **Todos os 130 usuários existentes receberão automaticamente `plan_tier = 'padrao'`**
  - Nenhum acesso será perdido
- Adiciona a coluna `checkout_url` na tabela `subscriptions`
- Cria a tabela `video_export_usage` para controlar o limite diário de exports de vídeo
- Configura RLS (segurança) na nova tabela

### Como verificar se deu certo:

1. Vá em **Table Editor** no Supabase
2. Abra a tabela `profiles`
3. Verifique que apareceu a coluna `plan_tier` e todos os registros mostram `padrao`
4. Abra a tabela `subscriptions`
5. Verifique que apareceu a coluna `checkout_url` (estará vazia nos registros antigos, e isso é normal)
6. Verifique que a tabela `video_export_usage` foi criada (estará vazia)

---

## Passo 2: Configurar Variáveis de Ambiente (Opcional)

Se no futuro você criar novos planos na Kiwify com IDs diferentes, pode configurar estas variáveis de ambiente na Vercel:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `KIWIFY_PRO_PLAN_IDS` | IDs de planos Kiwify que são Pro (separados por vírgula) | `uuid1,uuid2` |
| `KIWIFY_PADRAO_PLAN_IDS` | IDs de planos Kiwify que são Padrão (separados por vírgula) | `uuid3,uuid4` |

> **Para o momento atual, NÃO é obrigatório configurar estas variáveis.** O sistema já reconhece os checkout links dos novos planos que você forneceu:

**Checkout links já cadastrados no código:**

| Plano | Checkout Link | Tier |
|-------|--------------|------|
| Padrão Mensal (Principal) | `Q1eE7t8` | padrao |
| Padrão Trimestral (Principal) | `jGMeK6e` | padrao |
| Pro Mensal (Principal) | `4fAAtkD` | pro |
| Pro Trimestral (Principal) | `TndnsLB` | pro |
| Padrão Mensal (Secundário) | `M2qUkd9` | padrao |
| Padrão Trimestral (Secundário) | `HijcSN1` | padrao |
| Pro Mensal (Secundário) | `0mRaPls` | pro |
| Pro Trimestral (Secundário) | `xaX0Ryx` | pro |

Além disso, todos os IDs de planos/produtos antigos (legados) são automaticamente tratados como `padrao`.

---

## Passo 3: Fazer o Deploy na Vercel

1. Faça commit das alterações:
   ```
   git add .
   git commit -m "feat: sistema de planos Padrao/Pro com limites e gates"
   ```
2. Faça push para o repositório:
   ```
   git push
   ```
3. A Vercel fará o deploy automaticamente
4. Aguarde o deploy terminar (normalmente 2-3 minutos)

---

## Passo 4: Testar

### Teste rápido (usuário existente - Plano Padrão):

1. Faça login com um usuário existente
2. Na sidebar, os itens **ATI**, **Criar Campanha Meta** e **Gerador de Criativos** devem aparecer com um cadeado
3. Ao clicar neles, deve aparecer uma mensagem "Recurso exclusivo do Plano Pro"
4. Na **Calculadora GPL**, os cards de resumo e o painel de grupos/campanhas devem mostrar "disponível no Plano Pro"
5. Em **Site de Captura**, o usuário deve poder criar apenas 1 site
6. Em **Integração WhatsApp**, o usuário deve poder conectar apenas 1 instância
7. Em **Grupos de Venda**, o usuário deve poder ter apenas 1 campanha ativa, 1 lista e 1 grupo

### Teste com novo checkout (Plano Pro):

1. Faça uma compra de teste usando o checkout Pro Mensal
2. O webhook da Kiwify enviará o `checkout_link` = `4fAAtkD`
3. O sistema vai reconhecer como `pro` e definir o `plan_tier` do profile como `pro`
4. O usuário terá acesso completo a ATI, Meta Ads, Gerador de Criativos, etc.

---

## Passo 5: Promover um usuário existente para Pro (manual)

Se precisar promover um usuário existente para Pro manualmente (por exemplo, para testar):

1. Abra o **Supabase Dashboard**
2. Vá em **SQL Editor**
3. Execute:
   ```sql
   UPDATE public.profiles
   SET plan_tier = 'pro'
   WHERE email = 'email-do-usuario@exemplo.com';
   ```
4. O usuário verá as mudanças ao recarregar a página

Para voltar ao Padrão:
```sql
UPDATE public.profiles
SET plan_tier = 'padrao'
WHERE email = 'email-do-usuario@exemplo.com';
```

---

## Perguntas Frequentes

### Os usuários existentes vão perder o acesso?
**NÃO.** A migration define `plan_tier = 'padrao'` como padrão, então todos os 130 usuários receberão automaticamente o Plano Padrão sem nenhuma interrupção.

### O que acontece se alguém comprar pelo checkout antigo?
O sistema reconhece todos os IDs de planos/produtos antigos como `padrao`. Nenhum acesso será perdido.

### O que acontece se o webhook da Kiwify não enviar o `checkout_link`?
O sistema faz fallback para os IDs do plano (`plan_id`) e do produto (`product_id`). Se nenhum for reconhecido, o default é `padrao`.

### Preciso alterar algo na Kiwify?
**NÃO.** Os webhooks já enviam o campo `checkout_link` automaticamente. O sistema agora lê esse campo para determinar o plano.

### Posso adicionar novos checkouts no futuro?
Sim! Basta editar o arquivo `src/lib/kiwify-plan-catalog.ts` e adicionar os novos checkout links nos arrays correspondentes.

### E se eu usar checkout de afiliado (link do coprodutor/afiliado) e o cliente comprar por esse link?
**Na prática, costuma funcionar normalmente.** O webhook da Kiwify continua sendo o seu (do produtor), com o mesmo **produto** e, na maioria dos casos, o mesmo **plano** (`Subscription.plan.id` e `Product.product_id`).

O que pode mudar é só o campo **`checkout_link`**: às vezes vem um código **diferente** do link “oficial” que está na nossa lista (ex.: `Q1eE7t8`). Quando esse código **não** está cadastrado no código, o app **ignora** o checkout desconhecido e usa o **fallback**:

1. `plan_id` (se estiver em `KIWIFY_PRO_PLAN_IDS` / `KIWIFY_PADRAO_PLAN_IDS` ou na lista legada)  
2. `product_id` (lista legada → tratado como Padrão)  
3. Se nada bater → **Padrão** (`padrao`)

**O que fazer se um plano Pro vendido por afiliado cair como Padrão?**  
- Confira no payload do webhook (ou no painel Kiwify) o **`plan.id`** da assinatura.  
- Coloque esse UUID em `KIWIFY_PRO_PLAN_IDS` na Vercel **ou** adicione o `checkout_link` que o webhook envia na lista **Pro** em `kiwify-plan-catalog.ts`.

### E se eu quiser mudar os limites de um plano?
Edite o arquivo `src/lib/plan-entitlements.ts`. Os limites estão claramente definidos nos objetos `PADRAO_LIMITS` e `PRO_LIMITS`.

### Como adicionar um plano customizado (ex.: Enterprise) onde **eu** decido os acessos?

Hoje o app só conhece três tiers: `legacy`, `padrao` e `pro`. Para um plano “Enterprise” ou totalmente sob medida, existem **dois caminhos**:

---

#### Opção A — Novo tier fixo no código (todos os Enterprise iguais)

Use quando **todos** os clientes Enterprise tiverem **as mesmas regras** (ex.: “Pro + 10 sites de captura”).

1. **Supabase** — incluir o novo valor no `CHECK` da coluna `plan_tier`:
   ```sql
   ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
   ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_tier_check
     CHECK (plan_tier = ANY (ARRAY['legacy','padrao','pro','enterprise'::text]));
   ```
2. **Código** — em `src/lib/plan-entitlements.ts`:
   - Amplie o tipo: `export type PlanTier = "legacy" | "padrao" | "pro" | "enterprise";`
   - Crie `ENTERPRISE_LIMITS` (cópia de `PRO_LIMITS` ou os números que quiser).
   - Adicione em `LIMITS` e em `getEntitlementsForTier()` o caso `enterprise`.
3. **Hierarquia com outros planos** — em `src/lib/kiwify-plan-catalog.ts`, função `bestPlanTier`, defina a ordem (ex.: `enterprise` acima de `pro` se quiser que assinatura Enterprise vença Pro).
4. **Kiwify** — se Enterprise for vendido por checkout, cadastre o `checkout_link` e/ou `plan_id` em `kiwify-plan-catalog.ts` (ou env vars) mapeando para `enterprise`.
5. **Clientes “só manual”** — não precisa Kiwify: no Supabase, `UPDATE profiles SET plan_tier = 'enterprise' WHERE email = '...';`

---

#### Opção B — Acessos diferentes por cliente (sob medida)

Use quando **cada** Enterprise tiver limites ou flags **diferentes** (um com ATI, outro sem, outro com 20 exports/dia).

O modelo atual **não** guarda isso no banco; só o `plan_tier` inteiro. Para “eu decido por usuário”, o desenho usual é:

1. **Nova coluna** em `profiles`, por exemplo `plan_entitlements_override jsonb` (nullable).
2. Quando essa coluna **não** for `null`, o backend **mescla** esse JSON com o resultado de `getEntitlementsForTier(plan_tier)` (campos omitidos usam o tier; campos presentes sobrescrevem).
3. O webhook da Kiwify **não** apaga esse JSON (só atualiza `plan_tier` a partir da assinatura), ou você marca clientes Enterprise com um tier fixo (`enterprise`) e o JSON só ajusta detalhes.

Isso exige alterar `getEntitlementsForUser` em `plan-server.ts` e o endpoint `/api/me/entitlements` para ler o override. Se quiser esse caminho no código, peça para implementar no repositório.

---

**Resumo:**  
- **Mesmas regras para todos os Enterprise** → Opção A (novo tier + migration do `CHECK`).  
- **Regra diferente por conta** → Opção B (override em JSON no `profiles` + lógica de merge no servidor).

---

## Limites por Plano (Referência Rápida)

| Recurso | Padrão | Pro |
|---------|--------|-----|
| Análise de Comissões | Ativo | Ativo |
| Análise de Cliques | Ativo | Ativo |
| Meus Links | Ativo | Ativo |
| Sites de Captura | 1 | 5 |
| Calculadora GPL | Ativo (sem resumo/grupos) | Ativo completo |
| Gerador Links Shopee | Ativo | Ativo |
| Grupos de Venda - Campanhas ativas | 1 | 10 |
| Grupos de Venda - Listas | 1 | Ilimitado |
| Grupos de Venda - Grupos total | 1 | 10 |
| Instâncias WhatsApp | 1 | 2 |
| Tráfego Inteligente (ATI) | Inativo | Ativo |
| Criar Campanha Meta | Inativo | Ativo |
| Gerador de Criativos | Inativo | Ativo |
| Exports de vídeo por dia | — | 2 |

---

## Ordem de Execução (Checklist)

- [ ] 1. Rodar a migration SQL no Supabase (Passo 1)
- [ ] 2. Verificar se as colunas/tabela foram criadas (Passo 1 - verificação)
- [ ] 3. (Opcional) Configurar variáveis de ambiente na Vercel (Passo 2)
- [ ] 4. Fazer commit e push (Passo 3)
- [ ] 5. Aguardar deploy da Vercel
- [ ] 6. Testar com usuário existente (Passo 4)
- [ ] 7. Testar novo checkout se possível (Passo 4)

**PRONTO!** O sistema de planos está funcionando.
