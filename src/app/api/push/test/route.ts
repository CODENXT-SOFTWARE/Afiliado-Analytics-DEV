/**
 * Dispara uma notificação de teste imediatamente para o usuário autenticado.
 * Útil pra verificar se a subscription está funcionando após a primeira vez
 * que o usuário ativou as notificações.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendPushToUser } from "@/lib/push/web-push";
import { payloadTeste } from "@/lib/push/payloads";

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

  const result = await sendPushToUser(user.id, payloadTeste());
  return NextResponse.json({ ok: true, ...result });
}
