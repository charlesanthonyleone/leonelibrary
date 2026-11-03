import { useEffect, useState } from 'react';
import { assetFetch } from '../lib/assets';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getCatalog, getHostedRaw, type CatEntry, type HostedBook } from '../lib/books';

const BASE = import.meta.env.BASE_URL;
type Meta = { ids: number[]; stop: string[]; n: number };
const fold = (w: string) => w.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
const hex = (s: string) => [...s].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
let metaP: Promise<Meta> | null = null; const shards = new Map<string, Promise<Record<string, number[]>>>();
const gz = async (u: string) => { const r = await assetFetch(u); if (!r.ok || !r.body) throw new Error('HTTP ' + r.status); const e = r.headers.get('content-encoding'); return JSON.parse(e?.includes('gzip') ? await r.text() : await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text()); };
const meta = () => (metaP ??= assetFetch('fts/meta.json').then(r => r.json()));
const key = (w: string) => /^[a-z]{2}/.test(w) ? w.slice(0, 2) : w[0];
const shard = (p: string) => { if (!shards.has(p)) shards.set(p, gz(`fts/${hex(p)}.json.gz`).catch(() => ({}))); return shards.get(p)!; };

type Scan = { ch: number; chTitle: string; snip: string; count: number } | null;
let pool: Worker[] | null = null; let rr = 0, seq = 0; const waiting = new Map<number, (r: Scan) => void>();
function scanOff(raw: string, words: string[], needle: string | null, ascii: boolean): Promise<Scan> {
  if (typeof Worker === 'undefined') return import('../lib/fts.worker').then(m => m.scanRaw({ raw, words, needle, ascii }));
  pool ??= Array.from({ length: Math.min(4, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)) }, () => { const w = new Worker(new URL('../lib/fts.worker.ts', import.meta.url), { type: 'module' }); w.onmessage = (e: MessageEvent<{ id: number; r: Scan }>) => { waiting.get(e.data.id)?.(e.data.r); waiting.delete(e.data.id); }; return w; });
  const id = ++seq; return new Promise(res => { waiting.set(id, res); pool![rr++ % pool!.length].postMessage({ id, raw, words, needle, ascii }); });
}
/** Books whose title names the query come first. */
const tm = (b: CatEntry, words: string[]) => { const t = fold(b.title); return words.filter(w => t.includes(w)).length; };
export type Hit = { book: CatEntry; ch: number; chTitle: string; snip: string; count: number };
export async function fullText(q: string, limit = 25, onHit?: (h: Hit) => void, start = 0, onCands?: (c: CatEntry[], exact: boolean) => void): Promise<{ hits: Hit[]; candidates: number; next: number }> {
  const phrase = q.match(/"([^"]+)"/)?.[1]; const words = [...new Set((fold(q).match(/[\p{L}]{3,24}/gu) ?? []))];
  if (!words.length) return { hits: [], candidates: 0, next: 0 };
  // Index, catalog and every needed shard load in parallel.
  const T0 = performance.now(), dbg = (l: string) => { if (localStorage.getItem('ftsdebug')) console.log('fts', l, Math.round(performance.now() - T0)); };
  const [m, cat] = await Promise.all([meta(), getCatalog()]); dbg('meta+cat'); const stop = new Set(m.stop);
  const live = words.filter(w => !stop.has(w)); const lists = await Promise.all(live.map(w => shard(key(w)).then(s => s[w] ?? [])));
  let set = null as Set<number> | null;
  for (const d of lists.sort((a, b) => a.length - b.length)) { let a = 0; const ids = new Set(d.map(x => (a += x))); set = set ? new Set([...set].filter(x => ids.has(x))) : ids; if (!set.size) break; }
  dbg('shards'); const byId = new Map(cat.map(c => [c.id, c]));
  const cands = (set ? [...set].map(i => byId.get(m.ids[i])!) : cat).filter(Boolean).sort((a, b) => tm(b, words) - tm(a, words) || b.downloads - a.downloads);
  const pool = cands.slice(start, start + 96); onCands?.(pool.slice(0, limit), !phrase && live.length === words.length); dbg('cands');
  const hits: Hit[] = []; const needle = phrase ? fold(phrase) : null;
  const ascii = /^[\x00-\x7f]*$/.test((needle ?? '') + words.join(''));
  // Sliding window: a slow book never holds up the others.
  let i = 0, done = 0; const W = 24;
  await new Promise<void>(res => {
    const pump = () => { if (hits.length >= limit || (i >= pool.length && done >= i)) return res();
      while (i < pool.length && i - done < W && hits.length < limit) { const b = pool[i++];
        getHostedRaw(b.id).then(raw => scanOff(raw, words, needle, ascii)).then(r => { if (r && hits.length < limit) { const g = { book: b, ...r } as Hit; hits.push(g); onHit?.(g); } }).catch(() => null).finally(() => { done++; pump(); }); }
      if (i >= pool.length && done >= i) res(); };
    pump(); });
  return { hits, candidates: cands.length, next: start + i };
}
/** Warm the index, catalog and scanning workers as soon as the page opens. */
function prewarm() { meta().catch(() => {}); getCatalog().catch(() => {}); if (typeof Worker !== 'undefined' && !pool) void scanOff('{}', ['zzz'], null, true); }

export default function Search() {
  const nav = useNavigate(); const [sp, setSp] = useSearchParams(); const q0 = sp.get('q') ?? ''; const [q, setQ] = useState(q0);
  const [hits, setHits] = useState<Hit[]>([]); const [state, setState] = useState<'' | 'busy' | 'done' | 'err'>(''); const [cands, setCands] = useState(0); const [next, setNext] = useState(0); const [pend, setPend] = useState<{ c: CatEntry[]; exact: boolean } | null>(null);
  useEffect(prewarm, []);
  useEffect(() => { if (!q0.trim()) return; let live = true; setHits([]); setPend(null); setState('busy');
    fullText(q0, 20, h => live && setHits(x => [...x, h]), 0, (c, exact) => live && setPend({ c, exact })).then(r => { if (live) { setCands(r.candidates); setNext(r.next); setState('done'); } }).catch(() => live && setState('err'));
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
      {state === 'busy' && <p className="muted" role="status">{pend ? (pend.exact ? `${pend.c.length ? 'Books containing every word' : 'No book contains all of those words'}, finding the passages…` : 'Checking books for the exact phrase…') : 'Looking up the index…'} {hits.length ? `${hits.length} found` : ''}</p>}
      {state === 'done' && <p className="muted" role="status">{hits.length ? `${hits.length} books shown, best match first` : 'No book contains all of those words.'}{cands > hits.length ? ` (${cands.toLocaleString()} books contain every word)` : ''}</p>}
      {state === 'err' && <div className="glass" role="alert"><p><b>Search couldn't reach the book index.</b> You may be offline or the text host is busy.</p><button className="btn sm" onClick={() => { setSp({}); setTimeout(() => setSp({ q: q0 }), 0); }}>Try again</button> <Link className="btn ghost sm" to={`/library?q=${encodeURIComponent(q0)}`}>Search titles and authors instead</Link></div>}
      {state === 'done' && !hits.length && <p className="small">Try fewer or different words, drop the quotes, or <Link to={`/library?q=${encodeURIComponent(q0)}`}>search titles and authors</Link>.</p>}
      <ol className="fts-list" aria-busy={state === 'busy'}>{(state === 'done' ? [...hits].sort((a, b) => tm(b.book, words) - tm(a.book, words) || b.count - a.count) : hits).map(h => <li key={h.book.id} className="glass"><Link to={`/read?id=${h.book.id}&ch=${h.ch}`}><b>{h.book.title}</b></Link> <span className="small muted">{h.book.author} · {h.chTitle} · {h.count} matching paragraph{h.count > 1 ? 's' : ''}</span><p className="snip">{mark(h.snip)}</p></li>)}
        {state === 'busy' && pend?.exact && pend.c.filter(b => !hits.some(h => h.book.id === b.id)).slice(0, Math.max(0, 20 - hits.length)).map(b => <li key={'p' + b.id} className="glass pending"><Link to={`/book?id=${b.id}`}><b>{b.title}</b></Link> <span className="small muted">{b.author} · finding the passage…</span></li>)}</ol>
      {state === 'done' && next < cands && <button className="btn sm" onClick={() => { setState('busy'); fullText(q0, 20, h => setHits(x => x.some(y => y.book.id === h.book.id) ? x : [...x, h]), next).then(r => { setNext(r.next); setState('done'); }).catch(() => setState('err')); }}>Search more books ({(cands - next).toLocaleString()} left)</button>}
    </div>
  );
}
