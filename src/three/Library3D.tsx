import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { BookSlot, Item, Layout } from '../lib/layout';
import { Engine, type Pick } from './engine';

export type Lib3DHandle = { snapshot: () => string | undefined; setCam: (c: Layout["cam"]) => void };
type Props = {
  layout: Layout; mode?: 'view' | 'books' | 'decor'; tool?: 'translate' | 'rotate' | 'scale'; editable?: boolean; compact?: boolean;
  onBooks?: (b: BookSlot[]) => void; onItem?: (it: Item, final: boolean) => void; onSelect?: (p: Pick) => void; onCam?: (c: Layout['cam']) => void;
};
/** The photoreal room: three.js with PBR textures, HDRI lighting and soft shadows. */
const Library3D = forwardRef<Lib3DHandle, Props>(function Library3D(p, ref) {
  const host = useRef<HTMLDivElement>(null), eng = useRef<Engine | null>(null), cb = useRef(p); cb.current = p;
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const e = new Engine(host.current!, {
      onBooks: b => cb.current.onBooks?.(b), onItem: (i, f) => cb.current.onItem?.(i, f), onSelect: s => cb.current.onSelect?.(s), onCam: c => cb.current.onCam?.(c), onReady: () => setReady(true),
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
  useImperativeHandle(ref, () => ({ snapshot: () => eng.current?.snapshot(), setCam: c => eng.current?.setCam(c) }));
  return <div ref={host} className={`lib3d ${p.compact ? 'compact' : ''} ${ready ? 'ready' : ''}`}>{!ready && <div className="lib3d-load"><span />Lighting the room…</div>}</div>;
});
export default Library3D;
