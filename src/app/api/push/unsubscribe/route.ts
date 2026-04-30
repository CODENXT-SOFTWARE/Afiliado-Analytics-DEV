/**
 * Remove uma subscription (por `endpoint`) do usuário autenticado. Chamado
 * pelo cliente quando o usuário desliga as notificações.
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let endpoint = "";
  try {
    const body = (await req.json()) as { endpoint?: string };
    endpoint = typeof body?.endpoint === "string" ? body.endpoint.trim() : "";
  } catch {
    /* body opcional */
  }

  const query = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (endpoint) {
    const { error } = await query.eq("endpoint", endpoint);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
