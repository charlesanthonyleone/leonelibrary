import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { author, getBook, getText, parseText, rightsFor, type Book, type Chapter } from '../lib/books';
import { uid, useDesign, useStored, type Edit, type Highlight, type Progress } from '../lib/store';
import DesignPanel from '../components/DesignPanel';
import { RightsTag, Soon } from '../components/ui';
import { logReading, shareNotesLink } from './Features';

function marked(text: string, hs: Highlight[]) {
  if (!hs.length) return text;
  const parts: (string | JSX.Element)[] = []; let rest = text, k = 0;
  for (const h of hs) {
    const i = rest.indexOf(h.text); if (i < 0) continue;
    parts.push(rest.slice(0, i), <mark key={k++} title={h.note || 'Highlight'} className={h.note ? 'has-note' : ''}>{h.text}</mark>);
    rest = rest.slice(i + h.text.length);
  }
  parts.push(rest); return parts;
}

export default function Reader() {
  const [sp, setSp] = useSearchParams();
  const id = Number(sp.get('id'));
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [err, setErr] = useState('');
  const [d] = useDesign();
  const [prog, setProg] = useStored<Progress>(`progress:${id}`, { chapter: 0, pct: 0, at: 0 });
  const [hl, setHl] = useStored<Highlight[]>(`highlights:${id}`, []);
  const [edits, setEdits] = useStored<Edit[]>(`edits:${id}`, []);
  const [panel, setPanel] = useState<'none' | 'toc' | 'design' | 'notes' | 'voice'>('none');
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [voice, setVoice] = useStored('voice', ''); const [rate, setRate] = useStored('voice-rate', 1); const [para, setPara] = useState(-1);
  useEffect(() => { const ss = window.speechSynthesis; if (!ss) return; const f = () => setVoices(ss.getVoices()); f(); ss.addEventListener?.('voiceschanged', f); return () => ss.removeEventListener?.('voiceschanged', f); }, []);
  // reading log: count a minute for every minute the tab is visible and the reader was active
  useEffect(() => { let active = Date.now(); const poke = () => { active = Date.now(); }; ['scroll', 'mousemove', 'keydown', 'touchstart'].forEach(e => window.addEventListener(e, poke, { passive: true }));
    const t = setInterval(() => { if (document.visibilityState === 'visible' && (Date.now() - active < 120000 || window.speechSynthesis?.speaking)) logReading(1); }, 60000);
    return () => { clearInterval(t); ['scroll', 'mousemove', 'keydown', 'touchstart'].forEach(e => window.removeEventListener(e, poke)); }; }, []);
  const pageRef = useRef<HTMLDivElement>(null);
  const ch = Math.min(Number(sp.get('ch') ?? prog.chapter) || 0, (chapters?.length ?? 1) - 1);

  useEffect(() => {
    let live = true; setChapters(null); setErr('');
    getBook(id).then(b => live && setBook(b)).catch(() => {});
    getText(id).then(t => { if (live) setChapters(parseText(t).chapters); }).catch(() => { if (live) setErr('cors'); });
    return () => { live = false; };
  }, [id]);
  useEffect(() => { if (chapters) setProg(p => ({ ...p, chapter: ch, at: Date.now() })); window.scrollTo(0, 0); }, [ch, chapters, setProg]);
  useEffect(() => {
    const on = () => { const h = document.documentElement; const pct = Math.min(1, h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)); setProg(p => (Math.abs(p.pct - pct) > .05 ? { ...p, pct } : p)); };
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [setProg]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);

  const chapter = chapters?.[ch];
  const paras = useMemo(() => chapter ? chapter.paras.map((p, i) => edits.find(e => e.chapter === ch && e.para === i)?.text ?? p) : [], [chapter, edits, ch]);
  const chHl = hl.filter(h => h.chapter === ch);

  const onUp = () => {
    const s = window.getSelection(); const t = s?.toString().trim() ?? '';
    if (!t || t.length > 600 || editing || !s?.rangeCount) return setSel(null);
    const r = s.getRangeAt(0).getBoundingClientRect(); setSel({ text: t, x: r.left + r.width / 2, y: r.top + window.scrollY });
  };
  const addHl = (note?: string) => { if (!sel) return; setHl([...hl, { id: uid(), chapter: ch, text: sel.text, note, at: Date.now() }]); setSel(null); window.getSelection()?.removeAllRanges(); };
  const goCh = (n: number) => { const p = new URLSearchParams(sp); p.set('ch', String(n)); setSp(p); setPanel('none'); };
  const speak = (from = 0) => {
    const ss = window.speechSynthesis; if (!ss) return;
    if (speaking && from === 0) { ss.cancel(); setSpeaking(false); setPara(-1); return; }
    ss.cancel(); setSpeaking(true);
    const v = voices.find(x => x.name === voice);
    const next = (i: number) => { if (i >= paras.length) { setSpeaking(false); setPara(-1); return; }
      const u = new SpeechSynthesisUtterance(paras[i]); u.lang = v?.lang ?? book?.languages[0] ?? 'en'; if (v) u.voice = v; u.rate = rate;
      u.onstart = () => { setPara(i); document.querySelector(`[data-p="${i}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
      u.onend = () => next(i + 1); u.onerror = () => { setSpeaking(false); setPara(-1); }; ss.speak(u); };
    next(from);
  };
  const shareNotes = () => { const who = prompt('Sign your notes as', '') ?? ''; const url = shareNotesLink(id, book?.title.split(/[;:]/)[0] ?? 'Notes', who, hl); navigator.clipboard?.writeText(url).catch(() => {}); prompt('Link copied. Anyone with it can read and import your notes:', url); };

  const style = { '--r-bg': d.bg, '--r-ink': d.ink, '--r-acc': d.accent, '--r-font': `'${d.font}', Georgia, serif`, '--r-size': `${d.size}px`, '--r-lead': d.leading, '--r-measure': `${d.measure}em`, '--r-align': d.align } as CSSProperties;
  if (err) return (
    <div className="page"><h1 className="display">This text isn't cached yet</h1>
      <p className="lede">Project Gutenberg doesn't allow browsers on other sites to fetch its files directly, so Leone Library serves a growing cached collection. This title isn't in it yet.</p>
      <div className="row gap wrap"><a className="btn gold" href={`https://www.gutenberg.org/ebooks/${id}`} target="_blank" rel="noreferrer">Read on Gutenberg ↗</a><Link className="btn ghost" to="/library">Back to the Library</Link></div>
      <p className="small muted">Full-catalogue reading arrives with the Leone text mirror. <Soon /></p></div>);

  return (
    <div className={`reader ${d.dropcap ? 'dropcap' : ''} ${d.indent ? 'indent' : ''} ${d.ornament ? 'orn' : ''}`} style={style} onMouseUp={onUp}>
      <div className="reader-bar glass">
        <Link to={`/book?id=${id}`} className="rb-title">← {book ? book.title.split(/[;:]/)[0] : '…'}</Link>
        <div className="rb-actions">
          <button onClick={() => setPanel(panel === 'toc' ? 'none' : 'toc')} className={panel === 'toc' ? 'on' : ''}>Contents</button>
          <button onClick={() => setPanel(panel === 'design' ? 'none' : 'design')} className={panel === 'design' ? 'on' : ''}>Design</button>
          <button onClick={() => setPanel(panel === 'notes' ? 'none' : 'notes')} className={panel === 'notes' ? 'on' : ''}>Notes {hl.length ? `(${hl.length})` : ''}</button>
          <button onClick={() => speak()} className={speaking ? 'on' : ''} title="Narrate this chapter with your device's voices">{speaking ? '■ Stop' : '▶ Listen'}</button>
          <button onClick={() => setPanel(panel === 'voice' ? 'none' : 'voice')} className={panel === 'voice' ? 'on' : ''}>Voice</button>
          <button onClick={() => setEditing(!editing)} className={editing ? 'on' : ''}>{editing ? 'Done editing' : 'Edit'}</button>
        </div>
        <div className="rb-progress"><span style={{ width: `${chapters ? ((ch + prog.pct) / chapters.length) * 100 : 0}%` }} /></div>
      </div>
      {panel !== 'none' && <aside className="reader-panel glass">
        {panel === 'toc' && <><h4>Contents</h4><ol className="toc">{chapters?.map((c, i) => <li key={i}><button className={i === ch ? 'on' : ''} onClick={() => goCh(i)}>{c.title}</button></li>)}</ol></>}
        {panel === 'design' && <><h4>Design</h4><DesignPanel compact /><Link className="small" to="/design">Full Design studio →</Link></>}
        {panel === 'notes' && <><h4>Highlights &amp; notes</h4>{!hl.length && <p className="small muted">Select any passage to highlight it or attach a note.</p>}
          <ul className="notes">{hl.map(h => <li key={h.id}><button className="link" onClick={() => goCh(h.chapter)}>{chapters?.[h.chapter]?.title ?? `Ch. ${h.chapter + 1}`}</button><q>{h.text.slice(0, 160)}</q>{h.note && <p>{h.note}</p>}<button className="x" onClick={() => setHl(hl.filter(x => x.id !== h.id))} aria-label="Remove">×</button></li>)}</ul></>}
        {panel === 'voice' && <><h4>Narration</h4><p className="small muted">Reads the whole chapter aloud, paragraph by paragraph, using voices installed on your device. Click any paragraph while listening to jump there.</p>
          <label className="lbl">Voice</label><select className="fx-in" value={voice} onChange={e => setVoice(e.target.value)}><option value="">Device default</option>{voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</select>
          <label className="lbl">Speed: {rate.toFixed(2)}×</label><input type="range" min={.6} max={1.6} step={.05} value={rate} onChange={e => setRate(+e.target.value)} />
          <button className="btn gold sm" onClick={() => speak(Math.max(0, para))}>{speaking ? 'Restart with these settings' : '▶ Start narration'}</button>
          <p className="tiny muted">AI studio voices (natural narrators, character voices) are coming with AI credits. <Soon /></p></>}
        {panel === 'notes' && hl.length > 0 && <button className="btn ghost sm" onClick={shareNotes}>Share notes as a link</button>}
      </aside>}
      <article className="page-paper" ref={pageRef}>
        {!chapters && <p className="loading"><span className="spin" /> Opening the book…</p>}
        {chapter && <>
          {ch === 0 && book && <header className="title-page"><div className="tp-orn">❦</div><h1>{book.title.split(/[;:]/)[0]}</h1><p>{author(book)}</p><RightsTag r={rightsFor(book)} /></header>}
          <h2 className="ch-title">{chapter.title}</h2>
          {editing && <p className="edit-hint">Editing: changes are saved on this device and recorded in the book's change log.</p>}
          <div className="prose">
            {paras.map((p, i) => editing
              ? <p key={i} contentEditable suppressContentEditableWarning className="editable" onBlur={e => { const t = e.currentTarget.textContent ?? ''; if (t !== chapter.paras[i]) setEdits([...edits.filter(x => !(x.chapter === ch && x.para === i)), { chapter: ch, para: i, text: t, at: Date.now() }]); }}>{p}</p>
              : <p key={i} data-p={i} className={para === i ? 'speaking' : ''} onClick={() => speaking && speak(i)}>{marked(p, chHl.filter(h => p.includes(h.text)))}</p>)}
          </div>
          <nav className="ch-nav">
            <button className="btn ghost" disabled={ch === 0} onClick={() => goCh(ch - 1)}>← Previous</button>
            <span className="muted small">{ch + 1} / {chapters!.length}</span>
            <button className="btn ghost" disabled={ch >= chapters!.length - 1} onClick={() => goCh(ch + 1)}>Next →</button>
          </nav>
        </>}
      </article>
      {sel && <div className="sel-pop glass" style={{ left: sel.x, top: sel.y - 52 }} onMouseUp={e => e.stopPropagation()}>
        <button onClick={() => addHl()}>Highlight</button>
        <button onClick={() => { const n = prompt('Note for this passage'); if (n) addHl(n); }}>Add note</button>
      </div>}
    </div>
  );
}
