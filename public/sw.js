// SmashQueue Service Worker — push notifications + click routing

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "SmashQueue", body: event.data.text() };
  }
  const { title, body, url, tag } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "SmashQueue", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || "smashqueue",
      data: { url: url || "/" },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        const url = new URL(client.url);
        if (url.pathname === targetUrl || client.url.endsWith(targetUrl)) {
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    })(),
  );
});

// Optional: keep service worker alive across pages
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
