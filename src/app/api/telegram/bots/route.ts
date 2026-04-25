/**
 * CRUD de bots Telegram do usuário logado.
 *
 *   GET    /api/telegram/bots                  → lista (token mascarado)
 *   POST   /api/telegram/bots                  → cria (valida token via getMe + setWebhook automático)
 *   PATCH  /api/telegram/bots                  → edita bot_name/ativo
 *   DELETE /api/telegram/bots?id=<uuid>        → remove (deleteWebhook + drop)
 *
 * Webhook: gerado em ${NEXT_PUBLIC_APP_URL}/api/telegram/webhook/<bot.id>
 * com secret aleatório guardado em telegram_bots.webhook_secret.
 */

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient } from "utils/supabase/server";
import { deleteWebhook, getMe, maskToken, setWebhook } from "@/lib/telegram/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").trim().replace(/\/+$/, "");
}

type BotRow = {
  id: string;
  bot_username: string;
  bot_name: string;
  bot_token: string;
  webhook_set_at: string | null;
  webhook_last_error: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await supabase
    .from("telegram_bots")
    .select("id, bot_username, bot_name, bot_token, webhook_set_at, webhook_last_error, ativo, created_at, updated_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bots = (data ?? []).map((b) => {
    const row = b as BotRow;
    return { ...row, bot_token: maskToken(row.bot_token) };
  });
  return NextResponse.json({ bots });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const bot_token = typeof body.bot_token === "string" ? body.bot_token.trim() : "";
  const bot_name_input = typeof body.bot_name === "string" ? body.bot_name.trim() : "";

  if (!bot_token) {
    return NextResponse.json({ error: "bot_token é obrigatório." }, { status: 400 });
  }

  // 1) Valida o token via getMe (também descobre username + first_name)
  const me = await getMe(bot_token);
  if (!me.ok) {
    return NextResponse.json(
      { error: `Token inválido: ${me.description}` },
      { status: 400 }
    );
  }
  const bot_username = me.result.username ?? "";
  const bot_name = bot_name_input || me.result.first_name || bot_username;

  // 2) Gera secret pro webhook (validado em todo POST do receiver)
  const webhook_secret = crypto.randomBytes(32).toString("hex");

  // 3) Insere no banco
  const { data: inserted, error: insertErr } = await supabase
    .from("telegram_bots")
    .insert({
      user_id: user.id,
      bot_token,
      bot_username,
      bot_name,
      webhook_secret,
      ativo: true,
      updated_at: new Date().toISOString(),
    })
    .select("id, bot_username, bot_name, ativo, created_at, updated_at")
    .single();

  if (insertErr) {
    if (insertErr.code === "23505") {
      return NextResponse.json(
        { error: "Este bot já está cadastrado em outra conta." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // 4) Configura webhook automaticamente
  const baseUrl = getAppBaseUrl();
  if (!baseUrl) {
    return NextResponse.json({
      ...inserted,
      bot_token: maskToken(bot_token),
      webhook_set_at: null,
      webhook_last_error:
        "NEXT_PUBLIC_APP_URL não configurada — webhook não foi registrado.",
    });
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook/${inserted.id}`;
  const wh = await setWebhook(bot_token, webhookUrl, webhook_secret);
  const nowIso = new Date().toISOString();

  if (wh.ok) {
    await supabase
      .from("telegram_bots")
      .update({
        webhook_set_at: nowIso,
        webhook_last_error: null,
        updated_at: nowIso,
      })
      .eq("id", inserted.id);
    return NextResponse.json({
      ...inserted,
      bot_token: maskToken(bot_token),
      webhook_set_at: nowIso,
      webhook_last_error: null,
    });
  }

  const errMsg = `${wh.error_code}: ${wh.description}`;
  await supabase
    .from("telegram_bots")
    .update({ webhook_last_error: errMsg, updated_at: nowIso })
    .eq("id", inserted.id);

  return NextResponse.json({
    ...inserted,
    bot_token: maskToken(bot_token),
    webhook_set_at: null,
    webhook_last_error: errMsg,
  });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.bot_name === "string") updates.bot_name = body.bot_name.trim();
  if (typeof body.ativo === "boolean") updates.ativo = body.ativo;

  const { data, error } = await supabase
    .from("telegram_bots")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, bot_username, bot_name, ativo, webhook_set_at, webhook_last_error, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Bot não encontrado." }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const idFromQs = url.searchParams.get("id");
  const idFromBody = !idFromQs
    ? ((await req.json().catch(() => ({}))) as { id?: string }).id
    : null;
  const id = (idFromQs ?? idFromBody ?? "").trim();
  if (!id) return NextResponse.json({ error: "id é obrigatório." }, { status: 400 });

  const { data: bot } = await supabase
    .from("telegram_bots")
    .select("bot_token")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if ((bot as { bot_token?: string } | null)?.bot_token) {
    await deleteWebhook((bot as { bot_token: string }).bot_token).catch(() => null);
  }

  const { error } = await supabase
    .from("telegram_bots")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
