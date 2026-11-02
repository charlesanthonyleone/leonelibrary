// Leone accounts & credits API. Zero dependencies: Node 22+ (node:http, node:sqlite, WebCrypto).
// All secrets come from the environment; nothing secret lives in the repo. Stripe refuses live keys unless STRIPE_LIVE=1.
import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { createHash, createHmac, randomBytes, timingSafeEqual, webcrypto as wc } from 'node:crypto';

const E = process.env, PORT = Number(E.PORT ?? 8787), ORIGIN = E.SITE_ORIGIN ?? 'https://library.leoneuniversity.org', SELF = E.API_ORIGIN ?? 'https://api.leoneuniversity.org';
const RP_ID = new URL(ORIGIN).hostname, THRESHOLD = Number(E.VOTE_THRESHOLD ?? 10);
const PACKS = { small: { credits: 100, cents: 300 }, medium: { credits: 400, cents: 1000 } };
if (E.STRIPE_SECRET_KEY?.startsWith('sk_live') && E.STRIPE_LIVE !== '1') { console.error('Refusing live Stripe key without STRIPE_LIVE=1'); process.exit(1); }

const db = new DatabaseSync(E.DB_PATH ?? './leone.db');
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, email TEXT UNIQUE, name TEXT, created INTEGER);
CREATE TABLE IF NOT EXISTS idents(provider TEXT, sub TEXT, user TEXT, PRIMARY KEY(provider, sub));
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS magic(token TEXT PRIMARY KEY, email TEXT, ret TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY, challenge TEXT, user TEXT, expires INTEGER);
CREATE TABLE IF NOT EXISTS passkeys(id TEXT PRIMARY KEY, user TEXT, pub TEXT, alg INTEGER, created INTEGER);
CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY, user TEXT, delta INTEGER, reason TEXT, ref TEXT UNIQUE, at INTEGER);
CREATE TABLE IF NOT EXISTS votes(book INTEGER, user TEXT, at INTEGER, PRIMARY KEY(book, user));
CREATE TABLE IF NOT EXISTS sync(user TEXT PRIMARY KEY, data TEXT, at INTEGER);`);
const q = (s, ...a) => db.prepare(s).all(...a), one = (s, ...a) => db.prepare(s).get(...a), run = (s, ...a) => db.prepare(s).run(...a);
const tok = (n = 32) => randomBytes(n).toString('base64url'), now = () => Date.now();
const b64u = b => Buffer.from(b).toString('base64url'), unb = s => Buffer.from(s, 'base64url');

function userFor(provider, sub, email, name) {
  const id = one('SELECT user FROM idents WHERE provider=? AND sub=?', provider, sub)?.user ?? (email && one('SELECT id FROM users WHERE email=?', email)?.id);
  const uid = id ?? tok(12);
  if (!id) { run('INSERT INTO users VALUES(?,?,?,?)', uid, email ?? null, name ?? null, now()); run('INSERT OR IGNORE INTO ledger(user,delta,reason,ref,at) VALUES(?,?,?,?,?)', uid, Number(E.WELCOME_CREDITS ?? 0), 'Welcome', 'welcome:' + uid, now()); }
  run('INSERT OR IGNORE INTO idents VALUES(?,?,?)', provider, sub, uid); return uid;
}
const session = (res, user) => { const t = tok(); run('INSERT INTO sessions VALUES(?,?,?)', t, user, now() + 30 * 864e5); res.setHeader('set-cookie', `ls=${t}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=None`); };
const current = req => { const t = /(?:^|; )ls=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]; const s = t && one('SELECT user FROM sessions WHERE token=? AND expires>?', t, now()); return s ? s.user : null; };
const profile = id => { const u = one('SELECT * FROM users WHERE id=?', id); if (!u) return null; return { id: u.id, email: u.email, name: u.name, credits: one('SELECT COALESCE(SUM(delta),0) b FROM ledger WHERE user=?', id).b, providers: q('SELECT provider FROM idents WHERE user=?', id).map(r => r.provider) }; };
const safeRet = r => { try { const u = new URL(r); return u.origin === ORIGIN ? u.href : ORIGIN; } catch { return ORIGIN; } };

const OAUTH = {
  google: { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile', id: E.GOOGLE_CLIENT_ID, secret: E.GOOGLE_CLIENT_SECRET,
    who: async t => { const p = await (await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { authorization: 'Bearer ' + t } })).json(); return { sub: p.sub, email: p.email_verified ? p.email : null, name: p.name }; } },
  github: { auth: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email', id: E.GITHUB_CLIENT_ID, secret: E.GITHUB_CLIENT_SECRET,
    who: async t => { const h = { authorization: 'Bearer ' + t, 'user-agent': 'leone' }; const p = await (await fetch('https://api.github.com/user', { headers: h })).json(); const em = (await (await fetch('https://api.github.com/user/emails', { headers: h })).json()).find?.(e => e.primary && e.verified); return { sub: String(p.id), email: em?.email ?? null, name: p.name ?? p.login }; } },
};

async function sendMail(to, subject, text) {
  if (E.MAIL_WEBHOOK) return fetch(E.MAIL_WEBHOOK, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ to, subject, text }) });
  console.log(`[mail:console] to=${to} subject=${subject}\n${text}`); // no mail provider configured yet (DECISIONS-NEEDED)
}
async function stripe(path, form) {
  if (!E.STRIPE_SECRET_KEY) throw Object.assign(new Error('Payments are not enabled yet'), { status: 503 });
  const r = await fetch('https://api.stripe.com/v1' + path, { method: 'POST', headers: { authorization: 'Bearer ' + E.STRIPE_SECRET_KEY, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
  const j = await r.json(); if (!r.ok) throw new Error(j.error?.message ?? 'Stripe error'); return j;
}
function stripeSigOk(raw, header) {
  const parts = Object.fromEntries((header ?? '').split(',').map(p => p.split('='))); if (!parts.t || !parts.v1 || !E.STRIPE_WEBHOOK_SECRET) return false;
  if (Math.abs(now() / 1000 - Number(parts.t)) > 300) return false;
  const want = createHmac('sha256', E.STRIPE_WEBHOOK_SECRET).update(`${parts.t}.${raw}`).digest(); const got = Buffer.from(parts.v1, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}
function derToRaw(der) { // ES256 DER signature -> r||s
  let o = 2; const rl = der[o + 1]; let r = der.subarray(o + 2, o + 2 + rl); o += 2 + rl; const sl = der[o + 1]; let s = der.subarray(o + 2, o + 2 + sl);
  const fix = x => { x = x[0] === 0 ? x.subarray(1) : x; const b = Buffer.alloc(32); x.copy(b, 32 - x.length); return b; }; return Buffer.concat([fix(r), fix(s)]);
}
function challenge(user) { const id = tok(12), c = tok(32); run('INSERT INTO challenges VALUES(?,?,?,?)', id, c, user, now() + 300000); return { id, c }; }
function takeChallenge(clientDataJSON, type) {
  const cd = JSON.parse(unb(clientDataJSON).toString()); if (cd.type !== type || cd.origin !== ORIGIN) throw new Error('Bad passkey response');
  const row = q('SELECT * FROM challenges WHERE challenge=? AND expires>?', cd.challenge, now())[0]; if (!row) throw new Error('Passkey challenge expired');
  run('DELETE FROM challenges WHERE id=?', row.id); return row;
}

const LIMIT = new Map(); // per-IP rate limit: 120 req/min
const routes = {
  'GET /health': () => ({ ok: true }),
  'GET /me': ({ user }) => user ? profile(user) : null,
  'POST /auth/logout': ({ req, res }) => { const t = /(?:^|; )ls=([^;]+)/.exec(req.headers.cookie ?? '')?.[1]; if (t) run('DELETE FROM sessions WHERE token=?', t); res.setHeader('set-cookie', 'ls=; Path=/; Max-Age=0; Secure; SameSite=None'); return { ok: true }; },
  'POST /auth/magic': async ({ body }) => {
    const email = String(body.email ?? '').trim().toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Enter a valid email');
    const t = tok(); run('INSERT INTO magic VALUES(?,?,?,?)', t, email, safeRet(body.return), now() + 15 * 60000);
    await sendMail(email, 'Sign in to Leone Library', `Open this link within 15 minutes to sign in:\n${SELF}/auth/magic/${t}\n\nIf you didn't ask for it, ignore this email.`); return { sent: true };
  },
  'POST /auth/passkey/register/options': ({ user }) => { if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 }); const { c } = challenge(user); return { challenge: c, rpId: RP_ID, userId: b64u(Buffer.from(user)) }; },
  'POST /auth/passkey/register/verify': ({ body }) => { const ch = takeChallenge(body.clientDataJSON, 'webauthn.create'); run('INSERT OR REPLACE INTO passkeys VALUES(?,?,?,?,?)', body.id, ch.user, body.publicKey, Number(body.alg), now()); return profile(ch.user); },
  'POST /auth/passkey/login/options': () => { const { c } = challenge(null); return { challenge: c, rpId: RP_ID }; },
  'POST /auth/passkey/login/verify': async ({ body, res }) => {
    takeChallenge(body.clientDataJSON, 'webauthn.get'); const pk = one('SELECT * FROM passkeys WHERE id=?', body.id); if (!pk) throw new Error('Unknown passkey');
    const auth = unb(body.authenticatorData); if (auth.subarray(0, 32).compare(createHash('sha256').update(RP_ID).digest()) !== 0) throw new Error('Wrong site');
    const data = Buffer.concat([auth, createHash('sha256').update(unb(body.clientDataJSON)).digest()]);
    const es = pk.alg === -7, key = await wc.subtle.importKey('spki', unb(pk.pub), es ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await wc.subtle.verify(es ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', key, es ? derToRaw(unb(body.signature)) : unb(body.signature), data);
    if (!ok) throw new Error('Passkey check failed'); session(res, pk.user); return profile(pk.user);
  },
  'GET /credits': ({ user }) => { if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 }); return { balance: profile(user).credits, ledger: q('SELECT at,delta,reason FROM ledger WHERE user=? ORDER BY at DESC LIMIT 50', user) }; },
  'POST /credits/checkout': async ({ user, body }) => {
    if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 }); const p = PACKS[body.pack]; if (!p) throw new Error('Unknown pack');
    const s = await stripe('/checkout/sessions', { mode: 'payment', success_url: ORIGIN + '/account?paid=1', cancel_url: ORIGIN + '/account', client_reference_id: user, 'metadata[pack]': body.pack,
      'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'usd', 'line_items[0][price_data][unit_amount]': String(p.cents), 'line_items[0][price_data][product_data][name]': `Leone credits: ${p.credits}` });
    return { url: s.url };
  },
  'GET /sync': ({ user }) => { if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 }); return JSON.parse(one('SELECT data FROM sync WHERE user=?', user)?.data ?? '{}'); },
  'PUT /sync': ({ user, raw }) => { if (!user) throw Object.assign(new Error('Sign in first'), { status: 401 }); if (raw.length > 2e6) throw new Error('Too large'); run('INSERT OR REPLACE INTO sync VALUES(?,?,?)', user, raw, now()); return { ok: true }; },
};
async function handle(req, res) {
  const url = new URL(req.url, SELF), ip = req.headers['x-forwarded-for']?.split(',')[0] ?? req.socket.remoteAddress;
  const lim = LIMIT.get(ip) ?? { n: 0, t: now() }; if (now() - lim.t > 60000) { lim.n = 0; lim.t = now(); } lim.n++; LIMIT.set(ip, lim);
  res.setHeader('access-control-allow-origin', ORIGIN); res.setHeader('access-control-allow-credentials', 'true'); res.setHeader('access-control-allow-headers', 'content-type'); res.setHeader('access-control-allow-methods', 'GET,POST,PUT');
  if (req.method === 'OPTIONS') return res.end();
  if (lim.n > 120) { res.statusCode = 429; return res.end('{"error":"Slow down"}'); }
  let raw = ''; for await (const c of req) { raw += c; if (raw.length > 2.5e6) return req.destroy(); }
  const user = current(req), send = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
  try {
    const m = url.pathname.match(/^\/auth\/(google|github)(\/callback)?$/);
    if (m && req.method === 'GET') { const p = OAUTH[m[1]]; if (!p.id) return send(503, { error: `${m[1]} sign-in not configured` });
      if (!m[2]) { const state = tok(16); run('INSERT INTO challenges VALUES(?,?,?,?)', state, safeRet(url.searchParams.get('return')), null, now() + 600000);
        res.statusCode = 302; res.setHeader('location', `${p.auth}?${new URLSearchParams({ client_id: p.id, redirect_uri: `${SELF}/auth/${m[1]}/callback`, response_type: 'code', scope: p.scope, state })}`); return res.end(); }
      const st = one('SELECT * FROM challenges WHERE id=? AND expires>?', url.searchParams.get('state'), now()); if (!st) return send(400, { error: 'Sign-in expired, try again' }); run('DELETE FROM challenges WHERE id=?', st.id);
      const t = await (await fetch(p.token, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: p.id, client_secret: p.secret, code: url.searchParams.get('code') ?? '', grant_type: 'authorization_code', redirect_uri: `${SELF}/auth/${m[1]}/callback` }) })).json();
      if (!t.access_token) return send(400, { error: 'Sign-in failed' }); const w = await p.who(t.access_token); session(res, userFor(m[1], w.sub, w.email, w.name)); res.statusCode = 302; res.setHeader('location', st.challenge); return res.end(); }
    const mg = url.pathname.match(/^\/auth\/magic\/([\w-]+)$/);
    if (mg) { const r = one('SELECT * FROM magic WHERE token=? AND expires>?', mg[1], now()); if (!r) return send(400, { error: 'Link expired' }); run('DELETE FROM magic WHERE token=?', mg[1]); session(res, userFor('email', r.email, r.email, null)); res.statusCode = 302; res.setHeader('location', r.ret); return res.end(); }
    const v = url.pathname.match(/^\/votes\/(\d+)$/);
    if (v) { if (req.method === 'POST') { if (!user) return send(401, { error: 'Sign in first' }); run('INSERT OR IGNORE INTO votes VALUES(?,?,?)', Number(v[1]), user, now()); } return send(200, { votes: one('SELECT COUNT(*) n FROM votes WHERE book=?', Number(v[1])).n, threshold: THRESHOLD }); }
    if (url.pathname === '/votes') return send(200, q('SELECT book, COUNT(*) votes FROM votes GROUP BY book HAVING votes>=? ORDER BY votes DESC', THRESHOLD));
    if (url.pathname === '/stripe/webhook' && req.method === 'POST') { if (!stripeSigOk(raw, req.headers['stripe-signature'])) return send(400, { error: 'bad signature' });
      const ev = JSON.parse(raw); if (ev.type === 'checkout.session.completed' && ev.data.object.payment_status === 'paid') { const s = ev.data.object, p = PACKS[s.metadata?.pack];
        if (p) run('INSERT OR IGNORE INTO ledger(user,delta,reason,ref,at) VALUES(?,?,?,?,?)', s.client_reference_id, p.credits, `Bought ${p.credits} credits`, 'stripe:' + s.id, now()); } return send(200, { ok: true }); }
    const f = routes[`${req.method} ${url.pathname}`]; if (!f) return send(404, { error: 'Not found' });
    send(200, await f({ req, res, user, raw, body: raw ? JSON.parse(raw) : {} }));
  } catch (e) { send(e.status ?? 400, { error: e.message }); }
}
setInterval(() => { run('DELETE FROM sessions WHERE expires<?', now()); run('DELETE FROM magic WHERE expires<?', now()); run('DELETE FROM challenges WHERE expires<?', now()); }, 3600000).unref();
http.createServer(handle).listen(PORT, E.HOST ?? '127.0.0.1', () => console.log(`leone-api on ${E.HOST ?? '127.0.0.1'}:${PORT}`));
