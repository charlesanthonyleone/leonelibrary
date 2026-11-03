#!/usr/bin/env python3
"""Rule-based quality audit of hosted books (read-only).
Usage: audit-books.py BOOKS_DIR CATALOG.json COVERS_LIST.txt [REPORT.json]
Flags per book: empty-chapter, tiny-chapter (<20 words), gutenberg-boilerplate, broken-title
(empty / all-caps / >120 chars / leftover markup or numbering junk), junk-prefix (KJV '0$', '001:001'-only paragraphs),
missing-cover, encoding-garbage (U+FFFD, mojibake, HTML entities/tags)."""
import json,gzip,os,re,sys,collections
D,CAT,COV=sys.argv[1:4]; REP=sys.argv[4] if len(sys.argv)>4 else None
BOIL=re.compile(r'project gutenberg|gutenberg-tm|gutenberg\.org|\*\*\* ?(start|end) of (the|this)|pgdp\.net|online distributed proofread|this e-?book is for the use of anyone',re.I)
GARB=re.compile(r'\ufffd|Ã[\u0080-\u00bf]|â€|&(amp|lt|gt|nbsp|quot|#\d+);|</?(p|div|span|br|i|b|em)(\s[^>]*)?/?>')
JUNK=re.compile(r'(^|\s)0\$(:\d|\s)|^\s*\$\d\$\d')
CJK=re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]')
OKT=re.compile(r'^(§\s*\d+( – §\s*\d+)?|[IVXLCDM\d]+( [–-] [IVXLCDM\d]+)?)$')
def caps(t):
    if re.fullmatch(r'([A-Z]\.\s*)+[A-Z]?( – ([A-Z]\.\s*)+[A-Z]?)?',t): return False   # initials 'C. W. W.'
    L=re.sub(r'[^A-Za-zÀ-ÿ]','',re.sub(r'\b[IVXLCDM]+\b','',t)); return len(L)>=4 and L==L.upper()
covers={os.path.splitext(x.strip())[0] for x in open(COV) if x.strip()}
cat=json.load(open(CAT)); out=[]; cnt=collections.Counter(); affected=collections.Counter()
for c in cat:
    i=str(c['id']); r={'id':c['id'],'title':c.get('title'),'flags':collections.Counter(),'ex':{}}
    def f(k,ex=None):
        r['flags'][k]+=1
        if ex and k not in r['ex']: r['ex'][k]=ex[:120]
    p=f'{D}/{i}.json.gz'
    if i not in covers: f('missing-cover')
    if not os.path.exists(p): f('missing-book')
    else:
        b=json.load(gzip.open(p)); chs=b.get('chapters') or []
        if not chs: f('empty-chapter','no chapters')
        for ch in chs:
            t=ch.get('t') or ''; ps=ch.get('p') or []; w=sum(len(x.split())+len(CJK.findall(x))//2 for x in ps)
            if w==0: f('empty-chapter',t)
            elif w<20 and len(chs)>1: f('tiny-chapter',t)
            if not t.strip() or caps(t) or len(t)>120 or GARB.search(t) or JUNK.search(t) or re.search(r'\b([IVXLCDM]+|\d+)ToC\b',t) or (re.match(r'^[\W\d_]+$',t) and not OKT.match(t)): f('broken-title',t)
            for x in ps:
                if BOIL.search(x): f('gutenberg-boilerplate',x)
                if JUNK.search(x): f('junk-prefix',x)
                if GARB.search(x): f('encoding-garbage',x)
    for k,v in r['flags'].items(): cnt[k]+=v; affected[k]+=1
    if r['flags']: out.append(r)
print(f'books: {len(cat)}  books with any flag: {len(out)}')
for k in sorted(affected): print(f'  {k:24s} books={affected[k]:5d}  hits={cnt[k]}')
if REP: json.dump({'books':len(cat),'flagged':len(out),'affected':affected,'hits':cnt,'detail':out},open(REP,'w'),indent=1,ensure_ascii=False)
