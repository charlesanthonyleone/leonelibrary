"""Source -> flat block stream [{'k':'h'|'p','lvl':int,'t':str,'link':float,'ids':set}]. Gutenberg HTML first, plain text fallback.
Boilerplate (PG header/footer/licence, production credits, page numbers, contents tables) is removed here."""
import re,html as html_lib
from lxml import html as LH
BOILER=re.compile(r'project gutenberg|gutenberg\.org|gutenberg-tm|pgdp\.net|distributed proofread|^\s*(produced by|this e-?book was produced|e-?text prepared by|updated editions will replace|release date:|most recently updated|character set encoding|\[e-?book #|transcribed from|scanned by|html version by|prepared by)',re.I)
START=re.compile(r'\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG',re.I); END=re.compile(r'\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG|^\s*End of (the )?Project Gutenberg',re.I)
HEADS={'h1':1,'h2':2,'h3':3,'h4':4,'h5':5,'h6':6}
BLOCK={'p','div','blockquote','li','dd','dt','pre','tr','table','tbody','thead','ul','ol','dl','section','article','body','center','hr','figure','figcaption','h1','h2','h3','h4','h5','h6','main','header','footer','nav','aside'}
SUB=str.maketrans('0123456789+-=()','₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎'); SUP=str.maketrans('0123456789+-=()','⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾')
DROP_XPATH=("//*[@id='pg-header' or @id='pg-footer' or @id='pg-machine-header' or @id='pg-start-separator' or @id='pg-end-separator']"
  "|//*[contains(concat(' ',@class,' '),' pg-boilerplate ')]|//script|//style|//img|//svg|//head"
  "|//*[contains(@class,'pagenum') or contains(@class,'pageno') or contains(@class,'page-num') or contains(@class,'pgnum')]"
  "|//*[contains(concat(' ',@class,' '),' tnote ') or contains(concat(' ',@class,' '),' transnote ') or contains(@class,'transcriber')]")
def _clean_tree(doc):
    for el in doc.xpath(DROP_XPATH):
        p=el.getparent()
        if p is None: continue
        tail=el.tail; prev=el.getprevious(); p.remove(el)
        if tail:   # keep the text that follows a dropped page number in the same paragraph
            if prev is not None: prev.tail=(prev.tail or '')+tail
            else: p.text=(p.text or '')+tail
    for el in list(doc.iter('span','a','ins')):   # page anchors printed as text ('pg_viii', 'pg003½') in marginal spans
        if el.getparent() is not None and re.fullmatch(r'\s*pg_?[0-9ivxlcdm½]+\s*',el.text_content() or '') and not len(el.xpath('.//*[not(self::span) and not(self::a)]')):
            par=el.getparent(); tail=el.tail; prev=el.getprevious(); par.remove(el)
            if tail:
                if prev is not None: prev.tail=(prev.tail or '')+tail
                else: par.text=(par.text or '')+tail
    for br in doc.iter('br'): br.tail='\n'+(br.tail or '')
    for s in doc.iter('sub'):
        t=s.text_content()
        if re.fullmatch(r'[0-9+\-=()]+',t): s.clear(); s.text=t.translate(SUB)
    for s in doc.iter('sup'):
        t=s.text_content()
        if re.fullmatch(r'[0-9+\-=()]{1,3}',t) and not s.xpath('ancestor::a'): s.clear(); s.text=t.translate(SUP)
def _txt(el):
    return el.text_content()
def _norm(t,keep_nl=False):
    t=t.replace('\xa0',' ').replace('\u00ad','')
    if keep_nl: return '\n'.join(re.sub(r'[ \t\r\f\v]+',' ',l).strip() for l in t.split('\n') if l.strip())
    return re.sub(r'\s+',' ',t).strip()
def _linkfrac(el,total):
    if not total: return 0.0
    n=sum(len(_norm(a.text_content())) for a in el.iter('a') if (a.get('href') or '').startswith('#') or 'pginternal' in (a.get('class') or ''))
    return min(1.0,n/total)
def _ids(el):
    s=set()
    for x in el.iter():
        for a in ('id','name'):
            v=x.get(a) if hasattr(x,'get') else None
            if v: s.add(v)
    return s
def from_html(raw):
    doc=LH.document_fromstring(raw)
    targets={a.get('href')[1:] for a in doc.iter('a') if (a.get('href') or '').startswith('#')}
    _clean_tree(doc)
    out=[]; pend=set()
    def emit(k,el,lvl=0,text=None):
        nonlocal pend
        t=_norm(text if text is not None else _txt(el), keep_nl=(k=='h'))
        ids=_ids(el)|pend
        if not t.strip(): pend|=ids; return
        pend=set()
        out.append({'k':k,'lvl':lvl,'t':t,'link':_linkfrac(el,len(_norm(t))) if text is None else 0.0,'ids':ids,'cls':el.get('class') or ''})
    def rec(el):
        tag=el.tag if isinstance(el.tag,str) else ''
        if tag in HEADS: emit('h',el,HEADS[tag]); return
        if tag=='tr':
            cells=[_norm(c.text_content()) for c in el if isinstance(c.tag,str)]
            emit('p',el,text=None) if False else None
            t=' '.join(c for c in cells if c)
            if t:
                ids=_ids(el)|pend; pend.clear()
                out.append({'k':'p','lvl':0,'t':t,'link':_linkfrac(el,len(t)),'ids':ids,'cls':'tr'})
            return
        cls=(el.get('class') or '') if tag else ''
        if re.search(r'\b(stanza|poem|verse|lg)\b',cls) and not any(isinstance(c.tag,str) and c.tag in HEADS for c in el.iterdescendants()):
            if not any(re.search(r'\bstanza\b',d.get('class') or '') for d in el.iterdescendants() if isinstance(d.tag,str)):
                emit('p',el); return
        blocky=[c for c in el.iterdescendants() if isinstance(c.tag,str) and c.tag in BLOCK]
        if not blocky:
            if tag: emit('p',el)
            return
        buf=[el.text or '']
        def flush():
            t=''.join(buf)
            if t.strip(): out.append({'k':'p','lvl':0,'t':_norm(t),'link':0.0,'ids':set(),'cls':''})
            buf.clear()
        for c in el:
            if not isinstance(c.tag,str): buf.append(c.tail or ''); continue
            if c.tag in BLOCK or any(isinstance(d.tag,str) and d.tag in BLOCK for d in c.iterdescendants()):
                flush(); rec(c); buf.append(c.tail or '')
            else: buf.append(c.text_content()+(c.tail or ''))
        flush()
    body=doc.find('body') if doc.find('body') is not None else doc
    rec(body)
    return _strip(out),targets
def from_text(raw):
    t=raw.replace('\r\n','\n').replace('\ufeff','')
    blocks=[re.sub(r'[ \t]*\n[ \t]*',' ',b).strip() for b in re.split(r'\n\s*\n',t)]
    out=[{'k':'p','lvl':0,'t':b,'link':0.0,'ids':set(),'cls':''} for b in blocks if b]
    for b in out: b['t']=re.sub(r'_([^_\n]+)_',r'\1',b['t'])
    return _strip(out),set()
VERSEJUNK=re.compile(r'^\d?[^\w\s\'"“‘(\[]{1,6}(?:\d[^\w\s\'"“‘(\[]{1,6}){0,2}(?=\d{1,3}:\d{1,3}\b)')   # bounded: no backtracking blow-up
CP=set('\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178')
MOJI=re.compile('[\u00c2-\u00f4](?:[\u0080-\u00bf'+''.join(CP)+']){1,3}')
def _unmoji(m):
    s=m.group(0); bs=bytearray()
    for ch in s:
        try: bs+=ch.encode('cp1252')
        except UnicodeEncodeError:
            if ord(ch)<256: bs.append(ord(ch))
            else: return s
    try: return bs.decode('utf-8')
    except UnicodeDecodeError: return s
ETEXT=re.compile(r'project gutenberg|gutenberg-tm|gutenberg\.org|pgdp\.net|distributed proofread|\be-?texts?\b|\btranscriber|this e-?book (is|was)',re.I)
def fix_text(t):
    """UTF-8 read as cp1252 ('CÃ¦sar' -> 'Cæsar'); a lost Æ ('�?schylus'); footnote anchors '[3:1]' -> superscript."""
    if 'Ã' in t or 'â€' in t or 'Â' in t: t=MOJI.sub(_unmoji,t)
    t=re.sub('\ufffd\\?(?=[a-z])','Æ',t)
    if '&' in t: t=html_lib.unescape(t)              # double-escaped entities ('&amp;') in the source
    t=re.sub(r'</?(?:p|div|span|br|i|b|em)(?:\s[^>]*)?/?>','',t)   # literal tags left in the text
    return t
def _strip(bs):
    # 1. PG start/end markers (older HTML and all plain text)
    s=next((i for i,b in enumerate(bs) if START.search(b['t'])),None)
    if s is not None and s<len(bs)*0.3: bs=bs[s+1:]
    e=next((i for i,b in enumerate(bs) if END.search(b['t'])),None)
    if e is not None and e>len(bs)*0.5: bs=bs[:e]
    # 2. production credits / PG mentions; illustration placeholders; plain-text markup
    i=0
    while i<len(bs) and i<12 and (BOILER.search(bs[i]['t']) or len(bs[i]['t'])<3): i+=1
    bs=bs[i:]
    res=[]
    for b in bs:
        t=b['t']
        if (BOILER.search(t) and len(t)<600) or ETEXT.search(t): continue   # PG/etext editor notes of any length
        if re.fullmatch(r'\[?(Illustration|Ilustración|Illustrations?)[^\]]{0,300}\]?',t,re.I) and len(t)<300: continue
        t=re.sub(r'/\*\s*(RIGHT|CENTER|CENTRE|LEFT|IND|NF)?\s*|\s*\*/',' ',t).strip()
        t=re.sub(r'\[(?:Pg|Page|p\.)\s*\d+\]','',t).strip()
        t=re.sub(r'\{\s*[0-9ivxlc]{1,6}\s*\}','',t).strip()          # page markers {12} {xxv}
        t=re.sub(r'(?<=\w)_\{(\d+)\}',lambda m:m.group(1).translate(SUB),t); t=re.sub(r'(?<=\w)\{(\d+)\}',lambda m:m.group(1).translate(SUB),t)
        t=VERSEJUNK.sub('',t); t=fix_text(t)   # '0$:001:001 Now…' -> '001:001 Now…' (stray markers glued to verse refs)
        if not t or re.fullmatch(r'[\s*·.•—–-]+',t): continue
        b=dict(b); b['t']=t; res.append(b)
    return res
