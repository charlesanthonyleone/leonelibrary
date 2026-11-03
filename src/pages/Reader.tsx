import { tocGroups } from '../lib/chapters';
import { Link, useSearchParams } from 'react-router-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { isOffline, keepOffline, dropOffline } from '../lib/books';
import { author, getBook, getChapters, rightsFor, type Book, type Chapter } from '../lib/books';
import { track } from '../lib/leoneid';
import { THEMES, load, uid, useDesign, useStored, type Edit, type Highlight, type Progress } from '../lib/store';
import DesignPanel from '../components/DesignPanel';
import { RightsTag } from '../components/ui';
import { download, logBook, logReading, notesExport, readingSpeed, shareNotesLink } from '../lib/shared';
import QuoteCard from '../components/QuoteCard';
import { piperFor, PIPER_ON } from '../lib/piper';
import { NEURAL_VOICES, narrate, neuralFor, onTtsState, ttsState, type Narration } from '../lib/tts';

type Bookmark = { id: string; chapter: number; para: number; label: string; at: number };
type A11y = { dyslexia: boolean; contrast: boolean; spacing: number; words: number; sr: boolean; spread: 'auto' | 'one' | 'two'; motion: 'flip' | 'slide' | 'none'; ruler?: boolean };
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
  const [d, setD] = useDesign(); const [say, setSay] = useState<[number, number, number] | null>(null); const [paused, setPaused] = useState(false); const swiped = useRef(false); const [def, setDef] = useState<string | null>(null);
  const [a, setA] = useStored<A11y>('a11y', A11Y0); const ax = { ...A11Y0, ...a };
  const [prog, setProg] = useStored<Progress & { para?: number; book?: number }>(`progress:${id}`, { chapter: 0, pct: 0, at: 0 });
  const [hl, setHl] = useStored<Highlight[]>(`highlights:${id}`, []);
  const [edits, setEdits] = useStored<Edit[]>(`edits:${id}`, []);
  const [marks, setMarks] = useStored<Bookmark[]>(`bookmarks:${id}`, []);
  const [panel, setPanel] = useState<'none' | 'toc' | 'aa' | 'design' | 'notes' | 'voice' | 'marks' | 'find'>('none'); const [fq, setFq] = useState(''); const [keys, setKeys] = useState(false);
  const [sel, setSel] = useState<{ text: string; x: number; y: number } | null>(null);
  const [editing, setEditing] = useState(false); const [card, setCard] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]); const [voice, setVoice] = useStored('voice', ''); const [rate, setRate] = useStored('voice-rate', 1); const [para, setPara] = useState(-1);
  const nar = useRef<Narration | null>(null); const cont = useRef(false); const [sleep, setSleep] = useState(0); const sleepAt = useRef(0); const [tts, setTts] = useState(ttsState()); useEffect(() => onTtsState(setTts), []);
  const [page, setPage] = useState(0); const [pages, setPages] = useState(1); const [turn, setTurn] = useState<'' | 'fwd' | 'back'>('');
  const [vw, setVw] = useState(window.innerWidth);
  const viewRef = useRef<HTMLDivElement>(null); const flowRef = useRef<HTMLDivElement>(null);
  const hashP = /^#p(\d+)$/.exec(location.hash)?.[1]; const pendingPara = useRef<number | 'end' | null>(hashP ? Number(hashP) : prog.para ?? null);
  useEffect(() => { const ss = window.speechSynthesis; if (!ss) return; const f = () => setVoices(ss.getVoices()); f(); ss.addEventListener?.('voiceschanged', f); return () => ss.removeEventListener?.('voiceschanged', f); }, []);
  const idRef = useRef(id); idRef.current = id;
  useEffect(() => { let active = Date.now(); const poke = () => { active = Date.now(); }; ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => window.addEventListener(e, poke, { passive: true }));
    const t = setInterval(() => { if (document.visibilityState === 'visible' && (Date.now() - active < 120000 || window.speechSynthesis?.speaking)) { logReading(1); logBook(idRef.current, 1, 0); } }, 60000);
    return () => { clearInterval(t); ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(e => window.removeEventListener(e, poke)); }; }, []);
  useEffect(() => { const r = () => setVw(window.innerWidth); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  const ch = Math.max(0, Math.min(Number(sp.get('ch') ?? prog.chapter) || 0, (chapters?.length ?? 1) - 1));

  useEffect(() => {
    let live = true; setChapters(null); setErr('');
    getBook(id).then(b => live && setBook(b)).catch(() => live && setErr('missing'));
    getChapters(id).then(c => { if (!live) return;
      // getHosted may have migrated saved progress to a new chapter split just now: re-read it so the first open lands exactly.
      if (!sp.get('ch')) { const f = load<Progress & { para?: number; book?: number }>(`progress:${id}`, { chapter: 0, pct: 0, at: 0 }); if (f.at && (f.chapter !== prog.chapter || f.para !== prog.para)) setProg(f); if (!hashP) pendingPara.current = f.para ?? pendingPara.current; }
      setChapters(c); }).catch(() => { if (live) setErr('missing'); });
    return () => { live = false; };
  }, [id]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); nar.current?.stop(); }, []);

  const chapter = chapters?.[ch];
  const paras = useMemo(() => chapter ? chapter.paras.map((p, i) => edits.find(e => e.chapter === ch && e.para === i)?.text ?? p) : [], [chapter, edits, ch]);
  const chHl = hl.filter(h => h.chapter === ch);
  const chWords = useMemo(() => paras.reduce((n, p) => n + (p.match(/\S+/g)?.length ?? 0), 0), [paras]);
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
  // Leone ID XP (anonymous on this device unless linked): a page turn after the first view, and finishing the book once.
  const seen = useRef(''); useEffect(() => { if (!chapters) return; const k = `${ch}:${page}`; if (seen.current && seen.current !== k) track('library.read_page'); seen.current = k;
    const done = (ch + (pages > 1 ? page / (pages - 1) : 1)) / chapters.length; if (done >= 0.99 && !localStorage.getItem(`lid-fin:${id}`)) { localStorage.setItem(`lid-fin:${id}`, '1'); track('library.finish_book'); } }, [page, ch, chapters]);
  useEffect(() => { if (!chapters) return; const t = setTimeout(() => { const p = paged ? firstVisible() : 0; setProg(o => ({ ...o, chapter: ch, para: p, pct: pages > 1 ? page / (pages - 1) : 0, book: (ch + (pages > 1 ? page / (pages - 1) : 1)) / chapters.length, at: Date.now() })); }, 250); return () => clearTimeout(t); }, [page, pages, ch, chapters]);

  const panelBtn = useRef<HTMLElement | null>(null);
  const togglePanel = (p: typeof panel, e?: { currentTarget: HTMLElement }) => { if (panel === p) return closePanel(); if (e) panelBtn.current = e.currentTarget; setPanel(p); };
  const closePanel = () => { setPanel('none'); requestAnimationFrame(() => panelBtn.current?.focus()); };
  useEffect(() => { if (panel !== 'none' && panel !== 'find') requestAnimationFrame(() => document.querySelector<HTMLElement>('#reader-panel .rp-h')?.focus({ preventScroll: true })); }, [panel]);
  const goCh = (n: number, at: number | 'end' = 0) => { pendingPara.current = at; setPage(0); const p = new URLSearchParams(sp); p.set('ch', String(n)); setSp(p, { replace: true }); setPanel('none'); };
  const flip = (dir: 1 | -1) => {
    if (!chapters) return;
    if (!paged) { if (dir > 0 && ch < chapters.length - 1) goCh(ch + 1); else if (dir < 0 && ch > 0) goCh(ch - 1); return; }
    const np = page + dir;
    if (np < 0) { if (ch > 0) goCh(ch - 1, 'end'); return; }
    if (np >= pages) { if (ch < chapters.length - 1) goCh(ch + 1, 0); return; }
    if (dir > 0) logBook(id, 0, Math.round(chWords / Math.max(1, pages)));
    setTurn(dir > 0 ? 'fwd' : 'back'); setPage(np); setTimeout(() => setTurn(''), 450);
  };
  useEffect(() => { const k = (e: KeyboardEvent) => { if (editing || (e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === ' ' && (e.target as HTMLElement)?.closest('button,a,summary,[role=button]')) return;
      if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); flip(e.shiftKey && e.key === ' ' ? -1 : 1); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); flip(-1); }
      else if (e.key === 'Home' && paged) { e.preventDefault(); setPage(0); }
      else if (e.key === 'End' && paged) { e.preventDefault(); setPage(pages - 1); }
      else if (e.key === 'Escape') { if (panel !== 'none') closePanel(); setKeys(false); }
      else if (e.key === 'l' || e.key === 'L') speak(speaking ? 0 : Math.max(0, paged ? firstVisible() : para));
      else if (e.key === 'b' || e.key === 'B') addMark();
      else if (e.key === 't' || e.key === 'T') setPanel(p => p === 'toc' ? 'none' : 'toc');
      else if (e.key === '/' ) { e.preventDefault(); setPanel('find'); }
      else if (e.key === '?') setKeys(k => !k); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); });
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null); const wheelAt = useRef(0);

  const onUp = () => {
    const s = window.getSelection(); const t = s?.toString().trim() ?? '';
    if (!t || t.length > 600 || editing || !s?.rangeCount) return setSel(null);
    const r = s.getRangeAt(0).getBoundingClientRect(); setSel({ text: t, x: Math.min(window.innerWidth - 120, Math.max(120, r.left + r.width / 2)), y: Math.max(60, r.top) });
  };
  // Touch screens select text without a mouseup: watch the selection instead.
  useEffect(() => { if (!matchMedia('(pointer: coarse)').matches) return; let t = 0;
    const h = () => { clearTimeout(t); t = window.setTimeout(() => { const n = window.getSelection()?.anchorNode; if (n && flowRef.current?.contains(n)) onUp(); }, 450); };
    document.addEventListener('selectionchange', h); return () => { document.removeEventListener('selectionchange', h); clearTimeout(t); }; });
  const addHl = (note?: string) => { if (!sel) return; const hp = paras.findIndex(x => x.includes(sel.text.slice(0, 80))); setHl([...hl, { id: uid(), chapter: ch, ...(hp >= 0 ? { para: hp } : {}), text: sel.text, note, at: Date.now() }]); track('library.bookmark'); setSel(null); window.getSelection()?.removeAllRanges(); };
  const follow = (i: number) => { setPara(i); const el = flowRef.current?.querySelector<HTMLElement>(`[data-p="${i}"]`); const vv = viewRef.current;
    if (el && vv && paged) setPage(Math.floor(el.offsetLeft / (vv.clientWidth + gap(two)))); else el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };
  useEffect(() => { if (panel === 'toc') document.querySelector<HTMLElement>('.reader-panel .toc button.on')?.scrollIntoView({ block: 'center' }); }, [panel]);
  // Keep the spoken sentence on screen: turn the page when it crosses onto the next one.
  useEffect(() => { if (!say || !paged) return; const sp = flowRef.current?.querySelector<HTMLElement>('.say'); const f = flowRef.current, vv = viewRef.current; if (!sp || !f || !vv) return;
    const pg = Math.floor((sp.getBoundingClientRect().left - f.getBoundingClientRect().left + 2) / (vv.clientWidth + gap(two))); if (pg >= 0 && pg !== page) setPage(pg); }, [say]);
  const lang0 = book?.languages[0] ?? 'en';
  const pv = piperFor(lang0);
  const kVoice = voice.startsWith('k:') && neuralFor(lang0) ? voice.slice(2) : (voice === '' || voice.startsWith('k:') || voice.startsWith('p:')) ? (neuralFor(lang0) ? 'af_heart' : pv ? 'p:' + pv.id : '') : '';
  const speakDevice = (from: number) => {
    const ss = window.speechSynthesis; if (!ss) { setSpeaking(false); return; }
    const v = voices.find(x => x.name === voice);
    const next = (i: number) => { if (i >= paras.length) { chapterDone(); return; }
      const u = new SpeechSynthesisUtterance(paras[i]); u.lang = v?.lang ?? lang0; if (v) u.voice = v; u.rate = rate; { const left = sleepAt.current ? sleepAt.current - Date.now() : Infinity; u.volume = left < FADE * 1000 ? Math.max(0.08, left / (FADE * 1000)) : 1; }
      u.onstart = () => follow(i); u.onend = () => next(i + 1); u.onerror = () => { setSpeaking(false); setPara(-1); }; ss.speak(u); };
    next(from);
  };
  /** At the end of a chapter, narration carries on into the next one unless the sleep timer says stop. */
  const chapterDone = () => { setPara(-1);
    if (sleep === -1 || (sleepAt.current && Date.now() >= sleepAt.current) || !chapters || ch >= chapters.length - 1) { setSpeaking(false); if (sleep) { setSleep(0); sleepAt.current = 0; } return; }
    cont.current = true; goCh(ch + 1, 0); };
  const speak = (from = 0) => {
    if (speaking && from === 0) { window.speechSynthesis?.cancel(); nar.current?.stop(); setSpeaking(false); setPara(-1); return; }
    start(from);
  };
  const start = (from: number) => {
    window.speechSynthesis?.cancel(); nar.current?.stop(); setSpeaking(true); setPaused(false); setSay(null);
    if (kVoice) nar.current = narrate(paras, from, { voice: kVoice, speed: rate, onPara: follow, onChunk: (i, a, b) => setSay([i, a, b]), onEnd: chapterDone, onError: () => speakDevice(from) });
    else speakDevice(from);
  };
  const togglePause = () => { if (nar.current && kVoice) { if (paused) nar.current.resume(); else nar.current.pause(); }
    else if (window.speechSynthesis) { if (paused) speechSynthesis.resume(); else speechSynthesis.pause(); } setPaused(!paused); };
  const skip = (dir: 1 | -1) => { if (nar.current && kVoice) { nar.current.skip(dir); setPaused(false); } else start(Math.max(0, Math.min(paras.length - 1, para + dir))); };
  const [off, setOff] = useState(false); const [scrubV, setScrubV] = useState<number | null>(null);
  useEffect(() => { if (id > 0) isOffline(id).then(setOff).catch(() => {}); }, [id]);
  const toggleOff = () => { (off ? dropOffline(id) : keepOffline(id)).then(() => isOffline(id)).then(setOff).catch(() => {}); };
  const SLEEPS = [0, 5, 15, 30, 60, -1];
  const cycleSleep = () => { const i = SLEEPS.indexOf(sleep); setSleep(SLEEPS[(i + 1) % SLEEPS.length]); sleepAt.current = 0; };
  const sleepLabel = sleep === -1 ? 'End of chapter' : sleep ? `${sleep} min` : 'Off';
  const paraSkip = (dir: 1 | -1) => { const from = Math.max(0, Math.min(paras.length - 1, (para < 0 ? 0 : para) + dir)); start(from); };
  const scrub = (v: number) => { if (!chapters) return; const t = (v / 100) * chapters.length; const c = Math.min(chapters.length - 1, Math.floor(t)); const n = chapters[c]?.paras?.length ?? 0; setScrubV(null); goCh(c, Math.floor((t - c) * n)); };
  const stopAll = () => { window.speechSynthesis?.cancel(); nar.current?.stop(); setSpeaking(false); setPaused(false); setPara(-1); setSay(null); };
  useEffect(() => { if (cont.current && chapter) { cont.current = false; start(0); } }, [chapter]);
  // Sleep timer: the voice fades out over the last FADE seconds (gain ramp for natural voices, per-paragraph volume for device voices), then stops.
  const [, tick] = useState(0); const fading = useRef(false);
  useEffect(() => { if (!sleep || sleep < 0 || !speaking) return; sleepAt.current = Date.now() + sleep * 60000;
    const iv = setInterval(() => tick(n => n + 1), 1000);
    const f = setTimeout(() => { fading.current = true; nar.current?.fade(FADE); }, Math.max(0, sleep * 60000 - FADE * 1000));
    const t = setTimeout(() => { fading.current = false; window.speechSynthesis?.cancel(); nar.current?.stop(); setSpeaking(false); setPaused(false); setPara(-1); setSay(null); setSleep(0); sleepAt.current = 0; }, sleep * 60000);
    return () => { clearInterval(iv); clearTimeout(f); clearTimeout(t); if (fading.current) { fading.current = false; nar.current?.fade(0.4, 1); } }; }, [sleep, speaking]);
  const sleepLeft = sleep > 0 && speaking && sleepAt.current ? Math.max(0, sleepAt.current - Date.now()) : 0;
  const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  // Lock-screen and headset controls while narrating.
  useEffect(() => { const ms = (navigator as any).mediaSession; if (!ms || !book) return;
    try { ms.metadata = new (window as any).MediaMetadata({ title: chapter?.title ?? book.title, artist: author(book), album: book.title.split(/[;:]/)[0] });
      ms.playbackState = speaking ? 'playing' : 'paused';
      ms.setActionHandler('play', () => !speaking && speak(Math.max(0, para))); ms.setActionHandler('pause', () => speaking && speak()); ms.setActionHandler('stop', () => speaking && speak());
      ms.setActionHandler('nexttrack', () => chapters && ch < chapters.length - 1 && (cont.current = speaking, goCh(ch + 1)));
      ms.setActionHandler('previoustrack', () => ch > 0 && (cont.current = speaking, goCh(ch - 1))); } catch { /* unsupported action */ } });
  const addMark = () => { const p = paged ? firstVisible() : 0; const label = (paras[p] ?? '').slice(0, 70); setMarks([...marks, { id: uid(), chapter: ch, para: p, label, at: Date.now() }]); };
  const exportNotes = (fmt: 'md' | 'json') => { const title = book?.title.split(/[;:]/)[0] ?? `Book ${id}`;
    const body = notesExport(fmt, { id, title, author: book ? author(book) : '', hl, marks, chapterName: c => [chapters?.[c]?.group, chapters?.[c]?.title ?? `Chapter ${c + 1}`].filter(Boolean).join(' · ') });
    download(`${title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').toLowerCase() || 'notes'}-notes.${fmt}`, body, fmt === 'md' ? 'text/markdown;charset=utf-8' : 'application/json'); };
  const shareNotes = () => { const who = prompt('Sign your notes as', '') ?? ''; const url = shareNotesLink(id, book?.title.split(/[;:]/)[0] ?? 'Notes', who, hl); navigator.clipboard?.writeText(url).catch(() => {}); prompt('Link copied. Anyone with it can read and import your notes:', url); };

  const font = ax.dyslexia ? `'OpenDyslexic', 'Atkinson Hyperlegible', sans-serif` : `'${d.font}', Georgia, serif`;
  const style = { '--r-bg': ax.contrast ? '#000' : d.bg, '--r-ink': ax.contrast ? '#fff' : d.ink, '--r-acc': ax.contrast ? '#ffd54a' : d.accent, '--r-font': font, '--r-size': `${d.size}px`,
    '--r-lead': d.leading + ax.spacing * .15, '--r-measure': `${d.measure}em`, '--r-align': ax.dyslexia ? 'left' : d.align, '--r-ls': `${ax.spacing * .02}em`, '--r-ws': `${ax.words * .08}em`, '--r-cols': two ? 2 : 1, '--r-gap': `${gap(two)}px` } as CSSProperties;
  if (err) return (
    <div className="page"><h1 className="display">This book isn't on the shelves</h1>
      <p className="lede">Leone Library only opens books it hosts in full. This one isn't in the collection yet — you can ask for it on the Add-a-book page, and it's imported once enough readers vote.</p>
      <div className="row gap wrap"><Link className="btn gold" to="/library">Back to the Library</Link><Link className="btn ghost" to="/add">Request a book</Link></div></div>);

  const left = pages - 1 - page; const pageNo = paged ? `Page ${page + 1} of ${pages}${left > 0 ? ` · ${left} ${left === 1 ? 'page' : 'pages'} left in chapter` : ' · last page of chapter'}` : '';
  const wpm = readingSpeed() ?? 230; const wordsLeft = Math.round(chWords * (paged && pages > 0 ? (pages - page) / pages : 1));
  const minLeft = Math.max(1, Math.round(wordsLeft / wpm)); const timeLeft = chapter ? `${minLeft < 60 ? `${minLeft} min` : `${Math.floor(minLeft / 60)} h ${minLeft % 60} min`} left in chapter` : '';
  const pct = chapters ? ((ch + (pages > 1 ? page / (pages - 1) : 0)) / chapters.length) * 100 : 0;
  const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'none' : ax.motion;
  return (
    <div className={`reader paged ${d.dropcap ? 'dropcap' : ''} ${d.indent ? 'indent' : ''} ${d.ornament ? 'orn' : ''} ${ax.contrast ? 'hc' : ''} ${paged ? '' : 'flow'} ${speaking ? 'listening' : ''}`} style={style} onMouseUp={onUp}>
      <a href="#reader-text" className="skip">Skip to text</a><h1 className="sr-only">{book?.title ?? 'Reader'}</h1>
      <div className="reader-bar glass" role="toolbar" aria-label="Reader tools">
        <Link to={`/book?id=${id}`} className="rb-title">← {book ? book.title.split(/[;:]/)[0] : '…'}</Link>
        <div className="rb-actions">
          <button onClick={e => togglePanel('toc', e)} className={panel === 'toc' ? 'on' : ''} aria-expanded={panel === 'toc'} aria-controls="reader-panel">Contents</button>
          <button onClick={e => togglePanel('find', e)} className={panel === 'find' ? 'on' : ''} aria-expanded={panel === 'find'} aria-controls="reader-panel" aria-label="Find in this book">Find</button>
          <button onClick={e => togglePanel('aa', e)} className={panel === 'aa' ? 'on' : ''} aria-expanded={panel === 'aa'} aria-controls="reader-panel" aria-label="Text and accessibility settings">Aa</button>
          <button onClick={e => togglePanel('marks', e)} className={panel === 'marks' ? 'on' : ''} aria-expanded={panel === 'marks'} aria-controls="reader-panel">Bookmarks{marks.length ? ` (${marks.length})` : ''}</button>
          <button onClick={e => togglePanel('notes', e)} className={panel === 'notes' ? 'on' : ''} aria-expanded={panel === 'notes'} aria-controls="reader-panel">Notes{hl.length ? ` (${hl.length})` : ''}</button>
          {id > 0 && 'caches' in window && <button className="rb-link" aria-pressed={off} onClick={toggleOff} title={off ? 'This book is saved on this device and opens without a connection' : 'Save this book on this device to read without a connection'}>{off ? '✓ Offline' : 'Save offline'}</button>}
          <button className="rb-link" onClick={() => setKeys(k => !k)} aria-expanded={keys} aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)">?</button>
          {id > 0 && <Link to={`/stats`} className="rb-link" title="Your reading statistics">Stats</Link>}
          {id > 0 && <Link to={`/dna?id=${id}`} className="rb-link" title="Statistics and story map measured from this text">DNA</Link>}
          <button onClick={() => speak()} className={`rb-listen ${speaking ? "on" : ""}`} title="Narrate this chapter aloud" aria-label={speaking ? (tts.phase === 'loading' && kVoice ? `Voice ${tts.pct}% loading. Stop narration` : 'Stop narration') : 'Listen: narrate this chapter aloud'}>{speaking ? (tts.phase === 'loading' && kVoice ? `■ Voice ${tts.pct}%` : '■ Stop') : '▶ Listen'}</button>
          <button onClick={e => togglePanel('voice', e)} className={panel === 'voice' ? 'on' : ''} aria-expanded={panel === 'voice'} aria-controls="reader-panel">Voice</button>
          <button onClick={() => { setEditing(!editing); if (editing && panel === 'design') setPanel('none'); }} className={editing ? 'on' : ''}>{editing ? 'Done editing' : 'Edit'}</button>
          {editing && <button onClick={e => togglePanel('design', e)} className={panel === 'design' ? 'on' : ''} aria-expanded={panel === 'design'} aria-controls="reader-panel">Design</button>}
        </div>
        <div className="rb-progress" role="progressbar" aria-label="Progress through the book" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      </div>
      {panel !== 'none' && <aside id="reader-panel" className="reader-panel glass" aria-label={({ toc: 'Contents', find: 'Find in this book', aa: 'Text and accessibility', design: 'Design', marks: 'Bookmarks', notes: 'Highlights and notes', voice: 'Narration' } as Record<string, string>)[panel]}>
        <button className="rp-close" onClick={closePanel} aria-label="Close panel">✕</button>
        {panel === 'toc' && <><h2 className="rp-h" tabIndex={-1}>Contents</h2>{tocGroups((chapters ?? []).map(c => ({ title: c.title, g: c.group }))).map((g, gi) => <div key={gi} className="toc-g">{g.group && <h3 className="toc-gh">{g.group}</h3>}<ol className="toc">{g.items.map(({ index: i, title }) => <li key={i}><button className={i === ch ? 'on' : ''} aria-current={i === ch ? 'true' : undefined} onClick={() => goCh(i)}>{title}{i < ch ? ' ✓' : ''}</button></li>)}</ol></div>)}</>}
        {panel === 'find' && <FindPanel chapters={chapters ?? []} q={fq} setQ={setFq} go={goCh} />}
        {panel === 'aa' && <><h2 className="rp-h" tabIndex={-1}>Text &amp; accessibility</h2>
          <div className="aa-quick" role="group" aria-label="Page theme">{([['Light', 'Ivory'], ['Sepia', 'Sepia'], ['Dark', 'Midnight']] as const).map(([lbl, t]) =>
            <button key={t} className={`aa-th th-${lbl.toLowerCase()} ${d.bg === THEMES[t].bg ? 'on' : ''}`} aria-pressed={d.bg === THEMES[t].bg} onClick={() => setD({ ...d, theme: t, ...THEMES[t] })}>{lbl}</button>)}</div>
          <div className="aa-quick" role="group" aria-label="Text size"><button aria-label="Smaller text" disabled={d.size <= 14} onClick={() => setD({ ...d, size: Math.max(14, d.size - 1) })}>A−</button>
            <span className="aa-size" aria-live="polite">{d.size}px</span><button aria-label="Larger text" disabled={d.size >= 30} onClick={() => setD({ ...d, size: Math.min(30, d.size + 1) })}>A+</button></div>
          <label className="chk"><input type="checkbox" checked={ax.dyslexia} onChange={e => setA({ ...ax, dyslexia: e.target.checked })} /> Dyslexia-friendly font</label>
          <label className="chk"><input type="checkbox" checked={ax.contrast} onChange={e => setA({ ...ax, contrast: e.target.checked })} /> High contrast</label>
          <label className="chk"><input type="checkbox" checked={!!ax.ruler} onChange={e => setA({ ...ax, ruler: e.target.checked })} /> Reading ruler (a band that follows your pointer)</label>
          <label className="chk"><input type="checkbox" checked={ax.sr} onChange={e => setA({ ...ax, sr: e.target.checked })} /> Screen-reader mode (continuous text)</label>
          <label className="lbl">Letter &amp; line spacing: {ax.spacing}</label><input aria-label="Letter and line spacing" type="range" min={0} max={5} value={ax.spacing} onChange={e => setA({ ...ax, spacing: +e.target.value })} />
          <label className="lbl">Word spacing: {ax.words}</label><input aria-label="Word spacing" type="range" min={0} max={5} value={ax.words} onChange={e => setA({ ...ax, words: +e.target.value })} />
          <label className="lbl">Pages</label><select aria-label="Pages" className="fx-in" value={ax.spread} onChange={e => setA({ ...ax, spread: e.target.value as A11y['spread'] })}><option value="auto">Automatic</option><option value="one">Single page</option><option value="two">Two-page spread</option></select>
          <label className="lbl">Page turn</label><select aria-label="Page turn" className="fx-in" value={ax.motion} onChange={e => setA({ ...ax, motion: e.target.value as A11y['motion'] })}><option value="slide">Slide</option><option value="flip">Page curl</option><option value="none">Instant</option></select>
          <p className="tiny muted">Font, size, colours and layout are in Design while editing.</p></>}
        {panel === 'design' && <><h2 className="rp-h" tabIndex={-1}>Design</h2><DesignPanel compact /><Link className="small" to="/design">Full Design studio →</Link></>}
        {panel === 'marks' && <><h2 className="rp-h" tabIndex={-1}>Bookmarks</h2><button className="btn gold sm" onClick={addMark}>+ Bookmark this page</button>{!marks.length && <p className="small muted">No bookmarks yet. Bookmarks keep your exact page, even after the book is updated.</p>}
          <ul className="notes">{[...marks].sort((a, b) => a.chapter - b.chapter || a.para - b.para).map(m => <li key={m.id}><button className="link" onClick={() => goCh(m.chapter, m.para)}>{[chapters?.[m.chapter]?.group, chapters?.[m.chapter]?.title ?? `Ch. ${m.chapter + 1}`].filter(Boolean).join(' · ')}</button><q>{m.label}…</q><button className="x" onClick={() => setMarks(marks.filter(x => x.id !== m.id))} aria-label="Remove bookmark">×</button></li>)}</ul></>}
        {panel === 'notes' && <><h2 className="rp-h" tabIndex={-1}>Highlights &amp; notes</h2>{!hl.length && <p className="small muted">Select any passage to highlight it or attach a note.</p>}
          <ul className="notes">{hl.map(h => <li key={h.id}><button className="link" onClick={() => goCh(h.chapter, h.para ?? 0)}>{[chapters?.[h.chapter]?.group, chapters?.[h.chapter]?.title ?? `Ch. ${h.chapter + 1}`].filter(Boolean).join(' · ')}</button><q>{h.text.slice(0, 160)}</q>{h.note && <p>{h.note}</p>}<button className="x" onClick={() => setHl(hl.filter(x => x.id !== h.id))} aria-label="Remove">×</button></li>)}</ul>
          {(hl.length > 0 || marks.length > 0) && <div className="row gap wrap" role="group" aria-label="Export highlights, notes and bookmarks">
            <button className="btn ghost sm" onClick={() => exportNotes('md')}>Export Markdown</button><button className="btn ghost sm" onClick={() => exportNotes('json')}>Export JSON</button>
            {hl.length > 0 && <button className="btn ghost sm" onClick={shareNotes}>Share as a link</button>}</div>}
          <p className="tiny muted">Exports include highlights, notes and bookmarks with links back to the page. Everything stays on this device; no account needed.</p></>}
        {panel === 'voice' && <><h2 className="rp-h" tabIndex={-1}>Narration</h2><p className="small muted">Reads the chapter aloud, turning pages as it goes. Natural voices run privately in your browser (Kokoro, open-source); the first use downloads the voice model once (about 90 MB).</p>
          <label className="lbl" htmlFor="voice-sel">Voice</label><select id="voice-sel" className="fx-in" value={kVoice ? (kVoice.startsWith('p:') ? kVoice : `k:${kVoice}`) : (voice || 'dev:')} onChange={e => setVoice(e.target.value)}>
            {neuralFor(lang0) ? <optgroup label="Natural voices (English)">{NEURAL_VOICES.map(v => <option key={v.id} value={`k:${v.id}`}>{v.label}</option>)}</optgroup>
              : pv && <optgroup label="Natural voice"><option value={`p:${pv.id}`}>{pv.label}</option></optgroup>}
            <optgroup label="Device voices"><option value="dev:">Device default</option>{voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>)}</optgroup></select>
          {!neuralFor(lang0) && !pv && <p className="small muted">{PIPER_ON ? 'There is no natural voice for this language yet' : 'Natural voices are English-only for now'}, so this book uses your device's voice.</p>}
          {pv && kVoice.startsWith('p:') && <p className="tiny muted">Piper voice ({pv.licence}), downloaded once (about 60 MB) and run in your browser.</p>}
          {tts.phase === 'loading' && <p className="small" role="status">Loading natural voice… {tts.pct}%</p>}
          {tts.phase === 'failed' && <p className="small muted" role="status">The natural voice couldn't load on this device, so your device's voice is used.</p>}
          <label className="lbl">Speed: {rate.toFixed(2)}×</label><input aria-label="Narration speed" type="range" min={.6} max={1.6} step={.05} value={rate} onChange={e => setRate(+e.target.value)} />
          <label className="lbl" htmlFor="sleep-sel">Sleep timer</label><select id="sleep-sel" className="fx-in" value={sleep} onChange={e => { setSleep(+e.target.value); sleepAt.current = 0; }}>
            <option value={0}>Off: keep reading chapter after chapter</option><option value={-1}>Stop at the end of this chapter</option>{[5, 15, 30, 45, 60].map(m => <option key={m} value={m}>Stop after {m} minutes</option>)}</select>
          <p className="tiny muted">{sleepLeft ? `${mmss(sleepLeft)} left. ` : ''}The voice fades out gently over the last {FADE} seconds.</p>
          <button className="btn gold sm" onClick={() => speak(Math.max(0, paged ? firstVisible() : para))}>{speaking ? 'Restart from this page' : '▶ Start from this page'}</button></>}
      </aside>}
      <div className={`book-spread ${two ? 'two' : 'one'}`}
          onPointerDown={e => { if (e.button === 0) swipe.current = { x: e.clientX, y: e.clientY, t: Date.now() }; }} onPointerCancel={() => { swipe.current = null; }}
            onWheel={e => { if (!paged || Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5 || Date.now() - wheelAt.current < 600) return; wheelAt.current = Date.now(); flip(e.deltaX > 0 ? 1 : -1); }}
            onPointerUp={e => { const s = swipe.current; swipe.current = null; if (!s || !paged) return; const dx = e.clientX - s.x; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - s.y) && (Date.now() - s.t < 700 || Math.abs(dx) > e.currentTarget.clientWidth * 0.25) && !window.getSelection()?.toString()) { swiped.current = true; setTimeout(() => { swiped.current = false; }, 400); flip(dx < 0 ? 1 : -1); } }}>
        {paged && <button className="tap prev" aria-label="Previous page" onClick={() => { if (swiped.current) { swiped.current = false; return; } flip(-1); }} />}
        {ax.ruler && <Ruler />}
        {keys && <div className="keys-help glass" role="dialog" aria-modal="false" aria-label="Keyboard shortcuts"><h2 className="h3">Keyboard shortcuts</h2>
          <dl>{[['→ / Space / Page Down', 'Next page'], ['← / Shift+Space / Page Up', 'Previous page'], ['Home / End', 'First / last page of chapter'], ['Swipe or trackpad swipe', 'Turn the page'], ['/', 'Find in this book'], ['L', 'Listen / stop narration'], ['B', 'Bookmark this page'], ['T', 'Contents'], ['Esc', 'Close panel'], ['?', 'Show or hide this help']].map(([k, v]) => <div key={k}><dt><kbd>{k}</kbd></dt><dd>{v}</dd></div>)}</dl>
          <button className="btn ghost sm" autoFocus onClick={() => setKeys(false)}>Close</button></div>}
        <article id="reader-text" className={`page-paper ${turn && motion !== 'none' ? `turn-${motion}-${turn}` : ''}`} lang={book?.languages[0]}>
          {!chapters && <p className="loading"><span className="spin" /> Opening the book…</p>}
          {chapter && <div className="pg-view" ref={viewRef}

            onClick={e => { if (swiped.current) { swiped.current = false; return; } if (!paged || editing || window.getSelection()?.toString() || (e.target as HTMLElement).closest('a,button,mark,input')) return;
              const r = e.currentTarget.getBoundingClientRect(); flip(e.clientX - r.left < r.width / 2 ? -1 : 1); }}>
            <div className="pg-flow" ref={flowRef} style={paged ? { transform: `translateX(calc(${-page} * (100% + var(--r-gap))))` } : undefined}>
              {ch === 0 && book && <header className="title-page"><div className="tp-orn">❦</div><p className="tp-h1" aria-hidden="true">{book.title.split(/[;:]/)[0]}</p><p>{author(book)}</p><RightsTag r={rightsFor(book)} /></header>}
              <h2 className="ch-title">{chapter.title}</h2>
              {editing && <p className="edit-hint">Editing: changes are saved on this device and recorded in the book's change log.</p>}
              <div className="prose">
                {paras.map((p, i) => editing
                  ? <p key={i} data-p={i} contentEditable suppressContentEditableWarning className="editable" onBlur={e => { const t = e.currentTarget.textContent ?? ''; if (t !== chapter.paras[i]) setEdits([...edits.filter(x => !(x.chapter === ch && x.para === i)), { chapter: ch, para: i, text: t, at: Date.now() }]); }}>{p}</p>
                  : <p key={i} data-p={i} className={para === i ? 'speaking' : ''} onClick={() => speaking && !paged && speak(i)}>{speaking && say && say[0] === i ? <>{p.slice(0, say[1])}<span className="say">{p.slice(say[1], say[2])}</span>{p.slice(say[2])}</> : marked(p, chHl.filter(h => p.includes(h.text)))}</p>)}
              </div>
              {!paged && <nav className="ch-nav"><button className="btn ghost" disabled={ch === 0} onClick={() => goCh(ch - 1)}>← Previous chapter</button><button className="btn ghost" disabled={ch >= chapters!.length - 1} onClick={() => goCh(ch + 1)}>Next chapter →</button></nav>}
            </div>
          </div>}
        </article>
        {paged && <button className="tap next" aria-label="Next page" onClick={() => { if (swiped.current) { swiped.current = false; return; } flip(1); }} />}
      </div>
      {speaking && <div className="player glass" role="region" aria-label="Narration player">
        <div className="pl-info"><span className="pl-ch">{chapter?.title.slice(0, 40)}</span><span className="muted small">{tts.phase === 'loading' && kVoice ? `Loading natural voice ${tts.pct}%` : paused ? `Paused · ${Math.round(pct)}%` : `Reading · ${rate}× · ${Math.round(pct)}%`}</span></div>
        <div className="pl-ctl"><button onClick={() => paraSkip(-1)} aria-label="Previous paragraph">⏪</button><button onClick={() => skip(-1)} aria-label="Previous sentence">⏮</button>
          <button className="pl-main" onClick={togglePause} aria-label={paused ? 'Resume narration' : 'Pause narration'}>{paused ? '▶' : '❚❚'}</button>
          <button onClick={() => skip(1)} aria-label="Next sentence">⏭</button><button onClick={() => paraSkip(1)} aria-label="Next paragraph">⏩</button>
          <button className={`pl-sleep ${sleepLeft && sleepLeft < FADE * 1000 ? 'fading' : ''}`} onClick={cycleSleep} aria-label={`Sleep timer: ${sleepLeft ? `${mmss(sleepLeft)} left` : sleepLabel}. Change`} title={sleepLeft && sleepLeft < FADE * 1000 ? 'Fading out…' : 'Sleep timer'}>☾{sleep === -1 ? ' ch' : sleepLeft ? ` ${mmss(sleepLeft)}` : ''}</button>
          <button onClick={() => setRate(rate >= 2 ? 0.75 : Math.round((rate + 0.25) * 100) / 100)} aria-label={`Speed ${rate} times, change`}>{rate}×</button>
          <button onClick={stopAll} aria-label="Stop narration">✕</button></div></div>}
      {chapter && <div className="pg-foot"><span className="muted small">{chapter.title.slice(0, 48)}<span className="foot-left" title={readingSpeed() ? `Based on your reading speed here (${wpm} words a minute)` : 'Estimated at 230 words a minute until the reader learns your speed'}> · {timeLeft}</span></span><span className="muted small" aria-live="polite">{pageNo}{pageNo && ' · '}Chapter {ch + 1} of {chapters!.length} · {Math.round(pct)}%</span>
        <input className="scrub" type="range" min={0} max={100} step={0.1} value={scrubV ?? pct} aria-label="Position in book" aria-valuetext={`${Math.round(pct)}%, chapter ${ch + 1} of ${chapters!.length}`} onChange={e => setScrubV(+e.target.value)} onPointerUp={e => scrub(+(e.target as HTMLInputElement).value)} onKeyUp={e => scrub(+(e.target as HTMLInputElement).value)} />
        {scrubV !== null && <span className="scrub-tip small">{chapters![Math.min(chapters!.length - 1, Math.floor(scrubV / 100 * chapters!.length))]?.title.slice(0, 40)} · {Math.round(scrubV)}%</span>}</div>}
      {def && <Define word={def} onClose={() => setDef(null)} />}
      {card && <QuoteCard text={card} by={book ? author(book) : ''} title={book?.title.split(/[;:]/)[0] ?? ''} onClose={() => setCard(null)} />}
      {sel && <div className="sel-pop glass" role="toolbar" aria-label="Selected text" style={{ left: sel.x, top: sel.y - 52, position: 'fixed' }} onMouseUp={e => e.stopPropagation()}>
        <button onClick={() => addHl()}>Highlight</button>
        {/^[\p{L}'’-]{2,30}$/u.test(sel.text.trim()) && <button onClick={() => { setDef(sel.text.trim()); setSel(null); }}>Define</button>}
        <button onClick={() => { const n = prompt('Note for this passage'); if (n) addHl(n); }}>Add note</button>
        <button onClick={() => { navigator.clipboard?.writeText(`“${sel.text}” — ${book ? author(book) : ''}, ${book?.title.split(/[;:]/)[0] ?? ''}`); setSel(null); }}>Copy quote</button>
        <button onClick={() => { setCard(sel.text); setSel(null); }}>Quote card</button>
      </div>}
    </div>
  );
}
const FADE = 30;
function gap(two: boolean) { return two ? 64 : 0; }

function FindPanel({ chapters, q, setQ, go }: { chapters: Chapter[]; q: string; setQ: (s: string) => void; go: (n: number, at?: number) => void }) {
  const res = useMemo(() => { const n = q.trim().toLowerCase(); if (n.length < 2) return [] as { c: number; p: number; s: string }[];
    const out: { c: number; p: number; s: string }[] = [];
    chapters.forEach((c, ci) => c.paras.forEach((p, pi) => { if (out.length >= 200) return; const at = p.toLowerCase().indexOf(n); if (at < 0) return; const st = Math.max(0, at - 50);
      out.push({ c: ci, p: pi, s: (st ? '…' : '') + p.slice(st, at + n.length + 70) + '…' }); }));
    return out; }, [q, chapters]);
  const n = q.trim().toLowerCase();
  const mk = (s: string) => { const i = s.toLowerCase().indexOf(n); return i < 0 ? s : <>{s.slice(0, i)}<mark>{s.slice(i, i + n.length)}</mark>{s.slice(i + n.length)}</>; };
  return <><h2 className="rp-h" tabIndex={-1}>Find in this book</h2>
    <input className="fx-in" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Word or phrase" aria-label="Find in this book" />
    <p className="small muted" role="status">{n.length < 2 ? 'Type at least two letters. Press / to open this panel.' : `${res.length >= 200 ? '200+' : res.length} match${res.length === 1 ? '' : 'es'}`}</p>
    <ol className="find-list">{res.map((r, i) => <li key={i}><button onClick={() => go(r.c, r.p)}><span className="small muted">{chapters[r.c].title}</span><br />{mk(r.s)}</button></li>)}</ol></>;
}

function Ruler() {
  const [y, setY] = useState(-100);
  useEffect(() => { const m = (e: PointerEvent) => setY(e.clientY); window.addEventListener('pointermove', m); return () => window.removeEventListener('pointermove', m); }, []);
  return <div className="read-ruler" aria-hidden="true" style={{ top: y - 22 }} />;
}

type Sense = { pos: string; defs: string[] };
const strip = (h: string) => new DOMParser().parseFromString(h, 'text/html').body.textContent?.trim() ?? '';
/** Free dictionary lookup from Wiktionary (CC BY-SA), shown with attribution. */
function Define({ word, onClose }: { word: string; onClose: () => void }) {
  const [r, setR] = useState<Sense[] | null | 'none'>(null);
  useEffect(() => { let live = true; const w = word.replace(/[’']s$/, '');
    const get = (x: string) => fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(x)}`).then(res => res.ok ? res.json() : null);
    get(w).then(j => j?.en ? j : w !== w.toLowerCase() ? get(w.toLowerCase()) : j).then(j => { if (!live) return;
      const out: Sense[] = (j?.en ?? []).slice(0, 3).map((e: { partOfSpeech: string; definitions: { definition: string }[] }) => ({ pos: e.partOfSpeech, defs: e.definitions.map(d => strip(d.definition)).filter(Boolean).slice(0, 3) })).filter((x: Sense) => x.defs.length);
      setR(out.length ? out : 'none'); }).catch(() => live && setR('none'));
    return () => { live = false; }; }, [word]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return <div className="define glass" role="dialog" aria-label={`Definition of ${word}`}>
    <div className="row between"><h2 className="h3">{word}</h2><button className="btn ghost sm" onClick={onClose} autoFocus aria-label="Close definition">✕</button></div>
    {r === null && <p className="muted small" role="status">Looking it up…</p>}
    {r === 'none' && <p className="muted small" role="status">No dictionary entry found for this word.</p>}
    {Array.isArray(r) && r.map((x, i) => <div key={i}><p className="def-pos">{x.pos}</p><ol>{x.defs.map((d, j) => <li key={j}>{d}</li>)}</ol></div>)}
    <p className="small muted">From <a href={`https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`} target="_blank" rel="noopener">Wiktionary</a>, CC BY-SA.</p>
  </div>;
}
