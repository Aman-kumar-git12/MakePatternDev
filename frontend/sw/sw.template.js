/* MakePattern service worker (generated at build time from sw/sw.template.js). */
/* eslint-disable no-restricted-globals */
const BUILD_ID = '__BUILD_ID__';
const SHELL_CACHE = `mp-shell-${BUILD_ID}`;
const ASSET_CACHE = 'mp-assets';
// Every JS/CSS chunk of this build, so the app (incl. lazily loaded views) starts offline.
const PRECACHE_ASSETS = __PRECACHE_ASSETS__;
const SHELL_FILES = ['/index.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL_CACHE);
      await shell.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' })));
      const assets = await caches.open(ASSET_CACHE);
      const missing = [];
      for (const url of PRECACHE_ASSETS) {
        if (!(await assets.match(url))) missing.push(url);
      }
      await assets.addAll(missing);
    })()
  );
  // No skipWaiting here: the page shows "New version available" and the user decides.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith('mp-shell-') && key !== SHELL_CACHE) await caches.delete(key);
      }
      // Hashed assets are immutable; drop the ones this build no longer references.
      const assets = await caches.open(ASSET_CACHE);
      const keep = new Set(PRECACHE_ASSETS.map((u) => new URL(u, self.location.origin).href));
      for (const req of await assets.keys()) {
        if (!keep.has(req.url)) await assets.delete(req);
      }
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirstNavigation(request) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const shell = await caches.open(SHELL_CACHE);
      await shell.put('/index.html', res.clone());
    }
    return res;
  } catch {
    const cached = await caches.match('/index.html');
    return cached || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  // Never cache an HTML fallback under a .js/.css URL (a missing old chunk after a deploy).
  const type = res.headers.get('content-type') || '';
  if (res.ok && !type.includes('text/html')) {
    const assets = await caches.open(ASSET_CACHE);
    await assets.put(request, res.clone());
  }
  return res;
}

async function staleWhileRevalidate(request) {
  const shell = await caches.open(SHELL_CACHE);
  const cached = await shell.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res.ok) shell.put(request, res.clone());
      return res;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Never touch other origins (API, LeetCode, Pyodide/Monaco CDNs, fonts) or API paths.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request));
  } else if (url.pathname.startsWith('/icons/') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(staleWhileRevalidate(request));
  }
});
