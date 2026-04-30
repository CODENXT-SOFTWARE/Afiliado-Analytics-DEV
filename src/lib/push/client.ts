/**
 * Helpers client-side pra gerenciar a subscription do PushManager. Usado pelo
 * `PwaServiceWorker` (auto-subscribe silencioso quando a permissão já foi
 * concedida) e pelo `PushPermissionPrompt` (fluxo manual da primeira vez).
 *
 * Importante: subscribe só funciona depois que o navigator.serviceWorker está
 * pronto e a chave VAPID pública foi obtida do servidor.
 */

const SUBSCRIBED_FLAG_KEY = "aa-push-subscribed-endpoint";
const PERMISSION_PROMPT_DISMISSED_KEY = "aa-push-prompt-dismissed-at";
const PROMPT_REMIND_MS = 1000 * 60 * 60 * 24 * 7;

export type PushSupportStatus =
  | "supported"
  | "no-service-worker"
  | "no-push-manager"
  | "no-notification-api"
  | "ssr";

export function detectPushSupport(): PushSupportStatus {
  if (typeof window === "undefined") return "ssr";
  if (typeof Notification === "undefined") return "no-notification-api";
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!("PushManager" in window)) return "no-push-manager";
  return "supported";
}

export function isPushSupported(): boolean {
  return detectPushSupport() === "supported";
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function fetchVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/vapid-public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as { publicKey?: string };
    return typeof json.publicKey === "string" ? json.publicKey : null;
  } catch {
    return null;
  }
}

async function postSubscriptionToServer(sub: PushSubscription): Promise<boolean> {
  try {
    const json = sub.toJSON() as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type EnsureSubscribedOptions = {
  /** Se true, tenta criar uma subscription nova mesmo sem flag local. */
  force?: boolean;
};

/**
 * Garante que existe uma subscription ativa registrada no servidor. Quando a
 * permissão já é "granted" e ainda não há subscription pra este endpoint,
 * cria silenciosamente. Retorna `true` se o usuário fica com push ativo.
 */
export async function ensureSubscribed(
  opts: EnsureSubscribedOptions = {},
): Promise<boolean> {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();

    if (!sub) {
      const publicKey = await fetchVapidPublicKey();
      if (!publicKey) return false;
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const cached = readSubscribedEndpoint();
    if (!opts.force && cached && cached === sub.endpoint) {
      return true;
    }

    const ok = await postSubscriptionToServer(sub);
    if (ok) writeSubscribedEndpoint(sub.endpoint);
    return ok;
  } catch (err) {
    console.error("[push] ensureSubscribed falhou:", err);
    return false;
  }
}

/**
 * Pede permissão explícita (deve ser chamado de dentro de um clique do
 * usuário pra navegadores que exigem gesto). Em caso de "granted" também
 * registra a subscription no servidor.
 */
export async function requestPermissionAndSubscribe(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";

  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }

  if (permission === "granted") {
    await ensureSubscribed({ force: true });
  }
  return permission;
}

export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(() => {});
      await sub.unsubscribe();
    }
    clearSubscribedEndpoint();
    return true;
  } catch {
    return false;
  }
}

function readSubscribedEndpoint(): string | null {
  try {
    return window.localStorage.getItem(SUBSCRIBED_FLAG_KEY);
  } catch {
    return null;
  }
}

function writeSubscribedEndpoint(endpoint: string) {
  try {
    window.localStorage.setItem(SUBSCRIBED_FLAG_KEY, endpoint);
  } catch {
    /* ignore */
  }
}

function clearSubscribedEndpoint() {
  try {
    window.localStorage.removeItem(SUBSCRIBED_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowPermissionPrompt(): boolean {
  if (!isPushSupported()) return false;
  if (Notification.permission !== "default") return false;
  try {
    const dismissedAt = Number(window.localStorage.getItem(PERMISSION_PROMPT_DISMISSED_KEY) ?? 0);
    if (!Number.isFinite(dismissedAt) || dismissedAt <= 0) return true;
    return Date.now() - dismissedAt > PROMPT_REMIND_MS;
  } catch {
    return true;
  }
}

export function dismissPermissionPrompt() {
  try {
    window.localStorage.setItem(PERMISSION_PROMPT_DISMISSED_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}
