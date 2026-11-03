"""Rules applied to every book after structure detection."""
import re,sys,os
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..','chapters'))
from chap2 import words, wlen, resplit
from scripture import is_scripture, chapterize_scripture
from normalize import clean_title
REF=re.compile(r'^(?:\d{1,2}:)?(\d{1,3}):(\d{1,3})\b')
def scripture_split(chs):
    """Verse-numbered sections (Bible, Apocrypha) -> Book (group) > Chapter N, chapter taken from each verse reference."""
    allp=[p for c in chs for p in c['p']]
    if not (len(allp)>200 and sum(1 for p in allp if REF.match(p))>0.4*len(allp)): return chs,False
    out=[]
    for c in chs:
        refs=sum(1 for p in c['p'] if REF.match(p))
        if refs<max(1,0.3*len(c['p'])): out.append(c); continue
        book=' · '.join(re.sub(r'^(?:Book|Livre|Buch)\s+\d+\s+(?=\S)','',x) for x in (c.get('g'),c['t']) if x and x!='Opening') or None
        cur=None; front=[]
        for p in c['p']:
            m=REF.match(p)
            if m:
                n=int(m.group(1))
                if cur is None or cur['_n']!=n:
                    cur={'t':f'Chapter {n}','p':front+[],'g':book,'_n':n}; front=[]; out.append(cur)
                cur['p'].append(p)
            elif cur is None: front.append(p)
            else: cur['p'].append(p)
        if front: out.append({'t':c['t'],'p':front,'g':c.get('g')})
    for c in out: c.pop('_n',None)
    return out,True
def is_verse_book(chs): return scripture_split(chs)[1]
def fold_empty(chs,minw=25):
    res=[]; carry=[]
    for i,c in enumerate(chs):
        if words(c['p'])<minw and i<len(chs)-1 and not (chs[i+1].get('g')!=c.get('g') and words(c['p'])>0 and False):
            carry+=([c['t']] if c['t'] not in ('Opening',) else [])+c['p']
            continue
        if carry: c={**c,'p':carry+c['p']}; carry=[]
        res.append(c)
    if carry:
        if res: res[-1]['p']+=carry
        elif any(words([p]) for p in carry): res=[{'t':'Opening','p':carry}]
    return [c for c in res if c['p']]
def dedupe(chs):
    """A section whose title recurs later in the same group with no more than a list of text before it is a contents entry."""
    nk=lambda s:re.sub(r'\W','',s.lower())
    later={}
    for i,c in enumerate(chs): later[(c.get('g'),nk(c['t']))]=i
    out=[]
    for i,c in enumerate(chs):
        k=(c.get('g'),nk(c['t']))
        if later[k]>i and words(c['p'])<150: chs[later[k]]['p']=c['p']+chs[later[k]]['p'] if words(c['p'])>40 else chs[later[k]]['p']; continue
        if out and (out[-1].get('g'),nk(out[-1]['t']))==k:   # same title back-to-back: one section cut by a sub-heading
            out[-1]=dict(out[-1],p=out[-1]['p']+c['p']); continue
        out.append(c)
    # identical text twice (a repeated section): keep the first
    # identical opening text twice: keep the longer one (a contents summary that opens like its chapter must not
    # replace the chapter itself), in the place of the first
    seen={}; res=[]
    for c in out:
        k=nk(' '.join(c['p'][:3])[:300])
        if len(k)>80 and k in seen:
            j=seen[k]
            if words(c['p'])>words(res[j]['p']): res[j]=c
            continue
        seen[k]=len(res); res.append(c)
    return res
NUMT=re.compile(r'^(chapter|letter|scene|canto|book|part|stave|section|§|[ivxlc]+\b|\d+\b)',re.I)
def number_groups(chs):
    """Numbering that restarts ('I' again) means hidden groups. The group is named by the un-numbered section
    right before each restart (a story/essay title), else 'Volume N'."""
    nk=lambda s:re.sub(r'\W','',s.lower())
    if any(c.get('g') for c in chs) or len(chs)<4: return chs
    num=[bool(NUMT.match(c['t'])) and c['t']!='Opening' for c in chs]
    starts=[0]; seen=set()
    for i,c in enumerate(chs):
        k=nk(c['t'])
        if num[i] and k in seen:
            s0=i-1 if i>0 and not num[i-1] else i
            starts.append(s0); seen=set()
        seen.add(k)
    if len(starts)==1: return chs
    # first run: a title section directly before its first numbered section
    f=next((i for i in range(len(chs)) if num[i]),0)
    if f>0 and not num[f-1]: starts[0]=f-1
    out=[dict(c) for c in chs]
    bounds=starts+[len(chs)]
    for n,(s0,e) in enumerate(zip(bounds,bounds[1:])):
        lab=chs[s0]['t'] if not num[s0] and all(not num[s0] or True for _ in [0]) and num[s0+1:s0+2]==[True] else f'Volume {n+1}'
        for c in out[s0:e]: c['g']=lab
    return out
SUP=str.maketrans('0123456789','⁰¹²³⁴⁵⁶⁷⁸⁹')
def footnote_anchors(chs):
    """Non-scripture '[ch:n]' anchors are footnote references: shown as superscript n."""
    f=lambda m:m.group(2).translate(SUP)
    return [dict(c,p=[re.sub(r'\[(\d{1,3}):(\d{1,3})\]',f,x) for x in c['p']]) for c in chs]
NOTES=re.compile(r'^\W*(foot|end|line|side|marginal )?notes?\W*$',re.I)
def fold_notes(chs):
    """Footnote blocks are part of the chapter they follow, not chapters of their own."""
    out=[]
    for c in chs:
        if out and NOTES.match(c['t']): out[-1]=dict(out[-1]); out[-1]['p']=out[-1]['p']+[c['t'].rstrip(':')+':']+c['p']; continue
        out.append(c)
    return out
def split_huge(chs,target=4500):
    out=[]
    for c in chs:
        c['p']=resplit(c['p'])
        if words(c['p'])<=target*4: out.append(c); continue
        parts=[];cur=[];w=0
        for p in c['p']:
            cur.append(p); w+=wlen(p)
            if w>=target*1.5: parts.append(cur); cur=[]; w=0
        if cur: (parts[-1].extend(cur) if parts and w<target*0.4 else parts.append(cur))
        for i,pp in enumerate(parts): out.append({**c,'p':pp,'_part':i+1 if i else None})
    return out
def merge_tiny_runs(chs):
    """Runs of 6+ tiny numbered pieces (aphorisms, stanzas, numbered maxims) become ~2,500-word chapters 'I – XLII'."""
    num=lambda t:re.fullmatch(r'(?:[IVXLCDM]+|\d+)\.?',t) is not None
    tiny=lambda c:words(c['p'])<150 and num(c['t'])
    out=[];i=0
    while i<len(chs):
        j=i
        while j<len(chs) and tiny(chs[j]) and chs[j].get('g')==chs[i].get('g'): j+=1
        if j-i>=6:
            grp=[];w=0
            for c in chs[i:j]:
                grp.append(c); w+=words(c['p'])
                if w>=2500: out.append(_m(grp)); grp=[]; w=0
            if grp: out.append(_m(grp))
            i=j
        else: out.append(chs[i]); i+=1
    return out
def _m(grp):
    if len(grp)==1: return grp[0]
    ps=[]
    for c in grp: ps+=[c['t']]+c['p']
    d={'t':f"{grp[0]['t']} – {grp[-1]['t']}",'p':ps}
    if grp[0].get('g'): d['g']=grp[0]['g']
    return d
EDNOTE=re.compile(r"production notes|(e-?book|e-?text)(\s+editor)?['’]?s?\s+note|transcriber['’]?s?\s+note",re.I)
def finish(chs):
    out=[]
    for c in chs:
        if EDNOTE.search(c['t']): continue   # transcriber/ebook-editor notes are not part of the work
        t=clean_title(c['t']) if c['t']!='Opening' else 'Opening'
        if c.get('_part'): t=f"{t} (part {c['_part']})"
        d={'t':t or 'Untitled','p':[p for p in c['p'] if p.strip()]}
        g=c.get('g')
        if g and g!=t: d['g']=g
        if d['p']: out.append(d)
    if out and out[0]['t']=='Opening' and len(out)>1 and words(out[0]['p'])<40: out[1]['p']=out[0]['p']+out[1]['p']; out.pop(0)
    return out
