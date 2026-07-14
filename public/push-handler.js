self.addEventListener("push", (event) => {
  let payload;

  try {
    payload = event.data?.json() ?? {};
  } catch {
    payload = { body: event.data?.text() };
  }

  const title = payload.title || "Lili · Recordatorio";
  const options = {
    body: payload.body || "Tienes una tarea pendiente.",
    icon: "/pwa-192x192.png",
    badge: "/favicon-64.png",
    tag: payload.tag || "lili-reminder",
    renotify: true,
    data: {
      url: payload.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existingWindow = windows.find((client) => client.url.startsWith(self.location.origin));

    if (existingWindow) {
      await existingWindow.focus();
      if ("navigate" in existingWindow) await existingWindow.navigate(targetUrl);
      return;
    }

    await self.clients.openWindow(targetUrl);
  })());
});
