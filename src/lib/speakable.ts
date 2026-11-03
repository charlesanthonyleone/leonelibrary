/** Narration text clean-up (LR3). Turns a chunk of book text into what a good reader would actually say.
 *  Only the string sent to the voice changes; highlight ranges still point at the original text.
 *  Use: tts.generate(speakable(chunkText, lang), …). Pure, fast, no dependencies. */
const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
export function roman(s: string): number | null {
  if (!/^[IVXLCDM]+$/.test(s) || !/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s)) return null;
  let n = 0; for (let i = 0; i < s.length; i++) { const a = ROMAN[s[i]], b = ROMAN[s[i + 1]] ?? 0; n += a < b ? -a : a; } return n || null;
}
const WORDS: [RegExp, string][] = [
  [/\bMr\./g, 'Mister'], [/\bMrs\./g, 'Missus'], [/\bDr\./g, 'Doctor'], [/\bSt\.(?=\s+[A-Z])/g, 'Saint'], [/\bMt\./g, 'Mount'],
  [/\bCapt\./g, 'Captain'], [/\bCol\./g, 'Colonel'], [/\bGen\.(?=\s+[A-Z])/g, 'General'], [/\bLt\./g, 'Lieutenant'],
  [/\bRev\.(?=\s+[A-Z])/g, 'Reverend'], [/\bProf\./g, 'Professor'], [/\bHon\./g, 'Honourable'], [/\bJr\./g, 'Junior'],
  [/&c\.?/g, 'et cetera'], [/\betc\./g, 'et cetera'], [/\bi\.e\./g, 'that is'], [/\be\.g\./g, 'for example'], [/\bviz\./g, 'namely'],
  [/\bvs\./g, 'versus'], [/\bNo\.(?=\s*\d)/g, 'number'], [/\bVol\.(?=\s*\w)/g, 'volume'], [/\bch\.(?=\s*\w)/g, 'chapter'],
  [/\bp\.(?=\s*\d)/g, 'page'], [/\bpp\.(?=\s*\d)/g, 'pages'], [/£\s?(\d[\d,]*)/g, '$1 pounds'], [/\$(\d[\d,]*)/g, '$1 dollars'],
];
const TITLED = /\b(Chapter|Book|Part|Volume|Vol|Canto|Act|Scene|Section|Letter|Psalm|Article|Lecture|Stave|Fytte|Henry|Edward|George|Louis|Charles|William|James|Richard|John|Pope|Pius|Leo|Gregory|Elizabeth|Mary|Napoleon|Philip|Frederick|Alexander|Peter|Catherine)\s+([IVXLCDM]{1,7})\b(?!['’])/g;
export function speakable(t: string, lang = 'en'): string {
  let s = t
    .replace(/\{[^{}]*\}/g, '')                       // WEB-style inline footnotes {After "God," the Hebrew…}
    .replace(/\[(?:\d+|[a-z]|Footnote[^\]]*|Illustration[^\]]*|Sidenote[^\]]*)\]/gi, '') // [12] [Illustration: …]
    .replace(/(^|\s)(?:\d{1,2}:)?\d{1,3}:\d{1,3}(?=\s)/g, '$1')  // scripture verse numbers 001:001 / 01:001:001 / 3:16
    .replace(/_([^_]+)_/g, '$1').replace(/\*([^*]+)\*/g, '$1') // _italics_ *emphasis*
    .replace(/\s*[—–]\s*|\s+-{1,2}\s+|(?<=\w)--(?=\w)/g, ', ')    // dashes read as a pause, not "dash"
    .replace(/\.{3,}|…/g, '… ')
    .replace(/(\w)[‘’'](?=\w)/g, "$1'");
  if (lang.startsWith('en')) {
    for (const [r, w] of WORDS) s = s.replace(r, w);
    s = s.replace(TITLED, (m, a: string, r: string) => { const n = roman(r); if (n == null || (r === 'I' && !/^(Chapter|Book|Part|Volume|Vol|Canto|Act|Scene|Section|Letter|Psalm|Article|Lecture|Stave|Fytte)$/.test(a))) return m;
      return /^(Chapter|Book|Part|Volume|Vol|Canto|Act|Scene|Section|Letter|Psalm|Article|Lecture|Stave|Fytte)$/.test(a) ? `${a} ${n}` : `${a} the ${ordinal(n)}`; })
      .replace(/^([IVXLCDM]{1,7})\.\s/, (m, r: string) => { const n = roman(r); return n ? `${n}. ` : m; }) // "IV. The Storm" chapter openers
      .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1$2');
  }
  return s.replace(/\s+([,.;:!?])/g, '$1').replace(/,\s*,/g, ',').replace(/^[\s,]+/, '').replace(/\s{2,}/g, ' ').trim();
}
const ORD = ['zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'];
const ordinal = (n: number) => ORD[n] ?? `${n}th`;
