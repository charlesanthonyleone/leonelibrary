import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cover, getCatalog, personName, toBook, topSubject, type CatEntry } from '../lib/books';
import { GenCover, hueOf } from '../components/ui';
import BookCard from '../components/BookCard';
import { useWiki, WikiCredit } from '../lib/wiki';

/** Store-style genres, mapped to Gutenberg's "Category:" bookshelves. */
export const GENRES: { slug: string; name: string; shelves: string[] }[] = [
  { slug: 'novels', name: 'Novels', shelves: ['Category: Novels'] },
  { slug: 'mystery', name: 'Mystery & Crime', shelves: ['Category: Crime, Thrillers and Mystery'] },
  { slug: 'scifi', name: 'Science Fiction & Fantasy', shelves: ['Category: Science-Fiction & Fantasy'] },
  { slug: 'adventure', name: 'Adventure', shelves: ['Category: Adventure'] },
  { slug: 'romance', name: 'Romance', shelves: ['Category: Romance'] },
  { slug: 'philosophy', name: 'Philosophy', shelves: ['Category: Philosophy & Ethics'] },
  { slug: 'poetry', name: 'Poetry', shelves: ['Category: Poetry'] },
  { slug: 'plays', name: 'Plays & Drama', shelves: ['Category: Plays/Films/Dramas'] },
  { slug: 'history', name: 'History', shelves: ['Category: History - Other', 'Category: History - American', 'Category: History - Modern (1750+)', 'Category: History - Ancient', 'Category: History - British', 'Category: History - European', 'Category: History - Medieval/Middle Ages', 'Category: History - Warfare'] },
  { slug: 'biography', name: 'Biography & Memoir', shelves: ['Category: Biographies'] },
  { slug: 'myth', name: 'Myth & Folklore', shelves: ['Category: Mythology, Legends & Folklore'] },
  { slug: 'children', name: 'Children & Young Adult', shelves: ['Category: Children & Young Adult Reading'] },
  { slug: 'short-stories', name: 'Short Stories', shelves: ['Category: Short Stories'] },
  { slug: 'humour', name: 'Humour', shelves: ['Category: Humour'] },
  { slug: 'religion', name: 'Religion & Spirituality', shelves: ['Category: Religion/Spirituality'] },
  { slug: 'travel', name: 'Travel Writing', shelves: ['Category: Travel Writing'] },
];
const CLASSIC = /Best Books Ever|Harvard Classics|Classics of Literature/;
const realSubj = (s: string) => !/^[A-Z]{1,3}[0-9.]*$/.test(s);
const short = (t: string) => t.split(/[;:\r\n]/)[0].trim();
export const authorKey = (c: CatEntry) => c.authors[0]?.name ?? c.author;
export const authorHref = (name: string) => `/author?name=${encodeURIComponent(name)}`;
export const minutes = (w: number) => { const m = Math.round(w / 250); if (m < 60) return `${m} min`; const h = m / 60; return h < 10 ? `${Math.round(h * 10) / 10} hours` : `${Math.round(h).toLocaleString()} hours`; };
const byPop = (a: CatEntry, b: CatEntry) => b.downloads - a.downloads;
function useCatalog() { const [c, setC] = useState<CatEntry[] | null>(null); const [err, setErr] = useState(false);
  useEffect(() => { getCatalog().then(setC).catch(() => setErr(true)); }, []); return { cat: c, err }; }

/** A cover tile: the source's own cover, else a clean typographic cover. */
export function Tile({ c, rank }: { c: CatEntry; rank?: number }) {
  const [bad, setBad] = useState(false); const b = toBook(c); const src = cover(b); const a = personName(authorKey(c));
  return <li className="tile"><Link to={`/book?id=${c.id}`} className="tile-a">
    <span className="tile-cover">{src && !bad ? <img src={src} alt="" loading="lazy" decoding="async" width={160} height={240} onError={() => setBad(true)} /> : <GenCover title={short(c.title)} author={a} hue={hueOf(c.title)} />}</span>
    {rank != null && <span className="tile-rank" aria-hidden="true">{rank}</span>}
    <span className="tile-t">{short(c.title)}</span></Link>
    <Link className="tile-au" to={authorHref(authorKey(c))}>{a}</Link></li>;
}

/** Horizontally scrolling shelf with arrow buttons on desktop and swipe on phones. */
export function Row({ title, more, books, ranked }: { title: string; more?: string; books: CatEntry[]; ranked?: boolean }) {
  const ref = useRef<HTMLUListElement>(null); const id = 'row-' + title.replace(/\W+/g, '-').toLowerCase();
  if (!books.length) return null;
  const nudge = (d: number) => ref.current?.scrollBy({ left: d * ref.current.clientWidth * 0.85, behavior: 'smooth' });
  return <section className="shelfrow" aria-labelledby={id}>
    <div className="sr-head"><h2 className="sr-title" id={id}>{more ? <Link to={more}>{title} <span aria-hidden="true">›</span></Link> : title}</h2>
      <span className="sr-nav"><button className="sr-btn" onClick={() => nudge(-1)} aria-label={`Scroll ${title} back`}>‹</button><button className="sr-btn" onClick={() => nudge(1)} aria-label={`Scroll ${title} forward`}>›</button></span></div>
    <ul className="sr-list" ref={ref}>{books.map((c, i) => <Tile key={c.id} c={c} rank={ranked ? i + 1 : undefined} />)}</ul></section>;
}

/** Home page shelves: popular, classics, short reads, then genres. */
export function HomeShelves() {
  const { cat } = useCatalog();
  const rows = useMemo(() => { if (!cat) return null; const pop = [...cat].sort(byPop);
    return { pop: pop.slice(0, 20), classics: pop.filter(c => c.shelves.some(s => CLASSIC.test(s))).slice(20, 40),
      shorts: pop.filter(c => c.words > 3000 && c.words < 25000 && c.lang.includes('en')).slice(0, 20),
      genres: GENRES.slice(0, 8).map(g => ({ g, b: pop.filter(c => c.shelves.some(s => g.shelves.includes(s))).slice(0, 20) })) }; }, [cat]);
  if (!rows) return <section className="section shelves-home" aria-busy="true"><div className="sr-skel" /></section>;
  return <section className="section shelves-home" aria-label="Browse the library">
    <div className="eyebrow">Browse</div><h2 className="display">Find your next book</h2>
    <GenreChips />
    <Row title="Most read" more="/library" books={rows.pop} ranked />
    <Row title="Timeless classics" more="/genre?g=classics" books={rows.classics} />
    <Row title="Short reads · under two hours" more="/library?len=short" books={rows.shorts} />
    {rows.genres.map(({ g, b }) => <Row key={g.slug} title={g.name} more={`/genre?g=${g.slug}`} books={b} />)}
    <p className="center"><Link className="btn ghost" to="/subjects">Browse every subject</Link> <Link className="btn ghost" to="/authors">Browse authors</Link></p>
  </section>;
}
export function GenreChips() {
  return <nav className="genre-chips" aria-label="Genres">{GENRES.map(g => <Link key={g.slug} to={`/genre?g=${g.slug}`} className="gchip" style={{ ['--h' as string]: hueOf(g.name) }}>{g.name}</Link>)}</nav>;
}

function Grid({ books, per = 48 }: { books: CatEntry[]; per?: number }) {
  const [n, setN] = useState(per); useEffect(() => setN(per), [books, per]);
  return <><div className="grid-books">{books.slice(0, n).map(c => <BookCard key={c.id} b={toBook(c)} />)}</div>
    {n < books.length && <p className="center"><button className="btn ghost" onClick={() => setN(n + per)}>Show more ({(books.length - n).toLocaleString()} left)</button></p>}</>;
}
const Loading = ({ err }: { err: boolean }) => err ? <div className="glass pad" role="alert"><b>The catalogue didn't load.</b> Check your connection and reload.</div> : <p className="muted" role="status"><span className="spin" /> Opening the catalogue…</p>;

export function GenrePage() {
  const [sp] = useSearchParams(); const slug = sp.get('g') ?? ''; const { cat, err } = useCatalog();
  const g = slug === 'classics' ? { name: 'Timeless Classics', shelves: [] as string[] } : GENRES.find(x => x.slug === slug);
  const books = useMemo(() => !cat || !g ? [] : cat.filter(c => slug === 'classics' ? c.shelves.some(s => CLASSIC.test(s)) : c.shelves.some(s => g.shelves.includes(s))).sort(byPop), [cat, g, slug]);
  const authors = useMemo(() => topAuthors(books, 12), [books]);
  useEffect(() => { document.title = `${g ? g.name : 'Genres'} · Leone Library`; }, [g]);
  if (!g) return <div className="page"><h1 className="display">Genres</h1><GenreChips /></div>;
  return <div className="page browse">
    <nav className="crumbs small" aria-label="Breadcrumb"><Link to="/library">Library</Link> › <span>Genres</span></nav>
    <h1 className="display">{g.name}</h1>
    {cat ? <p className="lede">{books.length.toLocaleString()} complete books, sorted by how often they're read.</p> : <Loading err={err} />}
    <GenreChips />
    {books.length > 0 && <Row title="Top 10" books={books.slice(0, 10)} ranked />}
    {authors.length > 0 && <><h2 className="sr-title">Leading authors</h2><AuthorChips list={authors} /></>}
    <h2 className="sr-title">All {g.name.toLowerCase()}</h2><Grid books={books} />
  </div>;
}

function topAuthors(books: CatEntry[], n: number) { const m = new Map<string, { n: number; d: number; c: CatEntry }>();
  books.forEach(c => { const k = authorKey(c); if (/^(Anonymous|Unknown|Various)$/i.test(k)) return; const e = m.get(k) ?? { n: 0, d: 0, c }; e.n++; e.d += c.downloads; m.set(k, e); });
  return [...m].sort((a, b) => b[1].d - a[1].d).slice(0, n); }
function AuthorChips({ list }: { list: [string, { n: number; c: CatEntry }][] }) {
  return <ul className="author-chips">{list.map(([k, v]) => <li key={k}><Link to={authorHref(k)} className="achip"><span className="a-mono" style={{ ['--h' as string]: hueOf(k) }} aria-hidden="true">{initials(k)}</span><span><b>{personName(k)}</b><span className="small muted">{v.n} book{v.n > 1 ? 's' : ''}</span></span></Link></li>)}</ul>;
}
const initials = (k: string) => personName(k).split(/\s+/).filter(w => /^\p{Lu}/u.test(w)).map(w => w[0]).slice(0, 2).join('') || '·';
const life = (p?: { birth_year: number | null; death_year: number | null }) => !p ? '' : p.birth_year || p.death_year ? `${p.birth_year ?? '?'}–${p.death_year ?? '?'}`.replace(/-(\d+)/g, '$1 BC') : '';

export function AuthorPage() {
  const [sp] = useSearchParams(); const name = sp.get('name') ?? ''; const { cat, err } = useCatalog();
  const books = useMemo(() => (cat ?? []).filter(c => c.authors.some(a => a.name === name) || c.author === name).sort(byPop), [cat, name]);
  const p = books[0]?.authors.find(a => a.name === name);
  const subs = useMemo(() => { const m = new Map<string, number>(); books.forEach(c => new Set(c.subjects.map(topSubject)).forEach(s => m.set(s, (m.get(s) ?? 0) + 1))); return [...m].filter(x => realSubj(x[0])).sort((a, b) => b[1] - a[1]).slice(0, 8); }, [books]);
  const words = books.reduce((s, c) => s + c.words, 0);
  const bio = useWiki('authors', name);
  const related = useMemo(() => { if (!cat || !books.length) return []; const sh = new Set(books.flatMap(c => c.shelves.filter(s => s.startsWith('Category:'))));
    return topAuthors(cat.filter(c => authorKey(c) !== name && c.shelves.some(s => sh.has(s))), 8); }, [cat, books, name]);
  useEffect(() => { if (name) document.title = `${personName(name)}: books · Leone Library`; }, [name]);
  if (cat && !books.length) return <div className="page"><h1 className="display">Author not found</h1><p className="lede">No hosted books by “{name}”. <Link to="/authors">Browse all authors</Link>.</p></div>;
  return <div className="page browse">
    <nav className="crumbs small" aria-label="Breadcrumb"><Link to="/library">Library</Link> › <Link to="/authors">Authors</Link></nav>
    <header className="author-hero">
      <span className="a-mono xl" style={{ ['--h' as string]: hueOf(name) }} aria-hidden="true">{initials(name)}</span>
      <div><h1 className="display">{personName(name)}</h1>
        <p className="lede">{[life(p), cat ? `${books.length} book${books.length === 1 ? '' : 's'} in the Library` : '', words ? `about ${minutes(words)} of reading` : ''].filter(Boolean).join(' · ')}</p>
        {subs.length > 0 && <div className="row gap wrap">{subs.map(([s]) => <Link key={s} className="chip" to={`/subject?s=${encodeURIComponent(s)}`}>{s}</Link>)}</div>}
        {bio && <div className="author-bio"><p>{bio.text}</p><WikiCredit w={bio} /></div>}
        {books[0] && <p><Link className="btn gold" to={`/read?id=${books[0].id}`}>Start with {short(books[0].title)}</Link></p>}</div>
    </header>
    {!cat && <Loading err={err} />}
    <h2 className="sr-title">Books</h2><Grid books={books} />
    {related.length > 0 && <><h2 className="sr-title">Readers also explore</h2><AuthorChips list={related} /></>}
  </div>;
}

export function AuthorsPage() {
  const { cat, err } = useCatalog(); const [q, setQ] = useState('');
  const all = useMemo(() => topAuthors(cat ?? [], 100000), [cat]);
  const f = q.trim().toLowerCase(); const shown = f ? all.filter(([k]) => (k + ' ' + personName(k)).toLowerCase().includes(f)) : all;
  return <div className="page browse"><nav className="crumbs small" aria-label="Breadcrumb"><Link to="/library">Library</Link> › <span>Authors</span></nav>
    <h1 className="display">Authors</h1><p className="lede">{all.length ? `${all.length.toLocaleString()} authors, most read first.` : ''}</p>
    <input className="fx-in big" value={q} onChange={e => setQ(e.target.value)} placeholder="Find an author" aria-label="Find an author" />
    {!cat && <Loading err={err} />}<AuthorChips list={shown.slice(0, 240)} />
    {shown.length > 240 && <p className="small muted">Showing 240 of {shown.length.toLocaleString()}. Type a name to narrow.</p>}</div>;
}

export function SubjectsPage() {
  const { cat, err } = useCatalog(); const [q, setQ] = useState('');
  const subs = useMemo(() => { const m = new Map<string, number>(); cat?.forEach(c => new Set(c.subjects.map(topSubject)).forEach(s => m.set(s, (m.get(s) ?? 0) + 1))); return [...m].filter(x => x[1] >= 3 && realSubj(x[0])).sort((a, b) => b[1] - a[1]); }, [cat]);
  const f = q.trim().toLowerCase(); const shown = f ? subs.filter(([s]) => s.toLowerCase().includes(f)) : subs;
  return <div className="page browse"><nav className="crumbs small" aria-label="Breadcrumb"><Link to="/library">Library</Link> › <span>Subjects</span></nav>
    <h1 className="display">Subjects</h1><p className="lede">Library of Congress subjects across the collection. Pick one to see every book filed under it.</p>
    <GenreChips />
    <input className="fx-in big" value={q} onChange={e => setQ(e.target.value)} placeholder="Find a subject: whaling, France, ghosts…" aria-label="Find a subject" />
    {!cat && <Loading err={err} />}
    <ul className="subject-list">{shown.slice(0, 400).map(([s, n]) => <li key={s}><Link to={`/subject?s=${encodeURIComponent(s)}`}><span>{s}</span><span className="muted small">{n}</span></Link></li>)}</ul></div>;
}

export function SubjectPage() {
  const [sp] = useSearchParams(); const s = sp.get('s') ?? ''; const { cat, err } = useCatalog();
  const books = useMemo(() => (cat ?? []).filter(c => c.subjects.some(x => topSubject(x) === s)).sort(byPop), [cat, s]);
  const narrower = useMemo(() => { const m = new Map<string, number>(); books.forEach(c => c.subjects.forEach(x => { const p = x.split(' -- '); if (topSubject(x) === s && p[1]) m.set(p[1], (m.get(p[1]) ?? 0) + 1); })); return [...m].filter(x => x[1] > 1).sort((a, b) => b[1] - a[1]).slice(0, 12); }, [books, s]);
  useEffect(() => { if (s) document.title = `${s} · Leone Library`; }, [s]);
  return <div className="page browse"><nav className="crumbs small" aria-label="Breadcrumb"><Link to="/library">Library</Link> › <Link to="/subjects">Subjects</Link></nav>
    <h1 className="display">{s}</h1>{cat ? <p className="lede">{books.length.toLocaleString()} book{books.length === 1 ? '' : 's'}, most read first.</p> : <Loading err={err} />}
    {narrower.length > 0 && <div className="row gap wrap">{narrower.map(([x, n]) => <Link key={x} className="chip" to={`/library?q=${encodeURIComponent(x)}&subject=${encodeURIComponent(s)}`}>{x} · {n}</Link>)}</div>}
    <Grid books={books} /></div>;
}
