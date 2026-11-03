import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { load, type Highlight, type Progress } from '../lib/store';
import { author, getBook, type Book } from '../lib/books';
import { today } from '../lib/epub';
import { download, notesExport, readStats, readingSpeed } from '../lib/shared';

type Row = { id: number; book?: Book; pct: number; min: number; words: number; last: number; hl: number; notes: number; marks: number };
const fmtMin = (m: number) => m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim();

/** Reading statistics from this device only: no account, nothing sent anywhere. */
export default function Stats() {
  const [books, setBooks] = useState<Record<number, Book>>({});
  const log = load<Record<string, number>>('readlog', {}); const st = readStats(); const wpm = readingSpeed();
  const rows: Row[] = useMemo(() => {
    const ids = new Set<number>(); Object.keys(localStorage).forEach(k => { const m = /^leone:(progress|highlights|bookmarks):(\d+)$/.exec(k); if (m) ids.add(+m[2]); }); Object.keys(st.books).forEach(k => ids.add(+k));
    return [...ids].filter(i => i > 0).map(id => { const p = load<Progress & { book?: number }>(`progress:${id}`, { chapter: 0, pct: 0, at: 0 }); const h = load<Highlight[]>(`highlights:${id}`, []); const b = st.books[id];
      return { id, pct: Math.round((p.book ?? 0) * 100), min: b?.min ?? 0, words: b?.words ?? 0, last: Math.max(b?.last ?? 0, p.at || 0), hl: h.length, notes: h.filter(x => x.note).length, marks: load<unknown[]>(`bookmarks:${id}`, []).length }; })
      .filter(r => r.last || r.hl || r.marks).sort((a, b) => b.last - a.last);
  }, []);
  useEffect(() => { rows.slice(0, 40).forEach(r => getBook(r.id).then(b => setBooks(o => ({ ...o, [r.id]: b }))).catch(() => {})); }, [rows]);
  const total = Object.values(log).reduce((s, v) => s + v, 0); const words = Object.values(st.words).reduce((s, v) => s + v, 0);
  const streak = (() => { let n = 0; const d = new Date(); if (!log[today(d)]) d.setDate(d.getDate() - 1); while (log[today(d)]) { n++; d.setDate(d.getDate() - 1); } return n; })();
  const week: { k: string; label: string; m: number }[] = []; for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); week.push({ k: today(d), label: d.toLocaleDateString(undefined, { weekday: 'short' }), m: log[today(d)] || 0 }); }
  const maxW = Math.max(1, ...week.map(w => w.m)); const weekMin = week.reduce((s, w) => s + w.m, 0);
  const days = Object.values(log).filter(v => v > 0).length; const finished = rows.filter(r => r.pct >= 99).length;
  const exportAll = () => { const all = rows.filter(r => r.hl || r.marks).map(r => { const t = books[r.id]?.title.split(/[;:]/)[0] ?? `Book ${r.id}`;
      return notesExport('md', { id: r.id, title: t, author: books[r.id] ? author(books[r.id]) : '', hl: load<Highlight[]>(`highlights:${r.id}`, []), marks: load(`bookmarks:${r.id}`, []), chapterName: c => `Chapter ${c + 1}` }); });
    download('leone-library-notes.md', all.join('\n\n---\n\n'), 'text/markdown;charset=utf-8'); };
  return <div className="page wide stats-page">
    <div className="eyebrow">Reading stats</div><h1 className="display">Your reading</h1>
    <p className="lede">Time, pace and progress, measured by the reader as you read. Everything here is stored on this device only; no account needed.</p>
    <section aria-labelledby="st-kpi"><h2 id="st-kpi" className="sr-only">Summary</h2>
      <div className="kpis"><div className="kpi glass"><span>Time read</span><b className="gold-t">{fmtMin(total)}</b></div><div className="kpi glass"><span>Current streak</span><b>{streak} {streak === 1 ? 'day' : 'days'}</b></div>
        <div className="kpi glass"><span>Reading speed</span><b>{wpm ? `${wpm} wpm` : '—'}</b>{!wpm && <span>Read a few more pages to measure it</span>}</div><div className="kpi glass"><span>Books finished</span><b>{finished}</b><span>{rows.length} opened · {days} reading {days === 1 ? 'day' : 'days'}</span></div></div></section>
    <section className="glass st-week" aria-labelledby="st-week"><h2 id="st-week" className="h3">Last 7 days · {fmtMin(weekMin)}</h2>
      <div className="st-bars" role="list">{week.map(w => <div key={w.k} role="listitem" className="st-bar" aria-label={`${w.label}: ${w.m} minutes`}><span className="st-fill" style={{ height: `${(w.m / maxW) * 100}%` }} /><span className="st-lbl" aria-hidden="true">{w.label}</span></div>)}</div>
      {words > 0 && <p className="small muted">About {words.toLocaleString()} words read, counted from page turns.</p>}</section>
    <section aria-labelledby="st-books"><div className="row between wrap"><h2 id="st-books" className="h3">Books</h2>{rows.some(r => r.hl || r.marks) && <button className="btn ghost sm" onClick={exportAll}>Export all notes (Markdown)</button>}</div>
      {!rows.length ? <p className="muted">Nothing yet. <Link to="/library">Open a book</Link> and the reader starts counting.</p>
        : <table className="st-table"><caption className="sr-only">Reading statistics per book</caption><thead><tr><th scope="col">Book</th><th scope="col">Progress</th><th scope="col">Time</th><th scope="col">Highlights</th><th scope="col">Last read</th></tr></thead>
          <tbody>{rows.map(r => { const b = books[r.id];
            return <tr key={r.id}><th scope="row"><Link to={`/read?id=${r.id}`}>{b ? b.title.split(/[;:]/)[0] : `Book ${r.id}`}</Link>{b && <span className="small muted"> · {author(b)}</span>}</th>
              <td><div className="st-prog" role="progressbar" aria-label="Progress" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${r.pct}%` }} /></div><span className="small">{r.pct}%</span></td>
              <td>{r.min ? fmtMin(r.min) : '—'}</td><td>{r.hl}{r.notes ? ` (${r.notes} notes)` : ''}{r.marks ? ` · ${r.marks} bookmarks` : ''}</td><td className="small">{r.last ? new Date(r.last).toLocaleDateString() : '—'}</td></tr>; })}</tbody></table>}</section>
    <p className="small muted">Yearly goals and a heatmap are on <Link to="/goals">Reading goals</Link>.</p>
  </div>;
}
