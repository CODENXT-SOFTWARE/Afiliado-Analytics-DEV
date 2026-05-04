/**
 * Dispara uma notificação de "Comissão total" pro próprio usuário usando
 * EXATAMENTE a mesma fonte de dados que o cron de produção das 10:30 BRT.
 *
 * Por isso o comportamento muda conforme o kill switch
 * `PUSH_COMISSAO_NOVO_FLUXO`:
 *
 *   - Fluxo novo (default): lê `push_user_state.comissao_ontem`. Se for
 *     null (coleta das 09:30 não rodou ainda hoje, falhou, ou o usuário
 *     não tem chave Shopee), responde 409 com mensagem clara — não envia
 *     push genérico, porque seria diferente do que o cron de produção
 *     mandaria. Manter o teste fiel ao real é mais útil que mandar
 *     "qualquer coisa".
 *
 *   - Fluxo legado (`PUSH_COMISSAO_NOVO_FLUXO=false`): lê `comissao_total`
 *     e cai no fallback genérico se vazio (comportamento original).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendPushToUser } from "@/lib/push/web-push";
import { payloadComissaoTotal } from "@/lib/push/payloads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const fluxoNovoAtivo = process.env.PUSH_COMISSAO_NOVO_FLUXO !== "false";

  if (fluxoNovoAtivo) {
    const { data: state } = await supabase
      .from("push_user_state")
      .select("comissao_ontem, comissao_ontem_data")
      .eq("user_id", user.id)
      .maybeSingle();

    const valor =
      state?.comissao_ontem != null && Number.isFinite(Number(state.comissao_ontem))
        ? Number(state.comissao_ontem)
        : null;

    if (valor == null) {
      // Sem dado coletado: mesma decisão do cron real (não envia). Retorna
      // mensagem clara pra UI explicar o motivo ao invés de mandar push
      // genérico que iria diferir do comportamento de produção.
      return NextResponse.json(
        {
          ok: false,
          reason: "sem-coleta",
          error:
            "Ainda não há comissão coletada para hoje. A coleta automática ocorre às 09:30 BRT (de segunda a domingo). Verifique também se suas chaves da Shopee estão configuradas em Integrações.",
        },
        { status: 409 },
      );
    }

    const result = await sendPushToUser(user.id, payloadComissaoTotal(valor), {
      logSlug: "comissao-total-teste",
    });
    return NextResponse.json({
      ok: true,
      comissaoOntem: valor,
      comissaoOntemData: state?.comissao_ontem_data ?? null,
      result,
    });
  }

  // Fluxo legado: lê comissao_total (range filtrado pelo dashboard).
  const { data: state } = await supabase
    .from("push_user_state")
    .select("comissao_total")
    .eq("user_id", user.id)
    .maybeSingle();

  const valor =
    state?.comissao_total != null && Number.isFinite(Number(state.comissao_total))
      ? Number(state.comissao_total)
      : null;

  const result = await sendPushToUser(user.id, payloadComissaoTotal(valor), {
    logSlug: "comissao-total-teste",
  });
  return NextResponse.json({ ok: true, comissaoTotal: valor, result });
}
