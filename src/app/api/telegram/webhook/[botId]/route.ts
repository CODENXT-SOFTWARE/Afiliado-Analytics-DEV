/**
 * Webhook receiver chamado pelo Telegram quando o bot recebe mensagens.
 * Configurado automaticamente via setWebhook na criação do bot.
 *
 *   POST /api/telegram/webhook/<botId>
 *   Header: X-Telegram-Bot-Api-Secret-Token = telegram_bots.webhook_secret
 *
 * Comportamento:
 *  - Valida o secret token (impede chamadas falsas que poluiriam a tabela de grupos)
 *  - Se a mensagem é de grupo/supergrupo/canal, faz upsert em telegram_grupos_venda
 *  - DMs (chat.type = "private") são ignoradas
 *  - SEMPRE responde 200 quando o secret é válido (Telegram fica em retry infinito senão)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) throw new Error("Supabase service role não configurado.");
  return createClient(url, key);
}

type TelegramChat = {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
};

type TelegramMessage = {
  chat: TelegramChat;
  date?: number;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  channel_post?: TelegramMessage;
  my_chat_member?: { chat: TelegramChat; date?: number };
};

export async function POST(req: NextRequest, ctx: { params: Promise<{ botId: string }> }) {
  const { botId } = await ctx.params;

  let supabase;
  try {
    supabase = getServiceSupabase();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const { data: bot } = await supabase
    .from("telegram_bots")
    .select("id, user_id, webhook_secret, ativo")
    .eq("id", botId)
    .maybeSingle();

  // Bot não existe ou desativado: 200 silencioso (não revelar)
  if (!bot) return NextResponse.json({ ok: true }, { status: 200 });
  const botRow = bot as { id: string; user_id: string; webhook_secret: string; ativo: boolean };
  if (!botRow.ativo) return NextResponse.json({ ok: true }, { status: 200 });

  const headerSecret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (headerSecret !== botRow.webhook_secret) {
    return NextResponse.json({ ok: false, reason: "invalid_secret" }, { status: 401 });
  }

  const update = (await req.json().catch(() => ({}))) as TelegramUpdate;

  const chat =
    update.message?.chat ?? update.channel_post?.chat ?? update.my_chat_member?.chat;
  if (!chat) return NextResponse.json({ ok: true });

  // Ignora DM com o bot — só rastreia grupos
  if (chat.type === "private") return NextResponse.json({ ok: true });

  const chatIdStr = String(chat.id);
  const groupName = chat.title ?? "";
  const messageDateSec =
    update.message?.date ?? update.channel_post?.date ?? update.my_chat_member?.date;
  const ultimaMensagemEm = messageDateSec
    ? new Date(messageDateSec * 1000).toISOString()
    : new Date().toISOString();

  const { data: existing } = await supabase
    .from("telegram_grupos_venda")
    .select("id, group_name")
    .eq("bot_id", botRow.id)
    .eq("chat_id", chatIdStr)
    .maybeSingle();

  if (existing) {
    const existingRow = existing as { id: string; group_name: string };
    await supabase
      .from("telegram_grupos_venda")
      .update({
        group_name: groupName || existingRow.group_name,
        ultima_mensagem_em: ultimaMensagemEm,
      })
      .eq("id", existingRow.id);
  } else {
    await supabase.from("telegram_grupos_venda").insert({
      user_id: botRow.user_id,
      bot_id: botRow.id,
      chat_id: chatIdStr,
      group_name: groupName,
      ultima_mensagem_em: ultimaMensagemEm,
    });
  }

  return NextResponse.json({ ok: true });
}
