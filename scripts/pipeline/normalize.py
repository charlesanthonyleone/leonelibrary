"""Title and author normalisation rules (shared by every book)."""
import re
ROMAN=re.compile(r'^(?=[MDCLXVI])M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$')
NOT_ROMAN={'I','MIX','DIM','LID','MILD','CIVIL','VIVID','LIVID','DID','MID','DIVI','LIVI','MILL','ILL','MI','DI','LI','CID','VI-'}
SMALL={'of','the','and','in','on','to','a','an','at','for','with','by','or','from','as','but','nor','into','upon','de','la','le','les','du','des','der','die','das','und','von','van','el','y','e','et','di','del','da'}
WORD=re.compile(r"[^\W\d_]+(?:['’][^\W\d_]+)*")
def is_roman(w): return len(w)<=7 and bool(ROMAN.match(w)) and w not in NOT_ROMAN
def shouting(t):
    ws=[w for w in WORD.findall(t) if not is_roman(w)]
    L=''.join(ws); return len(L)>=3 and L.isupper()
def title_case(t, force=False):
    """Title Case for shouting text; mixed-case text keeps its casing except leading heading words (CHAPTER, BOOK…)."""
    if not t: return t
    sh=force or shouting(t)
    out=[]; last=0; first=True
    for m in WORD.finditer(t):
        w=m.group(0); prev=t[:m.start()].rstrip()
        seg = first or bool(re.search(r'[.:;—–!?(\[]$|--$',prev))
        nw=w
        if w.isupper() and len(w)>1 or (sh and w.isupper()):
            if is_roman(w): nw=w
            elif sh or (first and HEADW.match(w)) or NUMW.match(w):
                nw = w.lower() if (not seg and w.lower() in SMALL) else w[:1]+w[1:].lower()
        out.append(t[last:m.start()]); out.append(nw); last=m.end(); first=False
    out.append(t[last:]); return ''.join(out)
HEADW=re.compile(r'^(CHAPTER|CHAP|BOOK|PART|LETTER|STAVE|CANTO|SECTION|VOLUME|VOL|ACT|SCENE|EPILOGUE|PROLOGUE|PREFACE|INTRODUCTION|APPENDIX|CONCLUSION|NOTES?|CONTENTS|INDEX|FOREWORD|AFTERWORD|PREFATORY|DEDICATION)$')
NUMW=re.compile(r'^(ONE|TWO|THREE|FOUR|FIVE|SIX|SEVEN|EIGHT|NINE|TEN|ELEVEN|TWELVE|THIRTEEN|FOURTEEN|FIFTEEN|SIXTEEN|SEVENTEEN|EIGHTEEN|NINETEEN|TWENTY|THIRTY|FIRST|SECOND|THIRD|FOURTH|FIFTH|SIXTH|SEVENTH|EIGHTH|NINTH|TENTH|LAST|FINAL)$')
def clean_title(t, maxlen=90):
    t=re.sub(r'\s+',' ',t or '').strip()
    t=re.sub(r'^[-–—\s\[*]+|[-–—\s\]*]+$','',t)
    t=re.sub(r'\s*\{[^}]*\}\s*$','',t)            # trailing page refs {12}
    t=re.sub(r'^pg_?[0-9ivxlcdm½]+(?=[A-Z§\s])\s*','',t)   # leaked page anchor 'pg_viiiPREFACE'
    t=re.sub(r'\b([IVXLCDM]+|\d+)ToC(?=[.:\s]|$)',r'\1',t)   # glued back-to-contents link 'Chapter IToC. Colonial'
    t=re.sub(r'\s*(\[\d+\]?|\*?\(\d+\)|\*+)\s*$','',t)   # trailing footnote markers '§ 3[136', '84. *(2)'
    t=re.sub(r'(?<=\w)\s*\.\s*$','',t)              # trailing full stop
    t=re.sub(r'\s*--\s*',' — ',t)
    t=re.sub(r'\s+([.,:;])',r'\1',t)
    # casing per segment: 'Chapter II. JONATHAN HARKER’S JOURNAL—continued' -> each shouting segment in Title Case
    segs=re.split(r'(\.\s+|:\s*|;\s*|\s*—\s*|\s+–\s+)',t)
    t=''.join(x if k%2 else title_case(x, force=shouting(x)) for k,x in enumerate(segs))
    t=re.sub(r'(?<=[.:—]\s)([a-z])',lambda m:m.group(1).upper(),t)
    if len(t)>maxlen: t=t[:maxlen-1].rstrip()+'…'
    return t
def book_title(t):
    t=re.sub(r'\s*[:/;]?\s*\$[a-z]\b\s*',': ',t or '').strip(' :/;'); t=re.sub(r':\s*:',':',t)   # MARC subfield codes ': $b' leaked from catalogue records
    t=re.sub(r'\s*\r?\n\s*(Contents|Table of Contents)\s*$','',t.strip(),flags=re.I)
    t=re.sub(r'[ \t]+',' ',t).strip()
    t=re.sub(r'(?<=\S)\s+(Table of )?Contents$','',t,flags=re.I)   # TOC heading leaked into the title
    t=re.sub(r'\s*\r?\n\s*',': ',t)
    t=title_case(t, force=shouting(t))
    t=re.sub(r';\s*[Oo]r,\s*',  '; or, ', t)          # "Moby Dick; Or, The Whale" -> "; or, "
    t=re.sub(r'(?<=: )([a-z])',lambda m:m.group(1).upper(),t)
    return t
NOBLE={'graf','grafinia','kniaz','knyaz','baron','freiherr','conte','comte','marquis','duc','count','countess','vicomte','earl','viscount'}
PREFIX={'saint':'Saint','sir':'Sir','lord':'Lord','lady':'Lady','pope':'Pope','dame':'Dame','mrs.':'Mrs.','mr.':'Mr.','dr.':'Dr.','rev.':'Rev.'}
SUFFIX=re.compile(r'^(Jr\.?|Sr\.?|I{1,3}|IV|Ph\.\s?D\.?)$')
def author_name(a):
    """'Melville, Herman' -> 'Herman Melville'; 'Tolstoy, Leo, graf' -> 'Leo Tolstoy'; 'Augustine, of Hippo, Saint' -> 'Saint Augustine of Hippo'."""
    if not a: return 'Anonymous'
    a=re.sub(r'\s*\([^)]*\)','',a).strip().rstrip(',')
    a=re.sub(r'\s*\[[^\]]*\]','',a).strip()
    parts=[p.strip() for p in a.split(',') if p.strip()]
    if len(parts)==1: return title_case(parts[0]) if shouting(parts[0]) else parts[0]
    last,first,rest=parts[0],parts[1],parts[2:]
    pre=[];suf=[]
    for r in rest:
        lr=r.lower()
        if lr in NOBLE: continue
        if lr in PREFIX: pre.append(PREFIX[lr])
        elif SUFFIX.match(r): suf.append(r)
        elif lr.startswith('of ') or lr.startswith('the '): suf.append(r)
        else: pre.append(r) if r[:1].isupper() and len(r.split())==1 and lr in PREFIX else suf.append(r)
    if SUFFIX.match(first): return ' '.join([last]+[first]) # "Smith, Jr." edge
    if first.lower().startswith(('of ','the ')): name=[last,first]
    else: name=[first,last]
    out=' '.join(pre+name+suf)
    return title_case(out) if shouting(out) else out
