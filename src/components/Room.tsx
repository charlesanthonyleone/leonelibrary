import { useMemo } from 'react';
import Shelf3D, { type SpineBook } from './Shelf3D';
import { useUiMotion } from './ui';
import { sanitizeHtml, scopeCss, type RoomCfg } from '../lib/room';

/* ---- decorations: hand-drawn SVG/CSS objects that sit on the planks like books do ---- */
const Plant = ({ v = 0 }: { v?: number }) => {
  const leaves = v ? [[-58, 64], [-28, 76], [4, 82], [32, 74], [60, 62], [-80, 50], [84, 48]] : [[-40, 70], [-14, 84], [14, 86], [40, 72], [-64, 54], [66, 52]];
  return (
    <svg className="dc plant" viewBox="0 0 120 170" width="96" height="136" aria-hidden>
      <defs>
        <linearGradient id={`lf${v}`} x1="0" x2="1"><stop offset="0" stopColor="#1f5a33" /><stop offset=".5" stopColor="#3f8f4f" /><stop offset="1" stopColor="#1b4a2b" /></linearGradient>
        <linearGradient id="pot" x1="0" x2="1"><stop offset="0" stopColor="#6b3720" /><stop offset=".45" stopColor="#b8683f" /><stop offset="1" stopColor="#5a2c18" /></linearGradient>
      </defs>
      {leaves.map(([a, l], i) => <g key={i} transform={`translate(60 112) rotate(${a})`}><path d={`M0 0 Q${-l * .28} ${-l * .55} 0 ${-l} Q${l * .28} ${-l * .55} 0 0Z`} fill={`url(#lf${v})`} /><path d={`M0 0 L0 ${-l * .92}`} stroke="#9fd59a" strokeOpacity=".35" strokeWidth="1" /></g>)}
      <path d="M30 110 H90 L82 166 H38Z" fill="url(#pot)" /><rect x="26" y="104" width="68" height="10" rx="3" fill="#c97a4c" /><rect x="26" y="104" width="68" height="3" rx="1.5" fill="#e6a477" opacity=".6" />
    </svg>
  );
};
const Candles = () => (
  <div className="dc candles" aria-hidden>{[62, 88, 48].map((h, i) => <span key={i} className="candle" style={{ height: h, ['--fd' as string]: `${i * .37}s` }}><i className="flame" /><i className="halo" /></span>)}</div>
);
const Lamp = () => (
  <div className="dc lamp" aria-hidden><span className="cone" /><span className="shade" /><span className="arm" /><span className="base" /></div>
);
const Globe = () => (
  <svg className="dc globe" viewBox="0 0 90 130" width="70" height="101" aria-hidden>
    <defs><radialGradient id="gl" cx=".35" cy=".35" r=".8"><stop offset="0" stopColor="#d9c9a0" /><stop offset=".6" stopColor="#8b7a50" /><stop offset="1" stopColor="#3b2f18" /></radialGradient></defs>
    <circle cx="45" cy="50" r="36" fill="url(#gl)" /><path d="M24 34c8 4 10-4 18 0s4 12 12 12 6-10 12-8M18 58c10 2 14 10 24 8s10-6 18-4" stroke="#4a3a1a" strokeWidth="2" fill="none" opacity=".55" />
    <path d="M45 10 A40 40 0 0 1 45 90" stroke="#c9a04a" strokeWidth="3" fill="none" /><rect x="42" y="90" width="6" height="22" fill="#8a6a2a" /><ellipse cx="45" cy="118" rx="24" ry="7" fill="#6b4f1f" />
  </svg>
);
const Ivy = () => (
  <svg className="dc ivy" viewBox="0 0 600 120" preserveAspectRatio="none" aria-hidden>
    {[[40, 90], [150, 60], [260, 110], [380, 70], [500, 100], [570, 50]].map(([x, l], i) => <g key={i}><path d={`M${x} 0 C${x + 12} ${l * .3} ${x - 14} ${l * .6} ${x + 4} ${l}`} stroke="#2f5f32" strokeWidth="2" fill="none" />
      {Array.from({ length: 5 }, (_, k) => <ellipse key={k} cx={x + (k % 2 ? 8 : -6)} cy={l * (k + .6) / 5.4} rx="7" ry="5" fill={k % 2 ? '#3f8a45' : '#2e6b36'} transform={`rotate(${k % 2 ? 30 : -30} ${x} ${l * (k + .6) / 5.4})`} />)}</g>)}
  </svg>
);
const StringLights = () => (
  <svg className="dc string" viewBox="0 0 600 60" preserveAspectRatio="none" aria-hidden>
    <path d="M0 6 Q150 52 300 18 T600 8" stroke="#2a2a2a" strokeWidth="1.5" fill="none" />
    {Array.from({ length: 13 }, (_, i) => { const t = i / 12, x = t * 600, y = t < .5 ? 6 + (1 - Math.abs(t * 4 - 1)) * 30 + t * 24 : 18 - (t - .5) * 20 + Math.sin((t - .5) * 6.28) * 10; return <circle key={i} className="bulb" cx={x} cy={y + 5} r="4" style={{ animationDelay: `${i * .23}s` }} />; })}
  </svg>
);

function Particles({ kind, n }: { kind: string; n: number }) {
  const ps = useMemo(() => Array.from({ length: n }, (_, i) => { const r = (k: number) => ((Math.sin((i + 1) * 12.9898 * k) * 43758.5453) % 1 + 1) % 1;
    return { x: r(1) * 100, s: .4 + r(2) * 1, d: 7 + r(3) * 9, dl: -r(4) * 16, y: r(5) * 100, sw: (r(6) - .5) * 60 }; }), [n]);
  return <div className={`fx fx-${kind}`} aria-hidden>{ps.map((p, i) => <i key={i} style={{ left: `${p.x}%`, top: kind === 'snow' || kind === 'petals' ? '-4%' : `${p.y}%`, ['--s' as string]: p.s, ['--d' as string]: `${p.d}s`, ['--dl' as string]: `${p.dl}s`, ['--sw' as string]: `${p.sw}px` }} />)}</div>;
}

/** scenery painted entirely in CSS/SVG, behind the case */
function SceneBg({ scene }: { scene: RoomCfg['scene'] }) {
  switch (scene) {
    case 'snow': return <div className="sb"><svg className="pines" viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden>
      {[0, 1].map(row => Array.from({ length: 16 }, (_, i) => { const x = i * 66 + (row ? 30 : 0) + ((i * 37) % 20), h = (row ? 150 : 110) + ((i * 53) % 60), b = row ? 300 : 250;
        return <g key={row + '-' + i} opacity={row ? 1 : .55}><path d={`M${x} ${b - h} L${x - h * .28} ${b} L${x + h * .28} ${b}Z`} fill={row ? '#1d2c3c' : '#3b4f66'} /><path d={`M${x} ${b - h} L${x - h * .1} ${b - h * .62} L${x + h * .1} ${b - h * .62}Z`} fill="#e8f0f8" opacity=".85" /></g>; }))}
    </svg><div className="drift" /></div>;
    case 'meadow': return <div className="sb"><div className="hills" /><svg className="cliff" viewBox="0 0 400 500" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="rk" x1="0" x2="1"><stop offset="0" stopColor="#4c4a4f" /><stop offset=".5" stopColor="#38363b" /><stop offset="1" stopColor="#1c1b1e" /></linearGradient>
        <linearGradient id="rk2" x1="0" x2="1"><stop offset="0" stopColor="#2a2a2e" /><stop offset="1" stopColor="#111114" /></linearGradient></defs>
      <path d="M70 60 C90 30 120 22 150 30 L175 26 L176 500 L20 500 C34 440 26 400 44 350 C60 300 40 250 58 200 C70 150 50 110 70 60Z" fill="url(#rk)" />
      <path d="M232 22 C270 10 320 18 360 0 L400 0 L400 500 L230 500 C236 430 228 380 238 320 C246 260 226 200 236 140 C242 90 224 60 232 22Z" fill="url(#rk2)" />
      {[[60, 120, 170], [48, 220, 172], [40, 330, 174], [250, 110, 390], [240, 240, 400], [236, 360, 400]].map(([x1, y, x2], i) => <path key={i} d={`M${x1} ${y} Q${(x1 + x2) / 2} ${y + 8} ${x2} ${y - 4}`} stroke="#000" strokeOpacity=".35" strokeWidth="3" fill="none" />)}
      <path d="M80 70 C60 140 90 190 64 260" stroke="#6b6a70" strokeOpacity=".35" strokeWidth="5" fill="none" />
      <path d="M60 46 C90 20 130 20 176 24 L176 40 C130 34 96 40 60 60Z M232 20 C280 6 330 14 400 0 L400 16 C340 26 280 22 232 34Z" fill="#3f6b38" />
    </svg><div className="falls"><i /><i /><i /></div><div className="pool" /><div className="mist" /><div className="grass" /><div className="flowers" /></div>;
    case 'greenhouse': return <div className="sb"><div className="panes" /><div className="floor" /></div>;
    case 'neon': return <div className="sb"><div className="sun" /><div className="grid" /></div>;
    case 'atelier': return <div className="sb"><div className="bokeh" /><div className="floor" /></div>;
    case 'gallery': return <div className="sb"><div className="pool-light" /><div className="floor" /></div>;
    case 'summit': return <div className="sb"><div className="plinth" /></div>;
    default: return <div className="sb"><div className="panel" /><div className="floor" /></div>;
  }
}

let seq = 0;
export default function Room({ cfg, books, rows, compact, applied }: { cfg: RoomCfg; books: SpineBook[]; rows?: number; compact?: boolean; applied?: { css: string; html: string } }) {
  const motion = useUiMotion();
  const id = useMemo(() => `room-${++seq}`, []);
  const code = applied ?? { css: cfg.css, html: cfg.html };
  const css = useMemo(() => scopeCss(code.css, `#${id}`), [code.css, id]);
  const html = useMemo(() => code.html.trim() ? sanitizeHtml(code.html) : '', [code.html]);
  const d = cfg.decor, nRows = rows ?? (books.length > 9 ? 2 : 1);
  const slots = [{ lead: d.plants ? <Plant /> : undefined, trail: d.candles ? <Candles /> : undefined }, { lead: d.globe ? <Globe /> : undefined, trail: d.plants ? <Plant v={1} /> : undefined }];
  if (nRows === 1 && d.globe) slots[0].trail = <>{slots[0].trail}<Globe /></>;
  return (
    <div id={id} className={`room scene-${cfg.scene} mat-${cfg.material} light-${cfg.light} ${compact ? 'compact' : ''} ${motion ? 'anim' : ''}`} style={{ ['--li' as string]: cfg.intensity }}>
      <SceneBg scene={cfg.scene} />
      <div className="room-light" />
      {cfg.effect !== 'none' && <Particles kind={cfg.effect} n={cfg.effect === 'snow' ? 90 : cfg.effect === 'dust' ? 40 : 28} />}
      <Shelf3D books={books} rows={nRows} hint={!compact} slots={slots}
        top={<>{d.lamp && <Lamp />}{d.lights && <StringLights />}</>} front={d.ivy ? <Ivy /> : undefined} />
      {html && <div className="room-custom" dangerouslySetInnerHTML={{ __html: html }} />}
      {css && <style>{css}</style>}
    </div>
  );
}
