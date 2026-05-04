/**
 * Cron noturno de retry pra `comissao-total`.
 *
 * Roda às 22:00 BRT (01:00 UTC). É a "última chance" do dia: pega todos os
 * users elegíveis que NÃO têm entrada de sucesso em `push_send_log` para
 * `comissao-total` no dia atual (BRT) — e dispara push agora, com o
 * `comissao_ontem` que já foi coletado pela manhã.
 *
 * Cobre os casos que escaparam do cron principal das 10:30:
 *   • Subscription estava temporariamente em throttle no FCM
 *   • Falha de rede/Vercel num push específico
 *   • Cron principal teve resultado parcial
 *
 * Elegibilidade (mesmas regras do cron principal):
 *   • `profiles.subscription_status = 'active'`
 *   • `push_user_state.comissao_ontem` IS NOT NULL
 *
 * Sem fallback genérico: quem não tem dado coletado fica de fora. Quem
 * tem assinatura inativa fica de fora.
 *
 * Schedule: `0 1 * * *` (01:00 UTC = 22:00 BRT) em vercel.json.
 *
 * Kill switch: `PUSH_COMISSAO_NOVO_FLUXO=false` mantém o comportamento
 * antigo (lê `comissao_total`, sem filtro de active, com fallback).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendPushPerUser } from "@/lib/push/web-push";
import { payloadComissaoTotal } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Início do dia BRT atual em UTC ISO. */
function brtStartOfDayIso(): string {
  const now = new Date();
  // BRT é UTC-3. Subtrai 3h pra "data BRT", zera hora, soma 3h pra UTC.
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const brtMidnight = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 0, 0, 0),
  );
  return new Date(brtMidnight.getTime() + 3 * 60 * 60 * 1000).toISOString();
}

async function listarUsersAtivos(
  admin: ReturnType<typeof createAdminClient>,
  candidateIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const BATCH = 500;
  for (let i = 0; i < candidateIds.length; i += BATCH) {
    const slice = candidateIds.slice(i, i + BATCH);
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("subscription_status", "active")
      .in("id", slice);
    if (error) {
      console.error("[push-comissao-retry] erro ao listar profiles ativos:", error.message);
      continue;
    }
    for (const row of (data ?? []) as Array<{ id: string }>) {
      out.add(row.id);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const admin = createAdminClient();
  const dayStart = brtStartOfDayIso();
  const fluxoNovoAtivo = process.env.PUSH_COMISSAO_NOVO_FLUXO !== "false";

  // Passo 1: lista users que JÁ receberam com sucesso hoje.
  const { data: receivedRows } = await admin
    .from("push_send_log")
    .select("user_id")
    .eq("slug", "comissao-total")
    .eq("success", true)
    .gte("sent_at", dayStart);

  const receivedSet = new Set<string>(
    ((receivedRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id),
  );

  // Passo 2: lista TODOS os users com push_user_state e seus valores.
  // No fluxo novo, lemos `comissao_ontem`; no legado, `comissao_total`.
  const valorColumn = fluxoNovoAtivo ? "comissao_ontem" : "comissao_total";
  const { data: stateRows } = await admin
    .from("push_user_state")
    .select(`user_id, ${valorColumn}`);

  type StateRowAny = { user_id: string } & Record<string, number | null | undefined>;
  const states = (stateRows ?? []) as StateRowAny[];

  // No fluxo novo: descarta linhas sem valor coletado (null = coleta falhou
  // ou user sem chave Shopee). No legado: mantém todos pra preservar
  // o comportamento antigo de fallback.
  const pendingComValor = states
    .filter((s) => !receivedSet.has(s.user_id))
    .filter((s) => {
      if (!fluxoNovoAtivo) return true;
      const v = s[valorColumn];
      return v != null && Number.isFinite(Number(v));
    });

  if (pendingComValor.length === 0) {
    return NextResponse.json({
      ok: true,
      retry: {
        totalEligible: states.length,
        alreadyReceived: receivedSet.size,
        pending: 0,
        fluxoNovoAtivo,
      },
    });
  }

  // Passo 3: filtra somente users com subscription_status='active' (no
  // fluxo novo). No legado, mantém todos.
  let pendingFinal = pendingComValor;
  if (fluxoNovoAtivo) {
    const activeSet = await listarUsersAtivos(
      admin,
      pendingComValor.map((s) => s.user_id),
    );
    pendingFinal = pendingComValor.filter((s) => activeSet.has(s.user_id));
  }

  if (pendingFinal.length === 0) {
    return NextResponse.json({
      ok: true,
      retry: {
        totalEligible: states.length,
        alreadyReceived: receivedSet.size,
        pending: 0,
        descartadosPorInativo: pendingComValor.length,
        fluxoNovoAtivo,
      },
    });
  }

  // Passo 4: dispara push pros pendentes finais.
  const valorMap = new Map<string, number | null>();
  for (const s of pendingFinal) {
    const raw = s[valorColumn];
    valorMap.set(s.user_id, raw != null ? Number(raw) : null);
  }

  const cache = new Map<string, ReturnType<typeof payloadComissaoTotal>>();
  const result = await sendPushPerUser(
    (userId) => {
      const cached = cache.get(userId);
      if (cached) return cached;
      const valor = valorMap.get(userId) ?? null;
      // No fluxo novo, valor null nunca chega aqui (já foi filtrado). No
      // legado, null cai no fallback do payload.
      const payload = payloadComissaoTotal(valor);
      cache.set(userId, payload);
      return payload;
    },
    {
      logSlug: "comissao-total",
      userIdsFilter: pendingFinal.map((p) => p.user_id),
    },
  );

  return NextResponse.json({
    ok: true,
    retry: {
      totalEligible: states.length,
      alreadyReceived: receivedSet.size,
      pending: pendingFinal.length,
      sent: result,
      fluxoNovoAtivo,
    },
  });
}
