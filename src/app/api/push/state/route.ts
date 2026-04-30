/**
 * Sincroniza o estado leve do usuário usado pelos crons de push pra montar
 * mensagens personalizadas. Hoje guardamos apenas a "comissão total" mais
 * recente exibida no dashboard (calculada client-side a partir do CSV/API).
 *
 * O cron das 08:10 BRT lê isto pra montar "Comissão total: R$ X". Sem dado,
 * cai no fallback genérico ("Acompanhe seu desempenho 📊").
 *
 * Body:
 *   { comissaoTotal: number, comissaoPeriod?: string }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StateBody = {
  comissaoTotal?: number | null;
  comissaoPeriod?: string | null;
};

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

  return NextResponse.json({ ok: true });
}
