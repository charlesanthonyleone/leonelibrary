"""Re-split every hosted book with chap2 and write to OUT (staging). Keeps text identical: every cleaned block
ends up as a paragraph or a chapter/group title. Adds 'v':2 and 'remap' (old chapter index -> [new chapter, para])
so saved reading positions and bookmarks from the old split still land in the right place."""
import json,gzip,os,sys,re,concurrent.futures as cf
sys.path.insert(0,'/workspace/llimport'); sys.path.insert(0,os.path.dirname(__file__))
from imp import clean
from chap2 import chapterize,words
from scripture import is_scripture,chapterize_scripture
SRC=sys.argv[1]; OUT=sys.argv[2]; ONLY={int(x) for x in sys.argv[3].split(',')} if len(sys.argv)>3 else set()  # ONLY: re-split already-v2 books (v bumps, remap from previous version); RAW='/workspace/llimport/raw'
os.makedirs(OUT,exist_ok=True)
def one(f):
    old=json.load(gzip.open(f'{SRC}/{f}','rt')); i=old['id']
    if ONLY and i not in ONLY: return i,'skip',None
    if old.get('v') and not ONLY: return i,'already',None
    # rebuild the exact block stream the old splitter consumed: headings + paragraphs, in order
    blocks=[]
    for c in old['chapters']:
        if c['t']!='Opening' and not re.fullmatch(r'Part \d+',c['t']): blocks.append(c['t'])
        blocks+=c['p']
    chs=chapterize_scripture(blocks) if is_scripture(blocks) else chapterize(blocks)
    # text check: paragraphs+titles must account for all blocks (titles are normalised so count, not compare)
    np_=sum(len(c['p']) for c in chs); nt=len(chs)+len({c.get('g') for c in chs if c.get('g')})
    wb=sum(len(b.split()) for b in blocks); wo=sum(sum(len(p.split()) for p in c['p'])+len(c['t'].split()) for c in chs)+sum(len(g.split()) for g in {c.get('g') for c in chs if c.get('g')})
    if wo<wb*0.995: return i,'lost',(wo,wb)
    # remap old chapter starts
    idx={}
    for ci,c in enumerate(chs):
        for pi,pp in enumerate(c['p']): idx.setdefault(pp[:60],(ci,pi))
    remap=[]
    for oc in old['chapters']:
        hit=next((idx[pp[:60]] for pp in oc['p'][:5] if pp[:60] in idx),None) or (remap[-1] if remap else [0,0])
        remap.append(list(hit))
    rec={**{k:v for k,v in old.items() if k!='chapters'},'v':(old.get('v') or 1)+1,'chapters':chs,'remap':remap}
    with gzip.open(f'{OUT}/{f}','wt',compresslevel=9) as g: json.dump(rec,g,ensure_ascii=False,separators=(',',':'))
    w=[words(c['p']) for c in chs]
    return i,'ok',dict(n=len(chs),old=len(old['chapters']),max=max(w),oldmax=max(words(c['p']) for c in old['chapters']),groups=len({c.get('g') for c in chs if c.get('g')}),parts=all(c['t'].startswith('Part ') for c in chs))
if __name__=='__main__':
    fs=sorted(os.listdir(SRC)); res={}
    with cf.ProcessPoolExecutor(6) as ex:
        for i,s,d in ex.map(one,fs,chunksize=8): res[i]=(s,d)
    json.dump(res,open(f'{OUT}/../rebuild-report.json','w'))
    from collections import Counter
    print(Counter(s for s,_ in res.values()))
    ok=[d for s,d in res.values() if s=='ok']
    print('fallback v2',sum(d['parts'] for d in ok),'huge>40k v1',sum(d['oldmax']>40000 for d in ok),'v2',sum(d['max']>40000 for d in ok),'grouped',sum(d['groups']>0 for d in ok))
