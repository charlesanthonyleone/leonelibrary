// "Book DNA": statistics measured directly from the hosted text. Nothing is estimated from outside sources.
import type { HostedBook } from './books';
export type Dna = {
  words: number; unique: number; sentences: number; avgSentence: number; avgWord: number; dialogue: number; ease: number | null;
  chapterWords: number[]; names: { name: string; count: number; per: number[] }[]; longest: string; topWords: [string, number][];
};
const STOP = new Set('the and of to a in that it was he i his her she you with as for had is on at not but be by they him this which all were from so have my or we me said one there are an their what when no would if been them who more out up then will into could do some its any your about our than very us only can now may little upon such over these before after great man made should well like must down how other time much own did good where might himself never two old see know come here even first through way long most yet those again went shall too being every without still while came am many same once let make thought nothing back say away under each just though another last whom something both whose against why off far ever us also among'.split(' '));
const TITLES = new Set('Mrs Miss Sir Lady Lord Madame Monsieur Mme Mlle Herr Frau Captain Colonel General Doctor Professor Uncle Aunt Saint God Heaven Chapter Book Part Letter Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April June July August September October November December English French'.split(' '));
function syllables(w: string) { w = w.toLowerCase().replace(/[^a-z]/g, ''); if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, ''); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length); }
export function bookDna(b: HostedBook): Dna {
  let words = 0, sentences = 0, letters = 0, syl = 0, quoted = 0, chars = 0, longest = '';
  const mid = new Set<string>(); const freq = new Map<string, number>(), caps = new Map<string, number[]>(), lower = new Set<string>(); const chapterWords: number[] = [];
  const C = b.chapters.length;
  b.chapters.forEach((c, ci) => { let cw = 0;
    for (const p of c.p) {
      chars += p.length; for (const q of p.match(/[“"«„][^”"»“]{1,2000}[”"»“]/g) ?? []) quoted += q.length;
      for (const s of p.split(/(?<!\b(?:Mr|Mrs|Dr|St|Mme|Messrs|Mlle|Prof|Gen|Col|Capt|Rev)\.)(?<=[.!?])\s+(?=[“"'‘(]?\p{Lu})/u)) { const ws = s.match(/[\p{L}’'-]+/gu) ?? []; if (!ws.length) continue; sentences++; if (s.length > longest.length && s.length < 1500) longest = s;
        ws.forEach((w, wi) => { words++; cw++; letters += w.length; if (b.lang === 'en') syl += syllables(w); const l = w.toLowerCase().replace(/[’']s$/, '');
          freq.set(l, (freq.get(l) ?? 0) + 1);
          if (/^\p{Lu}\p{Ll}{2,}$/u.test(w)) { const a = caps.get(w) ?? new Array(C).fill(0); a[ci]++; caps.set(w, a); if (wi > 0) mid.add(w); } else if (/^\p{Ll}/u.test(w)) lower.add(w.toLowerCase()); }); }
    }
    chapterWords.push(cw); });
  const names = [...caps].filter(([n]) => mid.has(n) && !TITLES.has(n) && !lower.has(n.toLowerCase()) && !STOP.has(n.toLowerCase())).map(([name, per]) => ({ name, per, count: per.reduce((s, x) => s + x, 0) })).sort((a, b) => b.count - a.count).slice(0, 12);
  const topWords = [...freq].filter(([w]) => w.length > 3 && !STOP.has(w) && !caps.has(w[0].toUpperCase() + w.slice(1))).sort((a, b) => b[1] - a[1]).slice(0, 24);
  const avgSentence = words / Math.max(1, sentences);
  return { words, unique: freq.size, sentences, avgSentence, avgWord: letters / Math.max(1, words), dialogue: quoted / Math.max(1, chars), ease: b.lang === 'en' ? 206.835 - 1.015 * avgSentence - 84.6 * (syl / Math.max(1, words)) : null, chapterWords, names, longest, topWords };
}
