/**
 * Consulta o status de um pagamento Mercado Pago — usado pelo polling do
 * checkout PIX. O comprador paga no banco e o frontend chama esse endpoint
 * a cada poucos segundos até `status === "approved"`, daí redireciona pra
 * página de agradecimento.
 *
 *   GET /api/checkout/[subId]/payment-status?id=<paymentId>
 *   Resposta: { status, statusDetail }
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { getMpPayment } from "@/lib/mercadopago/api";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ subId: string }> }) {
  try {
    const { subId: slug } = await ctx.params;
    if (!slug) return NextResponse.json({ error: "slug obrigatório" }, { status: 400 });

    const url = new URL(req.url);
    const paymentId = url.searchParams.get("id")?.trim();
    if (!paymentId) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

    const supabase = createAdminClient();
    const { data: produto, error } = await supabase
      .from("produtos_infoprodutor")
      .select("user_id")
      .eq("public_slug", slug)
      .eq("provider", "mercadopago")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!produto) return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("mp_access_token")
      .eq("id", (produto as { user_id: string }).user_id)
      .maybeSingle();
    const accessToken = (profile as { mp_access_token?: string | null } | null)?.mp_access_token?.trim();
    if (!accessToken) {
      return NextResponse.json({ error: "Vendedor sem conta Mercado Pago" }, { status: 503 });
    }

    const payment = await getMpPayment(paymentId, accessToken);
    return NextResponse.json({
      status: payment.status,
      statusDetail: payment.status_detail ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao consultar pagamento";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
