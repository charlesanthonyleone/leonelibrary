// Leone Library offline worker. App shell cached on install; assets cached as used.
// Books saved with "Keep offline" live in the separate 'leone-books' cache and survive updates.
const V = 'leone-v4', BOOKS = 'leone-books';
const BASE = self.registration.scope;
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(async c => { await c.addAll([BASE, BASE + 'manifest.webmanifest', BASE + 'icon-192.png', BASE + 'data/catalog.json']); const list = await fetch(BASE + 'precache.json').then(r => r.json()).catch(() => []); await c.addAll(list.map(f => BASE + f)).catch(() => {}); }).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== BOOKS).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET') return;
  const url = new URL(r.url);
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put(BASE, cp)); return res; }).catch(() => caches.match(BASE)));
    return;
  }
  const am = url.pathname.match(/\/((?:books|covers|fts)\/[^/]+)$/);
  if (am) { // book texts, covers and the search index (same origin or the asset host): one cache key per file
    const key = BASE + am[1];
    e.respondWith(caches.match(key).then(hit => hit || fetch(r).then(res => { if (res.ok && am[1].startsWith('fts/')) { const cp = res.clone(); caches.open(V).then(c => c.put(key, cp)); } return res; })));
    return;
  }
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)/.test(url.host)) {
    e.respondWith(caches.open(V).then(async c => { const hit = await c.match(r); const net = fetch(r).then(res => { if (res.ok) c.put(r, res.clone()); return res; }).catch(() => hit); return hit || net; }));
  }
});
