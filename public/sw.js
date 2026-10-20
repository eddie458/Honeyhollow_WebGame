// Honeyhollow service worker: lets the game start without a connection after
// the first visit. Build files have unique (hashed) names, so they are served
// from the cache; the page itself is fetched fresh whenever possible so
// updates arrive, and falls back to the cached copy offline. The online API
// is never cached.
const CACHE = 'honeyhollow-v1';

self.addEventListener('install', (event) => {
  // Precache the page and the scripts/styles it names, so the very next start works offline.
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch('./', { cache: 'no-cache' });
        if (res.ok) {
          const html = await res.clone().text();
          await cache.put('./', res);
          const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map((m) => m[1]);
          await cache.addAll([...new Set(assets)]);
        }
      } catch {
        /* offline while installing: the page caches itself as it loads */
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // live data only
  if (req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('.html')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) await cache.put(req.mode === 'navigate' ? './' : req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match('./')) || Response.error();
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.type === 'basic') await cache.put(req, res.clone());
  return res;
}
