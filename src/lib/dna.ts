// "Book DNA": statistics measured directly from the hosted text. Nothing is estimated from outside sources.
import type { HostedBook } from './books';
export type Dna = {
  words: number; unique: number; sentences: number; avgSentence: number; avgWord: number; dialogue: number; ease: number | null;
  chapterWords: number[]; names: { name: string; count: number; per: number[] }[]; longest: string; topWords: [string, number][];
};
const STOP = new Set('the and of to a in that it was he i his her she you with as for had is on at not but be by they him this which all were from so have my or we me said one there are an their what when no would if been them who more out up then will into could do some its any your about our than very us only can now may little upon such over these before after great man made should well like must down how other time much own did good where might himself never two old see know come here even first through way long most yet those again went shall too being every without still while came am many same once let make thought nothing back say away under each just though another last whom something both whose against why off far ever us also among'.split(' '));
const STOP_LANG: Record<string, Set<string>> = {
  de: new Set('der die das und in zu den von nicht mit sich des auf für ist im dem es ein er als auch an eine sie ich so wie aus bei nach wenn noch wir um was einer einen hat aber vor nur oder sein ihr ihm ihn ihre war waren wird werden kann können durch über unter dann da daß dass mir mich dir dich uns euch man schon hatte hätte wäre ganz sehr mein meine seine seiner seinen ihrer ihren dieser diese dieses jetzt doch immer nun wieder ja nein alles alle zum zur am vom hier dort wo denn ob also nichts etwas mehr einem eines keine kein bis gegen ohne habe haben sind bin bist seid wurde sagte'.split(' ')),
  fr: new Set('le la les de des du un une et en à au aux ce cette ces que qui ne pas plus il elle ils elles je tu nous vous on se sa son ses leur leurs lui y dans par pour sur avec mais ou donc car est était sont être avoir avait a ai été fait comme tout tous toute toutes bien même aussi si me te moi toi mon ma mes ton ta tes notre nos votre vos dont où quand très sans sous peu encore alors puis là ici cela ça celui celle entre deux fois rien dit'.split(' ')),
};
const TITLES = new Set('Mrs Miss Sir Lady Lord Madame Monsieur Mme Mlle Herr Frau Captain Colonel General Doctor Professor Uncle Aunt Saint God Heaven Chapter Book Part Letter Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April June July August September October November December English French'.split(' '));
function syllables(w: string) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); }
export const DNA_UNSUPPORTED = new Set(['zh', 'ja', 'ko', 'th']);
export function bookDna(b: HostedBook): Dna {
  let words = 0, sentences = 0, letters = 0, syl = 0, quoted = 0, chars = 0, longest = '';
  const mid = new Set<string>(); const freq = new Map<string, number>(), caps = new Map<string, number[]>(), lower = new Set<string>(); const chapterWords: number[] = [];
  const C = b.chapters.length;
  b.chapters.forEach((c, ci) => { let cw = 0;
    for (const p of c.p) {
      chars += p.length; const qs = p.match(/[“"«„][^”"»“]{1,2000}[”"»“]/g) ?? [];
      // French, Spanish and Russian printing marks speech with a dash: a paragraph opening with one, or an em dash after a sentence end, starts a spoken turn.
      if (!qs.length && /^\s*[—–]/.test(p)) quoted += p.length; else if (!qs.length && /[.!?]\s*—\s*\p{Lu}/u.test(p)) for (const t of p.split(/(?<=[.!?])\s*—/).slice(1)) quoted += t.length; else for (const q of qs) quoted += q.length;
      for (const s of p.split(/(?<!\b(?:Mr|Mrs|Dr|St|Mme|Messrs|Mlle|Prof|Gen|Col|Capt|Rev)\.)(?<=[.!?])\s+(?=[“"'‘(]?\p{Lu})/u)) { const ws = s.match(/[\p{L}’'-]+/gu) ?? []; if (!ws.length) continue; sentences++; if (s.length > longest.length && s.length < 1500) longest = s;
        ws.forEach((w, wi) => { words++; cw++; letters += w.length; if (b.lang === 'en') syl += syllables(w); const l = w.toLowerCase().replace(/[’']s$/, '');
          freq.set(l, (freq.get(l) ?? 0) + 1);
          if (/^\p{Lu}\p{Ll}{2,}$/u.test(w)) { const a = caps.get(w) ?? new Array(C).fill(0); a[ci]++; caps.set(w, a); if (wi > 0) mid.add(w); } else if (/^\p{Ll}/u.test(w)) lower.add(w.toLowerCase()); }); }
    }
    chapterWords.push(cw); });
  const names = b.lang === 'de' ? [] : [...caps].filter(([n]) => mid.has(n) && !TITLES.has(n) && !lower.has(n.toLowerCase()) && !STOP.has(n.toLowerCase())).map(([name, per]) => ({ name, per, count: per.reduce((s, x) => s + x, 0) })).sort((a, b) => b.count - a.count).slice(0, 12);
  // English, German and French use standard function-word lists; other languages treat the book's own 120 most common words as function words.
  const own = b.lang === 'en' ? new Set<string>() : STOP_LANG[b.lang] ?? new Set([...freq].sort((x, y) => y[1] - x[1]).slice(0, 120).map(x => x[0]));
  const topWords = [...freq].filter(([w]) => w.length > 3 && !(b.lang === 'fr' && /^(?:qu|[cdjlmnst])[’']/.test(w)) && !/-(?:il|elle|ils|elles|je|tu|on|nous|vous|ce|es|er|sie)$/.test(w) && !STOP.has(w) && !own.has(w) && !caps.has(w[0].toUpperCase() + w.slice(1))).sort((a, b) => b[1] - a[1]).slice(0, 24);
  const avgSentence = words / Math.max(1, sentences);
  return { words, unique: freq.size, sentences, avgSentence, avgWord: letters / Math.max(1, words), dialogue: quoted / Math.max(1, chars), ease: b.lang === 'en' ? 206.835 - 1.015 * avgSentence - 84.6 * (syl / Math.max(1, words)) : null, chapterWords, names, longest, topWords };
}
