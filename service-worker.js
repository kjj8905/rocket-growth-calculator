const CACHE_VERSION = "sellerdit-pwa-v1";
const APP_SHELL_CACHE = CACHE_VERSION + "-shell";
const APP_SHELL_URLS = [
  "/community",
  "/community/suppliers",
  "/styles.css",
  "/app.js",
  "/manifest.webmanifest",
  "/assets/rocket-favicon.svg?v=20260611",
  "/assets/site-flow.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_URLS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith("sellerdit-pwa-") && key !== APP_SHELL_CACHE)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "/community"));
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

function isStaticAsset(url) {
  return url.pathname === "/styles.css"
    || url.pathname === "/app.js"
    || url.pathname === "/manifest.webmanifest"
    || url.pathname.startsWith("/assets/");
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await cache.match(fallbackUrl)) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || fresh || Response.error();
}
