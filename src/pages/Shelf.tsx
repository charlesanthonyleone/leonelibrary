import { Link, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Room from '../components/Room';
import { useShelf, useProjects, load, uid, type Progress } from '../lib/store';
import { CSS_EXAMPLES, HTML_EXAMPLE, fromPreset, sanitizeHtml, scopeCss, usePlan } from '../lib/room';
import { FLOORS, ITEMS, MATS, PRESETS3D, SPINE_COLORS, TEXES, VIEWS, WALLS, WEATHERS, decodeLayout, encodeLayout, makeLayout, useLayouts, type Item, type ItemKind, type Layout } from '../lib/layout';
import { hasWebGL, caseHeight, respread } from '../lib/layout';
import type { Pick } from '../three/engine';
import type { Lib3DHandle } from '../three/Library3D';
import { playAmbience, stopAmbience, type Amb } from '../three/ambience';
import { Soon } from '../components/ui';
import BookHUD from '../components/BookHUD';
import ReaderTab from '../components/ReaderTab';
import { DEFAULT_LOOK, type ReaderLook } from '../lib/reader3d';
import type { ReadState } from '../three/reading';
import { getText, parseText, type Chapter } from '../lib/books';
import { save, useStored, type Edit } from '../lib/store';
import { logReading } from './Features';

const Library3D = lazy(() => import('../three/Library3D'));

export const STARTER = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: 2701, title: 'Moby Dick', author: 'Herman Melville' }, { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 1513, title: 'Romeo and Juliet', author: 'William Shakespeare' }, { id: 1260, title: 'Jane Eyre', author: 'Charlotte Brontë' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' }, { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens' }, { id: 768, title: 'Wuthering Heights', author: 'Emily Brontë' },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' }, { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy' },
  { id: 1399, title: 'Anna Karenina', author: 'Leo Tolstoy' }, { id: 158, title: 'Emma', author: 'Jane Austen' },
  { id: 161, title: 'Sense and Sensibility', author: 'Jane Austen' }, { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 120, title: 'Treasure Island', author: 'Robert Louis Stevenson' }, { id: 43, title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson' },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells' }, { id: 35, title: 'The Time Machine', author: 'H. G. Wells' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift' }, { id: 829, title: "Gulliver's Travels", author: 'Jonathan Swift' },
  { id: 5200, title: 'Metamorphosis', author: 'Franz Kafka' }, { id: 4300, title: 'Ulysses', author: 'James Joyce' },
  { id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli' }, { id: 205, title: 'Walden', author: 'Henry David Thoreau' },
];
const Lock = () => <span className="lock" aria-label="Editor plan">🔒</span>;
const CAMS: [string, Layout['cam']][] = [['Front', { az: 0, el: .08, dist: 2.7 }], ['Left', { az: -.75, el: .15, dist: 2.9 }], ['Right', { az: .7, el: .15, dist: 2.9 }], ['Close', { az: -.2, el: .05, dist: 1.5 }], ['Wide', { az: -.45, el: .22, dist: 5 }]];
export const ambFor = (l: Layout): Amb => l.weather === 'rain' ? 'rain' : l.setting === 'outdoor' && l.view === 'meadow' ? 'falls' : l.view === 'snow' ? 'wind' : l.view === 'night' ? 'night' : 'room';

type Tab = 'room' | 'shelves' | 'books' | 'decor' | 'light' | 'reader' | 'code' | 'ai';

export default function Shelf() {
  const [shelf] = useShelf(); const [projects] = useProjects(); const [plan, setPlan] = usePlan(); const pro = plan === 'editor-demo';
  const books = shelf.length ? shelf.map(b => ({ id: b.id, title: b.title, author: b.author })) : STARTER;
  const R = useLayouts(books); const L = R.cur;
  const loc = useLocation();
  const shared = useMemo(() => { const m = loc.hash.match(/room=([^&]+)/); return m ? decodeLayout(m[1]) : null; }, [loc.hash]);
  const view = shared ?? L;
  const [tab, setTab] = useState<Tab>('room'); const [mode, setMode] = useState<'view' | 'books' | 'decor'>('view'); const [tool, setTool] = useState<'translate' | 'rotate' | 'scale'>('translate');
  const [sel, setSel] = useState<Pick>(null); const [upsell, setUpsell] = useState<string | null>(null); const [toast, setToast] = useState(''); const [draft, setDraft] = useState({ css: L.css, html: L.html });
  const [gl] = useState(hasWebGL); const lib = useRef<Lib3DHandle>(null);
  useEffect(() => { setDraft({ css: L.css, html: L.html }); setSel(null); }, [L.id]);
  useEffect(() => { if (view.sound) playAmbience(ambFor(view)); else stopAmbience(); return () => stopAmbience(); }, [view.sound, ambFor(view)]);
  useEffect(() => { const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? R.redo() : R.undo(); } }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  // ------------------------------------------------ reading a book in the room
  const [lookRaw, setLook] = useStored<ReaderLook>('reader3d', DEFAULT_LOOK); const look = useMemo(() => ({ ...DEFAULT_LOOK, ...lookRaw }), [lookRaw]);
  const [rs, setRs] = useState<ReadState | null>(null); const [chs, setChs] = useState<Chapter[] | null>(null); const [fs, setFs] = useState(false);
  const roomRef = useRef<HTMLDivElement>(null); const active = useRef(Date.now());
  const openBook = (id: string) => {
    if (!lib.current?.open(id, look)) return; setChs(null); active.current = Date.now();
    const n = Number(id); if (!Number.isFinite(n)) { lib.current.setText(null, 'This book has no text attached yet.'); return; }
    getText(n).then(raw => { const ed = load<Edit[]>(`edits:${n}`, []);
      const c = parseText(raw).chapters.map((c, ci) => ({ ...c, paras: c.paras.map((p, pi) => ed.find(e => e.chapter === ci && e.para === pi)?.text ?? p) }));
      setChs(c); lib.current?.setText(c, '', load<{ ch: number; para: number } | null>(`bookmark:${n}`, null)); })
      .catch(() => lib.current?.setText(null, 'The text could not be loaded right now. Check your connection, or open it in the classic reader.'));
  };
  const closeBook = () => lib.current?.close();
  useEffect(() => { lib.current?.setLook(look); }, [look]);
  useEffect(() => { if (!rs || rs.stage !== 'reading' || !rs.anchor || !chs) return; const n = Number(rs.id);
    save(`bookmark:${n}`, rs.anchor); save(`progress:${n}`, { chapter: Math.max(0, rs.anchor.ch), pct: 0, at: Date.now() }); active.current = Date.now(); }, [rs?.spread, rs?.focus, chs]);
  const reading = !!rs;
  useEffect(() => { if (!reading) return; const t = setInterval(() => { if (document.visibilityState === 'visible' && (Date.now() - active.current < 120000 || window.speechSynthesis?.speaking)) logReading(1); }, 60000); return () => clearInterval(t); }, [reading]);
  const toggleFs = () => { const el = roomRef.current; if (!el) return;
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (fs) { setFs(false); return; }
    if (el.requestFullscreen) el.requestFullscreen().catch(() => setFs(true)); else setFs(true); };
  useEffect(() => { const f = () => setFs(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f); }, []);
  useEffect(() => { const k = (e: KeyboardEvent) => { const tg = e.target as HTMLElement; if (tg?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (reading) { if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); lib.current?.next(); active.current = Date.now(); }
        else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); lib.current?.prev(); active.current = Date.now(); }
        else if (e.key === 'Escape' && !document.fullscreenElement) { if (fs) setFs(false); else closeBook(); } }
      else if (e.key === 'Escape' && fs) setFs(false);
      if (e.key === 'f' && !e.metaKey && !e.ctrlKey) toggleFs(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2600); };
  const gate = (what: string, fn: () => void) => (pro ? fn() : setUpsell(what));
  const patch = (p: Partial<Layout>, coalesce = false) => R.set({ ...L, ...p, preset: p.preset ?? 'custom' }, coalesce);
  const gp = (what: string, p: Partial<Layout>, c = false) => gate(what, () => patch(p, c));
  const selItem = sel?.type === 'item' ? L.items.find(i => i.id === sel.id) : undefined;
  const selBook = sel?.type === 'book' ? L.books.find(b => String(b.id) === sel.id) : undefined;
  const setItem = (it: Item, c = false) => patch({ items: L.items.map(i => (i.id === it.id ? it : i)) }, c);
  const addItem = (kind: ItemKind) => gate('Decorations', () => { const H = caseHeight(L), onTop = !['lamp', 'rug', 'fern', 'plant'].includes(kind);
    const it: Item = { id: uid(), kind, x: onTop ? (Math.random() - .5) * (L.width - .4) : (Math.random() > .5 ? 1 : -1) * (L.width / 2 + .35), y: onTop ? H : 0, z: onTop ? .02 : .35, ry: 0, s: kind === 'rug' ? 1.3 : 1, color: kind === 'rug' ? '#6d2a22' : undefined };
    patch({ items: [...L.items, it] }); setMode('decor'); setTab('decor'); setSel({ type: 'item', id: it.id }); });
  const share = () => { const url = `${location.origin}${location.pathname}#room=${encodeLayout(L)}`; navigator.clipboard?.writeText(url).catch(() => {}); history.replaceState(null, '', `#room=${encodeLayout(L)}`); flash('Share link copied. The whole room lives in the link, nothing is uploaded.'); history.replaceState(null, '', location.pathname); };
  const snap = () => { const d = lib.current?.snapshot(); if (!d) return; const a = document.createElement('a'); a.href = d; a.download = `${L.name.replace(/\W+/g, '-')}.jpg`; a.click(); };
  const scoped = useMemo(() => scopeCss(view.css, '#lib-room'), [view.css]);
  const html = useMemo(() => (view.html.trim() ? sanitizeHtml(view.html) : ''), [view.html]);

  const Chips = <T extends string>({ label, opts, val, on, free }: { label: string; opts: [T, string][]; val: T; on: (v: T) => void; free?: boolean }) => (
    <div className="ctl"><div className="lbl">{label} {!pro && !free && <Lock />}</div><div className="chips">{opts.map(([v, n]) => <button key={v} className={`chip ${val === v ? 'on' : ''}`} onClick={() => (free ? on(v) : gate(label, () => on(v)))}>{n}</button>)}</div></div>);
  const Slider = ({ label, min, max, step, val, on, fmt, free }: { label: string; min: number; max: number; step: number; val: number; on: (v: number) => void; fmt?: (v: number) => string; free?: boolean }) => (
    <div className="ctl"><div className="lbl">{label} {!pro && !free && <Lock />} <span className="val">{fmt ? fmt(val) : val}</span></div>
      <input type="range" min={min} max={max} step={step} value={val} onChange={e => (free || pro ? on(+e.target.value) : setUpsell(label))} /></div>);
  const T = ({ id, children }: { id: Tab; children: ReactNode }) => <button role="tab" aria-selected={tab === id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{children}</button>;
  const hh = (t: number) => `${Math.floor(t) % 12 || 12}:${String(Math.round((t % 1) * 60)).padStart(2, '0')} ${t < 12 || t >= 24 ? 'am' : 'pm'}`;

  return (
    <div className="page wide shelf-page">
      <div className="shelf-head">
        <div><div className="eyebrow">My Shelf</div><h1 className="display">Your personal 3D library</h1>
          <p className="lede">Real wood, glass and marble under real light. Rearrange every book, place every plant and lamp, change the view out of the window, then share it with a link.</p></div>
        <label className="demo-toggle"><input type="checkbox" checked={pro} onChange={e => setPlan(e.target.checked ? 'editor-demo' : 'free')} /> <span>Preview Editor features <small className="muted">(local demo, nothing is charged)</small></span></label>
      </div>

      {shared && <div className="shared-bar glass"><span>👁 Viewing a shared room: <b>{shared.name}</b> <small className="muted">(read-only preview from a link)</small></span>
        <div className="row gap"><button className="btn gold sm" onClick={() => { R.add({ ...shared, id: uid(), name: shared.name + ' (copy)' }); history.replaceState(null, '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); location.hash = ''; }}>Save a copy</button><Link className="btn ghost sm" to="/shelf" onClick={() => (location.hash = '')}>Back to mine</Link></div></div>}

      {!shared && <div className="room-bar glass">
        <select aria-label="Saved rooms" value={L.id} onChange={e => R.setActive(e.target.value)}>{R.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        <button className="btn ghost sm" onClick={() => gate('Multiple rooms', () => R.add(makeLayout('study', books, `Room ${R.rooms.length + 1}`)))}>+ New {!pro && <Lock />}</button>
        <button className="btn ghost sm" onClick={() => gate('Multiple rooms', () => R.add({ ...L, id: uid(), name: L.name + ' copy' }))}>Duplicate</button>
        <button className="btn ghost sm" onClick={() => { const n = prompt('Name this room', L.name); if (n) patch({ name: n.slice(0, 40), preset: L.preset }); }}>Rename</button>
        {R.rooms.length > 1 && <button className="btn ghost sm" onClick={() => confirm(`Delete “${L.name}”?`) && R.remove(L.id)}>Delete</button>}
        <span className="sp" />
        <button className="icon-btn" title="Undo (Ctrl+Z)" disabled={!R.canUndo} onClick={R.undo}>↶</button>
        <button className="icon-btn" title="Redo (Ctrl+Shift+Z)" disabled={!R.canRedo} onClick={R.redo}>↷</button>
        <button className="btn ghost sm" onClick={snap}>Snapshot</button>
        <button className="btn gold sm" onClick={share}>Share link</button>
      </div>}

      <div className="shelf-layout">
        <div className="room-col">
          <div id="lib-room" ref={roomRef} className={`lib-room ${fs ? 'pseudo-fs' : ''} ${reading ? 'reading' : ''}`}>
            {gl ? <Suspense fallback={<div className="lib3d"><div className="lib3d-load"><span />Lighting the room…</div></div>}>
              <Library3D ref={lib} layout={view} mode={shared ? 'view' : mode} tool={tool} editable={!shared}
                onBooks={b => (pro || true) && patch({ books: b, preset: L.preset })} onItem={(it, f) => setItem(it, !f)} onSelect={p => { if (mode === 'view' && p?.type === 'book') return; setSel(p); if (p?.type === 'book') setTab('books'); if (p?.type === 'item') setTab('decor'); }}
                onCam={c => !reading && !shared && R.set({ ...L, cam: c }, true)} onOpen={openBook} onRead={setRs} />
            </Suspense> : <Room cfg={fromPreset(view.setting === 'outdoor' ? (view.view === 'snow' ? 'snow' : 'meadow') : 'study')} books={view.books} />}
            {scoped && <style>{scoped}</style>}
            {html && <div className="room-custom" dangerouslySetInnerHTML={{ __html: html }} />}
            {rs && <BookHUD lib={lib.current} st={rs} title={view.books.find(b => String(b.id) === rs.id)?.title ?? ''} chapters={chs} fs={fs || !!document.fullscreenElement} onFs={toggleFs} onClose={closeBook} />}
            {!shared && !reading && <div className="lib-tools">
              <div className="seg">{([['view', '🖐 Orbit'], ['books', '📚 Arrange books'], ['decor', '🪴 Place decor']] as const).map(([m, n]) => <button key={m} className={mode === m ? 'on' : ''} onClick={() => (m === 'decor' && !pro ? setUpsell('Placing decorations') : setMode(m))}>{n}{m === 'decor' && !pro && <Lock />}</button>)}</div>
              {mode === 'decor' && <div className="seg">{([['translate', 'Move'], ['rotate', 'Rotate'], ['scale', 'Scale']] as const).map(([m, n]) => <button key={m} className={tool === m ? 'on' : ''} onClick={() => setTool(m)}>{n}</button>)}</div>}
            </div>}
            {!reading && <><div className="lib-cams">{CAMS.map(([n, c]) => <button key={n} onClick={() => { lib.current?.setCam(c); if (!shared) R.set({ ...L, cam: c }, true); }}>{n}</button>)}
              <button className={view.sound ? 'on' : ''} onClick={() => shared ? null : patch({ sound: !L.sound, preset: L.preset })} title="Ambient sound, generated in your browser">{view.sound ? '🔊' : '🔈'} Sound</button>
              <button onClick={toggleFs} title="Full screen (F)">{fs ? '⤡ Exit' : '⤢ Expand'}</button></div>
            <div className="lib-hint">{mode === 'books' ? 'Drag a book to any shelf or position' : mode === 'decor' ? 'Click an object, then drag the handles. It settles onto whatever is below' : 'Click a book to take it off the shelf and read · drag to orbit · scroll to zoom'}</div></>}
          </div>
          {toast && <div className="toast">{toast}</div>}
        </div>

        {!shared && <aside className="studio-panel glass">
          <div className="tabs wrap" role="tablist"><T id="room">Room</T><T id="shelves">Shelves</T><T id="books">Books</T><T id="decor">Decor</T><T id="light">Light</T><T id="reader">Reader</T><T id="code">HTML/CSS</T><T id="ai">AI</T></div>

          {tab === 'room' && <div className="ctls">
            <div className="lbl">Start from a room</div>
            <div className="presets3d">{PRESETS3D.map(p => { const locked = !p.free && !pro;
              return <button key={p.id} className={`p3 ${L.preset === p.id ? 'on' : ''}`} onClick={() => (locked ? setUpsell(p.name) : R.set({ ...L, ...p.make(), books: respread(L.books, p.make().shelves), id: L.id, name: L.name }))}>
                <span className={`p3-sw p3-${p.id}`} /><b>{p.name} {locked && <Lock />}</b><small>{p.blurb}</small></button>; })}</div>
            <Chips label="Setting" opts={[['room', 'Indoors'], ['outdoor', 'Outdoors']]} val={L.setting} on={v => patch({ setting: v, floor: v === 'outdoor' ? (L.view === 'snow' ? 'snow' : 'grass') : 'oak' })} />
            <Chips label="View" opts={VIEWS} val={L.view} on={v => patch({ view: v, floor: L.setting === 'outdoor' ? (v === 'snow' ? 'snow' : 'grass') : L.floor })} />
            {L.setting === 'room' && <>
              <Chips label="Walls" opts={WALLS} val={L.wall} on={v => patch({ wall: v })} />
              <Chips label="Floor" opts={FLOORS.filter(f => f[0] === 'oak' || f[0] === 'marble')} val={L.floor} on={v => patch({ floor: v })} />
              <Chips label="Window" opts={[['on', 'Window'], ['off', 'Solid wall']]} val={L.window ? 'on' : 'off'} on={v => patch({ window: v === 'on' })} />
            </>}
          </div>}

          {tab === 'shelves' && <div className="ctls">
            <Chips label="Material" opts={MATS} val={L.mat} on={v => patch({ mat: v })} />
            <Slider label="Shelves" min={1} max={6} step={1} val={L.shelves} on={v => patch({ shelves: v, books: L.books.map(b => ({ ...b, shelf: Math.min(b.shelf, v - 1) })) }, true)} />
            <Slider label="Width" min={.8} max={2.6} step={.05} val={L.width} fmt={v => `${Math.round(v * 100)} cm`} on={v => patch({ width: v }, true)} />
            <Slider label="Shelf spacing" min={.28} max={.5} step={.01} val={L.spacing} fmt={v => `${Math.round(v * 100)} cm`} on={v => patch({ spacing: v }, true)} />
            <Slider label="Depth" min={.22} max={.42} step={.01} val={L.depth} fmt={v => `${Math.round(v * 100)} cm`} on={v => patch({ depth: v }, true)} />
          </div>}

          {tab === 'books' && <div className="ctls">
            <p className="small muted">Drag books between shelves here, or switch to <b>Arrange books</b> and drag them in the room. Free on every plan.</p>
            {Array.from({ length: L.shelves }, (_, i) => L.shelves - 1 - i).map(s => (
              <div key={s} className="dnd-shelf" onDragOver={e => e.preventDefault()} onDrop={e => { const id = e.dataTransfer.getData('book'); const b = L.books.find(x => String(x.id) === id); if (!b) return; patch({ books: [...L.books.filter(x => x !== b), { ...b, shelf: s }], preset: L.preset }); }}>
                <div className="lbl">Shelf {s + 1}{s === L.shelves - 1 ? ' (top)' : s === 0 ? ' (bottom)' : ''}</div>
                <div className="dnd-row">{L.books.filter(b => Math.min(b.shelf, L.shelves - 1) === s).map(b => <span key={b.id} draggable className={`dnd-book ${selBook === b ? 'on' : ''}`} style={{ background: b.color }} onDragStart={e => e.dataTransfer.setData('book', String(b.id))} onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.stopPropagation(); const id = e.dataTransfer.getData('book'); const m = L.books.find(x => String(x.id) === id); if (!m || m === b) return; const rest = L.books.filter(x => x !== m); rest.splice(rest.indexOf(b), 0, { ...m, shelf: s }); patch({ books: rest, preset: L.preset }); }}
                  onClick={() => setSel({ type: 'book', id: String(b.id) })} title={b.title}>{b.title}</span>)}</div></div>))}
            {selBook && <div className="sel-card">
              <b>{selBook.title}</b> <span className="muted small">· {selBook.author}</span>
              <div className="lbl">Spine colour {!pro && <Lock />}</div>
              <div className="swatches">{SPINE_COLORS.map(c => <button key={c} style={{ background: c }} className={selBook.color === c ? 'on' : ''} onClick={() => gate('Spine colours', () => patch({ books: L.books.map(b => (b === selBook ? { ...b, color: c } : b)) }))} aria-label={c} />)}
                <input type="color" value={selBook.color} onChange={e => gate('Spine colours', () => patch({ books: L.books.map(b => (b === selBook ? { ...b, color: e.target.value } : b)) }, true))} /></div>
              <Chips label="Binding" opts={TEXES} val={selBook.tex} on={v => patch({ books: L.books.map(b => (b === selBook ? { ...b, tex: v } : b)) })} />
              <Slider label="Height" min={.17} max={.3} step={.005} val={selBook.h} fmt={v => `${Math.round(v * 100)} cm`} on={v => patch({ books: L.books.map(b => (b === selBook ? { ...b, h: v } : b)) }, true)} />
              <Slider label="Thickness" min={.015} max={.08} step={.002} val={selBook.t} fmt={v => `${Math.round(v * 1000)} mm`} on={v => patch({ books: L.books.map(b => (b === selBook ? { ...b, t: v } : b)) }, true)} />
              {typeof selBook.id === 'number' && <Link className="btn ghost sm" to={`/read?id=${selBook.id}`}>Open in reader</Link>}
            </div>}
          </div>}

          {tab === 'decor' && <div className="ctls">
            <div className="lbl">Add to the room {!pro && <Lock />}</div>
            <div className="chips">{ITEMS.map(([k, n]) => <button key={k} className="chip" onClick={() => addItem(k)}>+ {n}</button>)}</div>
            <div className="lbl">In this room</div>
            <div className="chips">{L.items.map(i => <button key={i.id} className={`chip ${selItem === i ? 'on' : ''}`} onClick={() => { setSel({ type: 'item', id: i.id }); if (pro) setMode('decor'); }}>{ITEMS.find(x => x[0] === i.kind)?.[1]}</button>)}{!L.items.length && <span className="muted small">Nothing yet.</span>}</div>
            {selItem && <div className="sel-card">
              <b>{ITEMS.find(x => x[0] === selItem.kind)?.[1]}</b>
              <Slider label="Rotate" min={-3.14} max={3.14} step={.02} val={selItem.ry} fmt={v => `${Math.round(v * 57.3)}°`} on={v => setItem({ ...selItem, ry: v }, true)} />
              <Slider label="Scale" min={.3} max={3} step={.05} val={selItem.s} fmt={v => `${Math.round(v * 100)}%`} on={v => setItem({ ...selItem, s: v }, true)} />
              {(selItem.kind === 'rug' || selItem.kind === 'vase') && <div className="ctl"><div className="lbl">Colour</div><input type="color" value={selItem.color ?? '#6d2a22'} onChange={e => gate('Decor colours', () => setItem({ ...selItem, color: e.target.value }, true))} /></div>}
              <div className="row gap wrap"><button className="btn ghost sm" onClick={() => gate('Decorations', () => { const c = { ...selItem, id: uid(), x: selItem.x + .2 }; patch({ items: [...L.items, c] }); setSel({ type: 'item', id: c.id }); })}>Duplicate</button>
                <button className="btn ghost sm" onClick={() => gate('Decorations', () => { patch({ items: L.items.filter(i => i !== selItem) }); setSel(null); })}>Remove</button></div>
            </div>}
          </div>}

          {tab === 'light' && <div className="ctls">
            <Slider free label="Time of day" min={5} max={24} step={.25} val={L.time} fmt={hh} on={v => patch({ time: v, preset: L.preset }, true)} />
            <Chips label="Reading lamps & candles" opts={[['on', 'Lit'], ['off', 'Out']]} val={L.lampOn ? 'on' : 'off'} on={v => patch({ lampOn: v === 'on' })} />
            <div className="ctl"><div className="lbl">Lamp colour {!pro && <Lock />}</div><div className="swatches">{['#ffb46b', '#ffd9a0', '#fff1dc', '#ff8a4a', '#b8d4ff', '#ff6fb0'].map(c => <button key={c} style={{ background: c }} className={L.lampColor === c ? 'on' : ''} onClick={() => gp('Lamp colour', { lampColor: c })} aria-label={c} />)}<input type="color" value={L.lampColor} onChange={e => gp('Lamp colour', { lampColor: e.target.value }, true)} /></div></div>
            <Slider label="Ambient light" min={.1} max={1.6} step={.05} val={L.ambient} fmt={v => `${Math.round(v * 100)}%`} on={v => patch({ ambient: v }, true)} />
            <Slider label="Exposure" min={.4} max={2} step={.05} val={L.exposure} fmt={v => v.toFixed(2)} on={v => patch({ exposure: v }, true)} />
            <Chips label="Weather & effects" opts={WEATHERS} val={L.weather} on={v => patch({ weather: v })} />
            <Chips free label="Ambient sound" opts={[['on', 'On'], ['off', 'Off']]} val={L.sound ? 'on' : 'off'} on={v => patch({ sound: v === 'on', preset: L.preset })} />
            <p className="tiny muted">Sound is synthesised live in your browser (falls, rain, wind, crickets, a crackling room). No audio is downloaded.</p>
          </div>}

          {tab === 'reader' && <ReaderTab look={look} set={setLook} pro={pro} upsell={setUpsell} reading={reading} onPreview={() => { const b = view.books[0]; if (b) openBook(String(b.id)); }} />}
          {tab === 'code' && <div className={`ctls ${pro ? '' : 'gated'}`}>
            <p className="small muted">Layer your own HTML and CSS over the room: <code>#lib-room</code>, <code>.lib3d-canvas</code> (try a <code>filter</code>), <code>.room-custom</code>. Scoped to this room; scripts, handlers, iframes, forms and external URLs are stripped.</p>
            <div className="lbl">CSS</div>
            <textarea className="code" spellCheck={false} rows={8} value={draft.css} onChange={e => setDraft({ ...draft, css: e.target.value })} placeholder={'.lib3d-canvas { filter: sepia(.3) contrast(1.05); }'} disabled={!pro} />
            <div className="chips">{[['Film grade', '.lib3d-canvas { filter: sepia(.18) contrast(1.08) saturate(1.1); }'], ['Vignette', '& { box-shadow: inset 0 0 140px 30px rgba(0,0,0,.65); }\n.lib3d { mix-blend-mode: normal; }'], ['Gold frame', '& { outline: 2px solid #d8b46a; outline-offset: -10px; }'], ...CSS_EXAMPLES.slice(0, 0)].map(([n, c]) => <button key={n} className="chip" disabled={!pro} onClick={() => setDraft({ ...draft, css: (draft.css ? draft.css + '\n\n' : '') + c })}>+ {n}</button>)}</div>
            <div className="lbl">HTML overlay</div>
            <textarea className="code" spellCheck={false} rows={4} value={draft.html} onChange={e => setDraft({ ...draft, html: e.target.value })} placeholder={HTML_EXAMPLE} disabled={!pro} />
            <div className="row gap wrap"><button className="btn gold sm" disabled={!pro} onClick={() => patch({ css: draft.css, html: draft.html, preset: L.preset })}>Apply to my room</button>
              <button className="btn ghost sm" disabled={!pro} onClick={() => { setDraft({ css: '', html: '' }); patch({ css: '', html: '', preset: L.preset }); }}>Clear code</button></div>
            {!pro && <div className="gate-over"><Lock /><b>Custom HTML &amp; CSS is an Editor feature</b><Link className="btn gold sm" to="/plans">See plans</Link><button className="link small" onClick={() => setPlan('editor-demo')}>Preview it (demo)</button></div>}
          </div>}

          {tab === 'ai' && <div className="ctls">
            <div className="lbl">Describe your dream room <Soon /></div>
            <textarea rows={4} disabled placeholder="A cherry-wood case in a rainy Kyoto tea house, paper lanterns, moss on the lower shelf…" />
            <button className="btn gold sm" disabled>Design it for me · coming soon</button>
            <p className="small muted">The AI designer will build the layout for you with AI credits. No model is connected yet, so nothing is sent anywhere.</p>
          </div>}
          <p className="tiny muted">Every change saves on this device. Undo with Ctrl+Z.</p>
        </aside>}
      </div>

      {shelf.length > 0 && <div className="list glass pad">
        {shelf.map(b => { const p = load<Progress>(`progress:${b.id}`, { chapter: 0, pct: 0, at: 0 });
          return <div className="list-row" key={b.id}><Link to={`/read?id=${b.id}`}><b>{b.title.split(/[;:]/)[0]}</b> <span className="muted">· {b.author}</span></Link><span className="small muted">{p.at ? `Chapter ${p.chapter + 1}` : 'Not started'}</span></div>; })}
      </div>}
      {projects.length > 0 && <div className="list glass pad"><h3>Studio projects</h3>{projects.map(p => <div className="list-row" key={p.id}><b>{p.title}</b><span className="muted small">{p.kind} of {p.sourceTitle}</span></div>)}</div>}
      <p className="tiny muted center credits">Textures &amp; HDRI skies: <a href="https://polyhaven.com" target="_blank" rel="noreferrer">Poly Haven</a> (CC0): dark_wood, oak_veneer_01, marble_01, laminate_floor_02, painted_plaster_wall, aerial_grass_rock, rock_face, fabric_pattern_07, lythwood_room, kloofendal_48d_partly_cloudy_puresky, snowy_park_01, satara_night. Rendering by three.js. Painting: Milky Way photo used across the site.</p>

      {upsell && <div className="modal-back" onClick={() => setUpsell(null)}><div className="modal glass pad" role="dialog" aria-modal onClick={e => e.stopPropagation()}>
        <div className="eyebrow">Editor plan</div><h3 className="display sm">{upsell} is an Editor feature</h3>
        <p className="muted">Every room, material and view, placing and styling every object, multiple saved rooms, plus your own HTML and CSS. Reading and rearranging your books stay free forever.</p>
        <div className="row gap wrap"><Link className="btn gold" to="/plans">See plans</Link><button className="btn ghost" onClick={() => { setPlan('editor-demo'); setUpsell(null); }}>Preview as Editor (demo)</button></div>
      </div></div>}
    </div>
  );
}
