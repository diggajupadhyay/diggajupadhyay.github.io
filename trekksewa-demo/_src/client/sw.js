/* global __VERSION__, __PRECACHE__ */
// Service worker: makes the site usable with little or no signal.
//  - the page shell and the safety tools are stored at install time
//  - every page you open is kept for next time (fresh copy when online)
//  - map tiles you have looked at stay available; nothing is bulk-downloaded

const VERSION = __VERSION__;
const SHELL = `ts-shell-${VERSION}`;
const PAGES = 'ts-pages-v1';
const ASSETS = 'ts-assets-v1';
const DATA = 'ts-data-v1';
const TILES = 'ts-tiles-v1';
const TILE_LIMIT = 800;
const PAGE_TIMEOUT_MS = 4000;

const scope = new URL(self.registration.scope);
const TILE_HOSTS = /(^|\.)tile\.openstreetmap\.org$|(^|\.)tile\.opentopomap\.org$/;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(__PRECACHE__))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('ts-shell-') && k !== SHELL).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

async function fromAnyCache(request, options) {
  return (await caches.match(request, options)) || null;
}

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

// Pages: try the network briefly so content stays current, fall back to the saved copy.
async function page(request) {
  const cache = await caches.open(PAGES);
  try {
    const response = await Promise.race([fetch(request), timeout(PAGE_TIMEOUT_MS)]);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await fromAnyCache(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await fromAnyCache(new URL('offline/', scope).href);
    return offline || new Response('You are offline and this page has not been saved yet.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
}

// Fingerprinted files never change, so the saved copy is always right.
async function cacheFirst(request, cacheName) {
  const cached = await fromAnyCache(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(cacheName)).put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await fromAnyCache(request);
  const fresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await fresh) || new Response('', { status: 504 });
}

async function tile(request) {
  const cache = await caches.open(TILES);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone()).then(async () => {
      const keys = await cache.keys();
      if (keys.length > TILE_LIMIT) await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((k) => cache.delete(k)));
    });
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    if (url.pathname.includes('/_src/')) return;
    if (request.mode === 'navigate') return event.respondWith(page(request));
    if (url.pathname.includes('/assets/')) return event.respondWith(cacheFirst(request, ASSETS));
    if (url.pathname.includes('/data/')) return event.respondWith(staleWhileRevalidate(request, DATA));
    return event.respondWith(staleWhileRevalidate(request, ASSETS));
  }
  if (TILE_HOSTS.test(url.hostname)) return event.respondWith(tile(request));
  // everything else (weather API etc.) goes straight to the network
});

// A page can ask for a set of URLs to be kept for offline use ("Save for offline").
self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'cache-pages' && Array.isArray(msg.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES);
        const results = await Promise.allSettled(msg.urls.map((u) => cache.add(u)));
        const ok = results.filter((r) => r.status === 'fulfilled').length;
        event.source?.postMessage({ type: 'cache-pages-done', id: msg.id, ok, total: msg.urls.length });
      })(),
    );
  }
});
