import { useEffect, useState } from 'react';
/** Author bios and book descriptions: the lead section of the matching English Wikipedia article (CC BY-SA 4.0).
 *  Matched exactly through Wikidata (P1938 Gutenberg author ID, P2034 Gutenberg ebook ID); never typed in by hand.
 *  Built by scripts/wiki/build.py into public/data/authors.json and public/data/descriptions.json. */
export type WikiText = { text: string; desc?: string; title: string; url: string; qid: string };
const BASE = import.meta.env.BASE_URL;
const cache: Record<string, Promise<Record<string, WikiText>>> = {};
const load = (f: string) => (cache[f] ??= fetch(`${BASE}data/${f}.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
export function useWiki(file: 'authors' | 'descriptions', key: string | number | undefined) {
  const [w, setW] = useState<WikiText | null>(null);
  useEffect(() => { setW(null); if (key == null || key === '') return; let on = true; load(file).then(m => on && setW(m[String(key)] ?? null)); return () => { on = false; }; }, [file, key]);
  return w;
}
export const WikiCredit = ({ w }: { w: WikiText }) => <p className="small muted wiki-credit">From <a href={w.url} rel="noopener" target="_blank">“{w.title}”</a> on Wikipedia, licensed <a href="https://creativecommons.org/licenses/by-sa/4.0/" rel="license noopener" target="_blank">CC BY-SA 4.0</a> (<a href={`${w.url.replace('/wiki/', '/w/index.php?title=')}&action=history`} rel="noopener" target="_blank">authors</a>). Matched via <a href={`https://www.wikidata.org/wiki/${w.qid}`} rel="noopener" target="_blank">Wikidata {w.qid}</a>.</p>;
