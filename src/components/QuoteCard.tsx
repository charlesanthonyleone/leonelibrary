import { useEffect, useRef, useState } from 'react';
// Renders a shareable quote image on a canvas, entirely on the device.
const STYLES = { Night: ['#0e1526', '#f3ead2', '#d9b25f'], Paper: ['#f4ecd8', '#2a2118', '#8a5a1f'], Ink: ['#111', '#fff', '#ffd54a'], Sage: ['#21352c', '#eef3e8', '#b9d79b'] } as const;
type S = keyof typeof STYLES;
function wrap(ctx: CanvasRenderingContext2D, text: string, w: number) { const out: string[] = []; let line = ''; for (const word of text.split(/\s+/)) { const t = line ? line + ' ' + word : word; if (ctx.measureText(t).width > w && line) { out.push(line); line = word; } else line = t; } if (line) out.push(line); return out; }
export default function QuoteCard({ text, by, title, onClose }: { text: string; by: string; title: string; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null); const [s, setS] = useState<S>('Night'); const [square, setSquare] = useState(true);
  useEffect(() => { const c = ref.current!, W = 1080, H = square ? 1080 : 1920; c.width = W; c.height = H; const x = c.getContext('2d')!; const [bg, ink, acc] = STYLES[s];
    x.fillStyle = bg; x.fillRect(0, 0, W, H); x.strokeStyle = acc; x.lineWidth = 3; x.strokeRect(48, 48, W - 96, H - 96);
    let size = 64; const q = text.length > 600 ? text.slice(0, 597) + '…' : text; let lines: string[];
    do { x.font = `${size}px Georgia, 'Times New Roman', serif`; lines = wrap(x, `“${q}”`, W - 240); size -= 2; } while (lines.length * size * 1.4 > H - 520 && size > 22);
    const lh = (size + 2) * 1.4, top = (H - lines.length * lh) / 2 - 40; x.fillStyle = ink; x.textBaseline = 'top'; lines.forEach((l, i) => x.fillText(l, 120, top + i * lh));
    x.fillStyle = acc; x.font = `italic 40px Georgia, serif`; const cite = `— ${by}`; x.fillText(cite, 120, top + lines.length * lh + 40);
    x.font = `32px Georgia, serif`; x.fillStyle = ink; x.globalAlpha = .75; wrap(x, title, W - 240).slice(0, 2).forEach((l, i) => x.fillText(l, 120, top + lines.length * lh + 100 + i * 42));
    x.globalAlpha = .6; x.font = `26px Georgia, serif`; x.fillText('Leone Library · library.leoneuniversity.org', 120, H - 120); x.globalAlpha = 1; }, [s, square, text, by, title]);
  const save = () => ref.current!.toBlob(b => { if (!b) return; const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `quote-${title.slice(0, 30).replace(/\W+/g, '-')}.png`; a.click(); });
  const share = () => ref.current!.toBlob(async b => { if (!b) return; const f = new File([b], 'quote.png', { type: 'image/png' }); if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], text: `${by}, ${title}` }).catch(() => {}); else save(); });
  return (
    <div className="qc-back" role="dialog" aria-modal="true" aria-label="Quote card" onClick={onClose} onKeyDown={e => e.key === 'Escape' && onClose()}>
      <div className="qc glass" onClick={e => e.stopPropagation()} onMouseUp={e => e.stopPropagation()}>
        <canvas ref={ref} className="qc-canvas" role="img" aria-label={`Quote: ${text}`} />
        <div className="row gap wrap">{(Object.keys(STYLES) as S[]).map(k => <button key={k} className={`btn sm ${k === s ? 'gold' : 'ghost'}`} onClick={() => setS(k)}>{k}</button>)}
          <button className="btn sm ghost" onClick={() => setSquare(!square)}>{square ? 'Story size' : 'Square'}</button></div>
        <div className="row gap"><button className="btn gold" onClick={save}>Download PNG</button><button className="btn ghost" onClick={share}>Share</button><button className="btn ghost" onClick={onClose} autoFocus>Close</button></div>
      </div>
    </div>);
}
