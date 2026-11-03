/** Chapter data helpers (LR3). Book JSON v2 (scripts/chapters/chap2.py) adds:
 *  - chapters[i].g: optional group label ("Book One: 1805", "Canto the First") for a two-level contents list
 *  - v: 2, remap: old chapter index -> [new chapter, first paragraph] so positions saved under the old split still land right. */
import { load, save } from './store';
type Ch = { t: string; p: string[]; g?: string };
export type HostedV2 = { id: number; v?: number; remap?: [number, number][]; chapters: Ch[] };

/** Contents grouped for display: [{ group, items: [{ index, title }] }]. Books without groups give one untitled group. */
export function tocGroups(chapters: { t?: string; title?: string; g?: string }[]) {
  const out: { group: string | null; items: { index: number; title: string }[] }[] = [];
  chapters.forEach((c, index) => {
    const g = c.g ?? null; const title = c.t ?? c.title ?? `Chapter ${index + 1}`;
    if (!out.length || out[out.length - 1].group !== g) out.push({ group: g, items: [] });
    out[out.length - 1].items.push({ index, title });
  });
  return out;
}

/** Map an old (chapter, paragraph) to the new split, walking forward if the paragraph runs past the new chapter. */
export function mapPos(b: HostedV2, ch: number, para = 0): [number, number] {
  const r = b.remap?.[ch]; if (!r) return [Math.min(ch, b.chapters.length - 1), para];
  let [c, p] = r; p += para;
  while (c < b.chapters.length - 1 && p >= b.chapters[c].p.length) { p -= b.chapters[c].p.length; c++; }
  return [c, Math.max(0, Math.min(p, b.chapters[c].p.length - 1))];
}

/** One-time move of this device's saved progress, bookmarks, highlights and 3D-shelf anchor onto the v2 split.
 *  Runs before the reader gets the chapters; idempotent (marker `chv:<id>`). */
export function migrateSaved(b: HostedV2) {
  if (b.v !== 2 || !b.remap || b.id < 0) return;
  const mk = `chv:${b.id}`; if (load<number>(mk, 0) >= 2) return;
  const has = (k: string) => { try { return localStorage.getItem('leone:' + k) != null; } catch { return false; } };
  if (has(`progress:${b.id}`)) {
    const pr = load<{ chapter: number; para?: number; [k: string]: unknown }>(`progress:${b.id}`, { chapter: 0 });
    const [c, p] = mapPos(b, pr.chapter, pr.para ?? 0);
    save(`progress:${b.id}`, { ...pr, chapter: c, para: p, book: (c + 0.5) / b.chapters.length });
  }
  if (has(`bookmarks:${b.id}`)) {
    const ms = load<{ chapter: number; para: number; label?: string }[]>(`bookmarks:${b.id}`, []);
    save(`bookmarks:${b.id}`, ms.map(m => { const [c, p] = findLabel(b, m.label) ?? mapPos(b, m.chapter, m.para); return { ...m, chapter: c, para: p }; }));
  }
  if (has(`highlights:${b.id}`)) {
    const hs = load<{ chapter: number; text: string }[]>(`highlights:${b.id}`, []);
    save(`highlights:${b.id}`, hs.map(h => { const f = findLabel(b, h.text); return { ...h, chapter: f ? f[0] : mapPos(b, h.chapter)[0] }; }));
  }
  if (has(`bookmark:${b.id}`)) {
    const a = load<{ ch: number; [k: string]: unknown }>(`bookmark:${b.id}`, { ch: 0 });
    if (typeof a.ch === 'number' && a.ch >= 0) save(`bookmark:${b.id}`, { ...a, ch: mapPos(b, a.ch)[0] });
  }
  save(mk, 2);
}
function findLabel(b: HostedV2, s?: string): [number, number] | null {
  if (!s || s.length < 12) return null; const k = s.slice(0, 60);
  for (let c = 0; c < b.chapters.length; c++) { const i = b.chapters[c].p.findIndex(p => p.includes(k)); if (i >= 0) return [c, i]; }
  return null;
}
