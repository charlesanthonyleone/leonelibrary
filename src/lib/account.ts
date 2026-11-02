// Client for the Leone accounts API (server/). Only active when FLAGS.accounts is on.
import { API, FLAGS } from './flags';
export type User = { id: string; email: string | null; name: string | null; credits: number; providers: string[] };
async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!FLAGS.accounts) throw new Error('Accounts are not enabled yet.');
  const r = await fetch(API + path, { credentials: 'include', ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  return r.json();
}
export const me = () => call<User | null>('/me');
export const oauthUrl = (p: 'google' | 'github') => `${API}/auth/${p}?return=${encodeURIComponent(location.href)}`;
export const magicLink = (email: string) => call<{ sent: boolean }>('/auth/magic', { method: 'POST', body: JSON.stringify({ email, return: location.origin + '/account' }) });
export const signOut = () => call('/auth/logout', { method: 'POST' });
export const credits = () => call<{ balance: number; ledger: { at: number; delta: number; reason: string }[] }>('/credits');
export const checkout = (pack: string) => call<{ url: string }>('/credits/checkout', { method: 'POST', body: JSON.stringify({ pack }) });
export const syncPush = (data: Record<string, unknown>) => call('/sync', { method: 'PUT', body: JSON.stringify(data) });
export const syncPull = () => call<Record<string, unknown>>('/sync');
export const vote = (bookId: number) => call<{ votes: number; threshold: number }>(`/votes/${bookId}`, { method: 'POST' });
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
/** Passkeys (WebAuthn): server issues the challenge and verifies the signature. */
export async function passkey(mode: 'register' | 'login') {
  const o = await call<{ challenge: string; rpId: string; userId?: string; allow?: string[] }>(`/auth/passkey/${mode}/options`, { method: 'POST' });
  const cred = mode === 'register'
    ? await navigator.credentials.create({ publicKey: { challenge: unb64(o.challenge), rp: { id: o.rpId, name: 'Leone Library' }, user: { id: unb64(o.userId!), name: 'reader', displayName: 'Leone reader' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' } } }) as PublicKeyCredential
    : await navigator.credentials.get({ publicKey: { challenge: unb64(o.challenge), rpId: o.rpId, userVerification: 'preferred' } }) as PublicKeyCredential;
  const r = cred.response as AuthenticatorAttestationResponse & AuthenticatorAssertionResponse;
  return call<User>(`/auth/passkey/${mode}/verify`, { method: 'POST', body: JSON.stringify({ id: cred.id, clientDataJSON: b64(r.clientDataJSON), ...(mode === 'register' ? { publicKey: b64(r.getPublicKey()!), alg: r.getPublicKeyAlgorithm() } : { authenticatorData: b64(r.authenticatorData), signature: b64(r.signature) }) }) });
}
