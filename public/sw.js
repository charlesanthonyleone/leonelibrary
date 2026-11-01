// Leone Library offline worker: app shell is cached on install; pages, assets and book texts are cached as you use them.
const V = 'leone-v1';
const BASE = self.registration.scope;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon-192.png'])).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (r.mode === 'navigate') { // network first, fall back to the cached shell so every route works offline
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(BASE, cp)); return res; }).catch(() => caches.match(BASE)));
    return;
  }
  if (url.origin === location.origin || /gutendex|gutenberg|fonts\.(googleapis|gstatic)/.test(url.host)) { // stale-while-revalidate
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(r); const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; }));
  }
});
