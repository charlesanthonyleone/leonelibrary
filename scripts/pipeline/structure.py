"""Block stream -> chapters. Rules, in order:
1 contents/illustration lists (TOC links, short-line runs under a Contents heading) are dropped;
2 heading kind from its keyword (Volume > Book > Part > Act > Chapter/Scene/Letter/Canto), else from its HTML level;
3 a heading directly followed by another heading is a group (two-level contents), one followed by text is a section;
4 scripture (verse-numbered) sections split into Book > Chapter N by their verse references;
5 too few headings -> text-pattern fallback (chap2) over the same clean blocks."""
import re,sys,os
sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..','chapters'))
from chap2 import chapterize as text_chapterize, GROUPW, CHAPW, words, resplit
from normalize import clean_title
KW=[(0,r'VOLUME|VOL\.?|TOME|TOMO|BAND|ТОМ'),(1,r'BOOK|LIVRE|BUCH|LIBRO|LIBER|КНИГА|BOEK|KIRJA'),(2,r'PART|PARTIE|TEIL|PARTE|ЧАСТЬ|DEEL|OSA|DIVISION'),(3,r'ACT|ACTE|AKT|ACTO|ATTO|ДЕЙСТВИЕ'),
    (5,r'CHAPTER|CHAP\.?|LETTER|STAVE|SCENE|SCÈNE|SZENE|ESCENA|SCENA|CANTO|CANTICLE|SECTION|KAPITEL|CHAPITRE|CAP[IÍ]TULO|CAPITOLO|ГЛАВА|HOOFDSTUK|LUKU|ROZDZIAŁ|KAPITOLA|KAPITTEL|STORY|TALE|ADVENTURE|PSALM|SONNET|ESSAY|LECTURE|SERMON|DISCOURSE|EPISTLE|DAY|NIGHT|FABLE|POEM|ODE|ELEGY|LETTRE|BRIEF|CARTA')]
NUM=r'(?:[IVXLCDM]+|\d+|[A-Za-z]+)'
def kind(t):
    first=t.split('\n')[0].strip().upper()
    for r,k in KW:
        if re.match(rf'^(?:THE\s+)?(?:[A-Z]+\s+)?(?:{k})\b',first) and (re.match(rf'^(?:THE\s+)?(?:{k})\s+(?:THE\s+)?{NUM}(?!\s+OF\b)',first) or re.match(rf'^(?:THE\s+)?(?:FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|LAST|[A-Z]+TH)\s+(?:{k})\b(?!\s+OF\b)',first)):
            return r
    if re.match(r'^[IVXLC]{1,7}\.?$|^\d{1,3}\.?$',first): return 5
    return None
NAMEDFRONT=re.compile(r'^(contents|table of contents|list of illustrations|illustrations|index of illustrations|list of plates|inhalt|inhaltsverzeichnis|table des matières|table|índice|indice|sommaire|содержание)\.?$',re.I)
def heading_text(t):
    lines=[l.strip() for l in t.split('\n') if l.strip()]
    # drop illustration captions printed before the real heading line ("He rode a black horse. / CHAPTER III.")
    k=next((i for i,l in enumerate(lines) if kind(l) is not None),0)
    lines=lines[k:]
    if not lines: return ''
    out=lines[0]
    for n,l in enumerate(lines[1:]):
        bare=n==0 and kind(out) is not None and len(out.split())<=4 and re.fullmatch(r'[\w\s.]+',out)
        out=(out.rstrip('.:')+'. '+l) if bare else out+' '+l
    return out
IMPRINT=re.compile(r'\b(1[5-9]\d\d|20[0-2]\d)\b.*\b(company|press|publishers?|sons|& co|limited|ltd)\b|\b(company|press|publishers?|sons|& co)\b.*\b(1[5-9]\d\d|20[0-2]\d)\b|^(copyright|all rights reserved|printed in)',re.I)
FRONTNAME=re.compile(r'^\W*(dramatis person|persons? (represented|of the (play|drama))|characters|the persons|contents|preface|introduction|prologue|foreword|induction|argument)',re.I)
def drop_lists(bs):
    """Remove contents tables (TOC links) and runs of short lines under a Contents/Illustrations heading."""
    out=[]; i=0
    while i<len(bs):
        b=bs[i]
        if b['k']=='p' and b['link']>0.6 and len(b['t'])<400: i+=1; continue
        if b['k']=='p' and NAMEDFRONT.match(b['t']) and i+1<len(bs) and bs[i+1]['link']>0.6: i+=1; continue
        if b['k']=='h' and NAMEDFRONT.match(b['t'].split('\n')[0]):
            j=i+1
            while j<len(bs) and bs[j]['k']=='p' and (len(bs[j]['t'])<160 or bs[j]['link']>0.5): j+=1
            if j==len(bs) or bs[j]['k']=='h' or j-i>3: i=j; continue
        out.append(b); i+=1
    return out
def drop_title_page(bs,title,author):
    """Headings before the first prose that repeat the book title or 'by Author' are the title page."""
    nk=lambda s:re.sub(r'[^a-z0-9]','',s.lower())
    tk=nk(title.split(';')[0].split(':')[0])[:25]; ak=nk(author.split()[-1]) if author else '#'
    out=[]; prose=False
    for b in bs:
        if b['k']=='p' and len(b['t'])>200: prose=True
        if b['k']=='h' and kind(b['t']) is None and tk and len(tk)>=4 and nk(b['t']).startswith(tk[:15]) and len(nk(b['t']))<len(tk)+40: continue
        if not prose and b['k']=='h' and ak!='#' and nk(b['t'])==nk(author or ''): continue   # bare author-name heading
        if not prose and b['k']=='h' and (re.match(r'^(by\W*$|by courtesy|courtesy of|reprinted by|published by|copyright|author of|authors? of|translator of|with (\w+ )?illustrations|illustrations by|frontispiece|dedicated to)\b',b['t'],re.I)): continue
        if not prose and b['k']=='h' and (re.match(r'^(by|par|von|di|de|por)\s',b['t'],re.I) and ak in nk(b['t']) or re.match(r'^(illustrated|edited|translated|with an? (introduction|preface)|introduced|done into english)\b',b['t'],re.I)): continue
        out.append(b)
    return out
CJK=re.compile(r'[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\uac00-\ud7af]')   # CJK body lines set as <h4>/<h5> are prose, not headings
def from_headings(bs):
    hs=[i for i,b in enumerate(bs) if b['k']=='h']
    if len(hs)<3: return None
    # rule 2/3: heading tiers
    info={}
    for n,i in enumerate(hs):
        b=bs[i]; t=heading_text(b['t'])
        if not t or re.fullmatch(r'[\W\d_]{0,4}',t) and kind(t) is None: info[i]=None; continue
        nxt=i+1
        while nxt<len(bs) and bs[nxt]['k']=='h' and not heading_text(bs[nxt]['t']): nxt+=1
        follow_h = nxt<len(bs) and bs[nxt]['k']=='h'
        info[i]={'t':t,'lvl':b['lvl'],'r':kind(t),'grp':follow_h}
        if kind(t) is None and (len(t)>100 or len(CJK.findall(t))>=25 or IMPRINT.search(t)): info[i]={'t':t,'lvl':b['lvl'],'r':5,'grp':False,'para':True}   # prose/imprint set as a heading
    # unknown-kind groups take the rank of keyword groups at their level (Epilogue next to Books); unknown sections that of keyword sections
    from collections import Counter
    gr={}; sr={}
    for x in info.values():
        if x and x['r'] is not None: (gr if x['r']<5 else sr).setdefault(x['lvl'],Counter())[x['r']]+=1
    # subtitle: a heading followed by a deeper, keyword-less heading that itself opens text ("ETYMOLOGY." / "(Supplied by…)")
    for a,b2 in zip(hs,hs[1:]):
        A=info.get(a); B=info.get(b2)
        if A and B and b2==a+1 and (A['r'] is None or A['r']>=5) and B['r'] is None and B['lvl']>A['lvl'] and len(B['t'])<=120 and not FRONTNAME.match(B['t']) and not (b2+1<len(bs) and bs[b2+1]['k']=='h'):
            A['t']=A['t'].rstrip('.:')+(': ' if A['r'] is None else '. ')+B['t']; A['grp']=False; info[b2]=None
    order=[i for i in hs if info.get(i)]; open_c={}
    for i in order:
        x=info[i]; x['unk']=x['r'] is None
        if x['r'] is None and not x['grp']: x['r']=5
    for n,i in enumerate(order):
        x=info[i]
        if not x['unk'] or not x['grp']:
            if x['r']<5: open_c[x['lvl']]='used'
            continue
        # unknown group: a container (-1) if keyword groups of its level follow before the next unknown group of its level
        contains=False
        for j in order[n+1:]:
            y=info[j]
            if y['lvl']==x['lvl'] and y['unk'] and y['grp']: break
            if y['lvl']==x['lvl'] and not y['unk'] and y['r']<5: contains=True; break
        if contains and open_c.get(x['lvl']) == 'fresh': x['para']=True; continue   # 'SCENE: Rome' between a play title and Act I
        if contains: open_c[x['lvl']]='fresh'
        x['r']=-1 if contains else (gr[x['lvl']].most_common(1)[0][0] if x['lvl'] in gr else 4)
    chs=[]; stack=[]; cur={'t':'Opening','p':[],'g':None,'key':(0,0)}
    for i,b in enumerate(bs):
        if b['k']=='h' and i in info:
            x=info[i]
            if x is None: continue
            if x.get('para'): cur['p'].append(x['t']); continue
            key=(x['lvl'],x['r'])
            if cur['p'] or cur['t']!='Opening': chs.append(cur)
            if x.get('unk') and x['grp']:
                k=next((n for n in range(len(stack)-1,-1,-1) if stack[n][2] and stack[n][0][0]==key[0]),None)
                if k is not None: del stack[k:]
            while stack and stack[-1][0]>=key: stack.pop()
            if x['grp'] and x['r']<5 or x['grp'] and any(info.get(j) and info[j]['r']>=5 for j in hs if j>i and j<i+4):
                stack.append((key,clean_title(x['t']),x.get('unk'))); cur={'t':'Opening','p':[],'g':None,'key':key}; continue
            g=' · '.join(s[1] for s in stack) or None
            cur={'t':clean_title(x['t']),'p':[],'g':g,'key':key}
        elif b['k']=='p': cur['p'].append(b['t'])
    chs.append(cur)
    # opening sections created after a group heading that carried its own text (preface to a Book) take the group's name
    for c in chs:
        if c['t']=='Opening' and c is not chs[0] and stackless(c): pass
    chs=[c for c in chs if c['p'] or c['t']!='Opening']
    sec=[c for c in chs if c['t']!='Opening']
    return chs if len(sec)>=3 else None
def stackless(c): return True
