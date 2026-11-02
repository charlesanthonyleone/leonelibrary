import type { Chapter } from './books';
const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

/** Everything about how the physical reader looks and behaves. Saved per user on this device. */
export type ReaderLook = {
  paper: string; texture: 'smooth' | 'laid' | 'vellum' | 'rough'; age: number; ink: string;
  font: string; size: number; lh: number; margin: number; justify: boolean; dropcap: boolean; heads: boolean;
  binding: 'cloth' | 'leather' | 'linen' | 'paper'; cover: string; foil: string;
  flipMs: number; sound: boolean; style: 'curl' | 'soft' | 'stiff';
  light: 'lamp' | 'daylight' | 'candle'; lightAmt: number; ribbon: boolean; ribbonColor: string;
};
export const DEFAULT_LOOK: ReaderLook = {
  paper: '#f3ead6', texture: 'laid', age: .15, ink: '#2a2118', font: 'EB Garamond', size: 19, lh: 1.42, margin: 46, justify: true, dropcap: true, heads: true,
  binding: 'cloth', cover: '', foil: '#d9b56a', flipMs: 750, sound: true, style: 'curl', light: 'lamp', lightAmt: 1, ribbon: true, ribbonColor: '#8c1d22',
};
export const PAPERS: [string, string][] = [['#f3ead6', 'Cream'], ['#fbf8f1', 'White'], ['#efe2c4', 'Ivory'], ['#e6d3a8', 'Antique'], ['#dfe3d6', 'Sage'], ['#25231f', 'Night']];
export const FONTS: [string, string, boolean][] = [['EB Garamond', 'Garamond', true], ['Georgia', 'Georgia', true], ['Literata', 'Literata', false], ['Lora', 'Lora', false], ['Cormorant Garamond', 'Cormorant', false], ['Inter', 'Sans', false]];
export const FREE_PAPERS = ['#f3ead6', '#fbf8f1'];

export const LW = 560; // logical page width in layout units; height follows the book's proportions
export type Line = { t: string[]; x: number; y: number; w: number; just: boolean; f: 0 | 1 | 2; c?: boolean };
export type PageD = { kind: 'title' | 'blank' | 'text' | 'note'; ch: number; para: number; lines: Line[]; drop?: { s: string; x: number; y: number; size: number }; head?: string; num?: number; text: string };

const mctx = document.createElement('canvas').getContext('2d')!;
const wcache = new Map<string, Map<string, number>>();
function measurer(font: string) {
  let m = wcache.get(font); if (!m) { m = new Map(); wcache.set(font, m); }
  const mm = m;
  return (w: string) => { let v = mm.get(w); if (v === undefined) { mctx.font = font; v = mctx.measureText(w).width; mm.set(w, v); } return v; };
}
export const fontsFor = (L: ReaderLook) => ({ body: `${L.size}px "${L.font}", Georgia, serif`, ital: `italic ${L.size * .74}px "${L.font}", Georgia, serif`, head: `500 ${L.size * 1.55}px "${L.font}", Georgia, serif`, title: `500 ${L.size * 2.3}px "${L.font}", Georgia, serif`, drop: `500 ${L.size * 3.3}px "${L.font}", Georgia, serif` });
export async function ensureFonts(L: ReaderLook) { const f = fontsFor(L); try { await Promise.all(Object.values(f).map(x => document.fonts.load(x, 'Aa'))); } catch { /* system fallback */ } }

/** Break the real book text into printed pages: chapter openings, drop caps, indents, running heads, folios. */
export function paginate(meta: { title: string; author: string }, chapters: Chapter[] | null, L: ReaderLook, LH: number, status = ''): PageD[] {
  const F = fontsFor(L), mb = measurer(F.body), mh = measurer(F.head), mt = measurer(F.title), md = measurer(F.drop);
  const lineH = L.size * L.lh, M = L.margin, inner = LW - M * 2, top = M + (L.heads ? L.size * .9 : 0), bottom = LH - M - L.size * .6;
  const rows = Math.max(4, Math.floor((bottom - top) / lineH)), space = mb(' ');
  const pages: PageD[] = [];
  const wrapC = (txt: string, m: (w: string) => number, max: number) => { const out: string[][] = []; let cur: string[] = [], w = 0; const sp = m(' ');
    for (const word of txt.split(/\s+/).filter(Boolean)) { const ww = m(word); if (cur.length && w + sp + ww > max) { out.push(cur); cur = []; w = 0; } w += (cur.length ? sp : 0) + ww; cur.push(word); } if (cur.length) out.push(cur); return out; };
  // title page + blank verso, as in a printed book
  { const lines: Line[] = []; let y = LH * .3;
    for (const l of wrapC(meta.title, mt, inner)) { lines.push({ t: l, x: M, y, w: inner, just: false, f: 1, c: true }); y += L.size * 2.6; }
    y += L.size * 1.6; lines.push({ t: ['—'], x: M, y, w: inner, just: false, f: 0, c: true }); y += L.size * 2;
    for (const l of wrapC(meta.author, mb, inner)) { lines.push({ t: l, x: M, y, w: inner, just: false, f: 0, c: true }); y += lineH; }
    lines.push({ t: ['Leone', 'Library'], x: M, y: LH - M - L.size * 2, w: inner, just: false, f: 2, c: true });
    lines.push({ t: 'Public domain worldwide · Leone Library'.split(' '), x: M, y: LH - M - L.size * .6, w: inner, just: false, f: 2, c: true });
    pages.push({ kind: 'title', ch: -1, para: 0, lines, text: `${meta.title}, by ${meta.author}.` });
    pages.push({ kind: 'blank', ch: -1, para: 0, lines: [], text: '' }); }
  if (!chapters) { pages.push({ kind: 'note', ch: -1, para: 0, lines: [{ t: (status || 'Opening the book…').split(' '), x: M, y: LH * .45, w: inner, just: false, f: 2, c: true }], text: '' }); return pages; }

  let pg: PageD | null = null, row = 0, headTitle = '';
  const newPage = (ch: number, para: number) => { pg = { kind: 'text', ch, para, lines: [], head: headTitle, text: '' }; pages.push(pg); row = 0; };
  chapters.forEach((c, ci) => {
    headTitle = c.title.replace(/\s+/g, ' ').slice(0, 60);
    newPage(ci, 0); const P = pg!; P.head = undefined;
    // chapter opening: sunk title
    let y = LH * .2; const tl = wrapC(c.title, mh, inner * .9);
    for (const l of tl) { P.lines.push({ t: l, x: M, y, w: inner, just: false, f: 1, c: true }); y += L.size * 1.9; }
    row = Math.max(0, Math.ceil((y + lineH * 1.2 - top) / lineH));
    c.paras.forEach((para, pi) => {
      const words = para.split(/\s+/).filter(Boolean); if (!words.length) return;
      const first = pi === 0; let drop: PageD['drop'] | undefined; let dropW = 0, dropRows = 0;
      if (first && L.dropcap && /^[A-Za-z]/.test(words[0]) && words[0].length > 1) {
        const ch0 = words[0][0]; dropW = md(ch0) + L.size * .35; dropRows = 2; words[0] = words[0].slice(1);
        drop = { s: ch0, x: M, y: 0, size: L.size * 3.3 };
      }
      let li = 0, i = 0;
      while (i < words.length) {
        if (row >= rows) newPage(ci, pi);
        const page = pg!;
        const indent = li < dropRows ? dropW : (li === 0 && !first ? L.size * 1.4 : 0), max = inner - indent;
        const line: string[] = []; let w = 0;
        while (i < words.length) { const ww = mb(words[i]); if (line.length && w + space + ww > max) break; w += (line.length ? space : 0) + ww; line.push(words[i]); i++; }
        const y0 = top + lineH * (row + .78);
        if (drop && li === 0) { drop.y = y0 + lineH * (dropRows - 1); page.drop = drop; }
        page.lines.push({ t: line, x: M + indent, y: y0, w: max, just: L.justify && i < words.length, f: 0 });
        page.text += (page.text ? ' ' : '') + (drop && li === 0 ? drop.s : '') + line.join(' ');
        li++; row++;
      }
      if (li < dropRows) row += dropRows - li;
      if (!L.justify || true) { /* paragraphs run on without extra space, like a printed novel */ }
    });
  });
  pages.push({ kind: 'note', ch: chapters.length, para: 0, lines: [{ t: ['The', 'End'], x: M, y: LH * .42, w: inner, just: false, f: 1, c: true }], text: 'The End.' });
  let n = 0; pages.forEach((p, i) => { if (i >= 2) { n++; if (p.kind === 'text') p.num = n; } });
  return pages;
}

// ---------------------------------------------------------------- drawing
const paperCache = new Map<string, HTMLCanvasElement>();
const hexRgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
export const dark = (L: ReaderLook) => { const [r, g, b] = hexRgb(L.paper); return r * .3 + g * .59 + b * .11 < 90; };
function paper(L: ReaderLook, w: number, h: number, recto: boolean) {
  const key = [L.paper, L.texture, L.age.toFixed(2), w, h, recto].join();
  let c = paperCache.get(key); if (c) return c;
  if (paperCache.size > 8) paperCache.clear();
  c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d')!, r = rnd(recto ? 7 : 11);
  const base = mix(hexRgb(L.paper), [214, 190, 140], dark(L) ? 0 : L.age * .45);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  // fibre / surface
  const img = g.getImageData(0, 0, w, h), d = img.data, amp = L.texture === 'rough' ? 16 : L.texture === 'vellum' ? 7 : 5;
  for (let y = 0; y < h; y++) { const laid = L.texture === 'laid' ? (y % 7 < 1 ? -5 : 0) : 0;
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = (r() - .5) * amp + laid + (L.texture === 'laid' && x % 170 < 2 ? -6 : 0); d[i] += n; d[i + 1] += n; d[i + 2] += n; } }
  g.putImageData(img, 0, 0);
  if (L.texture === 'vellum') for (let k = 0; k < 40; k++) { const x = r() * w, y = r() * h, rr = 40 + r() * 140, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(150,120,70,.05)'); gr.addColorStop(1, 'rgba(150,120,70,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  // ageing: toned edges
  if (L.age > 0 && !dark(L)) { const e = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * .35, w / 2, h / 2, Math.max(w, h) * .75); e.addColorStop(0, 'rgba(150,105,40,0)'); e.addColorStop(1, `rgba(150,105,40,${L.age * .35})`); g.fillStyle = e; g.fillRect(0, 0, w, h); }
  // gutter: the page dips into the binding
  const gx = recto ? 0 : w, gw = w * .16, gg = g.createLinearGradient(gx, 0, recto ? gw : w - gw, 0);
  gg.addColorStop(0, 'rgba(40,25,10,.34)'); gg.addColorStop(.35, 'rgba(40,25,10,.1)'); gg.addColorStop(1, 'rgba(40,25,10,0)'); g.fillStyle = gg; g.fillRect(recto ? 0 : w - gw, 0, gw, h);
  const ox = recto ? w : 0, og = g.createLinearGradient(ox, 0, recto ? w - w * .04 : w * .04, 0); og.addColorStop(0, 'rgba(60,40,15,.12)'); og.addColorStop(1, 'rgba(60,40,15,0)'); g.fillStyle = og; g.fillRect(recto ? w - w * .04 : 0, 0, w * .04, h);
  paperCache.set(key, c); return c;
}

/** Draw one page at `scale` canvas pixels per layout unit. Recto pages sit on the right of a spread. */
export function drawPage(c: HTMLCanvasElement, p: PageD | null, L: ReaderLook, LH: number, recto: boolean, idx: number, meta: { title: string }, scale: number) {
  const w = Math.round(LW * scale), h = Math.round(LH * scale); if (c.width !== w) c.width = w; if (c.height !== h) c.height = h;
  const g = c.getContext('2d')!; g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(paper(L, w, h, recto), 0, 0);
  // foxing, seeded by page so it never shimmers
  if (L.age > .35 && !dark(L)) { const r = rnd(idx * 31 + 5), n = Math.floor((L.age - .3) * 10 * r()); for (let k = 0; k < n; k++) { const x = r() * w, y = r() * h, rr = (2 + r() * 9) * scale; const gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(140,90,40,.22)'); gr.addColorStop(1, 'rgba(140,90,40,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); } }
  if (!p) return;
  g.scale(scale, scale); const F = fontsFor(L), ink = dark(L) ? '#e8dcc4' : L.ink; g.fillStyle = ink; g.textBaseline = 'alphabetic';
  const mb = measurer(F.body), M = L.margin;
  if (L.heads && p.kind === 'text' && p.head !== undefined) { g.font = F.ital; g.globalAlpha = .7; g.textAlign = 'center'; g.fillText(recto ? p.head : meta.title, LW / 2, M * .62 + L.size * .2); g.globalAlpha = 1; }
  g.textAlign = 'left';
  for (const l of p.lines) {
    g.font = l.f === 1 ? F.head : l.f === 2 ? F.ital : F.body;
    if (p.kind === 'title' && l.f === 1) g.font = F.title;
    if (l.c) { g.textAlign = 'center'; g.fillText(l.t.join(' '), LW / 2, l.y); g.textAlign = 'left'; continue; }
    if (l.just && l.t.length > 1) { const tot = l.t.reduce((a, w) => a + mb(w), 0), gap = (l.w - tot) / (l.t.length - 1);
      if (gap < mb(' ') * 2.6) { let x = l.x; for (const w of l.t) { g.fillText(w, x, l.y); x += mb(w) + gap; } continue; } }
    g.fillText(l.t.join(' '), l.x, l.y);
  }
  if (p.drop) { g.font = F.drop; g.fillStyle = dark(L) ? '#e9c983' : '#7a2418'; g.fillText(p.drop.s, p.drop.x, p.drop.y); g.fillStyle = ink; }
  const heads = p.kind === 'text' ? p.lines.filter(l => l.f === 1) : [];
  if (heads.length) { g.globalAlpha = .5; g.font = F.body; g.textAlign = 'center'; g.fillText('❦', LW / 2, heads[heads.length - 1].y + L.size * 1.5); g.globalAlpha = 1; g.textAlign = 'left'; }
  if (p.num) { g.font = `${L.size * .78}px "${L.font}", Georgia, serif`; g.textAlign = 'center'; g.globalAlpha = .75; g.fillText(String(p.num), LW / 2, LH - M * .55); g.globalAlpha = 1; }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

/** Endpaper for the inside of the boards: marbled when leather, plain tinted otherwise. */
export function drawEndpaper(c: HTMLCanvasElement, L: ReaderLook, col: string) {
  // quiet combed marble: the binding colour with fine, low-contrast veins (no blobs)
  c.width = 512; c.height = 720; const g = c.getContext('2d')!, r = rnd(3); void L;
  const [cr, cg, cb] = hexRgb(col); g.fillStyle = col; g.fillRect(0, 0, 512, 720);
  for (let k = 0; k < 120; k++) { const y0 = k * 6.2 + r() * 3, lt = r() > .5, a = .05 + r() * .07;
    g.strokeStyle = lt ? `rgba(${Math.min(255, cr + 70)},${Math.min(255, cg + 62)},${Math.min(255, cb + 50)},${a})` : `rgba(0,0,0,${a * .8})`;
    g.lineWidth = 1 + r() * 2.5; g.beginPath(); const ph = r() * 6, amp = 4 + r() * 6;
    for (let x = 0; x <= 512; x += 8) { const y = y0 + Math.sin(x / 38 + ph) * amp + Math.sin(x / 11 + y0) * 1.2; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  const v = g.createRadialGradient(256, 360, 120, 256, 360, 480); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.18)'); g.fillStyle = v; g.fillRect(0, 0, 512, 720);
}

/** Cover board: binding grain, a blind-stamped frame and the title in foil. */
export function drawCover(c: HTMLCanvasElement, L: ReaderLook, col: string, title: string, author: string, aspect: number) {
  const w = 640, h = Math.round(640 * aspect); c.width = w; c.height = h; const g = c.getContext('2d')!, r = rnd(17);
  g.fillStyle = col; g.fillRect(0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4;
    const n = L.binding === 'cloth' || L.binding === 'linen' ? ((x % 3 === 0 ? 8 : 0) + (y % 3 === 0 ? 8 : 0) - 8) * (L.binding === 'linen' ? 1.4 : .7) + (r() - .5) * 8 : L.binding === 'leather' ? (r() - .5) * 18 : (r() - .5) * 6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(img, 0, 0);
  if (L.binding === 'leather') { const gr = g.createRadialGradient(w * .5, h * .45, 0, w * .5, h * .5, h * .7); gr.addColorStop(0, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(0,0,0,.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68); g.strokeStyle = 'rgba(255,255,255,.08)'; g.strokeRect(37, 37, w - 68, h - 68);
  g.strokeStyle = L.foil; g.globalAlpha = .8; g.lineWidth = 2; g.strokeRect(52, 52, w - 104, h - 104); g.globalAlpha = 1;
  g.fillStyle = L.foil; g.textAlign = 'center'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 2; g.shadowOffsetY = 1.5;
  let fs = 54; g.font = `600 ${fs}px Cinzel, "EB Garamond", serif`;
  const words = title.toUpperCase().split(/\s+/); const lines: string[] = []; let cur = '';
  for (const wd of words) { const t = cur ? cur + ' ' + wd : wd; if (g.measureText(t).width > w - 150 && cur) { lines.push(cur); cur = wd; } else cur = t; } lines.push(cur);
  if (lines.length > 4) { fs = 40; g.font = `600 ${fs}px Cinzel, serif`; }
  let y = h * .34 - (lines.length - 1) * fs * .6; for (const l of lines.slice(0, 6)) { g.fillText(l, w / 2, y); y += fs * 1.2; }
  g.font = `italic 30px "EB Garamond", serif`; g.fillText(author, w / 2, Math.max(y + 40, h * .62));
  g.font = '40px "EB Garamond", serif'; g.fillText('❦', w / 2, h * .8);
}
