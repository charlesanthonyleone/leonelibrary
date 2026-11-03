/* Leone ID SDK — drop-in for any Leone site.  <script src="https://id.xatmarket.com/sdk.js" data-client="xatcast"></script>
 * Everything works anonymously on the device. Linking a Leone ID is opt-in and only adds encrypted backup + cross-site XP.
 * Keys: kd (this site's data key) and kx (shared XP key) arrive in the URL fragment from Leone ID and stay on this device.
 * The Leone ID server stores only AES-256-GCM ciphertext. */
(() => {
  const me = document.currentScript, ISSUER = (me && me.dataset.issuer) || new URL(me ? me.src : location.href).origin, CLIENT = me && me.dataset.client;
  const S = crypto.subtle, te = new TextEncoder(), td = new TextDecoder(), LS = localStorage, P = 'lid:' + CLIENT + ':';
  const b64u = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ub64 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const get = (k, d) => { try { return JSON.parse(LS.getItem(P + k)) ?? d; } catch { return d; } }, put = (k, v) => v == null ? LS.removeItem(P + k) : LS.setItem(P + k, JSON.stringify(v));
  const listeners = new Set(), emit = () => listeners.forEach(f => { try { f(state()); } catch {} });
  const state = () => ({ linked: !!get('at'), sub: get('sub', null), client: CLIENT });
  async function call(path, body, method) { const at = get('at'); if (!at) throw new Error('not linked');
    const r = await fetch(ISSUER + path, { method: method || (body ? 'PUT' : 'GET'), headers: { authorization: 'Bearer ' + at, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({})); if (r.status === 401) { forget(); throw new Error('Leone ID link was removed'); } if (!r.ok && r.status !== 409) throw new Error(j.error || 'HTTP ' + r.status); return { status: r.status, ...j }; }
  const key = async n => { const k = get(n); return k ? S.importKey('raw', ub64(k), 'AES-GCM', false, ['encrypt', 'decrypt']) : null; };
  async function seal(k, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); return b64u(iv) + '.' + b64u(await S.encrypt({ name: 'AES-GCM', iv }, k, te.encode(JSON.stringify(obj)))); }
  async function unseal(k, s) { const [iv, ct] = s.split('.').map(ub64); return JSON.parse(td.decode(await S.decrypt({ name: 'AES-GCM', iv }, k, ct))); }
  function forget() { ['at', 'sub', 'kd', 'kx', 'ver:data', 'ver:xp'].forEach(k => put(k, null)); emit(); }

  // ---- linking (OIDC code + PKCE, public client) ----
  async function link(returnTo) { const v = b64u(crypto.getRandomValues(new Uint8Array(32))), st = b64u(crypto.getRandomValues(new Uint8Array(12)));
    const ch = b64u(await S.digest('SHA-256', te.encode(v))); const ruri = (me && me.dataset.redirect) || location.origin + location.pathname;
    sessionStorage.setItem('lid-pkce', JSON.stringify({ v, st, ruri, back: returnTo || location.href }));
    location.href = `${ISSUER}/authorize?response_type=code&client_id=${encodeURIComponent(CLIENT)}&redirect_uri=${encodeURIComponent(ruri)}&state=${st}&code_challenge=${ch}&code_challenge_method=S256&scope=openid`; }
  async function handleRedirect() { const u = new URL(location.href), code = u.searchParams.get('code'), st = u.searchParams.get('state');
    const pk = JSON.parse(sessionStorage.getItem('lid-pkce') || 'null'); if (!pk || st !== pk.st) return null; sessionStorage.removeItem('lid-pkce');
    const h = new URLSearchParams(location.hash.slice(1)); history.replaceState(null, '', u.pathname);
    if (!code) return { cancelled: true, back: pk.back };
    const r = await fetch(ISSUER + '/token', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', code, code_verifier: pk.v, client_id: CLIENT, redirect_uri: pk.ruri }) }).then(r => r.json());
    if (!r.access_token) throw new Error('Linking failed: ' + (r.error || 'unknown'));
    put('at', r.access_token); put('sub', r.sub); put('kd', h.get('lid_kd')); put('kx', h.get('lid_kx'));
    // id_token is returned too, for site backends that want a verified session: verify against ISSUER/jwks (ES256, aud=client, pairwise sub).
    track('leoneid.linked_site'); emit(); await xpSync().catch(() => {}); return { linked: true, sub: r.sub, id_token: r.id_token, back: pk.back }; }
  async function unlink() { try { await call('/v1/unlink', {}, 'POST'); } finally { forget(); } }

  // ---- encrypted data sync for this site (bucket "data"). merge(remote, local) -> merged ----
  async function push(obj) { const k = await key('kd'); if (!k) return false; const r = await call('/v1/sync/data', { data: await seal(k, obj), ver: get('ver:data', 0) });
    if (r.status === 409) { put('ver:data', r.ver); return 'conflict'; } put('ver:data', r.ver); return true; }
  async function pull() { const k = await key('kd'); if (!k) return null; const r = await call('/v1/sync/data'); put('ver:data', r.ver); return r.data ? unseal(k, r.data) : null; }
  async function sync(local, merge) { for (let i = 0; i < 3; i++) { const remote = await pull(); const m = remote ? merge(remote, local) : local; const ok = await push(m); if (ok === true) return m; local = m; } throw new Error('sync conflict'); }

  // ---- XP + achievements (anonymous locally; synced encrypted when linked) ----
  let CAT = null; const catalog = async () => CAT || (CAT = await fetch(ISSUER + '/achievements.json').then(r => r.json()));
  const day = () => new Date().toISOString().slice(0, 10);
  function track(event, n = 1) { const L = get('xp', { c: {}, d: {} }), today = day(); const d = L.d[event]?.day === today ? L.d[event] : { day: today, n: 0 };
    d.n += n; L.d[event] = d; L.c[event] = (L.c[event] || 0) + n; put('xp', L); clearTimeout(track.t); track.t = setTimeout(() => xpSync().catch(() => {}), 5000);
    window.dispatchEvent(new CustomEvent('leoneid:xp', { detail: { event, n } })); }
  // XP is computed from counts with per-day caps applied as events arrive (cap tracked per event per day per site).
  function xpOf(cat, L) { let xp = 0; for (const [e, n] of Object.entries(L.c || {})) { const r = cat.events[e]; if (!r) continue; const days = Math.max(1, (L.days?.[e] ?? 1)); xp += Math.min(n * r.xp, r.cap_per_day * days); } return xp; }
  function noteDays() { const L = get('xp', { c: {}, d: {} }); L.days = L.days || {}; L.seen = L.seen || {}; for (const [e, d] of Object.entries(L.d)) if (L.seen[e] !== d.day) { L.seen[e] = d.day; L.days[e] = (L.days[e] || 0) + 1; } put('xp', L); return L; }
  async function xpSync() { const L = noteDays(); const k = await key('kx'); if (!k) return false; const r = await call('/v1/sync/xp', { data: await seal(k, L), ver: get('ver:xp', 0) }); if (r.status === 409) { put('ver:xp', r.ver); return xpSync(); } put('ver:xp', r.ver); return true; }
  const levelOf = (cat, xp) => { let lvl = 1, need = cat.levels.base, acc = 0; while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * cat.levels.growth); } return { level: lvl, into: xp - acc, need }; };
  async function summary() { const cat = await catalog(); const ledgers = { [CLIENT]: noteDays() }; const k = await key('kx');
    if (k) { try { for (const l of (await call('/v1/xp')).ledgers) if (l.site !== CLIENT) ledgers[l.site] = await unseal(k, l.data); } catch {} }
    const counts = {}; let xp = 0; const perSite = {}; for (const [s, L] of Object.entries(ledgers)) { const x = xpOf(cat, L); perSite[s] = x; xp += x; for (const [e, n] of Object.entries(L.c || {})) counts[e] = (counts[e] || 0) + n; }
    const lv = levelOf(cat, xp), sites = Object.values(perSite).filter(x => x > 0).length;
    const unlocked = cat.achievements.filter(a => a.when.event ? (counts[a.when.event] || 0) >= a.when.count : a.when.sites ? sites >= a.when.sites : a.when.level ? lv.level >= a.when.level : false).map(a => a.id);
    return { xp, ...lv, perSite, counts, achievements: cat.achievements.map(a => ({ ...a, unlocked: unlocked.includes(a.id) })), crossSite: !!k }; }

  window.LeoneID = { issuer: ISSUER, client: CLIENT, state, onChange: f => (listeners.add(f), () => listeners.delete(f)), link, handleRedirect, unlink,
    signUp: () => link(), // on a site, sign-up = Leone ID passkey registration + recovery code, then link (only on an explicit "save across sites")
    data: { push, pull, sync }, xp: { track, summary, sync: xpSync }, privacy: () => fetch(ISSUER + '/api/sites').then(r => r.json()).then(j => j.sites.find(s => s.id === CLIENT)?.privacy) };
})();
