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

/** One-time move of this device's saved progress, bookmarks, highlights and 3D-shelf anchor onto the current split (v2, v3 … each remap maps from the previous version).
 *  Runs before the reader gets the chapters; idempotent (marker `chv:<id>`). */
export function migrateSaved(b: HostedV2) {
  const v = b.v ?? 1; if (v < 2 || !b.remap || b.id < 0) return;
  const mk = `chv:${b.id}`; if (load<number>(mk, 0) >= v) return;
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
  save(mk, v);
}
function findLabel(b: HostedV2, s?: string): [number, number] | null {
  if (!s || s.length < 12) return null; const k = s.slice(0, 60);
  for (let c = 0; c < b.chapters.length; c++) { const i = b.chapters[c].p.findIndex(p => p.includes(k)); if (i >= 0) return [c, i]; }
  return null;
}

/* ---- chapter titles: all-caps headings read in Title Case ("CHAPTER 1. Loomings" → "Chapter 1. Loomings") ---- */
const ROMAN = /^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
const NOT_ROMAN = new Set(['I', 'MIX', 'DIM', 'LID', 'MILD', 'CIVIL', 'VIVID', 'LIVID', 'DID', 'MID', 'DIVI', 'LIVI']);
const HEAD = /^(CHAPTER|CHAP|BOOK|PART|LETTER|STAVE|CANTO|SECTION|VOLUME|VOL|ACT|SCENE|EPILOGUE|PROLOGUE|PREFACE|INTRODUCTION|APPENDIX|CONCLUSION|NOTES?)$/;
const SMALL = new Set(['of', 'the', 'and', 'in', 'on', 'to', 'a', 'an', 'at', 'for', 'with', 'by', 'or', 'from', 'as', 'but', 'nor', 'into', 'upon']);
const isRoman = (w: string) => w.length <= 7 && ROMAN.test(w) && !NOT_ROMAN.has(w);
const cap = (w: string) => w.charAt(0) + w.slice(1).toLowerCase();
/** Title Case for chapter titles that shout. Mixed-case titles keep their own casing except an all-caps heading word
 *  (CHAPTER, BOOK, …). Roman numerals stay upper case. Non-Latin scripts are left alone. */
export function chapterTitle(t: string): string {
  if (!t || !/[A-Z]{2}/.test(t)) return t;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, ''); const words = t.match(/[A-Za-zÀ-ÿ'’]+/g) ?? [];
  const nonRoman = words.filter(w => !isRoman(w));
  const upper = nonRoman.join('').replace(/[^A-Za-zÀ-ÿ]/g, '');
  const shouting = upper.length >= 3 && upper === upper.toUpperCase() && letters.length >= 3;
  let first = true;
  return t.replace(/[A-Za-zÀ-ÿ'’]+/g, (w, off: number) => {
    const isFirst = first; first = false;
    if (w !== w.toUpperCase() || w.length < 2 && w !== 'A') return w;
    if (isRoman(w)) return w;
    if (!shouting && !(isFirst && HEAD.test(w))) return w;            // mixed titles: leave acronyms (USA, NASA) alone
    const prev = t.slice(0, off).trimEnd(); const startSeg = isFirst || /[.:;—–!?(]$/.test(prev);
    if (!startSeg && SMALL.has(w.toLowerCase())) return w.toLowerCase();
    if (/^[A-Z]+['’][A-Z]$/.test(w)) return cap(w);                  // DON'T → Don't
    return cap(w);
  });
}
