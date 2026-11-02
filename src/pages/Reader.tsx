import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { author, getBook, getChapters, rightsFor, type Book, type Chapter } from '../lib/books';
import { uid, useDesign, useStored, type Edit, type Highlight, type Progress } from '../lib/store';
import DesignPanel from '../components/DesignPanel';
import { RightsTag } from '../components/ui';
import { logReading, shareNotesLink } from './Features';
import QuoteCard from '../components/QuoteCard';

type Bookmark = { id: string; chapter: number; para: number; label: string; at: number };
type A11y = { dyslexia: boolean; contrast: boolean; spacing: number; words: number; sr: boolean; spread: 'auto' | 'one' | 'two'; motion: 'flip' | 'slide' | 'none' };
const A11Y0: A11y = { dyslexia: false, contrast: false, spacing: 0, words: 0, sr: false, spread: 'auto', motion: 'slide' };

function marked(text: string, hs: Highlight[]) {
  if (!hs.length) return text;
  const parts: (string | JSX.Element)[] = []; let rest = text, k = 0;
  for (const h of hs) { const i = rest.indexOf(h.text); if (i < 0) continue;
    parts.push(rest.slice(0, i), <mark key={k++} title={h.note || 'Highlight'} className={h.note ? 'has-note' : ''}>{h.text}</mark>); rest = rest.slice(i + h.text.length); }
  parts.push(rest); return parts;
}

export default function Reader() {
  const [sp, setSp] = useSearchParams();
  const id = Number(sp.get('id'));
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [err, setErr] = useState('');
  const [d] = useDesign();
  const [a, setA] = useStored<A11y>('a11y', A11Y0); const ax = { ...A11Y0, ...a };
  const [prog, setProg] = useStored<Progress & { para?: number; book?: number }>(`progress:${id}`, { chapter: 0, pct: 0, at: 0 });
  const [hl, setHl] = useStored<Highlight[]>(`highlights:${id}`, []);
  const [edits, setEdits] = useStored<Edit[]>(`edits:${id}`, []);
  const [marks, setMarks] = useStored<Bookmark[]>(`bookmarks:${id}`, []);
  const [panel, setPanel] = useState<'none' | 'toc' | 'aa' | 'design' | 'notes' | 'voice' | 'marks'>('none');
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false); const [card, setCard] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [voice, setVoice] = useStored('voice', ''); const [rate, setRate] = useStored('voice-rate', 1); const [para, setPara] = useState(-1);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1); const [turn, setTurn] = useState<'' | 'fwd' | 'back'>('');
  const [vw, setVw] = useState(window.innerWidth);
  const viewRef = useRef<HTMLDivElement>(null); const flowRef = useRef<HTMLDivElement>(null);
  const pendingPara = useRef<number | 'end' | null>(prog.para ?? null);
  useEffect(() => { const ss = window.speechSynthesis; if (!ss) return; const f = () => setVoices(ss.getVoices()); f(); ss.addEventListener?.('voiceschanged', f); return () => ss.removeEventListener?.('voiceschanged', f); }, []);
  useEffect(() => { let active = Date.now(); const poke = () => { active = Date.now(); }; ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => window.addEventListener(e, poke, { passive: true }));
    const t = setInterval(() => { if (document.visibilityState === 'visible' && (Date.now() - active < 120000 || window.speechSynthesis?.speaking)) logReading(1); }, 60000);
    return () => { clearInterval(t); ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => window.removeEventListener(e, poke)); }; }, []);
  useEffect(() => { const r = () => setVw(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const ch = Math.max(0, Math.min(Number(sp.get('ch') ?? prog.chapter) || 0, (chapters?.length ?? 1) - 1));

  useEffect(() => {
    let live = true; setChapters(null); setErr('');
    getBook(id).then(b => live && setBook(b)).catch(() => live && setErr('missing'));
    getChapters(id).then(c => { if (live) setChapters(c); }).catch(() => { if (live) setErr('missing'); });
    return () => { live = false; };
  }, [id]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const chapter = chapters?.[ch];
  const paras = useMemo(() => chapter ? chapter.paras.map((p, i) => edits.find(e => e.chapter === ch && e.para === i)?.text ?? p) : [], [chapter, edits, ch]);
  const chHl = hl.filter(h => h.chapter === ch);
  const two = !ax.sr && (ax.spread === 'two' || (ax.spread === 'auto' && vw >= 1100));
  const paged = !ax.sr && !editing;

  // measure pages whenever layout-affecting inputs change
  const measure = useCallback(() => {
    const v = viewRef.current, f = flowRef.current; if (!v || !f || !paged) return;
    const stride = v.clientWidth + gap(two);
    const n = Math.max(1, Math.ceil((f.scrollWidth + gap(two)) / stride - 0.01));
    const n2 = two ? Math.ceil(n / 2) * 2 : n; setPages(two ? n2 / 2 : n2);
    const want = pendingPara.current;
    if (want !== null) { pendingPara.current = null;
      if (want === 'end') setPage((two ? n2 / 2 : n2) - 1);
      else { const el = f.querySelector<HTMLElement>(`[data-p="${want}"]`); setPage(el ? Math.floor(el.offsetLeft / stride) : 0); } }
  }, [paged, two]);
  useLayoutEffect(() => { measure(); }, [measure, paras, d, a, chHl.length]);
  useEffect(() => { const r = () => { pendingPara.current = firstVisible(); measure(); }; window.addEventListener('resize', r); document.fonts?.ready.then(() => measure()); return () => window.removeEventListener('resize', r); });

  const firstVisible = () => { const v = viewRef.current, f = flowRef.current; if (!v || !f) return 0; const stride = v.clientWidth + gap(two);
    const ps = Array.from(f.querySelectorAll<HTMLElement>('[data-p]')); const hit = ps.find(p => p.offsetLeft >= page * stride - 2); return hit ? Number(hit.dataset.p) : 0; };
  useEffect(() => { if (!chapters) return; const t = setTimeout(() => { const p = paged ? firstVisible() : 0; setProg(o => ({ ...o, chapter: ch, para: p, pct: pages > 1 ? page / (pages - 1) : 0, book: (ch + (pages > 1 ? page / (pages - 1) : 1)) / chapters.length, at: Date.now() })); }, 250); return () => clearTimeout(t); }, [page, pages, ch, chapters]);

  const goCh = (n: number, at: number | 'end' = 0) => { pendingPara.current = at; setPage(0); const p = new URLSearchParams(sp); p.set('ch', String(n)); setSp(p, { replace: true }); setPanel('none'); };
  const flip = (dir: 1 | -1) => {
    if (!chapters) return;
    if (!paged) { if (dir > 0 && ch < chapters.length - 1) goCh(ch + 1); else if (dir < 0 && ch > 0) goCh(ch - 1); return; }
    const np = page + dir;
    if (np < 0) { if (ch > 0) goCh(ch - 1, 'end'); return; }
    if (np >= pages) { if (ch < chapters.length - 1) goCh(ch + 1, 0); return; }
    setTurn(dir > 0 ? 'fwd' : 'back'); setPage(np); setTimeout(() => setTurn(''), 450);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (editing || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); flip(e.shiftKey && e.key === ' ' ? -1 : 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); flip(-1); }
      else if (e.key === 'Escape') setPanel('none'); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);

  const onUp = () => {
    const s = window.getSelection(); const t = s?.toString().trim() ?? '';
    if (!t || t.length > 600 || editing || !s?.rangeCount) return setSel(null);
    const r = s.getRangeAt(0).getBoundingClientRect(); setSel({ text: t, x: Math.min(window.innerWidth - 120, Math.max(120, r.left + r.width / 2)), y: Math.max(60, r.top) });
  };
  const addHl = (note?: string) => { if (!sel) return; setHl([...hl, { id: uid(), chapter: ch, text: sel.text, note, at: Date.now() }]); setSel(null); window.getSelection()?.removeAllRanges(); };
  const speak = (from = 0) => {
    const ss = window.speechSynthesis; if (!ss) return;
    if (speaking && from === 0) { ss.cancel(); setSpeaking(false); setPara(-1); return; }
    ss.cancel(); setSpeaking(true);
    const v = voices.find(x => x.name === voice);
    const next = (i: number) => { if (i >= paras.length) { setSpeaking(false); setPara(-1); return; }
      const u = new SpeechSynthesisUtterance(paras[i]); u.lang = v?.lang ?? book?.languages[0] ?? 'en'; if (v) u.voice = v; u.rate = rate;
      u.onstart = () => { setPara(i); const el = flowRef.current?.querySelector<HTMLElement>(`[data-p="${i}"]`); const vv = viewRef.current;
        if (el && vv && paged) setPage(Math.floor(el.offsetLeft / (vv.clientWidth + gap(two)))); else el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
      u.onend = () => next(i + 1); u.onerror = () => { setSpeaking(false); setPara(-1); }; ss.speak(u); };
    next(from);
  };
  const addMark = () => { const p = paged ? firstVisible() : 0; const label = (paras[p] ?? '').slice(0, 70); setMarks([...marks, { id: uid(), chapter: ch, para: p, label, at: Date.now() }]); };
  const shareNotes = () => { const who = prompt('Sign your notes as', '') ?? ''; const url = shareNotesLink(id, book?.title.split(/[;:]/)[0] ?? 'Notes', who, hl); navigator.clipboard?.writeText(url).catch(() => {}); prompt('Link copied. Anyone with it can read and import your notes:', url); };

  const font = ax.dyslexia ? `'OpenDyslexic', 'Atkinson Hyperlegible', sans-serif` : `'${d.font}', Georgia, serif`;
  const style = { '--r-bg': ax.contrast ? '#000' : d.bg, '--r-ink': ax.contrast ? '#fff' : d.ink, '--r-acc': ax.contrast ? '#ffd54a' : d.accent, '--r-font': font, '--r-size': `${d.size}px`,
    '--r-lead': d.leading + ax.spacing * .15, '--r-measure': `${d.measure}em`, '--r-align': ax.dyslexia ? 'left' : d.align, '--r-ls': `${ax.spacing * .02}em`, '--r-ws': `${ax.words * .08}em`, '--r-cols': two ? 2 : 1, '--r-gap': `${gap(two)}px` } as CSSProperties;
  if (err) return (
    <div className="page"><h1 className="display">This book isn't on the shelves</h1>
      <p className="lede">Leone Library only opens books it hosts in full. This one isn't in the collection yet — you can ask for it on the Add-a-book page, and it's imported once enough readers vote.</p>
      <div className="row gap wrap"><Link className="btn gold" to="/library">Back to the Library</Link><Link className="btn ghost" to="/add">Request a book</Link></div></div>);

  const pageNo = paged ? `${page + 1} / ${pages}` : '';
  const pct = chapters ? ((ch + (pages > 1 ? page / (pages - 1) : 0)) / chapters.length) * 100 : 0;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'none' : ax.motion;
  return (
    <div className={`reader paged ${d.dropcap ? 'dropcap' : ''} ${d.indent ? 'indent' : ''} ${d.ornament ? 'orn' : ''} ${ax.contrast ? 'hc' : ''} ${paged ? '' : 'flow'}`} style={style} onMouseUp={onUp}>
      <a href="#reader-text" className="skip">Skip to text</a>
      <div className="reader-bar glass" role="toolbar" aria-label="Reader tools">
        <Link to={`/book?id=${id}`} className="rb-title">← {book ? book.title.split(/[;:]/)[0] : '…'}</Link>
        <div className="rb-actions">
          <button onClick={() => setPanel(panel === 'toc' ? 'none' : 'toc')} className={panel === 'toc' ? 'on' : ''}>Contents</button>
          <button onClick={() => setPanel(panel === 'aa' ? 'none' : 'aa')} className={panel === 'aa' ? 'on' : ''} aria-label="Text and accessibility settings">Aa</button>
          <button onClick={() => setPanel(panel === 'marks' ? 'none' : 'marks')} className={panel === 'marks' ? 'on' : ''}>Bookmarks{marks.length ? ` (${marks.length})` : ''}</button>
          <button onClick={() => setPanel(panel === 'notes' ? 'none' : 'notes')} className={panel === 'notes' ? 'on' : ''}>Notes{hl.length ? ` (${hl.length})` : ''}</button>
          {id > 0 && <Link to={`/dna?id=${id}`} className="rb-link" title="Statistics and story map measured from this text">DNA</Link>}
          <button onClick={() => speak()} className={speaking ? 'on' : ''} title="Narrate this chapter with your device's voices">{speaking ? '■ Stop' : '▶ Listen'}</button>
          <button onClick={() => setPanel(panel === 'voice' ? 'none' : 'voice')} className={panel === 'voice' ? 'on' : ''}>Voice</button>
          <button onClick={() => { setEditing(!editing); if (editing && panel === 'design') setPanel('none'); }} className={editing ? 'on' : ''}>{editing ? 'Done editing' : 'Edit'}</button>
          {editing && <button onClick={() => setPanel(panel === 'design' ? 'none' : 'design')} className={panel === 'design' ? 'on' : ''}>Design</button>}
        </div>
        <div className="rb-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      </div>
      {panel !== 'none' && <aside className="reader-panel glass" aria-label="Reader panel">
        {panel === 'toc' && <><h4>Contents</h4><ol className="toc">{chapters?.map((c, i) => <li key={i}><button className={i === ch ? 'on' : ''} onClick={() => goCh(i)}>{c.title}{i < ch ? ' ✓' : ''}</button></li>)}</ol></>}
        {panel === 'aa' && <><h4>Text &amp; accessibility</h4>
          <label className="chk"><input type="checkbox" checked={ax.dyslexia} onChange={e => setA({ ...ax, dyslexia: e.target.checked })} /> Dyslexia-friendly font</label>
          <label className="chk"><input type="checkbox" checked={ax.contrast} onChange={e => setA({ ...ax, contrast: e.target.checked })} /> High contrast</label>
          <label className="chk"><input type="checkbox" checked={ax.sr} onChange={e => setA({ ...ax, sr: e.target.checked })} /> Screen-reader mode (continuous text)</label>
          <label className="lbl">Letter &amp; line spacing: {ax.spacing}</label><input type="range" min={0} max={5} value={ax.spacing} onChange={e => setA({ ...ax, spacing: +e.target.value })} />
          <label className="lbl">Word spacing: {ax.words}</label><input type="range" min={0} max={5} value={ax.words} onChange={e => setA({ ...ax, words: +e.target.value })} />
          <label className="lbl">Pages</label><select className="fx-in" value={ax.spread} onChange={e => setA({ ...ax, spread: e.target.value as A11y['spread'] })}><option value="auto">Automatic</option><option value="one">Single page</option><option value="two">Two-page spread</option></select>
          <label className="lbl">Page turn</label><select className="fx-in" value={ax.motion} onChange={e => setA({ ...ax, motion: e.target.value as A11y['motion'] })}><option value="slide">Slide</option><option value="flip">Page curl</option><option value="none">Instant</option></select>
          <p className="tiny muted">Font, size, colours and layout are in Design while editing.</p></>}
        {panel === 'design' && <><h4>Design</h4><DesignPanel compact /><Link className="small" to="/design">Full Design studio →</Link></>}
        {panel === 'marks' && <><h4>Bookmarks</h4><button className="btn gold sm" onClick={addMark}>+ Bookmark this page</button>
          <ul className="notes">{marks.map(m => <li key={m.id}><button className="link" onClick={() => goCh(m.chapter, m.para)}>{chapters?.[m.chapter]?.title ?? `Ch. ${m.chapter + 1}`}</button><q>{m.label}…</q><button className="x" onClick={() => setMarks(marks.filter(x => x.id !== m.id))} aria-label="Remove bookmark">×</button></li>)}</ul></>}
        {panel === 'notes' && <><h4>Highlights &amp; notes</h4>{!hl.length && <p className="small muted">Select any passage to highlight it or attach a note.</p>}
          <ul className="notes">{hl.map(h => <li key={h.id}><button className="link" onClick={() => goCh(h.chapter)}>{chapters?.[h.chapter]?.title ?? `Ch. ${h.chapter + 1}`}</button><q>{h.text.slice(0, 160)}</q>{h.note && <p>{h.note}</p>}<button className="x" onClick={() => setHl(hl.filter(x => x.id !== h.id))} aria-label="Remove">×</button></li>)}</ul>
          {hl.length > 0 && <button className="btn ghost sm" onClick={shareNotes}>Share notes as a link</button>}</>}
        {panel === 'voice' && <><h4>Narration</h4><p className="small muted">Reads the chapter aloud with voices installed on your device, turning pages as it goes.</p>
          <label className="lbl">Voice</label><select className="fx-in" value={voice} onChange={e => setVoice(e.target.value)}><option value="">Device default</option>{voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select>
          <label className="lbl">Speed: {rate.toFixed(2)}×</label><input type="range" min={.6} max={1.6} step={.05} value={rate} onChange={e => setRate(+e.target.value)} />
          <button className="btn gold sm" onClick={() => speak(Math.max(0, paged ? firstVisible() : para))}>{speaking ? 'Restart from this page' : '▶ Start from this page'}</button></>}
      </aside>}
      <div className={`book-spread ${two ? 'two' : 'one'}`}>
        {paged && <button className="tap prev" aria-label="Previous page" onClick={() => flip(-1)} />}
        <article id="reader-text" className={`page-paper ${turn && motion !== 'none' ? `turn-${motion}-${turn}` : ''}`} lang={book?.languages[0]}>
          {!chapters && <p className="loading"><span className="spin" /> Opening the book…</p>}
          {chapter && <div className="pg-view" ref={viewRef}
            onPointerDown={e => { swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }}
            onPointerUp={e => { const s = swipe.current; swipe.current = null; if (!s || !paged) return; const dx = e.clientX - s.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) && Date.now() - s.t < 700 && !window.getSelection()?.toString()) flip(dx < 0 ? 1 : -1); }}>
            <div className="pg-flow" ref={flowRef} style={paged ? { transform: `translateX(calc(${-page} * (100% + var(--r-gap))))` } : undefined}>
              {ch === 0 && book && <header className="title-page"><div className="tp-orn">❦</div><h1>{book.title.split(/[;:]/)[0]}</h1><p>{author(book)}</p><RightsTag r={rightsFor(book)} /></header>}
              <h2 className="ch-title">{chapter.title}</h2>
              {editing && <p className="edit-hint">Editing: changes are saved on this device and recorded in the book's change log.</p>}
              <div className="prose">
                {paras.map((p, i) => editing
                  ? <p key={i} data-p={i} contentEditable suppressContentEditableWarning className="editable" onBlur={e => { const t = e.currentTarget.textContent ?? ''; if (t !== chapter.paras[i]) setEdits([...edits.filter(x => !(x.chapter === ch && x.para === i)), { chapter: ch, para: i, text: t, at: Date.now() }]); }}>{p}</p>
                  : <p key={i} data-p={i} className={para === i ? 'speaking' : ''} onClick={() => speaking && speak(i)}>{marked(p, chHl.filter(h => p.includes(h.text)))}</p>)}
              </div>
              {!paged && <nav className="ch-nav"><button className="btn ghost" disabled={ch === 0} onClick={() => goCh(ch - 1)}>← Previous chapter</button><button className="btn ghost" disabled={ch >= chapters!.length - 1} onClick={() => goCh(ch + 1)}>Next chapter →</button></nav>}
            </div>
          </div>}
        </article>
        {paged && <button className="tap next" aria-label="Next page" onClick={() => flip(1)} />}
      </div>
      {chapter && <div className="pg-foot" aria-live="polite"><span className="muted small">{chapter.title.slice(0, 48)}</span><span className="muted small">{pageNo}{pageNo && ' · '}Chapter {ch + 1} of {chapters!.length}</span></div>}
      {card && <QuoteCard text={card} by={book ? author(book) : ''} title={book?.title.split(/[;:]/)[0] ?? ''} onClose={() => setCard(null)} />}
      {sel && <div className="sel-pop glass" style={{ left: sel.x, top: sel.y - 52, position: 'fixed' }} onMouseUp={e => e.stopPropagation()}>
        <button onClick={() => addHl()}>Highlight</button>
        <button onClick={() => { const n = prompt('Note for this passage'); if (n) addHl(n); }}>Add note</button>
        <button onClick={() => { navigator.clipboard?.writeText(`“${sel.text}” — ${book ? author(book) : ''}, ${book?.title.split(/[;:]/)[0] ?? ''}`); setSel(null); }}>Copy quote</button>
        <button onClick={() => { setCard(sel.text); setSel(null); }}>Quote card</button>
      </div>}
    </div>
  );
}
function gap(two: boolean) { return two ? 64 : 0; }
