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
export const maxDuration = 60;

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
      return sendPushBroadcast(payloadBomDia());
    case "relatorio-shopee":
      return sendPushBroadcast(payloadRelatorioShopee());
    case "tendencias-manha":
    case "tendencias-tarde":
      return sendPushBroadcast(payloadTendencias());
    case "bom-almoco":
      return sendPushBroadcast(payloadBomAlmoco());
    case "campanha-direta":
      return sendPushBroadcast(payloadCampanhaDireta());
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

async function sendComissaoTotal(): Promise<SendResult> {
  const admin = createAdminClient();
  const { data: states } = await admin
    .from("push_user_state")
    .select("user_id, comissao_total");

  type Row = { user_id: string; comissao_total: number | null };
  const map = new Map<string, number | null>();
  for (const row of (states ?? []) as Row[]) {
    map.set(row.user_id, row.comissao_total ?? null);
  }

  const cache = new Map<string, PushPayload>();
  return sendPushPerUser((userId) => {
    const cached = cache.get(userId);
    if (cached) return cached;
    const payload = payloadComissaoTotal(map.get(userId) ?? null);
    cache.set(userId, payload);
    return payload;
  });
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
  return NextResponse.json({ ok: true, slug, ...result });
}
