// End-to-end encrypted sync. Shelves, highlights, notes and progress are encrypted here, in the browser, with a key
// derived from the reader's recovery phrase. The server only ever receives { v, salt, iv, ct }.
const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O, U
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export type Sealed = { v: 1; salt: string; iv: string; ct: string };

/** 200 random bits as 8 groups of 5 characters, e.g. 7K2QD-…  */
export function newPhrase(): string {
  const chars = [...crypto.getRandomValues(new Uint8Array(40))].map(x => ALPH[x & 31]).join(''); // 40 × 5 bits = 200 bits
  return chars.match(/.{5}/g)!.join('-');
}
export const normPhrase = (p: string) => p.toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
export const validPhrase = (p: string) => { const n = normPhrase(p); return n.length === 40 && [...n].every(c => ALPH.includes(c)); };

async function key(phrase: string, salt: Uint8Array) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normPhrase(phrase)), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: 310000 }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(data: unknown, phrase: string): Promise<Sealed> {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(phrase, salt), enc.encode(JSON.stringify(data))));
  return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
}
export async function open<T = unknown>(s: Sealed, phrase: string): Promise<T> {
  try { const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(s.iv) }, await key(phrase, unb64(s.salt)), unb64(s.ct)); return JSON.parse(dec.decode(pt)) as T; }
  catch { throw new Error('That recovery phrase does not unlock this library.'); }
}

/** Everything the reader keeps locally (leone:* keys), as a plain object. */
export function localSnapshot(): Record<string, unknown> {
  const o: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i)!; if (k.startsWith('leone:') && !k.startsWith('leone:e2e')) { try { o[k] = JSON.parse(localStorage.getItem(k)!); } catch { o[k] = localStorage.getItem(k); } } }
  return o;
}
/** Merge anonymous local data into the synced copy: lists are unioned, objects merged key by key, otherwise local wins. */
export function merge(remote: Record<string, unknown>, local: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...remote };
  for (const [k, lv] of Object.entries(local)) {
    const rv = remote[k];
    if (Array.isArray(lv) && Array.isArray(rv)) { const seen = new Set(rv.map(x => JSON.stringify(x))); out[k] = [...rv, ...lv.filter(x => !seen.has(JSON.stringify(x)))]; }
    else if (lv && rv && typeof lv === 'object' && typeof rv === 'object') out[k] = { ...(rv as object), ...(lv as object) };
    else out[k] = lv;
  }
  return out;
}
export function applySnapshot(o: Record<string, unknown>) { for (const [k, v] of Object.entries(o)) if (k.startsWith('leone:')) localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); }
