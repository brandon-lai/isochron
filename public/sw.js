/*
    Isochron — Offline PWA Service Worker
    Caches the app shell, WebAssembly DSP binary, and audio workers so
    watchmakers can measure movements offline at the bench.
*/

const CACHE_NAME = "isochron-pwa-v1";
const PRECACHE_URLS = [
  "/",
  "/manifest.webmanifest",
  "/wasm/tg-core.js",
  "/wasm/tg-core.wasm",
  "/workers/tg-worker.js",
  "/workers/capture-worklet.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Cache-first for immutable Next chunks, WASM binary, and worker scripts
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/wasm/") ||
    url.pathname.startsWith("/workers/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Network-first with offline fallback for HTML navigation and manifest
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("/"))),
  );
});
