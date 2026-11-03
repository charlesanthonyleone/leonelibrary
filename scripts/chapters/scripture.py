"""Scripture splitter: verse-numbered texts (KJV/WEB/Apocrypha) -> group=book name, chapter=Chapter N."""
import re
REF=re.compile(r'(?:(?<=\s)|^)(?:\d{1,2}:)?(\d{1,3}):(\d{1,3})\s')
BOOKHDR=re.compile(r'(?i)^Book \d+\s+(.{2,40}?)(?=\s+(?:\d{1,2}:)?\d{1,3}:\d{1,3}\s|$)')
def is_scripture(blocks):
    n=sum(1 for b in blocks if REF.match(b)); return len(blocks)>200 and n>0.4*len(blocks)
def bookline(b):
    m=BOOKHDR.match(b)
    if m: return m.group(1).strip(), b[m.end():].strip()
    if len(b)<80 and not REF.search(b) and re.match(r"(The |A |[1-3] )?[A-Z]",b) and not re.search(r'[.;,]$',b) or (len(b)<80 and b.startswith('The ') and 'Book' in b):
        return b.strip(), ''
    return None
EMB=re.compile(r'(?i)\s(?=Book \d{1,2}\s+[1-3]?\s?[A-Z][a-z])')
def prep(blocks):
    out=[]
    for b in blocks:
        b=re.sub(r'\s*\(part \d+\)$','',b)
        out+=[x for x in EMB.split(b) if x.strip()]
    return out
def chapterize_scripture(blocks):
    blocks=prep(blocks)
    chs=[]; book=None; cur=None; front=[]
    def start(n): 
        nonlocal cur
        cur={'t':f'Chapter {n}','p':[]}
        if book: cur['g']=book
        chs.append(cur)
    for b in blocks:
        bl=bookline(b)
        if bl and (cur is None or len(cur['p'])>0 or not REF.match(b)):
            name,rest=bl
            if name.lower() in ('contents',) or (rest=='' and len(name)>0 and chs==[] and book is None and not front and False): pass
            book=re.sub(r'\s*\[.*?\]|[\[\]]','',name).strip(); cur=None
            if not rest: continue
            b=rest
        # split block at verse refs whose chapter changes
        pos=[m for m in REF.finditer(b)]
        cuts=[0]; last=cur and cur.get('_c')
        segs=[]
        prev=0; pc=last
        for m in pos:
            c=int(m.group(1))
            if pc is not None and c!=pc and m.start()>prev:
                segs.append((b[prev:m.start()].strip(),pc)); prev=m.start()
            elif pc is None and m.start()>prev:
                segs.append((b[prev:m.start()].strip(),None)); prev=m.start()
            pc=c
        segs.append((b[prev:].strip(),pc))
        for s,c in segs:
            if not s: continue
            if c is None:
                (cur['p'] if cur else front).append(s); continue
            if cur is None or cur.get('_c')!=c or cur.get('g')!=book:
                start(c); cur['_c']=c
            cur['p'].append(s)
    for c in chs: c.pop('_c',None)
    if front: chs.insert(0,{'t':'Opening','p':front})
    return chs
