// Scans one hosted book's raw JSON for a query off the main thread.
type Req = { id: number; raw: string; words: string[]; needle: string | null; ascii: boolean };
const fold = (w: string) => w.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
export function scanRaw({ raw, words, needle, ascii }: Omit<Req, 'id'>) {
  const l = raw.toLowerCase(); if (ascii && !(needle ? l.includes(needle.split(' ')[0]) : words.every(w => l.includes(w)))) return null;
  const h = JSON.parse(raw) as { chapters: { t: string; p: string[] }[] };
  const re = new RegExp(`(?<![\\p{L}])(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'iu');
  let best: { ch: number; chTitle: string; snip: string } | null = null, total = 0, score = 0;
  h.chapters.forEach((c, ci) => c.p.forEach(p => { const lp = p.toLowerCase(); if (ascii && !(needle ? lp.includes(needle.slice(0, 4)) : lp.includes(words[0].slice(0, 3)))) return; const f = fold(p); const ok = needle ? f.includes(needle) : words.every(w => f.includes(w)); if (!ok) return; total++;
    const at = needle ? f.indexOf(needle) : Math.max(0, f.search(re)); const s = Math.max(0, at - 90);
    // prefer a paragraph where the words sit close together
    const sc = needle ? 1 : 1 / (1 + (Math.max(...words.map(w => f.indexOf(w))) - Math.min(...words.map(w => f.indexOf(w)))) / 80);
    if (!best || sc > score) { score = sc; best = { ch: ci, chTitle: c.t, snip: (s ? '…' : '') + p.slice(s, s + 260) + (p.length > s + 260 ? '…' : '') }; } }));
  return best ? { ...(best as object), count: total } as { ch: number; chTitle: string; snip: string; count: number } : null;
}
self.onmessage = (e: MessageEvent<Req>) => { let r = null; try { r = scanRaw(e.data); } catch { r = null; } (self as unknown as Worker).postMessage({ id: e.data.id, r }); };
