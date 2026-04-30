# Notificações Push (Web Push) — Setup

Este guia explica como ativar as notificações push do PWA do Afiliado
Analytics em produção. O fluxo já está implementado:

- Service worker em `public/sw.js` recebe os pushes e mostra a notificação.
- Subscrições do PushManager ficam em `public.push_subscriptions`.
- Estado leve (comissão total mais recente do dashboard) fica em
  `public.push_user_state`.
- Crons agendados (em horário de Brasília) disparam mensagens em massa via
  `/api/cron/push?slug=...`.
- O webhook do Mercado Pago dispara um push em tempo real para o vendedor a
  cada nova venda aprovada.

## 1) Aplicar a migration no Supabase

Rode a migration nova em produção (ou no banco de dev):

```sql
-- arquivo: supabase/migrations/20260430130000_push_subscriptions.sql
```

Cria as tabelas `push_subscriptions` e `push_user_state` com RLS.

## 2) Gerar e configurar as chaves VAPID

As chaves identificam o servidor publisher na rede de push dos navegadores.
Gere localmente (uma vez) e adicione nas Environment Variables da Vercel
(Production + Preview):

```bash
npx web-push generate-vapid-keys --json
```

Variáveis a configurar:

| Nome                   | Onde                | Valor                                  |
| ---------------------- | ------------------- | -------------------------------------- |
| `VAPID_PUBLIC_KEY`     | Server (todas envs) | `publicKey` retornado pelo comando     |
| `VAPID_PRIVATE_KEY`    | Server (todas envs) | `privateKey` retornado pelo comando    |
| `VAPID_SUBJECT`        | Server (opcional)   | `mailto:contato@afiliadoanalytics.com.br` |
| `CRON_SECRET`          | Server (já existe)  | usado pelos crons da Vercel            |

> Importante: a chave PRIVADA NUNCA pode aparecer no client. O endpoint
> `/api/push/vapid-public-key` expõe apenas a pública.

## 3) Cron Vercel (já no `vercel.json`)

Os crons rodam em UTC. Os horários abaixo correspondem ao fuso de Brasília
(UTC-3, sem horário de verão):

| BRT   | UTC   | Slug                | Mensagem                              |
| ----- | ----- | ------------------- | ------------------------------------- |
| 08:00 | 11:00 | `bom-dia`           | "Bom dia, Afiliado" + corpo           |
| 08:10 | 11:10 | `comissao-total`    | "Comissão total" + R$ X (por usuário) |
| 08:10 | 11:10 | `relatorio-shopee`  | "Relatório Shopee disponível 📊"      |
| 10:00 | 13:00 | `tendencias-manha`  | "Temos novas tendências"              |
| 12:10 | 15:10 | `bom-almoco`        | "Bom almoço, Afiliado 📊"             |
| 15:00 | 18:00 | `tendencias-tarde`  | "Temos novas tendências"              |
| 18:00 | 21:00 | `campanha-direta`   | "Que tal uma campanha direta?"        |

## 4) Como o usuário ativa

Em qualquer página `(main)/...`, usuários logados que ainda não decidiram
sobre notificações veem um card flutuante "Ativar notificações" no canto
inferior esquerdo. O clique:

1. Pede permissão ao navegador (precisa ser via gesto).
2. Cria uma `PushSubscription` com a chave VAPID pública.
3. Faz `POST /api/push/subscribe` com `{ endpoint, keys }`.

Para usuários que já concederam permissão antes, o `PwaServiceWorker`
chama `ensureSubscribed()` automaticamente após registrar o SW (idempotente).

## 5) Endpoints úteis

| Método | Path                          | O que faz                              |
| ------ | ----------------------------- | -------------------------------------- |
| GET    | `/api/push/vapid-public-key`  | Retorna `VAPID_PUBLIC_KEY`             |
| POST   | `/api/push/subscribe`         | Salva subscription do usuário logado   |
| POST   | `/api/push/unsubscribe`       | Remove (todas ou por endpoint)         |
| POST   | `/api/push/state`             | Atualiza `comissao_total` do usuário   |
| POST   | `/api/push/test`              | Dispara push de teste pro próprio user |
| GET    | `/api/cron/push?slug=...`     | Dispatcher (cron)                      |

Em produção todos os endpoints `/api/cron/...` exigem
`Authorization: Bearer ${CRON_SECRET}` (a Vercel injeta automaticamente).

## 6) Compatibilidade

| Plataforma                      | Suporte                              |
| ------------------------------- | ------------------------------------ |
| Android Chrome / Edge / Samsung | OK (qualquer site PWA-instalável)    |
| Desktop Chrome / Edge / Firefox | OK                                   |
| iOS Safari (16.4+)              | OK, mas o app precisa estar **adicionado à tela inicial** |
| iOS Safari (<16.4)              | Sem Web Push                         |

## 7) Como testar

Depois que o usuário ativar as notificações, o painel do dev pode chamar:

```bash
# (estando logado) via curl com o cookie do Supabase
curl -X POST https://www.afiliadoanalytics.com.br/api/push/test \
  -H "Cookie: <copia da sessão>"
```

Ou, mais simples, abrir o devtools e rodar:

```js
fetch("/api/push/test", { method: "POST" }).then((r) => r.json());
```

Se o ícone do app aparecer na bandeja com "Notificações ativadas 🎉",
está tudo certo. Caso contrário, verifique:

1. `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` setadas (sem espaços extras).
2. Banco com a migration aplicada.
3. `Notification.permission === "granted"` no DevTools.
4. `navigator.serviceWorker.controller` não-nulo.
