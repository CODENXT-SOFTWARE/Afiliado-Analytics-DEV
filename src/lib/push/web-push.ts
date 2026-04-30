/**
 * Helpers para enviar Web Push usando VAPID + service role do Supabase.
 *
 * - O service worker (`public/sw.js`) recebe `event.data.json()` e chama
 *   `registration.showNotification(title, options)` com o payload entregue
 *   por estas funções.
 * - Subscrições com endpoint inválido (404/410) são removidas automaticamente
 *   pra evitar disparos repetidos.
 *
 * Variáveis de ambiente exigidas (todas no servidor):
 *   - VAPID_PUBLIC_KEY            — chave VAPID pública (também exposta ao
 *                                   browser via /api/push/vapid-public-key).
 *   - VAPID_PRIVATE_KEY           — chave VAPID privada (NUNCA exposta ao
 *                                   browser).
 *   - VAPID_SUBJECT               — `mailto:` ou URL pública do site (default:
 *                                   `mailto:contato@afiliadoanalytics.com.br`).
 *   - NEXT_PUBLIC_SUPABASE_URL    — URL do projeto Supabase.
 *   - SUPABASE_SERVICE_ROLE_KEY   — service role pra ler subscrições e fazer
 *                                   prune fora do RLS.
 *
 * Use `npx web-push generate-vapid-keys --json` pra gerar o par de chaves.
 */

import webpush, { type PushSubscription as WebPushSubscription } from "web-push";
import { createAdminClient } from "@/lib/supabase-admin";

let configured = false;

function ensureConfigured(): { ok: true } | { ok: false; reason: string } {
  if (configured) return { ok: true };
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = (process.env.VAPID_SUBJECT?.trim() || "mailto:contato@afiliadoanalytics.com.br");
  if (!publicKey || !privateKey) {
    return { ok: false, reason: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY ausentes no servidor." };
  }
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Falha ao configurar VAPID.",
    };
  }
}

export type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  badge?: string;
  tag?: string;
  url?: string;
  /** Marcadores Markdown-like que o SW interpreta. Use **texto** pra negrito. */
  renderHints?: { boldTitle?: boolean };
};

type SubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function rowToWebPushSubscription(row: SubscriptionRow): WebPushSubscription {
  return {
    endpoint: row.endpoint,
    keys: {
      p256dh: row.p256dh,
      auth: row.auth,
    },
  };
}

async function deleteSubscriptionByEndpoint(endpoint: string) {
  try {
    const admin = createAdminClient();
    await admin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  } catch (err) {
    console.error("[push] falha ao remover subscription expirada:", err);
  }
}

export type SendResult = {
  total: number;
  ok: number;
  failed: number;
  pruned: number;
};

/**
 * Envia o mesmo payload pra TODAS as subscrições de um usuário.
 * Use isto pra disparos individuais (ex.: nova venda do Mercado Pago).
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (error) {
    console.error("[push] falha ao listar subscrições do usuário:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  return sendPushToRows(payload, (rows ?? []) as SubscriptionRow[]);
}

/**
 * Envia o mesmo payload pra TODAS as subscrições da base. Use com cuidado —
 * é o que os crons globais (`bom-dia`, `bom-almoco`, etc.) fazem.
 */
export async function sendPushBroadcast(payload: PushPayload): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (error) {
    console.error("[push] falha ao listar subscrições:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  return sendPushToRows(payload, (rows ?? []) as SubscriptionRow[]);
}

/**
 * Envia payload personalizado por usuário. `getPayload` pode retornar `null`
 * pra pular um usuário (ex.: sem dados de comissão). Útil pro cron das 08:10.
 */
export async function sendPushPerUser(
  getPayload: (userId: string) => Promise<PushPayload | null> | PushPayload | null,
): Promise<SendResult> {
  const cfg = ensureConfigured();
  if (!cfg.ok) {
    console.error("[push] config inválida:", cfg.reason);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth, user_id");

  if (error) {
    console.error("[push] falha ao listar subscrições:", error.message);
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  // Agrupa por user_id pra computar payload uma vez por usuário.
  const byUser = new Map<string, SubscriptionRow[]>();
  for (const r of rows ?? []) {
    const userId = (r as SubscriptionRow & { user_id: string }).user_id;
    const list = byUser.get(userId) ?? [];
    list.push(r as SubscriptionRow);
    byUser.set(userId, list);
  }

  const result: SendResult = { total: 0, ok: 0, failed: 0, pruned: 0 };
  for (const [userId, subs] of byUser) {
    const payload = await getPayload(userId);
    if (!payload) continue;
    const sub = await sendPushToRows(payload, subs);
    result.total += sub.total;
    result.ok += sub.ok;
    result.failed += sub.failed;
    result.pruned += sub.pruned;
  }
  return result;
}

async function sendPushToRows(
  payload: PushPayload,
  rows: SubscriptionRow[],
): Promise<SendResult> {
  const json = JSON.stringify(payload);
  const result: SendResult = { total: rows.length, ok: 0, failed: 0, pruned: 0 };

  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(rowToWebPushSubscription(row), json, {
          TTL: 60 * 60 * 24,
        });
        result.ok += 1;
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode?: number }).statusCode ?? 0)
            : 0;
        result.failed += 1;
        if (status === 404 || status === 410) {
          await deleteSubscriptionByEndpoint(row.endpoint);
          result.pruned += 1;
        } else {
          console.error("[push] erro ao enviar:", status, err);
        }
      }
    }),
  );

  return result;
}
