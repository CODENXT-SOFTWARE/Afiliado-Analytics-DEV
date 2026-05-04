/**
 * Sincroniza o estado leve do usuário usado pelos crons de push pra montar
 * mensagens personalizadas. Hoje guardamos apenas a "comissão total" mais
 * recente exibida no dashboard (calculada client-side a partir do CSV/API).
 *
 * O cron das 10:30 BRT lê isto pra montar "Comissão total: R$ X". Sem dado,
 * cai no fallback genérico ("Acompanhe seu desempenho 📊").
 *
 * Catch-up: se o user abre o dashboard e o cron de hoje JÁ RODOU mas ele
 * não tem entrada de sucesso em `push_send_log` pra `comissao-total` hoje
 * (cron falhou, race condition, abriu depois de 10:30 etc.) — disparamos
 * o push agora com o valor recém-calculado. Resolve a maioria dos casos
 * de "alguns users não recebem".
 *
 * Body:
 *   { comissaoTotal: number, comissaoPeriod?: string }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { sendPushToUser } from "@/lib/push/web-push";
import { payloadComissaoTotal } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StateBody = {
  comissaoTotal?: number | null;
  comissaoPeriod?: string | null;
};

/**
 * Checa se o user já recebeu `comissao-total` hoje (success=true).
 * "Hoje" = janela do dia em America/Sao_Paulo (BRT). Usa start of day BRT
 * convertido pra UTC.
 */
async function userJaRecebeuComissaoHoje(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  // Início do dia BRT em UTC: BRT é UTC-3, então 00:00 BRT = 03:00 UTC.
  // Pegamos a data atual em BRT, depois somamos 3h pra ficar em UTC.
  const now = new Date();
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const brtStartOfDay = new Date(
    Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate(), 0, 0, 0),
  );
  const utcStartOfDay = new Date(brtStartOfDay.getTime() + 3 * 60 * 60 * 1000);

  const { data } = await admin
    .from("push_send_log")
    .select("id")
    .eq("user_id", userId)
    .eq("slug", "comissao-total")
    .eq("success", true)
    .gte("sent_at", utcStartOfDay.toISOString())
    .limit(1)
    .maybeSingle();
  return data != null;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: StateBody = {};
  try {
    body = (await req.json()) as StateBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const comissao =
    typeof body.comissaoTotal === "number" && Number.isFinite(body.comissaoTotal)
      ? Math.round(body.comissaoTotal * 100) / 100
      : null;
  const period =
    typeof body.comissaoPeriod === "string" && body.comissaoPeriod.trim()
      ? body.comissaoPeriod.trim().slice(0, 200)
      : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("push_user_state")
    .upsert(
      {
        user_id: user.id,
        comissao_total: comissao,
        comissao_period: period,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );

  if (error) {
    console.error("[push/state] erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // ── Catch-up: só roda no FLUXO LEGADO (PUSH_COMISSAO_NOVO_FLUXO=false).
  //
  // No fluxo novo, a fonte de verdade é o cron das 09:30 BRT que coleta
  // server-side da Shopee — usar o valor calculado pelo dashboard (range
  // filtrado pelo user) aqui ia sobrescrever a regra de "comissão de
  // ontem" e gerar push inconsistente. Por isso desativamos.
  //
  // No legado: se já passou de 10:35 BRT e o user ainda não recebeu hoje,
  // dispara push agora com o valor que o dashboard acabou de calcular.
  let catchUpSent = false;
  const fluxoLegado = process.env.PUSH_COMISSAO_NOVO_FLUXO === "false";
  if (fluxoLegado) {
    try {
      if (comissao != null && jaPassouDoHorarioCron()) {
        const recebeu = await userJaRecebeuComissaoHoje(user.id);
        if (!recebeu) {
          const result = await sendPushToUser(
            user.id,
            payloadComissaoTotal(comissao),
            { logSlug: "comissao-total" },
          );
          catchUpSent = result.ok > 0;
        }
      }
    } catch (catchupErr) {
      console.error("[push/state] catch-up falhou:", catchupErr);
    }
  }

  return NextResponse.json({ ok: true, catchUpSent });
}

/**
 * O cron de `comissao-total` roda 10:30 BRT (13:30 UTC). Antes desse
 * horário, NÃO disparamos catch-up — o cron ainda vai rodar e mandar
 * pra todo mundo. Depois desse horário, o catch-up cobre quem não
 * recebeu (cron falhou, conexão quebrou, etc.).
 *
 * Adicionamos 5min de margem (10:35 BRT) pra dar tempo do cron terminar.
 */
function jaPassouDoHorarioCron(): boolean {
  const now = new Date();
  // Hora atual em BRT (UTC-3).
  const brtHour = (now.getUTCHours() - 3 + 24) % 24;
  const brtMinute = now.getUTCMinutes();
  const brtMinutesSinceMidnight = brtHour * 60 + brtMinute;
  const cronCompletesAt = 10 * 60 + 35; // 10:35 BRT
  return brtMinutesSinceMidnight >= cronCompletesAt;
}
