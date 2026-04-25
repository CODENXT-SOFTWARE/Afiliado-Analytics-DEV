/**
 * Wrapper minimalista da Telegram Bot API.
 * Sem dependências externas — só fetch.
 *
 * Docs: https://core.telegram.org/bots/api
 */

const TELEGRAM_API_BASE = "https://api.telegram.org";

export type TelegramApiResult<T> =
  | { ok: true; result: T }
  | { ok: false; error_code: number; description: string };

async function call<T>(
  token: string,
  method: string,
  params?: Record<string, unknown>
): Promise<TelegramApiResult<T>> {
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: params ? JSON.stringify(params) : undefined,
    });
    const json = (await res.json()) as {
      ok: boolean;
      result?: T;
      error_code?: number;
      description?: string;
    };
    if (!json.ok || json.result === undefined) {
      return {
        ok: false,
        error_code: json.error_code ?? res.status,
        description: json.description ?? `HTTP ${res.status}`,
      };
    }
    return { ok: true, result: json.result };
  } catch (e) {
    return {
      ok: false,
      error_code: -1,
      description: e instanceof Error ? e.message : "fetch_failed",
    };
  }
}

export type TelegramBotInfo = {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
};

export function getMe(token: string) {
  return call<TelegramBotInfo>(token, "getMe");
}

export function setWebhook(token: string, url: string, secretToken: string) {
  return call<true>(token, "setWebhook", {
    url,
    secret_token: secretToken,
    drop_pending_updates: true,
    allowed_updates: ["message", "channel_post", "my_chat_member"],
  });
}

export function deleteWebhook(token: string) {
  return call<true>(token, "deleteWebhook", { drop_pending_updates: true });
}

export function sendMessage(
  token: string,
  chatId: string | number,
  text: string,
  options?: {
    parse_mode?: "HTML" | "MarkdownV2";
    disable_web_page_preview?: boolean;
  }
) {
  return call(token, "sendMessage", {
    chat_id: chatId,
    text,
    ...options,
  });
}

export function sendPhoto(
  token: string,
  chatId: string | number,
  photo: string,
  caption?: string,
  options?: {
    parse_mode?: "HTML" | "MarkdownV2";
  }
) {
  return call(token, "sendPhoto", {
    chat_id: chatId,
    photo,
    caption,
    ...options,
  });
}

/** Mascara o token pra exibição em UI (mostra só o número antes do `:`). */
export function maskToken(token: string): string {
  if (!token || token.length < 10) return "****";
  const parts = token.split(":");
  if (parts.length !== 2) return "****";
  return `${parts[0]}:****`;
}
