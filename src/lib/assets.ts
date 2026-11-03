// Book texts, covers and the search index are served from Charles's own storage (via a tunnel);
// the app shell stays on GitHub Pages. The address lives in data/assets.json so it can change without a rebuild.
const BASE = import.meta.env.BASE_URL;
export let ASSET = BASE;
let ready: Promise<void> | null = null;
export function initAssets() { return ready ??= loadBase(); }
async function loadBase() {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
    const c = await fetch(`${BASE}data/assets.json`, { cache: 'no-cache', signal: ctl.signal }).then(r => r.json()); clearTimeout(t);
    if (typeof c.base === 'string' && /^https:\/\//.test(c.base)) ASSET = c.base.replace(/\/?$/, '/');
  } catch { /* keep same-origin */ }
}
/** The stable cache key for an asset, independent of where it was fetched from. */
export const localKey = (path: string) => `${location.origin}${BASE}${path}`;
/** Fetch books/…, covers/… or fts/…: saved copy first, then the asset host, then same-origin as a fallback. */
export async function assetFetch(path: string): Promise<Response> {
  if ('caches' in self) { const hit = await caches.match(localKey(path)); if (hit) return hit; }
  if (ASSET !== BASE) { try { const r = await fetch(ASSET + path); if (r.ok) return r; } catch { /* fall through */ } }
  return fetch(BASE + path);
}
export const assetUrl = (path: string) => ASSET + path;
