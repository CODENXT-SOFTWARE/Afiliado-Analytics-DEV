/**
 * Cron de coleta diária da comissão do dia anterior (BRT) para o push das
 * 10:30 BRT.
 *
 * Roda às 09:30 BRT (12:30 UTC). Para cada usuário elegível, chama a API da
 * Shopee Affiliate (`conversionReport`) e grava `comissao_ontem` +
 * `comissao_ontem_data` em `push_user_state`. Quem cair fora dos critérios
 * abaixo simplesmente não recebe push (decisão explícita do produto).
 *
 * Critérios de elegibilidade:
 *   - `profiles.subscription_status = 'active'`
 *   - `profiles.shopee_app_id` e `profiles.shopee_api_key` preenchidos
 *
 * Estratégia de execução:
 *   - Concorrência limitada (`COLLECT_CONCURRENCY`) para não estourar
 *     timeout do Vercel (300s) e nem disparar rate-limit da Shopee.
 *   - Cada usuário é independente: erro em um não interrompe os demais.
 *   - Resultado retornado em JSON com contadores para debug do primeiro dia.
 *
 * Schedule: `30 12 * * *` (12:30 UTC = 09:30 BRT) em vercel.json.
 *
 * Kill switch: `PUSH_COMISSAO_NOVO_FLUXO`. Se setada como `"false"`, o cron
 * sai imediatamente sem tocar na base. Permite reverter o fluxo novo sem
 * precisar de deploy.
 */

import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { fetchShopeeCommissionYesterdayBrt } from "@/lib/shopee/conversion-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const COLLECT_CONCURRENCY = 8;

type EligibleUser = {
  user_id: string;
  shopee_app_id: string;
  shopee_api_key: string;
};

type CollectStats = {
  totalElegiveis: number;
  coletados: number;
  falharam: number;
  erros: Array<{ userId: string; message: string }>;
};

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  const workers: Promise<void>[] = [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  for (let w = 0; w < limit; w++) {
    workers.push(
      (async () => {
        while (true) {
          const idx = nextIndex++;
          if (idx >= items.length) return;
          results[idx] = await worker(items[idx], idx);
        }
      })(),
    );
  }
  await Promise.all(workers);
  return results;
}

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

  // Filtra direto no Supabase: `active` + chaves preenchidas. Reduz tráfego
  // e evita iterar sobre milhares de profiles inativos.
  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("id, shopee_app_id, shopee_api_key")
    .eq("subscription_status", "active")
    .not("shopee_app_id", "is", null)
    .not("shopee_api_key", "is", null);

  if (profErr) {
    console.error("[push-coletar-comissao-ontem] erro ao listar profiles:", profErr.message);
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  type ProfileRow = { id: string; shopee_app_id: string | null; shopee_api_key: string | null };
  const eligible: EligibleUser[] = ((profiles ?? []) as ProfileRow[])
    .map((p) => ({
      user_id: p.id,
      shopee_app_id: (p.shopee_app_id ?? "").trim(),
      shopee_api_key: (p.shopee_api_key ?? "").trim(),
    }))
    .filter((p) => p.shopee_app_id.length > 0 && p.shopee_api_key.length > 0);

  const stats: CollectStats = {
    totalElegiveis: eligible.length,
    coletados: 0,
    falharam: 0,
    erros: [],
  };

  if (eligible.length === 0) {
    return NextResponse.json({ ok: true, stats });
  }

  await runWithConcurrency(eligible, COLLECT_CONCURRENCY, async (user) => {
    try {
      const { totalCommission, dateBrt } = await fetchShopeeCommissionYesterdayBrt({
        appId: user.shopee_app_id,
        secret: user.shopee_api_key,
      });

      const { error: upsertErr } = await admin
        .from("push_user_state")
        .upsert(
          {
            user_id: user.user_id,
            comissao_ontem: totalCommission,
            comissao_ontem_data: dateBrt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

      if (upsertErr) {
        stats.falharam += 1;
        stats.erros.push({ userId: user.user_id, message: `upsert: ${upsertErr.message}` });
        return;
      }

      stats.coletados += 1;
    } catch (err) {
      stats.falharam += 1;
      const message = err instanceof Error ? err.message : String(err);
      // Limita tamanho do erro pra resposta JSON não ficar gigante.
      stats.erros.push({ userId: user.user_id, message: message.slice(0, 200) });
      console.error("[push-coletar-comissao-ontem] falha user", user.user_id, message);
    }
  });

  // Trunca lista de erros na resposta para evitar payloads enormes — log
  // completo já está no console do Vercel.
  const erroSample = stats.erros.slice(0, 20);

  return NextResponse.json({
    ok: true,
    stats: {
      totalElegiveis: stats.totalElegiveis,
      coletados: stats.coletados,
      falharam: stats.falharam,
      errosAmostra: erroSample,
      errosOmitidos: Math.max(0, stats.erros.length - erroSample.length),
    },
  });
}
