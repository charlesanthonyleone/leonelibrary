// Leone ID: optional, end-to-end encrypted cross-site account (id.xatmarket.com). Everything works without it.
// XP is counted on this device anonymously; linking adds encrypted sync of shelves/progress/notes + cross-site XP.
import { applySnapshot, localSnapshot, merge } from './e2e';
type Ach = { id: string; name: string; desc: string; unlocked: boolean };
export type XpSummary = { xp: number; level: number; into: number; need: number; perSite: Record<string, number>; counts: Record<string, number>; achievements: Ach[]; crossSite: boolean };
type SDK = {
  state(): { linked: boolean; sub: string | null }; onChange(f: () => void): () => void; link(back?: string): Promise<void>;
  handleRedirect(): Promise<null | { linked?: boolean; cancelled?: boolean; back?: string }>; unlink(): Promise<void>;
  data: { sync<T>(local: T, merge: (r: T, l: T) => T): Promise<T> };
  xp: { track(e: string, n?: number): void; summary(): Promise<XpSummary>; sync(): Promise<boolean> };
  privacy(): Promise<{ e2e: string[]; server_sees: string[] } | undefined>;
};
export const lid = (): SDK | null => (window as unknown as { LeoneID?: SDK }).LeoneID ?? null;
export const linked = () => !!lid()?.state().linked;
export function track(event: 'library.read_page' | 'library.finish_book' | 'library.bookmark' | 'library.shelf_add', n = 1) {
  try { lid()?.xp.track(event, n); window.dispatchEvent(new Event('leoneid:xp')); } catch { /* XP is best-effort */ }
}
/** Encrypt everything this reader keeps (leone:* keys) on the device and merge with the copy from other devices. */
export async function syncAll() {
  const s = lid(); if (!s || !linked()) return 0;
  const m = await s.data.sync<Record<string, unknown>>(localSnapshot(), merge); applySnapshot(m); await s.xp.sync().catch(() => false);
  return Object.keys(m).length;
}
let started = false;
/** Background sync while linked: on tab hide and every 3 minutes. No-op when not linked. */
export function startAutoSync() {
  if (started) return; started = true;
  const go = () => { if (linked()) syncAll().catch(() => {}); };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') go(); });
  setInterval(go, 180_000);
}
