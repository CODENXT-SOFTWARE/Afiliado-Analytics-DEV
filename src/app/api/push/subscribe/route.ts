/**
 * Salva (UPSERT por endpoint) uma PushSubscription do browser para o usuário
 * autenticado. Chamado pelo `PushNotificationBootstrap` logo após o usuário
 * conceder permissão e o navegador gerar a subscription.
 *
 * Body esperado:
 *   {
 *     endpoint: string,
 *     keys: { p256dh: string, auth: string }
 *   }
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SubscribeBody = {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
};

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: SubscribeBody = {};
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";

  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Campos endpoint/keys.p256dh/keys.auth são obrigatórios." },
      { status: 400 },
    );
  }

  const userAgent = req.headers.get("user-agent")?.slice(0, 500) ?? null;

  // Usamos service role no UPSERT pra contornar o ON CONFLICT(endpoint) com
  // RLS. A validação de identidade já foi feita acima via `auth.getUser()`.
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .upsert(
      {
        user_id: user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (error) {
    console.error("[push/subscribe] erro ao gravar:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
