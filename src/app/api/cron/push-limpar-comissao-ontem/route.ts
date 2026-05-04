/**
 * Cron de limpeza diária das colunas `comissao_ontem` /
 * `comissao_ontem_data` em `push_user_state`.
 *
 * Roda às 08:00 BRT (11:00 UTC), ANTES da coleta das 09:30. Por que:
 *
 *   - O `push_user_state` tem PK `user_id` (uma linha por usuário), então
 *     a coleta sempre sobrescreve via upsert — não há acúmulo.
 *   - PORÉM: se a coleta da Shopee falhar para um usuário num dia X
 *     (chave revogada, API fora, rate-limit), o valor stale do dia X-1
 *     ficaria pra trás. Sem essa limpeza, o cron das 10:30 enviaria push
 *     com comissão de ANTEONTEM como se fosse de ontem — bug grave.
 *
 *   - Limpando antes da coleta, garantimos: se a coleta falha, o usuário
 *     simplesmente não recebe push (que é o comportamento desejado).
 *
 * Schedule: `0 11 * * *` (11:00 UTC = 08:00 BRT) em vercel.json.
 *
 * Kill switch: `PUSH_COMISSAO_NOVO_FLUXO`. Se setada como `"false"`, o
 * cron sai imediatamente sem tocar na base.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const isProd = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (isProd) {
    const auth = req.headers.get("authorization") || "";
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  if (process.env.PUSH_COMISSAO_NOVO_FLUXO === "false") {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "PUSH_COMISSAO_NOVO_FLUXO=false (kill switch ativo)",
    });
  }

  const admin = createAdminClient();

  // UPDATE em massa: zera as duas colunas em TODAS as linhas. PostgreSQL
  // exige um filtro WHERE em update via PostgREST, mas para "afetar todas"
  // basta uma condição sempre verdadeira. Usamos `not.is.null` em user_id
  // (PK NOT NULL, sempre verdadeiro) só para satisfazer o builder.
  const { error, count } = await admin
    .from("push_user_state")
    .update({
      comissao_ontem: null,
      comissao_ontem_data: null,
    }, { count: "exact" })
    .not("user_id", "is", null);

  if (error) {
    console.error("[push-limpar-comissao-ontem] erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, linhasAfetadas: count ?? null });
}
