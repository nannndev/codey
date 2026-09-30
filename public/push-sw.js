/* Web Push for Codey, imported by the generated service worker. */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Codey", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Codey";
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || "",
    icon: "/app-icon-192.png",
    badge: "/app-icon-192.png",
    tag: data.tag || "codey",
    data: { url: data.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(url).catch(() => undefined);
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
