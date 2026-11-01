import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BookSlot, Item, Layout } from '../lib/layout';
import { Engine, type Pick } from './engine';
import type { ReadState } from './reading';
import type { ReaderLook } from '../lib/reader3d';
import type { Chapter } from '../lib/books';

export type Lib3DHandle = {
  snapshot: () => string | undefined; setCam: (c: Layout["cam"]) => void;
  open: (id: string, look: ReaderLook) => boolean; close: (done?: () => void) => void; setText: (c: Chapter[] | null, status?: string, at?: { ch: number; para: number } | null) => void;
  setLook: (l: ReaderLook) => void; next: () => void; prev: () => void; jump: (spread: number) => void; fit: () => void; zoom: (f: number) => void; text: () => string; reading: () => boolean;
};
type Props = {
  layout: Layout; mode?: 'view' | 'books' | 'decor'; tool?: 'translate' | 'rotate' | 'scale'; editable?: boolean; compact?: boolean;
  onBooks?: (b: BookSlot[]) => void; onItem?: (it: Item, final: boolean) => void; onSelect?: (p: Pick) => void; onCam?: (c: Layout['cam']) => void;
  onOpen?: (id: string) => void; onRead?: (s: ReadState | null) => void;
};
/** The photoreal room: three.js with PBR textures, HDRI lighting and soft shadows. */
const Library3D = forwardRef<Lib3DHandle, Props>(function Library3D(p, ref) {
  const host = useRef<HTMLDivElement>(null), eng = useRef<Engine | null>(null), cb = useRef(p); cb.current = p;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const e = new Engine(host.current!, {
      onBooks: b => cb.current.onBooks?.(b), onItem: (i, f) => cb.current.onItem?.(i, f), onSelect: s => cb.current.onSelect?.(s), onCam: c => cb.current.onCam?.(c), onReady: () => setReady(true),
      onOpen: id => cb.current.onOpen?.(id), onRead: s => cb.current.onRead?.(s),
    });
    eng.current = e; e.set(p.layout, true); (window as any).__lib3d = e;
    return () => { e.dispose(); eng.current = null; };
  }, []);
  useEffect(() => { eng.current?.set(p.layout); }, [p.layout]);
  useEffect(() => { eng.current?.setMode(p.mode ?? 'view'); }, [p.mode]);
  useEffect(() => { eng.current?.setTool(p.tool ?? 'translate'); }, [p.tool]);
  useEffect(() => { if (eng.current) eng.current.editable = p.editable !== false; }, [p.editable]);
  const camKey = JSON.stringify(p.layout.cam);
  useEffect(() => { /* external camera presets */ }, [camKey]);
  useImperativeHandle(ref, () => ({
    snapshot: () => eng.current?.snapshot(), setCam: c => { if (!eng.current?.reading) eng.current?.setCam(c); },
    open: (id, look) => !!eng.current?.openBook(id, look), close: done => eng.current?.closeBook(done),
    setText: (c, s, at) => { void eng.current?.reading?.setText(c, s, at); }, setLook: l => { void eng.current?.reading?.setLook(l); },
    next: () => eng.current?.reading?.next(), prev: () => eng.current?.reading?.prev(), jump: k => eng.current?.reading?.jump(k), fit: () => eng.current?.reading?.fit(),
    zoom: f => { const r = eng.current?.reading; if (r) r.zoom = Math.min(3.2, Math.max(1, r.zoom * f)); },
    text: () => eng.current?.reading?.textNow() ?? '', reading: () => !!eng.current?.reading,
  }));
  return <div ref={host} className={`lib3d ${p.compact ? 'compact' : ''} ${ready ? 'ready' : ''}`}>{!ready && <div className="lib3d-load"><span />Lighting the room…</div>}</div>;
});
export default Library3D;
