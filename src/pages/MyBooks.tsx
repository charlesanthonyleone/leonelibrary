import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dropOffline, getCatalog, offlineIds, type CatEntry } from '../lib/books';
import { parseEpub, privateDelete, privateList, privatePut, type PrivateBook } from '../lib/private';
import { norm, parseClippings, parseGoodreads, type Clip, type ReadRow } from '../lib/imports';
import { useStored } from '../lib/store';

function useCatalog() { const [c, setC] = useState<CatEntry[]>([]); useEffect(() => { getCatalog().then(setC).catch(() => {}); }, []); return c; }
function matcher(cat: CatEntry[]) {
  const m = new Map<string, CatEntry[]>(); for (const c of cat) { const k = norm(c.title); m.set(k, [...(m.get(k) ?? []), c]); }
  return (title: string, author: string) => { const hits = m.get(norm(title)) ?? []; const sur = norm(author).split(' ').pop() || ''; return hits.find(h => !sur || norm(h.author).includes(sur)); };
}

export function Offline() {
  const cat = useCatalog(); const [ids, setIds] = useState<number[] | null>(null); const [bytes, setBytes] = useState<number | null>(null);
  const refresh = () => { offlineIds().then(setIds); navigator.storage?.estimate?.().then(e => setBytes(e.usage ?? null)); };
  useEffect(refresh, []);
  const books = (ids ?? []).map(i => cat.find(c => c.id === i)).filter(Boolean) as CatEntry[];
  return (
    <div className="page">
      <div className="eyebrow">Offline library</div>
      <h1 className="display">Saved for offline</h1>
      <p className="lede">Books you keep offline open without a connection: on a plane, underground, anywhere. Use “Keep offline” on any book page. {bytes != null && <span className="muted">This site is using {(bytes / 1048576).toFixed(1)} MB on this device.</span>}</p>
      {ids && !books.length && <p className="muted">Nothing saved yet. <Link to="/library">Browse the Library</Link> and press “Keep offline” on a book.</p>}
      <ul className="req-list">{books.map(b => (
        <li key={b.id} className="glass"><div><Link to={`/read?id=${b.id}`}><b>{b.title}</b></Link><div className="small muted">{b.author} · {b.words.toLocaleString()} words</div></div>
          <span><Link className="btn sm gold" to={`/read?id=${b.id}`}>Read</Link> <button className="btn sm ghost" onClick={() => dropOffline(b.id).then(refresh)}>Remove</button></span></li>))}</ul>
      <p className="small muted">Your private imports are always available offline: see <Link to="/import">My imports</Link>.</p>
    </div>
  );
}

export function Imports() {
  const cat = useCatalog(); const match = useMemo(() => matcher(cat), [cat]); const nav = useNavigate();
  const [priv, setPriv] = useState<PrivateBook[]>([]); const [msg, setMsg] = useState(''); const [busy, setBusy] = useState(false);
  const [clips, setClips] = useStored<Clip[]>('kindle-clips', []); const [reads, setReads] = useStored<ReadRow[]>('goodreads', []);
  const refresh = () => privateList().then(l => setPriv(l.sort((a, b) => b.added - a.added))).catch(() => {});
  useEffect(() => { refresh(); }, []);
  async function onEpub(f?: File) { if (!f) return; setBusy(true); setMsg('');
    try { const b = await parseEpub(f); await privatePut(b); await refresh(); setMsg(`Imported “${b.title}” (${b.chapters.length} sections, ${b.words.toLocaleString()} words).`); } catch (e) { setMsg((e as Error).message); } setBusy(false); }
  async function onClips(f?: File) { if (!f) return; try { const c = parseClippings(await f.text()); if (!c.length) throw new Error('No highlights found in that file.'); setClips(c); setMsg(`Imported ${c.length} Kindle highlights.`); } catch (e) { setMsg((e as Error).message); } }
  async function onGr(f?: File) { if (!f) return; try { const r = parseGoodreads(await f.text()); setReads(r); setMsg(`Imported ${r.length} Goodreads entries.`); } catch (e) { setMsg((e as Error).message); } }
  const byBook = useMemo(() => { const m = new Map<string, Clip[]>(); for (const c of clips) m.set(c.title, [...(m.get(c.title) ?? []), c]); return [...m]; }, [clips]);
  const readHere = reads.map(r => ({ r, hit: match(r.title, r.author) })).filter(x => x.hit);
  return (
    <div className="page">
      <div className="eyebrow">My imports</div>
      <h1 className="display">Bring your own books and history</h1>
      <p className="lede">Everything on this page is read and stored only in this browser. Nothing is uploaded.</p>
      {msg && <p className="glass" role="status" style={{ padding: '.7rem 1rem' }}>{msg}</p>}

      <section className="glass imp-card"><h2>Private EPUBs</h2>
        <p className="small muted">DRM-free .epub files only (for example from Standard Ebooks, your own writing, or stores that sell without DRM). Opens in the Leone reader with all its features.</p>
        <label className="btn gold">{busy ? 'Reading…' : 'Choose EPUB'}<input type="file" accept=".epub,application/epub+zip" hidden onChange={e => onEpub(e.target.files?.[0])} /></label>
        <ul className="req-list">{priv.map(b => <li key={b.id} className="glass"><div><b>{b.title}</b><div className="small muted">{b.author} · {b.words.toLocaleString()} words · {b.file}</div></div>
          <span><button className="btn sm gold" onClick={() => nav(`/read?id=${b.id}`)}>Read</button> <button className="btn sm ghost" onClick={() => { if (confirm(`Delete “${b.title}” from this browser?`)) privateDelete(b.id).then(refresh); }}>Delete</button></span></li>)}</ul>
      </section>

      <section className="glass imp-card"><h2>Kindle highlights</h2>
        <p className="small muted">Connect your Kindle by USB and choose <code>documents/My Clippings.txt</code>.</p>
        <label className="btn gold">Choose My Clippings.txt<input type="file" accept=".txt,text/plain" hidden onChange={e => onClips(e.target.files?.[0])} /></label>
        {clips.length > 0 && <button className="btn ghost sm" onClick={() => setClips([])}>Clear</button>}
        {byBook.map(([t, cs]) => { const hit = match(t, cs[0].author); return (
          <details key={t} className="clip-book"><summary><b>{t}</b> <span className="small muted">{cs[0].author} · {cs.length} highlight{cs.length > 1 ? 's' : ''}</span> {hit && <Link className="small" to={`/read?id=${hit.id}`}>Read here →</Link>}</summary>
            {cs.map((c, i) => <blockquote key={i} className="clip">{c.text}{c.note && <div className="small"><b>Note:</b> {c.note}</div>}<div className="small muted">{c.loc && `Location ${c.loc}`}{c.at ? ` · ${new Date(c.at).toLocaleDateString()}` : ''}</div></blockquote>)}</details>); })}
      </section>

      <section className="glass imp-card"><h2>Goodreads history</h2>
        <p className="small muted">On Goodreads: My Books → Import and export → Export library. Choose the CSV it gives you.</p>
        <label className="btn gold">Choose Goodreads CSV<input type="file" accept=".csv,text/csv" hidden onChange={e => onGr(e.target.files?.[0])} /></label>
        {reads.length > 0 && <><button className="btn ghost sm" onClick={() => setReads([])}>Clear</button>
          <p>{reads.length} books · {reads.filter(r => r.shelf === 'read').length} read · {reads.filter(r => r.shelf === 'to-read').length} want to read · <b>{readHere.length} in the Leone Library</b></p>
          <ul className="req-list">{readHere.map(({ r, hit }) => <li key={hit!.id} className="glass"><div><b>{hit!.title}</b><div className="small muted">{hit!.author} · on your “{r.shelf}” shelf{r.rating ? ` · ${'★'.repeat(r.rating)}` : ''}</div></div><Link className="btn sm gold" to={`/read?id=${hit!.id}`}>Read</Link></li>)}</ul></>}
      </section>
      <p className="small muted">Saved books for offline reading: <Link to="/offline">Offline library</Link>.</p>
    </div>
  );
}
