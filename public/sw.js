const CACHE_NAME = "ecommerce-app-shell-v1";
const APP_SHELL_ROUTES = ["/", "/pl", "/en", "/manifest.json"];
const SUPPORTED_LOCALES = ["pl", "en"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL_ROUTES))
      .catch(() => undefined),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload = null;
  try {
    payload = event.data.json();
  } catch (_error) {
    try {
      payload = JSON.parse(event.data.text());
    } catch (_error) {
      payload = null;
    }
  }

  if (!payload) {
    return;
  }

  const title = payload.title || "Marketplace update";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icons/icon-192.png",
    data: payload.data || {},
    actions: payload.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.actionUrl || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            if (client.url.includes(targetUrl)) {
              return client.focus();
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          const fallbackCandidates = [];

          try {
            const url = new URL(request.url);
            const [maybeLocale] = url.pathname.split("/").filter(Boolean);
            if (maybeLocale && SUPPORTED_LOCALES.includes(maybeLocale)) {
              fallbackCandidates.push(`/${maybeLocale}`);
            }
          } catch (_error) {
            // Ignore URL parsing issues and continue with defaults.
          }

          fallbackCandidates.push("/pl", "/en", "/");

          const uniqueCandidates = Array.from(new Set(fallbackCandidates));

          for (const path of uniqueCandidates) {
            const match = await caches.match(path);
            if (match) {
              return match;
            }
          }

          return Response.error();
        }),
    );
    return;
  }

  if (request.url.startsWith(self.location.origin)) {
    const servesNextAsset = request.url.includes("/_next/");

    if (servesNextAsset) {
      event.respondWith(
        fetch(request)
          .then((response) => {
            if (
              response &&
              response.status === 200 &&
              response.type === "basic" &&
              request.method === "GET"
            ) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
            }
            return response;
          })
          .catch(async () => {
            const cached = await caches.match(request);
            if (cached) {
              return cached;
            }
            return Response.error();
          }),
      );
      return;
    }

    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }

        return fetch(request)
          .then((response) => {
            if (
              !response ||
              response.status !== 200 ||
              response.type !== "basic" ||
              request.method !== "GET"
            ) {
              return response;
            }

            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => undefined);
            return response;
          })
          .catch(() => cached ?? Response.error());
      }),
    );
  }
});
