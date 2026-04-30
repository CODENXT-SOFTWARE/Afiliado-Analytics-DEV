/* Service worker do Afiliado Analytics.
 *
 * Funções:
 *  1) Atender o critério de PWA instalável (basta existir + manifest + HTTPS).
 *  2) Receber pushes Web Push (VAPID) e exibir notificações com título, corpo,
 *     ícone, banner (image) e link de destino.
 *  3) Focar/abrir a aba certa quando o usuário toca a notificação.
 *
 * Payload esperado (JSON enviado pelo servidor):
 *   {
 *     title: string,
 *     body: string,
 *     icon?: string,
 *     image?: string,
 *     badge?: string,
 *     tag?: string,
 *     url?: string
 *   }
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_err) {
      try {
        data = { title: "Afiliado Analytics", body: event.data.text() };
      } catch (_err2) {
        data = { title: "Afiliado Analytics", body: "" };
      }
    }
  }

  const title = (data && data.title) || "Afiliado Analytics";
  const options = {
    body: (data && data.body) || "",
    icon: (data && data.icon) || "/pwa-icon-192.png",
    badge: (data && data.badge) || "/pwa-icon-192.png",
    image: (data && data.image) || undefined,
    tag: (data && data.tag) || undefined,
    renotify: !!(data && data.tag),
    data: {
      url: (data && data.url) || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          try {
            const url = new URL(client.url);
            const target = new URL(targetUrl, self.location.origin);
            if (url.origin === target.origin) {
              client.navigate(target.toString()).catch(() => {});
              return client.focus();
            }
          } catch (_err) {
            /* segue tentando */
          }
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
