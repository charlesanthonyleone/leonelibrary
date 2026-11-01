import * as THREE from 'three';
import type { BookSlot } from '../lib/layout';

const B = import.meta.env.BASE_URL + 'pbr/';
const loader = new THREE.TextureLoader();
const cache = new Map<string, THREE.Texture>();
export function tex(name: string, rep = 1, srgb = false): THREE.Texture {
  const k = name + rep;
  let t = cache.get(k);
  if (!t) {
    t = loader.load(B + name + '.webp');
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    cache.set(k, t);
  }
  return t;
}
export function pbr(id: string, rep: number, extra: THREE.MeshPhysicalMaterialParameters = {}) {
  return new THREE.MeshPhysicalMaterial({ map: tex(id + '_col', rep, true), normalMap: tex(id + '_nor', rep), roughnessMap: tex(id + '_rough', rep), ...extra });
}

/** Seeded random, so a book always gets the same wear. */
export const rnd = (seed: number) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const hash = (s: string) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h || 1; };

function canvas(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')!] as const; }
function grain(g: CanvasRenderingContext2D, w: number, h: number, r: () => number, amt: number, streak = false) {
  const im = g.getImageData(0, 0, w, h), d = im.data;
  for (let y = 0; y < h; y++) { const row = streak ? (r() - .5) * amt * .6 : 0;
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, n = (r() - .5) * amt + row; d[i] += n; d[i + 1] += n; d[i + 2] += n; } }
  g.putImageData(im, 0, 0);
}

/** Spine artwork: cloth / leather / paper grain, gilt bands and a foil-stamped title, plus a matching roughness+metalness map. */
const spineCache = new Map<string, { map: THREE.Texture; orm: THREE.Texture; cover: THREE.Texture }>();
export function spineTex(b: BookSlot) {
  const key = `${b.id}|${b.title}|${b.color}|${b.tex}`;
  const hit = spineCache.get(key); if (hit) return hit;
  const W = 128, H = 768, r = rnd(hash(key));
  const [c, g] = canvas(W, H), [o, go] = canvas(W, H);
  const rough = b.tex === 'leather' ? 150 : b.tex === 'paper' ? 200 : 215;
  g.fillStyle = b.color; g.fillRect(0, 0, W, H);
  go.fillStyle = `rgb(0,${rough},0)`; go.fillRect(0, 0, W, H);
  // subtle vertical shading from the rounded spine
  const sh = g.createLinearGradient(0, 0, W, 0); sh.addColorStop(0, 'rgba(0,0,0,.35)'); sh.addColorStop(.25, 'rgba(255,255,255,.06)'); sh.addColorStop(.55, 'rgba(255,255,255,.02)'); sh.addColorStop(1, 'rgba(0,0,0,.4)');
  g.fillStyle = sh; g.fillRect(0, 0, W, H);
  grain(g, W, H, r, b.tex === 'cloth' ? 26 : b.tex === 'leather' ? 18 : 10, b.tex === 'cloth');
  // wear at head and tail
  for (const y0 of [0, H - 18]) { const wg = g.createLinearGradient(0, y0, 0, y0 + 18); wg.addColorStop(y0 ? 0 : 1, 'rgba(0,0,0,0)'); wg.addColorStop(y0 ? 1 : 0, 'rgba(20,12,6,.45)'); g.fillStyle = wg; g.fillRect(0, y0, W, 18); }
  const gold = (x: number, y: number, w: number, h: number) => {
    const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#f6dc94'); gg.addColorStop(.5, '#b8893a'); gg.addColorStop(1, '#e9c777');
    g.fillStyle = gg; g.fillRect(x, y, w, h); go.fillStyle = 'rgb(0,70,255)'; go.fillRect(x, y, w, h);
  };
  const bands = b.tex === 'paper' ? [] : b.tex === 'gilt' ? [46, 54, 120, 128, H - 128, H - 120, H - 54, H - 46] : [60, H - 64];
  bands.forEach(y => gold(8, y, W - 16, b.tex === 'gilt' ? 4 : 3));
  if (b.tex === 'leather' || b.tex === 'gilt') for (const y of [150, 300, 450, 600]) { // raised bands
    const rb = g.createLinearGradient(0, y - 6, 0, y + 6); rb.addColorStop(0, 'rgba(0,0,0,.35)'); rb.addColorStop(.45, 'rgba(255,255,255,.18)'); rb.addColorStop(1, 'rgba(0,0,0,.35)'); g.fillStyle = rb; g.fillRect(0, y - 6, W, 12); }
  // title, foil stamped, rotated like an English spine (reads top to bottom)
  const title = b.title.length > 34 ? b.title.slice(0, 32) + '…' : b.title;
  const ink = b.tex === 'paper' ? '#2a2018' : '#e8c878';
  for (const [ctx, isOrm] of [[g, false], [go, true]] as const) {
    ctx.save(); ctx.translate(W / 2, H / 2 - 20); ctx.rotate(Math.PI / 2);
    let fs = 52; ctx.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`;
    while (ctx.measureText(title).width > H - 300 && fs > 22) { fs -= 2; ctx.font = `600 ${fs}px "Cormorant Garamond", Georgia, serif`; }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (!isOrm) { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1; }
    ctx.fillStyle = isOrm ? (b.tex === 'paper' ? 'rgb(0,230,0)' : 'rgb(0,80,255)') : ink; ctx.fillText(title, 0, 0);
    ctx.restore();
    ctx.save(); ctx.textAlign = 'center'; ctx.font = `600 22px "Cinzel", Georgia, serif`;
    ctx.fillStyle = isOrm ? (b.tex === 'paper' ? 'rgb(0,230,0)' : 'rgb(0,80,255)') : ink;
    ctx.fillText(b.author.split(' ').slice(-1)[0].toUpperCase().slice(0, 9), W / 2, H - 86); ctx.restore();
  }
  const [cc, cg] = canvas(256, 256); cg.fillStyle = b.color; cg.fillRect(0, 0, 256, 256); grain(cg, 256, 256, r, b.tex === 'cloth' ? 22 : 14, b.tex === 'cloth');
  const mk = (cv: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(cv); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const out = { map: mk(c, true), orm: mk(o, false), cover: mk(cc, true) };
  spineCache.set(key, out); return out;
}

/** Page block: fine vertical lines read correctly on the head, tail and fore-edge of a box. */
let pages: THREE.Texture | null = null;
export function pageTex() {
  if (pages) return pages;
  const [c, g] = canvas(512, 64), r = rnd(9);
  g.fillStyle = '#e9dfc6'; g.fillRect(0, 0, 512, 64);
  for (let x = 0; x < 512; x++) { const v = 200 + r() * 40; g.fillStyle = `rgba(${v - 40},${v - 55},${v - 90},${.15 + r() * .25})`; g.fillRect(x, 0, 1, 64); }
  const e = g.createLinearGradient(0, 0, 0, 64); e.addColorStop(0, 'rgba(120,90,50,.25)'); e.addColorStop(.15, 'rgba(0,0,0,0)'); e.addColorStop(.85, 'rgba(0,0,0,0)'); e.addColorStop(1, 'rgba(120,90,50,.25)');
  g.fillStyle = e; g.fillRect(0, 0, 512, 64);
  pages = new THREE.CanvasTexture(c); pages.colorSpace = THREE.SRGBColorSpace; return pages;
}

/** Procedural tiling normal map (for water ripples and snow). */
const nmCache = new Map<string, THREE.Texture>();
export function noiseNormal(scale = 8, strength = 2, seed = 3) {
  const k = `${scale}|${strength}|${seed}`; const hit = nmCache.get(k); if (hit) return hit;
  const N = 256, r = rnd(seed), h = new Float32Array(N * N);
  for (let o = 0; o < 4; o++) { const f = scale * 2 ** o, a = 1 / 2 ** o, g = Array.from({ length: (f + 1) * (f + 1) }, () => r());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const fx = x / N * f, fy = y / N * f, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
      const s = (t: number) => t * t * (3 - 2 * t), G = (i: number, j: number) => g[((j % f) * (f + 1)) + (i % f)];
      const v = G(ix, iy) * (1 - s(tx)) * (1 - s(ty)) + G(ix + 1, iy) * s(tx) * (1 - s(ty)) + G(ix, iy + 1) * (1 - s(tx)) * s(ty) + G(ix + 1, iy + 1) * s(tx) * s(ty);
      h[y * N + x] += v * a; } }
  const [c, g] = canvas(N, N), im = g.createImageData(N, N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dx = (h[y * N + (x + 1) % N] - h[y * N + (x + N - 1) % N]) * strength, dy = (h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x]) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * N + x) * 4; im.data[i] = (-dx / l * .5 + .5) * 255; im.data[i + 1] = (-dy / l * .5 + .5) * 255; im.data[i + 2] = (1 / l * .5 + .5) * 255; im.data[i + 3] = 255; }
  g.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; nmCache.set(k, t); return t;
}

/** Soft round sprite for mist, foam, snow and fireflies. */
let soft: THREE.Texture | null = null;
export function softSprite() {
  if (soft) return soft; const [c, g] = canvas(64, 64); const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(.4, 'rgba(255,255,255,.5)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  soft = new THREE.CanvasTexture(c); return soft;
}
/** Billowy cloud sprite for waterfall mist. */
let cloud: THREE.Texture | null = null;
export function cloudSprite() {
  if (cloud) return cloud; const [c, g] = canvas(128, 128), r = rnd(5);
  for (let i = 0; i < 40; i++) { const x = 30 + r() * 68, y = 30 + r() * 68, rad = 10 + r() * 26, rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, 'rgba(255,255,255,.22)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 128, 128); }
  cloud = new THREE.CanvasTexture(c); return cloud;
}

export function clockFace() {
  const [c, g] = canvas(256, 256); g.fillStyle = '#efe6d0'; g.beginPath(); g.arc(128, 128, 126, 0, 7); g.fill();
  g.fillStyle = '#2a2018'; g.font = '600 30px "Cormorant Garamond", Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { const a = i / 12 * Math.PI * 2 - Math.PI / 2; g.fillText(n, 128 + Math.cos(a) * 96, 128 + Math.sin(a) * 96); });
  g.strokeStyle = '#1a1410'; g.lineCap = 'round'; g.lineWidth = 7; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + 40, 128 - 34); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 - 8, 128 - 82); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function globeTex() {
  const [c, g] = canvas(512, 256), r = rnd(11); g.fillStyle = '#c9b78e'; g.fillRect(0, 0, 512, 256); grain(g, 512, 256, r, 18);
  g.strokeStyle = 'rgba(90,60,30,.45)'; g.lineWidth = 1;
  for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * 512 / 12, 0); g.lineTo(i * 512 / 12, 256); g.stroke(); }
  for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(0, i * 256 / 6); g.lineTo(512, i * 256 / 6); g.stroke(); }
  g.fillStyle = 'rgba(110,80,40,.55)'; // sepia landmasses, loosely hand-drawn
  for (let k = 0; k < 7; k++) { const cx = r() * 512, cy = 50 + r() * 150; g.beginPath(); for (let a = 0; a < 6.3; a += .3) { const rr = 18 + r() * 40; g.lineTo(cx + Math.cos(a) * rr * 1.5, cy + Math.sin(a) * rr); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
