import { useNavigate } from 'react-router-dom';
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { hueOf } from './ui';
import { useUiMotion } from './ui';

export type SpineBook = { id: number | string; title: string; author: string; to?: string };
const W = (t: string) => 34 + (hueOf(t) % 5) * 7;
const Ht = (t: string) => 210 + (hueOf(t + 'h') % 6) * 12;
const CLOTH = ['#5b1a24', '#14324f', '#1f3d2e', '#3d2350', '#4a2f14', '#22283f', '#5a3a12', '#2a1418'];

/** A real CSS-3D bookcase: spines with thickness, gilt bands, a candle-warm glow; drag to orbit. */
export type RowSlot = { lead?: ReactNode; trail?: ReactNode };
export default function Shelf3D({ books, rows = 2, slots = [], top, front, hint = true }: { books: SpineBook[]; rows?: number; slots?: RowSlot[]; top?: ReactNode; front?: ReactNode; hint?: boolean }) {
  const nav = useNavigate();
  const motion = useUiMotion();
  const [rot, setRot] = useState({ x: -6, y: -14 });
  const drag = useRef<{ x: number; y: number; r: { x: number; y: number } } | null>(null);
  const per = Math.ceil(books.length / rows) || 1;
  const shelves = Array.from({ length: rows }, (_, i) => books.slice(i * per, (i + 1) * per));
  const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, r: rot }; (e.target as Element).setPointerCapture?.(e.pointerId); };
  const move = (e: PointerEvent) => { const d = drag.current; if (!d) return; setRot({ x: Math.max(-25, Math.min(15, d.r.x - (e.clientY - d.y) * .15)), y: Math.max(-45, Math.min(45, d.r.y + (e.clientX - d.x) * .2)) }); };
  return (
    <div className={`case-stage ${motion ? 'anim' : ''}`} onPointerDown={down} onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
      <div className="case" style={{ transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)` }}>
        <div className="case-back" /><div className="case-side l" /><div className="case-side r" /><div className="case-cap" />
        {top && <div className="case-top">{top}</div>}
        {shelves.map((row, r) => (
          <div className="case-row" key={r}>
            {slots[r]?.lead && <div className="decor-slot">{slots[r].lead}</div>}
            {row.map((b, i) => {
              const w = W(b.title), h = Ht(b.title), cloth = CLOTH[hueOf(b.title) % CLOTH.length];
              return (
                <button key={b.id} className="book3d" title={`${b.title} — ${b.author}`} style={{ ['--w' as string]: `${w}px`, ['--hgt' as string]: `${h}px`, ['--cloth' as string]: cloth, ['--d' as string]: `${(i * 0.37) % 4}s` }}
                  onClick={() => nav(b.to ?? `/book?id=${b.id}`)}>
                  <span className="b-spine"><span className="b-band" /><span className="b-title">{b.title.split(/[;:]/)[0]}</span><span className="b-auth">{b.author.split(' ').slice(-1)[0]}</span><span className="b-band low" /></span>
                  <span className="b-side" /><span className="b-top" />
                </button>
              );
            })}
            {slots[r]?.trail && <div className="decor-slot">{slots[r].trail}</div>}
            <div className="plank"><span /></div>
          </div>
        ))}
        {front && <div className="case-front">{front}</div>}
      </div>
      {hint && <p className="tiny muted center case-hint">Drag to turn the case · click a spine to open</p>}
    </div>
  );
}
