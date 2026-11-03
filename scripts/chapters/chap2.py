"""Leone Library chapter splitter v2 (LR3).
Input: cleaned paragraph blocks (llimport clean()). Output: chapters [{'t','p','g'?}].
Fixes over v1: repeated headings per book/volume (War and Peace "CHAPTER I" x15) are real chapters, only
contents-list runs are skipped; BOOK/PART/DAY headings become group labels ('g') for a two-level TOC;
subtitles merge into titles; all-caps section titles (essays, Lives, tales) are used when no numbered
headings exist; heading-less books split at ~4,500 words on paragraph boundaries, not every 150 paragraphs."""
import re
NUM=r'(?:[IVXLCDM]+|\d+|[A-Z][a-z]+|[A-Z]+|ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN)'
GROUPW=r'(?:CANTO|Canto|BOOK|Book|PART|Part|VOLUME|Volume|VOL\.|Vol\.|EPILOGUE|Epilogue|ACT|Act|LIVRE|Livre|TEIL|Teil|BUCH|Buch|LIBRO|Libro|PARTIE|Partie|TOMO|Tomo|ЧАСТЬ|Часть|КНИГА|Книга|DEEL|Deel|OSA|Osa)'
CHAPW=r'(?:CHAPTER|Chapter|CHAP\.|Chap\.|LETTER|Letter|STAVE|Stave|SCENE|Scene|NOVEL|Novel|STORY|Story|SECTION|Section|ГЛАВА|Глава|KAPITEL|Kapitel|CHAPITRE|Chapitre|Capítulo|CAPÍTULO|CAPITULO|Capitolo|CAPITOLO|Hoofdstuk|HOOFDSTUK|Luku|LUKU|Rozdział|ROZDZIAŁ|Kapitola|KAPITOLA|Kapittel|KAPITTEL|Kapitel)'
GROUP=re.compile(rf'^[-–—\s]*{GROUPW}\s+(?:[Tt][Hh][Ee]\s+)?{NUM}\b[.:]?(?:[\s:.—–-].{{0,80}})?[-–—\s]*$|^[-–—\s]*(?:EPILOGUE|Epilogue|PROLOGUE|Prologue)[.:]?(?:\s.{{0,60}})?$|^[-–—\s]*(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|LAST) (?:DAY|BOOK|PART|VOLUME)\b.{{0,40}}$')
CHAP=re.compile(rf'^[-–—\s]*{CHAPW}\s+(?:[Tt][Hh][Ee]\s+)?{NUM}\b[.:]?(?:[\s:.—–-].{{0,80}})?$|^[IVXLC]{{1,7}}\.(?:\s[^;]{{0,70}})?$|^[IVXLC]{{1,7}}$|^\d{{1,3}}\.?$|^§\s*\d+\.?$|^第[一二三四五六七八九十百千〇零0-9]+[回章卷篇節节部]')
NAMED=re.compile(r'^(?:PREFACE|Preface|INTRODUCTION|Introduction|FOREWORD|Foreword|PROLOGUE|Prologue|EPILOGUE|Epilogue|CONCLUSION|Conclusion|AFTERWORD|Afterword|APPENDIX|Appendix|NOTES|Notes|POSTSCRIPT|Postscript|INDEX|Index|GLOSSARY|Glossary|VORWORT|Vorwort|EINLEITUNG|Einleitung|PRÉFACE|Préface|PRÓLOGO|Prólogo|INTRODUCCIÓN)\b.{0,50}$')
def caps(b):
    s=re.sub(r'[^A-Za-zÀ-ÿА-я]','',b)
    return 3<=len(s) and s.isupper() and len(b)<=70 and not re.search(r'[!?,;]\s*$|^\(|\)$',b) and len(b.split())<=9
def norm_title(t):
    t=re.sub(r'^[-–—\s\[]+|[-–—\s\]]+$','',t).strip()
    t=re.sub(r'\s+',' ',t); t=re.sub(r'\.?\s*\[\d+\]?$','',t).rstrip('.')
    if sum(ch.isupper() for ch in t)>0.6*sum(ch.isalpha() for ch in t) and len(t)>3:
        small={'of','the','and','in','on','to','a','an','at','for','with','by','or','from','de','la','le','der','die','das','und'}
        toks=re.split(r'(\s+|—|–|--|-)',t); out=[]; first=True
        for w in toks:
            if not w or re.fullmatch(r'\s+|—|–|--|-',w or ''): out.append(w); continue
            core=re.sub(r'[^A-Za-zÀ-ÿА-яЁё]','',w)
            if re.fullmatch(r'[IVXLCDM]+',core) and len(core)<=7 and not re.fullmatch(r'(I|MIX|DIM|LID|MILD|CIVIL|VIVID|LIVID|DID|MID|MIX|LIVID)',core) or core in ('I',): out.append(w)
            elif core.lower() in small and not first: out.append(w.lower())
            else: out.append(w[:1]+w[1:].lower() if w[:1].isalpha() else w[:2]+w[2:].lower())
            first=False
        t=''.join(out)
    return t[:90]+('…' if len(t)>90 else '')
CJK=re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]')
def wlen(p): return len(p.split())+len(CJK.findall(p))//2
def words(ps): return sum(wlen(p) for p in ps)
def subtitle_ok(b): return len(b)<=80 and not re.search(r'[.!?]["”’]?$',b.rstrip('.')+('' if b.endswith('.') and len(b)<50 else '')) or (len(b)<=60 and b.isupper())

def split_blocks(blocks,kind):
    """kind(b) -> 'g'|'c'|None. Returns list of (group,title,paras)."""
    tags=[kind(b) for b in blocks]
    # which level is outer? count adjacent heading pairs: "SECTION I / PART I" (Hume) means sections contain parts
    cg=sum(1 for a,b in zip(tags,tags[1:]) if a=='c' and b=='g'); gc=sum(1 for a,b in zip(tags,tags[1:]) if a=='g' and b=='c')
    if cg>gc and cg>=2: tags=[{'c':'g','g':'c'}.get(t,t) if t else t for t in tags]
    n=len(blocks)
    # contents runs: a heading whose next 2 blocks are also headings (or short lines) with no prose between,
    # and that pattern repeats >=4 in a row -> listing, not structure.
    istoc=[False]*n
    i=0
    while i<n:
        if tags[i]:
            j=i
            while j<n and (tags[j] or (len(blocks[j])<100 and j+1<n and tags[j+1])): j+=1
            heads=sum(1 for k in range(i,j) if tags[k])
            if heads>=4:
                keep=j-1
                while keep-1>=i and tags[keep-1]=='g' and tags[keep]!='g': keep-=1   # "BOOK ONE" + "CHAPTER I" that open the text
                for k in range(i,keep): istoc[k]=True
                # if the run ends and text that follows is short, it is still a toc; fine
            i=max(j,i+1)
        else: i+=1
    # a heading directly followed by another heading whose text recurs later as a heading is a contents entry
    nk=lambda b:re.sub(r'[^a-z0-9]','',b.lower())
    last={}
    for k in range(n):
        if tags[k]: last[nk(blocks[k])]=k
    for k in range(n-1):
        if tags[k] and any(tags[k+1:k+4]) and all(len(x)<120 for x in blocks[k+1:k+4]) and last.get(nk(blocks[k]),k)>k+1:
            # only when the later copy is followed by prose, i.e. it really heads text
            istoc[k]=True
    # contents zone: every heading before the first heading that actually opens prose, if there are many of them
    first=next((k for k in range(n) if tags[k] and any(len(x)>=200 for x in blocks[k+1:k+3])),None)
    if first is not None and sum(1 for t in tags[:first] if t)>=5:
        f0=first
        while f0-1>=0 and tags[f0-1]=='g' and tags[first]!='g': f0-=1
        for k in range(f0): istoc[k]=True
    out=[]; group=None; cur=[None,'Opening',[]]; pend_g=None
    k=0
    while k<n:
        b=blocks[k]; t=tags[k]
        if t and not istoc[k]:
            if t=='g':
                gt=norm_title(b)
                # group heading followed by a subtitle line ("BOOK ONE: 1805" / "THE PRINCE")
                if k+1<n and not tags[k+1] and len(blocks[k+1])<60 and caps(blocks[k+1]) and '.' not in blocks[k+1] : gt+=': '+norm_title(blocks[k+1]); k+=1
                group=gt; pend_g=gt
                # if the next real block is not a chapter heading, the group itself starts a chapter
                nxt=next((x for x in range(k+1,min(n,k+4)) if tags[x] or len(blocks[x])>=70),None)
                if nxt is None or tags[nxt]!='c':
                    if cur[2]: out.append(cur)
                    cur=[group,gt,[]]; pend_g=None
                k+=1; continue
            title=norm_title(b)
            if k+1<n and not tags[k+1] and len(blocks[k+1])<=80 and k+2<n and len(blocks[k+2])>=len(blocks[k+1]) and not re.search(r'[.!?。！？，]["”’」]?$',blocks[k+1]) and len(blocks[k+1].split())<=12:
                title+=': '+norm_title(blocks[k+1]) if not re.match(r'^[IVXLC]+\.?$|^\d+\.?$',title)==None or True else ''; k+=1
            if cur[2] or cur[1]!='Opening': out.append(cur)
            cur=[group,title,[]]; pend_g=None
        else: cur[2].append(b)
        k+=1
    out.append(cur)
    return [c for c in out if c[2] or c[1]!='Opening']

def resplit(blocks,cap=1500):
    """Paragraphs over ~1,500 words (texts with no blank lines) are split at sentence ends so pages and narration work."""
    out=[]
    for b in blocks:
        if wlen(b)<=cap: out.append(b); continue
        sents=[x+' ' for x in re.split(r'(?<=[.!?。！？])\s+',b)]; cur=''
        for x in sents:
            cur+=x
            if wlen(cur)>=300: out.append(cur.strip()); cur=''
        if cur.strip(): out.append(cur.strip())
    return out
def chapterize(blocks, target=4500):
    blocks=resplit(blocks)
    def k1(b):
        if len(b)>=100: return None
        if GROUP.match(b): return 'g'
        if CHAP.match(b) or NAMED.match(b): return 'c'
        return None
    chs=split_blocks(blocks,k1)
    real=[c for c in chs if c[1]!='Opening']
    if len(real)<3:
        # second tier: all-caps section titles, only if they are followed by prose and recur
        cand=[i for i,b in enumerate(blocks) if (caps(b) or k1(b)) and i+1<len(blocks) and len(blocks[i+1])>150]
        if len(cand)>=3 and words(blocks)/max(1,len(cand))>300:
            cs=set(cand)
            chs=split_blocks(blocks,lambda b,_c={blocks[i] for i in cand}:(k1(b) or 'c') if b in _c else None)
            real=[c for c in chs if c[1]!='Opening']
    if len(real)<3 and words(blocks)>target*1.5:
        allp=[p for c in chs for p in ([c[1]] if c[1]!='Opening' and False else [])+c[2]] if False else [p for c in chs for p in (([c[1]] if c[1]!='Opening' else [])+c[2])]
        parts=[];cur=[];w=0
        for p in allp:
            cur.append(p); w+=wlen(p)
            if w>=target: parts.append(cur); cur=[]; w=0
        if cur:
            if parts and w<target*0.35: parts[-1]+=cur
            else: parts.append(cur)
        chs=[[None,f'Part {i+1}',ps] for i,ps in enumerate(parts)]
    # fold near-empty chapters (part title pages, epigraphs) into the next chapter
    res=[]; carry=[]; cg=None
    for idx,(g,t,ps) in enumerate(chs):
        if words(ps)<25 and idx<len(chs)-1:
            carry+= ([t] if t!='Opening' else [])+ps; cg=cg or g; continue
        if carry:
            ps=carry+ps; carry=[]
        res.append([g,t,ps])
    if carry:
        if res: res[-1][2]+=carry
        else: res=[[None,'Opening',carry]]
    # very long chapters (no inner headings) split for the reader, keeping the title
    final=[]
    for g,t,ps in res:
        if words(ps)>target*4:
            parts=[];cur=[];w=0
            for p in ps:
                cur.append(p); w+=wlen(p)
                if w>=target*1.5: parts.append(cur); cur=[]; w=0
            if cur: (parts[-1].extend(cur) if parts and w<target*0.4 else parts.append(cur))
            for i,pp in enumerate(parts): final.append([g,t if i==0 else f'{t} (part {i+1})',pp])
        else: final.append([g,t,ps])
    # long runs of tiny numbered pieces (stanzas, aphorisms, limericks) become readable chapters of ~2,500 words
    def tiny(c): return words(c[2])<400 and c[1] not in ('Opening','Contents')
    merged=[]; i=0
    while i<len(final):
        j=i
        while j<len(final) and tiny(final[j]) and final[j][0]==final[i][0]: j+=1
        if j-i>=6:
            cur=[]; w=0
            for c in final[i:j]:
                cur.append(c); w+=words(c[2])
                if w>=2500: merged.append(cur); cur=[]; w=0
            if cur: merged.append(cur)
            i=j
        else: merged.append([final[i]]); i+=1
    final=[]
    for grp in merged:
        if len(grp)==1: final.append(grp[0]); continue
        ps=[]
        for c in grp: ps+=[c[1]]+c[2]
        final.append([grp[0][0], f"{grp[0][1]} – {grp[-1][1]}", ps])
    if final and final[0][1]=='Opening' and words(final[0][2])<400 and sum(1 for p in final[0][2] if len(p)<70)>len(final[0][2])*0.6: final[0][1]='Contents'
    # list-like chapters (contents pages, lists of illustrations) merge into one 'Contents' entry
    def listy(ps): return len(ps)>=4 and words(ps)<1500 and sum(1 for p in ps if len(p)<120)>=0.85*len(ps)
    while len(final)>1 and listy(final[1][2]) and (final[0][1] in ('Opening','Contents') or listy(final[0][2])):
        a=final.pop(1); final[0]=[None,'Contents',final[0][2]+([a[1]] if a[1]!='Opening' else [])+a[2]]
    if final and listy(final[0][2]) and final[0][1]=='Opening': final[0][1]='Contents'
    out=[]
    for g,t,ps in final:
        d={'t':t,'p':ps}
        if g and g!=t: d['g']=g
        out.append(d)
    return out
