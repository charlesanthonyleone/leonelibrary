/** Natural narration: Kokoro-82M (Apache-2.0) running in the browser via kokoro-js.
 * The model (~90 MB, q8) is downloaded once from Hugging Face and cached by the browser; no server, no cost.
 * Falls back to the device's speechSynthesis for non-English books or if the model can't load. */
export const NEURAL_VOICES = [
  { id: 'af_heart', label: 'Heart — warm, American (best)' },
  { id: 'af_bella', label: 'Bella — bright, American' },
  { id: 'bf_emma', label: 'Emma — calm, British' },
  { id: 'am_michael', label: 'Michael — steady, American' },
  { id: 'bm_george', label: 'George — classic, British' },
  { id: 'am_fenrir', label: 'Fenrir — deep, American' },
] as const;
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX';
type Tts = { generate: (t: string, o: { voice: string; speed?: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> };
let enginePromise: Promise<Tts> | null = null;
export type LoadState = { phase: 'idle' | 'loading' | 'ready' | 'failed'; pct: number; device?: string };
let state: LoadState = { phase: 'idle', pct: 0 }; const subs = new Set<(s: LoadState) => void>();
const set = (s: LoadState) => { state = s; subs.forEach(f => f(s)); };
export const ttsState = () => state;
export const onTtsState = (f: (s: LoadState) => void) => { subs.add(f); return () => { subs.delete(f); }; };

export function loadEngine(): Promise<Tts> {
  if (enginePromise) return enginePromise;
  const files = new Map<string, [number, number]>();
  enginePromise = (async () => {
    set({ phase: 'loading', pct: 0 });
    const { KokoroTTS } = await import('kokoro-js');
    const webgpu = !!(navigator as any).gpu && !!(await (navigator as any).gpu.requestAdapter().catch(() => null));
    const device = webgpu ? 'webgpu' : 'wasm';
    const progress_callback = (p: any) => { if (p.status === 'progress' && p.total) { files.set(p.file, [p.loaded, p.total]); let a = 0, b = 0; files.forEach(([l, t]) => { a += l; b += t; }); set({ phase: 'loading', pct: Math.round(a / b * 100), device }); } };
    const tts = await KokoroTTS.from_pretrained(MODEL, { dtype: webgpu ? 'fp32' : 'q8', device, progress_callback } as any);
    set({ phase: 'ready', pct: 100, device });
    return tts as unknown as Tts;
  })().catch(e => { enginePromise = null; set({ phase: 'failed', pct: 0 }); throw e; });
  return enginePromise;
}

/** Split a paragraph into sentence groups short enough for the model (~350 chars). */
export function chunk(p: string): string[] {
  const s = p.match(/[^.!?;]+[.!?;]*["”’)\]]*\s*/g) ?? [p]; const out: string[] = []; let cur = '';
  for (const x of s) { if ((cur + x).length > 350 && cur) { out.push(cur.trim()); cur = ''; } cur += x.length > 350 ? x.slice(0, 350) : x; }
  if (cur.trim()) out.push(cur.trim()); return out;
}

const cache = new Map<string, Promise<AudioBuffer>>();
let ctx: AudioContext | null = null;
function synth(tts: Tts, text: string, voice: string, speed: number) {
  const k = `${voice}|${speed}|${text}`; let p = cache.get(k);
  if (!p) { p = tts.generate(text, { voice, speed }).then(r => { const b = ctx!.createBuffer(1, r.audio.length, r.sampling_rate); b.copyToChannel(r.audio as Float32Array<ArrayBuffer>, 0); return b; });
    p.catch(() => cache.delete(k)); cache.set(k, p); if (cache.size > 40) cache.delete(cache.keys().next().value!); }
  return p;
}

export type Narration = { stop: () => void };
/** Narrate paragraphs from `from`, prefetching the next chunk while one plays. */
export function narrate(paras: string[], from: number, o: { voice: string; speed: number; onPara: (i: number) => void; onEnd: () => void; onError: (e: unknown) => void }): Narration {
  let live = true; let src: AudioBufferSourceNode | null = null;
  ctx ??= new AudioContext(); void ctx.resume();
  const queue: { i: number; t: string }[] = []; paras.forEach((p, i) => { if (i >= from && p.trim()) chunk(p).forEach(t => queue.push({ i, t })); });
  (async () => {
    const tts = await loadEngine();
    for (let q = 0; q < queue.length && live; q++) {
      const buf = await synth(tts, queue[q].t, o.voice, o.speed);
      if (queue[q + 1]) void synth(tts, queue[q + 1].t, o.voice, o.speed);
      if (!live) return;
      if (q === 0 || queue[q - 1].i !== queue[q].i) o.onPara(queue[q].i);
      await new Promise<void>(res => { src = ctx!.createBufferSource(); src.buffer = buf; src.connect(ctx!.destination); src.onended = () => res(); src.start(); });
    }
    if (live) o.onEnd();
  })().catch(e => { if (live) o.onError(e); });
  return { stop: () => { live = false; try { src?.stop(); } catch { /* already stopped */ } } };
}
export const neuralFor = (lang?: string) => !lang || lang.startsWith('en');
