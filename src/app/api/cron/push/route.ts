/**
 * Dispatcher dos pushes agendados.
 *
 *   GET /api/cron/push?slug=bom-dia
 *   GET /api/cron/push?slug=comissao-total
 *   GET /api/cron/push?slug=relatorio-shopee
 *   GET /api/cron/push?slug=tendencias-manha
 *   GET /api/cron/push?slug=bom-almoco
 *   GET /api/cron/push?slug=tendencias-tarde
 *   GET /api/cron/push?slug=campanha-direta
 *
 * Vercel Cron passa `Authorization: Bearer ${CRON_SECRET}` automaticamente
 * quando a variável está nas envs do projeto. Em prod o segredo é exigido
 * pra evitar que terceiros acionem disparos em massa.
 *
 * Observação sobre fuso: o Vercel Cron usa UTC. As entradas em `vercel.json`
 * traduzem o horário de Brasília (UTC-3) pra UTC: 08:00 BRT = 11:00 UTC,
 * 08:10 BRT = 11:10 UTC, e assim por diante.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import {
  sendPushBroadcast,
  sendPushPerUser,
  type PushPayload,
  type SendResult,
} from "@/lib/push/web-push";
import {
  payloadBomAlmoco,
  payloadBomDia,
  payloadCampanhaDireta,
  payloadComissaoTotal,
  payloadRelatorioShopee,
  payloadTendencias,
  type ScheduledPushSlug,
} from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 5min cobre folga até ~10k subscriptions com concurrency 50.
// (1000 subs ÷ 50 paralelos × 300ms = ~6s; 10k × 300ms ÷ 50 = ~60s.)
export const maxDuration = 300;

const VALID_SLUGS: ScheduledPushSlug[] = [
  "bom-dia",
  "comissao-total",
  "relatorio-shopee",
  "tendencias-manha",
  "bom-almoco",
  "tendencias-tarde",
  "campanha-direta",
];

function isValidSlug(s: string): s is ScheduledPushSlug {
  return (VALID_SLUGS as string[]).includes(s);
}

async function dispatch(slug: ScheduledPushSlug): Promise<SendResult> {
  switch (slug) {
    case "bom-dia":
      return sendPushBroadcast(payloadBomDia(), { logSlug: slug });
    case "relatorio-shopee":
      return sendPushBroadcast(payloadRelatorioShopee(), { logSlug: slug });
    case "tendencias-manha":
    case "tendencias-tarde":
      return sendPushBroadcast(payloadTendencias(), { logSlug: slug });
    case "bom-almoco":
      return sendPushBroadcast(payloadBomAlmoco(), { logSlug: slug });
    case "campanha-direta":
      return sendPushBroadcast(payloadCampanhaDireta(), { logSlug: slug });
    case "comissao-total":
      return sendComissaoTotal();
    default: {
      // Exhaustiveness — TS garante que nunca cai aqui.
      const _exhaustive: never = slug;
      void _exhaustive;
      return { total: 0, ok: 0, failed: 0, pruned: 0 };
    }
  }
}

/**
 * Comissão total: novo fluxo (a partir de 2026-05).
 *
 *   - Fonte do valor: `push_user_state.comissao_ontem` (populada às 09:30 BRT
 *     pelo cron `/api/cron/push-coletar-comissao-ontem`, server-side via API
 *     Shopee). Substitui o antigo `comissao_total` que era populado pelo
 *     dashboard com o range filtrado pelo usuário (frequentemente "últimos
 *     6/7 dias").
 *
 *   - Elegibilidade: somente users com `profiles.subscription_status='active'`.
 *     Trial, expirado, cancelado etc. NÃO recebem.
 *
 *   - Sem fallback: se `comissao_ontem` é null (coleta falhou ou user sem
 *     chave Shopee), simplesmente não envia para esse user. Decisão explícita
 *     do produto (melhor não enviar do que enviar valor errado / genérico).
 *
 *   - Kill switch: `PUSH_COMISSAO_NOVO_FLUXO=false` reverte ao
 *     comportamento antigo (`comissao_total`, sem filtro de active, com
 *     fallback genérico) — útil se algo der ruim em produção sem precisar
 *     de deploy.
 */
async function sendComissaoTotal(): Promise<SendResult> {
  const admin = createAdminClient();
  const fluxoNovoAtivo = process.env.PUSH_COMISSAO_NOVO_FLUXO !== "false";

  if (!fluxoNovoAtivo) {
    // Fluxo legado: lê `comissao_total` (range filtrado pelo dashboard) e
    // envia para todos com state, com fallback genérico quando vazio.
    // Mantido como rede de segurança durante a transição.
    const { data: states } = await admin
      .from("push_user_state")
      .select("user_id, comissao_total");
    type Row = { user_id: string; comissao_total: number | null };
    const map = new Map<string, number | null>();
    for (const row of (states ?? []) as Row[]) {
      map.set(row.user_id, row.comissao_total ?? null);
    }
    const cache = new Map<string, PushPayload>();
    return sendPushPerUser(
      (userId) => {
        const cached = cache.get(userId);
        if (cached) return cached;
        const payload = payloadComissaoTotal(map.get(userId) ?? null);
        cache.set(userId, payload);
        return payload;
      },
      { logSlug: "comissao-total" },
    );
  }

  // Fluxo novo: cruza push_user_state com profiles ativos. Pegamos
  // `comissao_ontem` apenas; quem não tem (null) é descartado abaixo.
  const { data: states } = await admin
    .from("push_user_state")
    .select("user_id, comissao_ontem");

  type StateRow = { user_id: string; comissao_ontem: number | null };
  const stateMap = new Map<string, number>();
  for (const row of (states ?? []) as StateRow[]) {
    if (row.comissao_ontem != null && Number.isFinite(Number(row.comissao_ontem))) {
      stateMap.set(row.user_id, Number(row.comissao_ontem));
    }
  }

  if (stateMap.size === 0) {
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  // Filtra users elegíveis: subscription_status='active'. Carregamos só os
  // ids para cruzar com o stateMap — Supabase REST tem limite de 1000 por
  // `in()`, então paginamos manualmente quando necessário.
  const candidateIds = Array.from(stateMap.keys());
  const activeUserIds = await listarUsersAtivos(admin, candidateIds);
  const elegiveis = activeUserIds.filter((id) => stateMap.has(id));

  if (elegiveis.length === 0) {
    return { total: 0, ok: 0, failed: 0, pruned: 0 };
  }

  const cache = new Map<string, PushPayload>();
  return sendPushPerUser(
    (userId) => {
      const valor = stateMap.get(userId);
      if (valor == null) return null; // não envia (sem dado de ontem)
      const cached = cache.get(userId);
      if (cached) return cached;
      const payload = payloadComissaoTotal(valor);
      cache.set(userId, payload);
      return payload;
    },
    { logSlug: "comissao-total", userIdsFilter: elegiveis },
  );
}

/**
 * Retorna apenas os ids cuja `subscription_status='active'` em `profiles`.
 * Pagina via `.in()` em batches de 500 ids para ficar bem dentro do limite
 * do PostgREST (1000) e evitar queries gigantes.
 */
async function listarUsersAtivos(
  admin: ReturnType<typeof createAdminClient>,
  candidateIds: string[],
): Promise<string[]> {
  const out: string[] = [];
  const BATCH = 500;
  for (let i = 0; i < candidateIds.length; i += BATCH) {
    const slice = candidateIds.slice(i, i + BATCH);
    const { data, error } = await admin
      .from("profiles")
      .select("id")
      .eq("subscription_status", "active")
      .in("id", slice);
    if (error) {
      console.error("[push/comissao-total] erro ao listar profiles ativos:", error.message);
      // Em caso de erro num batch: prefiro retornar vazio nesse batch a
      // potencialmente enviar para inativos (segurança > completude).
      continue;
    }
    for (const row of (data ?? []) as Array<{ id: string }>) {
      out.push(row.id);
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

  const url = new URL(req.url);
  const slug = (url.searchParams.get("slug") || "").trim();
  if (!slug || !isValidSlug(slug)) {
    return NextResponse.json(
      { error: `slug inválido. Use um de: ${VALID_SLUGS.join(", ")}` },
      { status: 400 },
    );
  }

  const result = await dispatch(slug);
  return NextResponse.json({ ok: true, slug, result });
}
