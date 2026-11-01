import * as THREE from 'three';
import { OpenBook, type BookState } from './book';
import { ensureFonts, paginate, type ReaderLook } from '../lib/reader3d';
import type { Chapter } from '../lib/books';
import type { Engine } from './engine';

export type ReadState = BookState & { id: string; stage: 'out' | 'fly' | 'open' | 'reading' | 'closing'; narrow: boolean; focus: 'L' | 'R'; anchor: { ch: number; para: number } | null };
const sm = (t: number) => t * t * (3 - 2 * t);
const LAYOUT_KEYS: (keyof ReaderLook)[] = ['font', 'size', 'lh', 'margin', 'justify', 'dropcap', 'heads'];

/** Takes a book off the shelf, carries it to the reader, opens it, turns its pages and puts it back. */
export class Reading {
  book: OpenBook; mesh: THREE.Object3D; id: string; stage: ReadState['stage'] = 'out'; t = 0;
  p0 = new THREE.Vector3(); q0 = new THREE.Quaternion(); pOut = new THREE.Vector3(); pA = new THREE.Vector3(); qA = new THREE.Quaternion();
  camFrom = { pos: new THREE.Vector3(), target: new THREE.Vector3() }; camT = new THREE.Vector3(); camP = new THREE.Vector3(); zoom = 1;
  chapters: Chapter[] | null = null; status = ''; meta: { title: string; author: string; color: string };
  focus: 'L' | 'R' = 'R'; ptr: { x: number; y: number; side: 1 | -1; drag: boolean; id: number } | null = null; ray = new THREE.Raycaster();
  onState: (s: ReadState | null) => void; done?: () => void; reqToken = 0; elev = .62; tiltBook = .87;
  constructor(public e: Engine, mesh: THREE.Object3D, meta: { title: string; author: string; color: string }, public look: ReaderLook, onState: (s: ReadState | null) => void) {
    this.mesh = mesh; this.id = String(mesh.userData.book); this.meta = meta; this.onState = onState;
    const t = mesh.userData.w as number, h = mesh.userData.h as number, d = mesh.userData.d as number;
    mesh.updateWorldMatrix(true, false);
    const ws = new THREE.Vector3(); mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);
    this.book = new OpenBook({ w: d - .004, h: h * ws.y - .002, t }, meta, look, e.r.capabilities.getMaxAnisotropy());
    this.book.onState = () => this.emit(); this.book.onTurn = () => this.sound();
    // shelf pose of the book in the book's own frame (see book.ts): x'→-Z, y'→+X, z'→-Y of the shelf mesh
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0));
    basis.setPosition(-t / 2 + this.book.B, h / 2, d / 2);
    mesh.matrixWorld.clone().multiply(basis).decompose(this.p0, this.q0, new THREE.Vector3());
    this.p0.copy(new THREE.Vector3(-t / 2 + this.book.B, h / 2, d / 2).applyMatrix4(mesh.matrixWorld));
    this.pOut.copy(this.p0).add(new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion())).multiplyScalar(d * .75));
    const tgt = e.orbit.target, D = e.L.depth;
    this.pA.set(0, Math.max(.5, tgt.y), D / 2 + .55);
    const s = Math.sin(this.tiltBook), c = Math.cos(this.tiltBook);
    this.qA.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, s, c), new THREE.Vector3(0, -c, s)));
    this.camFrom.pos.copy(e.cam.position); this.camFrom.target.copy(tgt);
    this.camT.copy(tgt); this.camP.copy(e.cam.position);
    const g = this.book.g; g.position.copy(this.p0); g.quaternion.copy(this.q0); e.scene.add(g);
    mesh.visible = false; e.orbit.enabled = false;
    this.book.setPages(paginate(meta, null, look, this.book.LH, ''));
    this.emit();
  }
  get narrow() { return this.e.cam.aspect < .85; }

  async setText(ch: Chapter[] | null, status = '', at?: { ch: number; para: number } | null) {
    this.chapters = ch; this.status = status; const tok = ++this.reqToken; await ensureFonts(this.look); if (tok !== this.reqToken) return;
    this.book.setPages(paginate(this.meta, ch, this.look, this.book.LH, status), at ?? undefined);
    if (at && this.book.k > 0) this.focus = 'L';
  }
  async setLook(L: ReaderLook) {
    const prev = this.look; this.look = L; this.book.applyLook(L);
    if (LAYOUT_KEYS.some(k => prev[k] !== L[k])) { const a = this.book.anchor(); const tok = ++this.reqToken; await ensureFonts(L); if (tok !== this.reqToken) return;
      this.book.setPages(paginate(this.meta, this.chapters, L, this.book.LH, this.status), a ?? undefined); }
  }

  state(): ReadState { return { ...this.book.state(), id: this.id, stage: this.stage, narrow: this.narrow, focus: this.focus, anchor: this.book.anchor() }; }
  emit() { this.onState(this.state()); }

  // ------------------------------------------------------------ navigation
  ready() { return this.stage === 'reading'; }
  next() { if (!this.ready()) return; const b = this.book;
    if (this.narrow && this.focus === 'L' && !b.anim) { this.focus = 'R'; this.emit(); return; }
    if (b.canTurn(1) || b.anim) { b.flip(1); if (this.narrow) this.focus = 'L'; } }
  prev() { if (!this.ready()) return; const b = this.book;
    if (this.narrow && this.focus === 'R' && b.k > 0 && !b.anim) { this.focus = 'L'; this.emit(); return; }
    if (b.canTurn(-1) || b.anim) { b.flip(-1); if (this.narrow) this.focus = 'R'; } }
  jump(k: number) { this.book.jump(k); this.focus = this.book.k > 0 ? 'L' : 'R'; }
  fit() { this.zoom = 1; }
  /** The words on the page(s) in view, for narration. */
  textNow() { const b = this.book; if (!this.narrow) return b.visibleText(); const i = this.focus === 'L' && b.k > 0 ? 2 * b.k - 1 : 2 * b.k; return b.pages[i]?.text ?? ''; }

  // ------------------------------------------------------------ pointer: click a page to turn it, or drag its corner
  local(e: PointerEvent) {
    const rc = this.e.r.domElement.getBoundingClientRect(); const v = new THREE.Vector2(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
    this.ray.setFromCamera(v, this.e.cam); const inv = this.book.g.matrixWorld.clone().invert(); const r = this.ray.ray.clone().applyMatrix4(inv);
    const p = new THREE.Vector3(); return r.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.book.T / 2), p) ? p : null;
  }
  down(e: PointerEvent) {
    if (!this.ready()) return; const p = this.local(e); const W = this.book.W, H = this.book.H;
    const side: 1 | -1 = p && Math.abs(p.z) < H / 2 + .02 && Math.abs(p.x) < W + .03 ? (p.x >= 0 ? 1 : -1) : (e.clientX > this.e.r.domElement.getBoundingClientRect().left + this.e.r.domElement.clientWidth / 2 ? 1 : -1);
    this.ptr = { x: e.clientX, y: e.clientY, side, drag: false, id: e.pointerId };
  }
  move(e: PointerEvent) {
    const q = this.ptr; if (!q || !this.ready()) { this.hover(e); return; } const b = this.book, dx = e.clientX - q.x;
    if (!q.drag && Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(e.clientY - q.y) && !b.anim && !this.narrow) {
      const dir: 1 | -1 = dx < 0 ? 1 : -1; const p = this.local(e); const tilt = p ? THREE.MathUtils.clamp(.5 + p.z / b.H, 0, 1) - .5 : 0;
      if (b.begin(dir, true, tilt * 2)) q.drag = true;
    }
    if (q.drag && b.anim?.drag) { const p = this.local(e); if (p) { const x = THREE.MathUtils.clamp(p.x, -b.W, b.W); b.drag(THREE.MathUtils.clamp(b.anim.dir > 0 ? (b.W - x) / (2 * b.W) : (b.W + x) / (2 * b.W), 0, 1)); } }
  }
  hover(e: PointerEvent) { if (!this.ready()) return; const p = this.local(e); this.e.r.domElement.style.cursor = p && Math.abs(p.z) < this.book.H / 2 && Math.abs(p.x) < this.book.W ? 'pointer' : ''; }
  up(e: PointerEvent) {
    const q = this.ptr; this.ptr = null; if (!q || !this.ready()) return; const b = this.book;
    if (q.drag) { const a = b.anim; if (a?.drag) { const fast = Math.abs(e.clientX - q.x) > 60; b.release(a.t > .4 || fast); } return; }
    if (Math.hypot(e.clientX - q.x, e.clientY - q.y) > 12) { // swipe
      if (Math.abs(e.clientX - q.x) > Math.abs(e.clientY - q.y)) (e.clientX < q.x ? this.next() : this.prev()); return; }
    if (this.narrow) { const rc = this.e.r.domElement.getBoundingClientRect(); (e.clientX - rc.left > rc.width / 2 ? this.next() : this.prev()); }
    else q.side > 0 ? this.next() : this.prev();
  }
  wheel(e: WheelEvent) { if (!this.ready()) return; e.preventDefault(); this.zoom = THREE.MathUtils.clamp(this.zoom * Math.exp(-e.deltaY * .0012), 1, 3.2); }

  // ------------------------------------------------------------ camera that keeps the spread fitted to the screen
  goal() {
    const b = this.book; b.g.updateMatrixWorld(); const cam = this.e.cam, fov = THREE.MathUtils.degToRad(cam.fov), aspect = cam.aspect, narrow = this.narrow;
    const vh = this.e.host.clientHeight, padV = vh < 560 ? .7 : .72; // room for the reading bar
    const w = narrow ? b.W * 1.08 : b.W * 2 * 1.06, h = b.H * 1.04;
    const dist = Math.max(h / (2 * Math.tan(fov / 2) * padV), w / (2 * Math.tan(fov / 2) * aspect * .84)) / this.zoom;
    const n = new THREE.Vector3(0, Math.sin(this.elev), Math.cos(this.elev));
    const ox = narrow ? (this.focus === 'L' && b.k > 0 ? -b.W / 2 : b.W / 2) : 0;
    const centre = new THREE.Vector3(ox, b.T / 2, 0).applyMatrix4(b.g.matrixWorld);
    // fit to the open pose rather than wherever the book happens to be mid-flight
    if (this.stage === 'out' || this.stage === 'fly') centre.copy(new THREE.Vector3(ox, b.T / 2, 0).applyQuaternion(this.qA).add(this.pA));
    const up = new THREE.Vector3(0, -.04, 0); // a touch high so the HUD at the bottom never covers a line
    return { target: centre.clone().add(up), pos: centre.clone().add(up).add(n.multiplyScalar(dist)) };
  }
  update(dt: number, t: number) {
    const b = this.book, g = b.g, e = this.e; this.t += dt;
    if (this.stage === 'out') { const k = Math.min(1, this.t / .38); g.position.lerpVectors(this.p0, this.pOut, sm(k)); if (k >= 1) { this.stage = 'fly'; this.t = 0; this.emit(); } }
    else if (this.stage === 'fly') { const k = Math.min(1, this.t / .95), s = sm(k);
      g.position.lerpVectors(this.pOut, this.pA, s); g.position.y += Math.sin(Math.PI * s) * .06; g.quaternion.slerpQuaternions(this.q0, this.qA, s);
      if (k >= 1) { this.stage = 'open'; this.t = 0; this.emit(); } }
    else if (this.stage === 'open') { const k = Math.min(1, this.t / .85), s = sm(k); b.cover = s; b.gut = s; b.layout(); if (k >= 1) { this.stage = 'reading'; this.emit(); } }
    else if (this.stage === 'closing') {
      const T = this.t;
      if (T < .7) { const s = sm(Math.min(1, T / .7)); b.cover = 1 - s; b.gut = 1 - s; b.layout(); }
      else if (T < 1.6) { const s = sm(Math.min(1, (T - .7) / .9)); g.position.lerpVectors(this.pA, this.pOut, s); g.position.y += Math.sin(Math.PI * s) * .06; g.quaternion.slerpQuaternions(this.qA, this.q0, s); }
      else { const s = sm(Math.min(1, (T - 1.6) / .35)); g.position.lerpVectors(this.pOut, this.p0, s); if (s >= 1) { this.finishClose(); return; } }
    }
    b.update(dt, t);
    // camera
    const closing = this.stage === 'closing' && this.t > .5, goal = closing ? this.camFrom : this.goal();
    const k = 1 - Math.exp(-dt * (closing ? 3.2 : this.stage === 'reading' ? 7 : 3.4));
    this.camT.lerp(goal.target, k); this.camP.lerp(goal.pos, k);
    e.cam.position.copy(this.camP); e.cam.lookAt(this.camT);
  }
  close(done?: () => void) {
    if (this.stage === 'closing') return; this.done = done; const b = this.book;
    if (b.anim) b.cancel(); if (this.stage !== 'reading') { b.cover = Math.min(b.cover, 1); }
    this.stage = 'closing'; this.t = 0; this.ptr = null; this.emit();
  }
  finishClose() {
    const e = this.e; e.scene.remove(this.book.g); this.book.dispose(); this.mesh.visible = true;
    e.orbit.target.copy(this.camFrom.target); e.cam.position.copy(this.camFrom.pos); e.orbit.enabled = true; e.orbit.update();
    this.onState(null); this.done?.();
  }

  // ------------------------------------------------------------ the sound of a page
  ac: AudioContext | null = null;
  sound() {
    if (!this.look.sound) return;
    try { const ac = this.ac ??= new AudioContext(), n = Math.floor(ac.sampleRate * .32), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) { const x = i / n; d[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * Math.min(1, x * 1.6)), 2) * (1 - x) * (.6 + .4 * Math.sin(x * 60)); }
      const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = .5;
      const gn = ac.createGain(); gn.gain.value = .22; s.connect(f).connect(gn).connect(ac.destination); s.playbackRate.value = .85 + Math.random() * .3; s.start();
    } catch { /* audio unavailable */ }
  }
}
