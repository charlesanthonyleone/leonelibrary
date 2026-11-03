/** Natural narration for non-English books: Piper voices (rhasspy/piper, MIT) run in the browser via
 * @diffusionstudio/vits-web (MIT) + onnxruntime-web (MIT). Only voices whose model card licence allows free reuse are listed.
 * The phonemizer (piper-phonemize / espeak-ng, GPL-3.0) is fetched at runtime from jsDelivr, not bundled; see DECISIONS-NEEDED.md.
 * Off unless the build sets VITE_PIPER=1. */
export const PIPER_ON = import.meta.env.VITE_PIPER === '1';
export const PIPER_VOICES: Record<string, { id: string; label: string; licence: string }> = {
  de: { id: 'de_DE-thorsten-high', label: 'Thorsten — German', licence: 'CC0' },
  fr: { id: 'fr_FR-siwis-medium', label: 'Siwis — French', licence: 'CC BY 4.0 (SIWIS database, Idiap)' },
  es: { id: 'es_ES-davefx-medium', label: 'DaveFX — Spanish', licence: 'CC0' },
  nl: { id: 'nl_BE-nathalie-medium', label: 'Nathalie — Dutch (Flemish)', licence: 'CC0' },
  pt: { id: 'pt_BR-faber-medium', label: 'Faber — Portuguese', licence: 'CC0' },
  ru: { id: 'ru_RU-denis-medium', label: 'Denis — Russian', licence: 'CC0' },
};
export const piperFor = (lang?: string) => (PIPER_ON && lang ? PIPER_VOICES[lang.slice(0, 2)] : undefined);

type Vits = typeof import('@diffusionstudio/vits-web');
let mod: Promise<Vits> | null = null;
export async function piperSynth(ctx: AudioContext, voice: string, text: string, onPct?: (p: number) => void): Promise<AudioBuffer> {
  const m = await (mod ??= import('@diffusionstudio/vits-web'));
  const wav = await m.predict({ text, voiceId: voice as never }, p => p.total && onPct?.(Math.round(p.loaded / p.total * 100)));
  return ctx.decodeAudioData(await wav.arrayBuffer());
}
