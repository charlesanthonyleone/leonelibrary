import * as THREE from 'three';
import { pageTex } from './tex';
import { drawCover, drawEndpaper, drawPage, LW, type PageD, type ReaderLook } from '../lib/reader3d';

/*  A physical book. Local frame: spine runs along z at x = 0, the right-hand pages lie on +x, page tops point to -z and
    the paper faces +y. Every visible page is a bent sheet: its shape is solved in the vertex shader from one number
    (how far it has turned) so the curl, the lift into the gutter and the shading all stay continuous.            */

const CURL_GLSL = /* glsl */`
uniform float uP, uBend, uTilt, uW, uH, uLift, uG, uGut, uY;
vec3 curlPos(vec3 p, out vec3 n) {
  float s = clamp(p.x, 0., uW);
  float k = (-uBend + uTilt * (p.z / uH)) / uW;
  float a0 = uP * 3.14159265 - k * uW * .5;
  float a = a0 + k * s;
  vec2 q = abs(k) < 1e-4 ? s * vec2(cos(a0), sin(a0)) : vec2(sin(a) - sin(a0), cos(a0) - cos(a)) / k;
  float gs = 1. - uGut * pow(1. - min(s / uG, 1.), 2.);
  n = vec3(-sin(a), cos(a), 0.);
  return vec3(q.x, q.y + uLift * gs + uY, p.z);
}`;
type U = Record<'uP' | 'uBend' | 'uTilt' | 'uW' | 'uH' | 'uLift' | 'uG' | 'uGut' | 'uY', { value: number }>;
function patch(m: THREE.Material, u: U, normals: boolean) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + CURL_GLSL)
      .replace('#include <begin_vertex>', 'vec3 cnB; vec3 transformed = curlPos(position, cnB);');
    if (normals) sh.vertexShader = sh.vertexShader.replace('#include <beginnormal_vertex>', 'vec3 cnA; curlPos(position, cnA); vec3 objectNormal = cnA;');
  };
  m.customProgramCacheKey = () => 'curl' + (normals ? 'n' : 'd');
}

/** One sheet of paper (two faces) that can lie flat on either side or be caught mid-turn. */
class Sheet {
  u: U; front: THREE.Mesh; back: THREE.Mesh; g = new THREE.Group();
  constructor(geo: THREE.BufferGeometry, W: number, H: number, G: number) {
    this.u = { uP: { value: 0 }, uBend: { value: 0 }, uTilt: { value: 0 }, uW: { value: W }, uH: { value: H }, uLift: { value: 0 }, uG: { value: G }, uGut: { value: 1 }, uY: { value: 0 } };
    const mk = (side: THREE.Side) => { const m = new THREE.MeshStandardMaterial({ roughness: .86, side }); patch(m, this.u, true); return m; };
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide }); patch(depth, this.u, false);
    this.front = new THREE.Mesh(geo, mk(THREE.FrontSide)); this.back = new THREE.Mesh(geo, mk(THREE.BackSide));
    for (const m of [this.front, this.back]) { m.customDepthMaterial = depth; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; this.g.add(m); }
  }
  set(front: THREE.Texture | null, back: THREE.Texture | null) {
    const f = this.front.material as THREE.MeshStandardMaterial, b = this.back.material as THREE.MeshStandardMaterial;
    if (f.map !== front) { f.map = front; f.needsUpdate = true; } if (b.map !== back) { b.map = back; b.needsUpdate = true; }
    this.front.visible = !!front; this.back.visible = !!back;
  }
}

export type BookState = { spread: number; spreads: number; left: number; right: number; leftNum?: number; rightNum?: number; chapter: number; phase: string };
const ease = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class OpenBook {
  g = new THREE.Group(); W: number; H: number; T: number; B = .003; OV = .003; G: number; LH: number;
  pages: PageD[] = []; look: ReaderLook; meta: { title: string; author: string; color: string };
  k = 0; cover = 0; gut = 0; hL = 0; hR = 0;           // spread index, cover angle (0 shut → 1 open), gutter curve
  geo: THREE.BufferGeometry; left: Sheet; right: Sheet; turn: Sheet;
  anim: { dir: 1 | -1; t: number; from: number; to: number; speed: number; drag?: boolean; tilt: number } | null = null; queue = 0;
  stackL: THREE.Mesh; stackR: THREE.Mesh; coverG = new THREE.Group(); frontBoard: THREE.Mesh; backBoard: THREE.Mesh; spine: THREE.Mesh; ribbon: THREE.Mesh;
  light = new THREE.DirectionalLight(0xffe2bf, 2.2); fill = new THREE.PointLight(0xffe6c8, .6, 2);
  cache = new Map<number, THREE.CanvasTexture>(); blank: THREE.CanvasTexture; endpaper: THREE.CanvasTexture; maxAniso: number;
  onState?: (s: BookState) => void; onTurn?: () => void;

  constructor(dims: { w: number; h: number; t: number }, meta: { title: string; author: string; color: string }, look: ReaderLook, maxAniso: number) {
    this.W = dims.w; this.H = dims.h; this.T = Math.max(.006, dims.t - this.B * 2); this.G = Math.min(.03, this.W * .18); this.look = look; this.meta = meta; this.maxAniso = maxAniso;
    this.LH = Math.round(LW * this.H / this.W); this.hR = this.T;
    const geo = this.geo = new THREE.PlaneGeometry(this.W, this.H, 48, 8); geo.rotateX(-Math.PI / 2); geo.translate(this.W / 2, 0, 0);
    this.left = new Sheet(geo, this.W, this.H, this.G); this.right = new Sheet(geo, this.W, this.H, this.G); this.turn = new Sheet(geo, this.W, this.H, this.G);
    this.left.u.uP.value = 1; this.turn.g.visible = false;
    const edgeM = new THREE.MeshStandardMaterial({ map: pageTex(), roughness: .95, side: THREE.DoubleSide });
    this.stackL = new THREE.Mesh(this.stackGeo(), edgeM); this.stackR = new THREE.Mesh(this.stackGeo(), edgeM); this.stackL.scale.x = -1;
    for (const s of [this.stackL, this.stackR]) { s.castShadow = s.receiveShadow = true; }
    this.blank = this.canvasTex(null, 0); const ep = document.createElement('canvas'); this.endpaper = new THREE.CanvasTexture(ep);
    const bw = this.W + this.OV, bh = this.H + this.OV * 2, boardGeo = new THREE.BoxGeometry(bw, this.B, bh); boardGeo.translate(bw / 2, 0, 0);
    this.frontBoard = new THREE.Mesh(boardGeo, []); this.backBoard = new THREE.Mesh(boardGeo, []);
    this.frontBoard.castShadow = this.backBoard.castShadow = true; this.backBoard.receiveShadow = true;
    this.coverG.add(this.frontBoard); this.backBoard.position.y = -this.B / 2;
    this.spine = new THREE.Mesh(new THREE.BoxGeometry(this.B, 1, bh), new THREE.MeshStandardMaterial()); this.spine.castShadow = true;
    // ribbon: tucked between the leaves on the left, tail hanging out under the foot of the page
    const rg = new THREE.PlaneGeometry(.0075, .085, 1, 24); const rp = rg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) { const v = .5 - rp.getY(i) / .085; rp.setXYZ(i, rp.getX(i), -Math.pow(v, 2) * .03 - .0004, this.H / 2 - .012 + v * .085); }
    rg.computeVertexNormals();
    this.ribbon = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: look.ribbonColor, roughness: .5, side: THREE.DoubleSide })); this.ribbon.castShadow = true;
    this.light.castShadow = true; this.light.shadow.mapSize.set(1024, 1024); this.light.shadow.bias = -.0006; this.light.shadow.normalBias = .004; this.light.shadow.radius = 3;
    Object.assign(this.light.shadow.camera, { left: -.35, right: .35, top: .35, bottom: -.35, near: .05, far: 2 });
    this.light.position.set(-.35, .9, -.35); this.light.target.position.set(0, 0, 0); this.fill.position.set(.25, .5, .3);
    this.g.add(this.left.g, this.right.g, this.turn.g, this.stackL, this.stackR, this.coverG, this.backBoard, this.spine, this.ribbon, this.light, this.light.target, this.fill);
    this.applyLook(look, true); this.layout();
  }

  // ------------------------------------------------------------ geometry of the page blocks
  stackGeo() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(24 * 18 * 3 + 6 * 3), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(24 * 18 * 2 + 12), 2)); return g; }
  fillStack(m: THREE.Mesh, h: number) {
    const W = this.W, H = this.H, n = 24, pos = m.geometry.attributes.position as THREE.BufferAttribute, uv = m.geometry.attributes.uv as THREE.BufferAttribute;
    const lift = (s: number) => h * (1 - this.gut * Math.pow(1 - Math.min(s / this.G, 1), 2)) - .0003;
    let i = 0; const P = (x: number, y: number, z: number, u: number, v: number) => { pos.setXYZ(i, x, y, z); uv.setXY(i, u, v); i++; };
    for (let c = 0; c < n; c++) { const s0 = W * c / n, s1 = W * (c + 1) / n, y0 = Math.max(0, lift(s0)), y1 = Math.max(0, lift(s1));
      for (const z of [-H / 2, H / 2]) { P(s0, 0, z, 0, s0 / W); P(s1, 0, z, 0, s1 / W); P(s1, y1, z, 1, s1 / W); P(s0, 0, z, 0, s0 / W); P(s1, y1, z, 1, s1 / W); P(s0, y0, z, 1, s0 / W); }
      P(s0, y0, -H / 2, 0, s0 / W); P(s1, y1, -H / 2, 0, s1 / W); P(s1, y1, H / 2, 1, s1 / W); P(s0, y0, -H / 2, 0, s0 / W); P(s1, y1, H / 2, 1, s1 / W); P(s0, y0, H / 2, 1, s0 / W); }
    const yW = Math.max(0, lift(W)); P(W, 0, -H / 2, 0, 0); P(W, 0, H / 2, 0, 1); P(W, yW, H / 2, 1, 1); P(W, 0, -H / 2, 0, 0); P(W, yW, H / 2, 1, 1); P(W, yW, -H / 2, 1, 0);
    pos.needsUpdate = uv.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); m.visible = h > .0002;
  }
  sheets() { return Math.max(1, Math.ceil((this.pages.length - 1) / 2) + 1); }
  hFor(k: number) { const S = this.sheets(); const l = this.T * Math.min(1, k / S); return [Math.max(k > 0 ? .0006 : 0, l), Math.max(.0006, this.T - l)]; }

  /** Place boards, blocks and sheets for the current cover angle, gutter and block thicknesses. */
  layout() {
    const B = this.B, c = this.cover * Math.PI, hingeY = THREE.MathUtils.lerp(this.T + B / 2, -B / 2, this.cover);
    this.coverG.rotation.z = c; this.coverG.position.set(0, hingeY, 0);
    this.spine.position.set(-B / 2, (hingeY + -B / 2) / 2, 0); const len = Math.abs(hingeY + B / 2) + B; this.spine.scale.y = len; this.spine.visible = len > B * 1.5;
    // while the cover swings, the left block rides on it
    this.stackL.position.y = 0; this.fillStack(this.stackL, this.hL * this.cover); this.fillStack(this.stackR, this.hR);
    for (const s of [this.left, this.right, this.turn]) { s.u.uGut.value = this.gut; }
    this.right.u.uLift.value = this.hR; this.left.u.uLift.value = this.hL * this.cover;
    this.left.g.visible = this.cover > .98 && this.k > 0;
    this.ribbon.visible = this.look.ribbon && this.cover > .9; this.ribbon.position.set(-.022, this.hL * this.cover, 0);
  }

  // ------------------------------------------------------------ textures
  canvasTex(p: PageD | null, idx: number) {
    const c = document.createElement('canvas'); drawPage(c, p, this.look, this.LH, idx % 2 === 0, idx, this.meta, 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = this.maxAniso; t.minFilter = THREE.LinearMipmapLinearFilter;
    if (idx % 2 === 1) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
    return t;
  }
  tex(i: number): THREE.Texture | null {
    if (i < 0) return this.endpaper; if (i >= this.pages.length) return i % 2 ? this.blankV : this.blank;
    let t = this.cache.get(i); if (t) { this.cache.delete(i); this.cache.set(i, t); return t; }
    t = this.canvasTex(this.pages[i], i); this.cache.set(i, t);
    while (this.cache.size > 14) { const [k0, v] = this.cache.entries().next().value as [number, THREE.CanvasTexture]; v.dispose(); this.cache.delete(k0); }
    return t;
  }
  get blankV() { const t = this.blank.clone(); t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; t.needsUpdate = true; return t; }
  flush() { this.cache.forEach(t => t.dispose()); this.cache.clear(); this.blank.dispose(); this.blank = this.canvasTex(null, 0); }
  prefetch() { const k = this.k; const want = [2 * k + 1, 2 * k + 2, 2 * k - 2, 2 * k - 3, 2 * k + 3]; let n = 0;
    for (const i of want) if (i >= 0 && i < this.pages.length && !this.cache.has(i) && n++ < 1) this.tex(i); }

  setPages(p: PageD[], keepAt?: { ch: number; para: number }) {
    this.pages = p; this.flush();
    if (keepAt) { const i = p.findIndex(x => x.ch > keepAt.ch || (x.ch === keepAt.ch && x.para >= keepAt.para && x.kind === 'text')); if (i >= 0) this.k = Math.ceil(i / 2); }
    this.k = Math.min(this.k, this.sheets() - 1); [this.hL, this.hR] = this.hFor(this.k); this.show(); this.layout(); this.emit();
  }
  jump(k: number) { this.anim = null; this.queue = 0; this.turn.g.visible = false; this.k = Math.max(0, Math.min(this.sheets() - 1, k)); [this.hL, this.hR] = this.hFor(this.k); this.show(); this.layout(); this.emit(); }
  show() { const k = this.k; this.right.set(this.tex(2 * k), null); this.left.set(null, this.tex(2 * k - 1)); }
  anchor() { const i = Math.max(0, 2 * this.k - 1), p = this.pages[i]?.kind === 'text' ? this.pages[i] : this.pages[2 * this.k]; return p && p.kind === 'text' ? { ch: p.ch, para: p.para } : null; }
  state(): BookState { const k = this.k, l = this.pages[2 * k - 1], r = this.pages[2 * k];
    return { spread: k, spreads: this.sheets(), left: 2 * k - 1, right: 2 * k, leftNum: l?.num, rightNum: r?.num, chapter: Math.max(0, (r ?? l)?.ch ?? 0), phase: this.anim ? 'turning' : 'still' }; }
  emit() { this.onState?.(this.state()); }
  visibleText() { return [this.pages[2 * this.k - 1]?.text, this.pages[2 * this.k]?.text].filter(Boolean).join(' '); }

  // ------------------------------------------------------------ turning
  canTurn(dir: 1 | -1) { return dir > 0 ? this.k < this.sheets() - 1 : this.k > 0; }
  begin(dir: 1 | -1, drag = false, tilt = .5) {
    const k = this.k; if (!this.canTurn(dir)) return false;
    if (dir > 0) { this.turn.set(this.tex(2 * k), this.tex(2 * k + 1)); this.right.set(this.tex(2 * k + 2), null); }
    else { this.turn.set(this.tex(2 * k - 2), this.tex(2 * k - 1)); this.left.set(null, this.tex(2 * k - 3)); if (k - 1 === 0) this.left.g.visible = false; }
    this.anim = { dir, t: 0, from: dir > 0 ? 0 : 1, to: dir > 0 ? 1 : 0, speed: 1, drag, tilt };
    this.setTurn(this.anim.from); this.turn.g.visible = true; this.onTurn?.(); return true;
  }
  flip(dir: 1 | -1) {
    if (this.cover < 1) return;
    if (this.anim) { if (this.anim.drag) return; if (this.anim.dir === dir) this.queue = Math.min(3, this.queue + 1); else this.queue = 0; this.anim.speed = 1.8; return; }
    this.begin(dir);
  }
  styleBend() { return this.look.style === 'stiff' ? [.18, 0] : this.look.style === 'soft' ? [.75, .28] : [1.25, .55]; }
  setTurn(p: number) {
    const a = this.anim!, [bend, tilt] = this.styleBend(), s = Math.sin(Math.PI * p), u = this.turn.u;
    const [nl, nr] = this.hFor(this.k + (a.dir > 0 ? 1 : -1)), [ol, or] = this.hFor(this.k);
    // the blocks trade thickness as the leaf travels
    const q = a.dir > 0 ? p : 1 - p; this.hL = THREE.MathUtils.lerp(ol, nl, q); this.hR = THREE.MathUtils.lerp(or, nr, q);
    u.uP.value = p; u.uBend.value = a.dir * bend * s; u.uTilt.value = a.dir * tilt * a.tilt * 2 * s;
    u.uLift.value = THREE.MathUtils.lerp(a.dir > 0 ? or : nr, a.dir > 0 ? nl : ol, p) ; u.uY.value = .0005 + s * .004; this.layout();
  }
  finish() {
    const a = this.anim!; this.anim = null; this.k += a.dir; this.turn.g.visible = false; [this.hL, this.hR] = this.hFor(this.k); this.show(); this.layout(); this.emit();
    if (this.queue > 0) { this.queue--; if (this.begin(a.dir)) (this.anim as any).speed = 1.8; }
  }
  cancel() { const a = this.anim!; this.anim = null; this.turn.g.visible = false; [this.hL, this.hR] = this.hFor(this.k); this.show(); this.layout(); void a; }
  drag(p: number) { const a = this.anim; if (!a?.drag) return; a.t = p; this.setTurn(a.dir > 0 ? p : 1 - p); }
  release(commit: boolean) { const a = this.anim; if (!a?.drag) return; a.drag = false; const cur = a.t; a.from = a.dir > 0 ? cur : 1 - cur;
    a.to = commit ? (a.dir > 0 ? 1 : 0) : (a.dir > 0 ? 0 : 1); a.t = 0; (a as any).back = !commit; a.speed = 1.4; }

  update(dt: number, t: number) {
    const a = this.anim;
    if (a && !a.drag) {
      const dur = Math.max(.15, this.look.flipMs / 1000) * Math.abs(a.to - a.from || 1) / a.speed;
      a.t = Math.min(1, a.t + dt / dur); const p = THREE.MathUtils.lerp(a.from, a.to, ease(a.t)); this.setTurn(p);
      if (a.t >= 1) { if ((a as any).back) this.cancel(); else this.finish(); }
    } else if (!a) this.prefetch();
    if (this.look.light === 'candle') this.light.intensity = this.baseLight * (.86 + Math.sin(t * 9) * .05 + Math.sin(t * 23.7) * .04);
  }
  baseLight = 2;
  applyLook(L: ReaderLook, first = false) {
    const prev = this.look; this.look = L;
    const col = L.cover || this.meta.color;
    const cc = document.createElement('canvas'); drawCover(cc, L, col, this.meta.title, this.meta.author, (this.H + this.OV * 2) / (this.W + this.OV));
    const coverT = new THREE.CanvasTexture(cc); coverT.colorSpace = THREE.SRGBColorSpace; coverT.anisotropy = this.maxAniso;
    drawEndpaper(this.endpaper.image as HTMLCanvasElement, L, L.binding === 'leather' ? '#5b3a22' : L.binding === 'paper' ? '#cbb991' : '#3f4b5e'); this.endpaper.colorSpace = THREE.SRGBColorSpace; this.endpaper.needsUpdate = true;
    const rough = L.binding === 'leather' ? .5 : L.binding === 'paper' ? .7 : .9;
    const outer = new THREE.MeshPhysicalMaterial({ map: coverT, roughness: rough, clearcoat: L.binding === 'leather' ? .35 : 0, clearcoatRoughness: .5, sheen: L.binding === 'cloth' || L.binding === 'linen' ? .6 : 0, sheenColor: new THREE.Color(col).multiplyScalar(1.6) });
    const plain = new THREE.MeshPhysicalMaterial({ color: col, roughness: rough, clearcoat: L.binding === 'leather' ? .35 : 0 });
    const endM = new THREE.MeshStandardMaterial({ map: this.endpaper, roughness: .9 });
    const backT = coverT.clone(); backT.needsUpdate = true; const backC = document.createElement('canvas'); backC.width = 64; backC.height = 64; const bg = backC.getContext('2d')!; bg.drawImage(cc, 0, 0, 8, 8, 0, 0, 64, 64);
    const backM = new THREE.MeshPhysicalMaterial({ map: new THREE.CanvasTexture(backC), roughness: rough, clearcoat: outer.clearcoat, sheen: outer.sheen, sheenColor: outer.sheenColor });
    (backM.map as THREE.Texture).colorSpace = THREE.SRGBColorSpace;
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z
    this.frontBoard.material = [plain, plain, outer, endM, plain, plain];
    this.backBoard.material = [plain, plain, endM, backM, plain, plain];
    this.spine.material = plain;
    (this.ribbon.material as THREE.MeshStandardMaterial).color.set(L.ribbonColor);
    const lc = L.light === 'candle' ? 0xffa35a : L.light === 'daylight' ? 0xfff3e4 : 0xffd9b0;
    this.light.color.setHex(lc); this.fill.color.setHex(lc); this.baseLight = (L.light === "candle" ? 1.3 : L.light === "daylight" ? 1.9 : 1.6) * L.lightAmt;
    this.light.intensity = this.baseLight; this.fill.intensity = .5 * L.lightAmt;
    this.light.position.set(L.light === "daylight" ? .45 : -.2, 1, -.25);
    if (!first && ['paper', 'texture', 'age', 'ink'].some(k => (prev as any)[k] !== (L as any)[k])) { this.flush(); this.show(); }
    if (!first) this.layout();
  }
  dispose() { this.flush(); this.g.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); }
}
