import { useEffect, useRef, useState } from 'react';
import type { Lib3DHandle } from '../three/Library3D';
import type { ReadState } from '../three/reading';
import type { Chapter } from '../lib/books';
import { load } from '../lib/store';

/** The thin reading bar around the open book. Deliberately no settings here: the reader is designed in Edit → Reader. */
export default function BookHUD({ lib, st, title, chapters, fs, onFs, onClose }: { lib: Lib3DHandle | null; st: ReadState; title: string; chapters: Chapter[] | null; fs: boolean; onFs: () => void; onClose: () => void }) {
  const [speaking, setSpeaking] = useState(false); const speakRef = useRef(false); const [toc, setToc] = useState(false);
  const stop = () => { speakRef.current = false; setSpeaking(false); window.speechSynthesis?.cancel(); };
  useEffect(() => () => { window.speechSynthesis?.cancel(); }, []);
  useEffect(() => { if (st.stage === 'closing') stop(); }, [st.stage]);
  const speakNow = () => {
    const ss = window.speechSynthesis; if (!ss || !lib || !speakRef.current) return;
    const txt = lib.text().trim(); const voices = ss.getVoices(), want = load('voice', ''), v = voices.find(x => x.name === want);
    if (!txt) { lib.next(); setTimeout(speakNow, 1400); return; }
    const parts = txt.match(/[^.!?;]+[.!?;]*["”’)]*\s*/g) ?? [txt]; let i = 0;
    const one = () => { if (!speakRef.current) return; if (i >= parts.length) { const before = JSON.stringify(lib && (window as any).__lib3d?.reading?.state()); lib.next(); setTimeout(() => { const after = JSON.stringify((window as any).__lib3d?.reading?.state()); if (after === before) stop(); else speakNow(); }, 1300); return; }
      const u = new SpeechSynthesisUtterance(parts[i++]); if (v) { u.voice = v; u.lang = v.lang; } u.rate = load('voice-rate', 1); u.onend = one; u.onerror = () => stop(); ss.speak(u); };
    one();
  };
  const listen = () => { if (speaking) return stop(); if (!window.speechSynthesis) return; speakRef.current = true; setSpeaking(true); speakNow(); };
  const pageLabel = () => { const n = [st.leftNum, st.rightNum].filter(Boolean) as number[];
    if (st.narrow) { const one = st.focus === 'L' ? st.leftNum : st.rightNum; return one ? `Page ${one}` : st.spread === 0 ? 'Title page' : ''; }
    return n.length === 2 ? `Pages ${n[0]}–${n[1]}` : n.length ? `Page ${n[0]}` : st.spread === 0 ? 'Title page' : ''; };
  const chap = chapters?.[st.chapter]?.title;
  const reading = st.stage === 'reading';
  return <>
    <div className={`book-vignette ${st.stage === 'closing' ? 'out' : ''}`} />
    <div className={`book-hud top ${reading ? 'on' : ''}`}>
      <button className="bh-btn" onClick={() => { stop(); onClose(); }} title="Put the book back (Esc)">← Shelf</button>
      <div className="bh-title"><b>{title}</b>{chap && <span>{chap.replace(/\s+/g, ' ').slice(0, 60)}</span>}</div>
      <button className="bh-btn" onClick={onFs} title="Full screen (F)">{fs ? '⤡ Exit' : '⤢ Full screen'}</button>
    </div>
    <div className={`book-hud bottom ${reading ? 'on' : ''}`}>
      <button className="bh-btn icon" onClick={() => lib?.prev()} aria-label="Previous page">‹</button>
      <div className="bh-mid">
        <button className="bh-link" onClick={() => setToc(!toc)} disabled={!chapters?.length}>{pageLabel()} <span className="muted">· {Math.round((st.spread / Math.max(1, st.spreads - 1)) * 100)}%</span></button>
        <input type="range" aria-label="Go to page" min={0} max={Math.max(0, st.spreads - 1)} value={st.spread} onChange={e => lib?.jump(+e.target.value)} />
      </div>
      <button className={`bh-btn ${speaking ? 'on' : ''}`} onClick={listen} title="Narrate the open pages with your device's voices">{speaking ? '■' : '▶'} <span className="hide-sm">{speaking ? 'Stop' : 'Listen'}</span></button>
      <button className="bh-btn icon" onClick={() => lib?.next()} aria-label="Next page">›</button>
    </div>
    {toc && chapters && <div className="book-toc glass" onClick={e => e.stopPropagation()}>
      <div className="row between"><b>Contents</b><button className="bh-link" onClick={() => setToc(false)}>Close</button></div>
      <ol>{chapters.map((c, i) => <li key={i}><button className={i === st.chapter ? 'on' : ''} onClick={() => { const w = (window as any).__lib3d?.reading; const idx = w?.book.pages.findIndex((p: any) => p.ch === i && p.kind === 'text') ?? -1; if (idx >= 0) lib?.jump(Math.ceil(idx / 2)); setToc(false); }}>{c.title.replace(/\s+/g, ' ').slice(0, 70)}</button></li>)}</ol>
    </div>}
  </>;
}
