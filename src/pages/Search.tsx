import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCatalog, getHostedRaw, type CatEntry, type HostedBook } from '../lib/books';

const BASE = import.meta.env.BASE_URL;
type Meta = { ids: number[]; stop: string[]; n: number };
const fold = (w: string) => w.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const hex = (s: string) => [...s].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
let metaP: Promise<Meta> | null = null; const shards = new Map<string, Promise<Record<string, number[]>>>();
const gz = async (u: string) => { const r = await fetch(u); if (!r.ok || !r.body) throw new Error('HTTP ' + r.status); const e = r.headers.get('content-encoding'); return JSON.parse(e?.includes('gzip') ? await r.text() : await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()); };
const meta = () => (metaP ??= fetch(`${BASE}fts/meta.json`).then(r => r.json()));
const key = (w: string) => /^[a-z]{2}/.test(w) ? w.slice(0, 2) : w[0];
const shard = (p: string) => { if (!shards.has(p)) shards.set(p, gz(`${BASE}fts/${hex(p)}.json.gz`).catch(() => ({}))); return shards.get(p)!; };

export type Hit = { book: CatEntry; ch: number; chTitle: string; snip: string; count: number };
export async function fullText(q: string, limit = 25, onHit?: (h: Hit) => void, start = 0): Promise<{ hits: Hit[]; candidates: number; next: number }> {
  const phrase = q.match(/"([^"]+)"/)?.[1]; const words = [...new Set((fold(q).match(/[\p{L}]{3,24}/gu) ?? []))];
  if (!words.length) return { hits: [], candidates: 0, next: 0 };
  const m = await meta(), stop = new Set(m.stop); let set = null as Set<number> | null;
  for (const w of words) { if (stop.has(w)) continue; const s = await shard(key(w)), d = s[w] ?? []; let a = 0; const ids = new Set(d.map(x => (a += x)));
    set = set ? new Set([...set].filter((x: number) => ids.has(x))) : ids; if (!set.size) break; }
  const cat = await getCatalog(), byId = new Map(cat.map(c => [c.id, c]));
  const cands = (set ? [...set].map(i => byId.get(m.ids[i])!) : cat).filter(Boolean).sort((a, b) => b.downloads - a.downloads);
  const hits: Hit[] = []; const needle = phrase ? fold(phrase) : null;
  const re = new RegExp(`(?<![\\p{L}])(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}])`, 'giu');
  const scan = (b: CatEntry, h: HostedBook) => { let best: Hit | null = null, total = 0;
    h.chapters.forEach((c, ci) => c.p.forEach(p => { const lp = p.toLowerCase(); if (ascii && !(needle ? lp.includes(needle.slice(0, 4)) : lp.includes(words[0].slice(0, 3)))) return; const f = fold(p); const ok = needle ? f.includes(needle) : words.every(w => f.includes(w)); if (!ok) return; total++;
      if (!best) { const at = needle ? f.indexOf(needle) : Math.max(0, f.search(re)); const s = Math.max(0, at - 90); best = { book: b, ch: ci, chTitle: c.t, snip: (s ? '…' : '') + p.slice(s, s + 260) + (p.length > s + 260 ? '…' : ''), count: 0 }; } }));
    if (best) (best as Hit).count = total; return best as Hit | null; };
  const ascii = /^[\x00-\x7f]*$/.test((needle ?? '') + words.join(''));
  const pool = cands.slice(start, start + 96); let i = 0;
  for (; i < pool.length && hits.length < limit; i += 16) {
    const got = await Promise.all(pool.slice(i, i + 16).map(b => getHostedRaw(b.id).then(raw => { const l = raw.toLowerCase(); if (ascii && !(needle ? l.includes(needle.split(' ')[0]) : words.every(w => l.includes(w)))) return null; return scan(b, JSON.parse(raw)); }).catch(() => null)));
    for (const g of got) if (g && hits.length < limit) { hits.push(g); onHit?.(g); }
  }
  return { hits, candidates: cands.length, next: start + i };
}

export default function Search() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const q0 = sp.get('q') ?? ''; const [q, setQ] = useState(q0);
  const [hits, setHits] = useState<Hit[]>([]); const [state, setState] = useState<'' | 'busy' | 'done'>(''); const [cands, setCands] = useState(0); const [next, setNext] = useState(0);
  useEffect(() => { if (!q0.trim()) return; let live = true; setHits([]); setState('busy');
    fullText(q0, 20, h => live && setHits(x => [...x, h])).then(r => { if (live) { setCands(r.candidates); setNext(r.next); setState('done'); } }).catch(() => live && setState('done'));
    return () => { live = false; }; }, [q0]);
  const words = (fold(q0).match(/[\p{L}]{3,24}/gu) ?? []);
  const mark = (s: string) => { const re = new RegExp(`(${words.join('|') || '$^'})`, 'giu'); return s.split(re).map((x, i) => i % 2 ? <mark key={i}>{x}</mark> : x); };
  return (
    <div className="page">
      <div className="eyebrow">Full-text search</div>
      <h1 className="display">Search inside every book</h1>
      <p className="lede">Find a line, a name or an idea anywhere in the complete text of all 2,500 hosted books. Put a phrase in “quotes” to match it exactly.</p>
      <form onSubmit={e => { e.preventDefault(); setSp({ q }); }} role="search"><input className="fx-in big" value={q} onChange={e => setQ(e.target.value)} placeholder='e.g. "it was the best of times" or whale lamp oil' aria-label="Search the text of every book" /></form>
      <p className="small"><button className="btn ghost sm" onClick={async () => { const c = await getCatalog(); const b = c[Math.floor(Math.random() * c.length)]; nav(`/read?id=${b.id}&ch=${Math.floor(Math.random() * Math.max(1, b.chapters))}`); }}>Open a random page in a random book</button></p>
      {state === 'busy' && <p className="muted" role="status">Searching… {hits.length} books so far</p>}
      {state === 'done' && <p className="muted" role="status">{hits.length ? `${hits.length} books shown, most-read first` : 'No book contains all of those words.'}{cands > hits.length ? ` (${cands.toLocaleString()} books contain every word)` : ''}</p>}
      <ol className="fts-list">{hits.map(h => <li key={h.book.id} className="glass"><Link to={`/read?id=${h.book.id}&ch=${h.ch}`}><b>{h.book.title}</b></Link> <span className="small muted">{h.book.author} · {h.chTitle} · {h.count} matching paragraph{h.count > 1 ? 's' : ''}</span><p className="snip">{mark(h.snip)}</p></li>)}</ol>
      {state === 'done' && next < cands && <button className="btn sm" onClick={() => { setState('busy'); fullText(q0, 20, h => setHits(x => x.some(y => y.book.id === h.book.id) ? x : [...x, h]), next).then(r => { setNext(r.next); setState('done'); }); }}>Search more books ({(cands - next).toLocaleString()} left)</button>}
    </div>
  );
}
