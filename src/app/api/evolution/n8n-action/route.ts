import { NextResponse } from "next/server";
import { createClient } from "utils/supabase/server";

const TIPOS_ACAO = [
  "verificar_status",
  "criar_instancia",
  "excluir_instancia",
  "reconectar",
  "testar_conexao",
  "buscar_grupo",
  "enviar_texto",
] as const;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const tipoAcao = (typeof body.tipoAcao === "string" ? body.tipoAcao.toLowerCase().trim() : "") as (typeof TIPOS_ACAO)[number];
  const nomeInstancia = typeof body.nomeInstancia === "string" ? body.nomeInstancia.trim() : "";
  const numeroWhatsApp = typeof body.numeroWhatsApp === "string" ? body.numeroWhatsApp.replace(/\D/g, "") : "";
  const hash = typeof body.hash === "string" ? body.hash.trim() : "";
  const getParticipants = body.getParticipants === true || body.getParticipants === "true";

  if (!TIPOS_ACAO.includes(tipoAcao)) {
    return NextResponse.json(
      { error: `tipoAcao inválido. Use: ${TIPOS_ACAO.join(", ")}.` },
      { status: 400 }
    );
  }
  if (!nomeInstancia) {
    return NextResponse.json({ error: "nomeInstancia é obrigatório." }, { status: 400 });
  }
  if (tipoAcao === "criar_instancia" && !numeroWhatsApp) {
    return NextResponse.json({ error: "numeroWhatsApp é obrigatório para criar_instancia." }, { status: 400 });
  }
  if (tipoAcao === "reconectar" && !hash) {
    return NextResponse.json({ error: "hash é obrigatório para reconectar." }, { status: 400 });
  }

  const envWebhook = (process.env.EVOLUTION_N8N_WEBHOOK_URL ?? "").trim();
  if (!envWebhook) {
    return NextResponse.json(
      { error: "Webhook Evolution não configurado. Defina EVOLUTION_N8N_WEBHOOK_URL no .env" },
      { status: 503 }
    );
  }
  const webhookUrl = envWebhook;

  const payload = {
    tipoAcao,
    nomeInstancia,
    ...(numeroWhatsApp && { numeroWhatsApp }),
    ...(hash && { hash }),
    getParticipants,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text };
    }
    if (!res.ok) {
      return NextResponse.json(
        { error: (json as { erro?: string })?.erro ?? `n8n retornou ${res.status}`, details: json },
        { status: 502 }
      );
    }
    return NextResponse.json(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao chamar webhook n8n";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
