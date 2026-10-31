import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getSnapshot, LANGS, searchBooks, type Book } from '../lib/books';
import BookCard from '../components/BookCard';

export default function Library() {
  const [sp, setSp] = useSearchParams();
  const q = sp.get('q') ?? '', lang = sp.get('lang') ?? '', page = Number(sp.get('page') ?? 1);
  const [input, setInput] = useState(q);
  const [books, setBooks] = useState<Book[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [next, setNext] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [source, setSource] = useState<'live' | 'snapshot'>('snapshot');
  const ctl = useRef<AbortController | null>(null);

  useEffect(() => {
    ctl.current?.abort(); const c = new AbortController(); ctl.current = c;
    setState('loading');
    getSnapshot().then(s => {
      if (c.signal.aborted) return;
      const ql = q.toLowerCase();
      const hits = s.results.filter(b => (!lang || b.languages.includes(lang)) && (!ql || (b.title + ' ' + b.authors.map(a => a.name).join(' ')).toLowerCase().includes(ql)));
      if (hits.length && page === 1) { setBooks(hits); setSource('snapshot'); }
    }).catch(() => {});
    searchBooks({ search: q || undefined, lang: lang || undefined, page }, c.signal)
      .then(r => { if (c.signal.aborted) return; setBooks(r.results); setCount(r.count); setNext(!!r.next); setSource('live'); setState('idle'); })
      .catch(() => { if (!c.signal.aborted) setState('error'); });
    return () => c.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, lang, page]);

  const go = (p: Record<string, string>) => { const n = new URLSearchParams(sp); Object.entries(p).forEach(([k, v]) => v ? n.set(k, v) : n.delete(k)); setSp(n); };
  return (
    <div className="page">
      <div className="eyebrow">The Library</div>
      <h1 className="display">The Open Library</h1>
      <p className="lede">Live search of Project Gutenberg's public-domain catalogue. Standard Ebooks, Internet Archive and Wikisource indexing is next.</p>
      <form className="searchbar glass" onSubmit={e => { e.preventDefault(); go({ q: input.trim(), page: '' }); }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Search titles or authors: Tolstoy, Austen, Holmes…" aria-label="Search the library" />
        <select value={lang} onChange={e => go({ lang: e.target.value, page: '' })} aria-label="Language">
          <option value="">All languages</option>
          {Object.entries(LANGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="btn gold">Search</button>
      </form>
      <div className="status small muted">
        {state === 'loading' && <span><span className="spin" /> Searching Gutenberg live{books.length ? ' — showing instant results from our cached catalogue meanwhile' : '…'}</span>}
        {state === 'idle' && count !== null && <span>{count.toLocaleString()} public-domain books{q && <> for “{q}”</>}{lang && <> in {LANGS[lang]}</>} · live from Gutendex</span>}
        {state === 'error' && <span>Gutendex didn't answer in time. Showing the cached catalogue{books.length ? '' : ' (no matches)'}. <button className="link" onClick={() => go({ page: String(page) })}>Retry</button></span>}
      </div>
      <div className="grid-books">{books.map(b => <BookCard key={b.id} b={b} />)}</div>
      {source === 'live' && (page > 1 || next) && (
        <div className="row gap center pager">
          <button className="btn ghost" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>← Previous</button>
          <span className="muted">Page {page}</span>
          <button className="btn ghost" disabled={!next} onClick={() => go({ page: String(page + 1) })}>Next →</button>
        </div>
      )}
    </div>
  );
}
