/**
 * Histórico recente de payloads (usuário logado).
 * GET ?limit=30
 */

import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";
import { gateEspelhamentoGrupos } from "@/lib/require-entitlements";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const gate = await gateEspelhamentoGrupos();
    if (!gate.allowed) return gate.response;

    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10) || 25));

    const { data: rows, error } = await supabase
      .from("espelhamento_payloads")
      .select(
        "id, config_id, id_mensagem_externa, instancia_nome, grupo_origem_jid, texto_entrada, texto_saida, status, erro_detalhe, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ data: rows ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
