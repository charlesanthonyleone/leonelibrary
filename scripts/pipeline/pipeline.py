"""Leone Library import pipeline. Every book goes through the same rules:
  source (Gutenberg HTML, else plain text) -> strip PG boilerplate -> structure from headings/TOC (text patterns as fallback)
  -> scripture/volume/dedupe/size rules -> normalised titles -> versioned book JSON + regenerated catalogue counts.
Usage: python3 pipeline.py OUTDIR [--prev DIR] [--only 1,2,3]
Writes OUTDIR/books/<id>.json.gz, OUTDIR/catalog.json, OUTDIR/manifest.json, OUTDIR/report.json."""
import json,gzip,os,re,sys,hashlib,argparse,concurrent.futures as cf
sys.path.insert(0,os.path.dirname(__file__)); sys.path.insert(0,os.path.join(os.path.dirname(__file__),'..','chapters'))
from extract import from_html, from_text
from structure import drop_lists, drop_title_page, from_headings, heading_text
from chap2 import chapterize as text_chapterize, words
from scripture import is_scripture, chapterize_scripture
import post
from normalize import book_title, author_name
PIPELINE='pipeline-1'
HTML=os.environ.get('LL_HTML','/workspace/llimport/html'); RAW=os.environ.get('LL_RAW','/workspace/llimport/raw')
def build(entry,prev_dir):
    i=entry['id']; title=book_title(entry['title']); authors=entry.get('authors') or []
    author=author_name(authors[0]['name']) if authors else author_name(entry.get('author'))
    src=None; hp=f'{HTML}/{i}.html'; tp=f'{RAW}/{i}.txt'
    if os.path.exists(hp) and os.path.getsize(hp)>2000:
        bs,_=from_html(open(hp,'rb').read()); src='html'
    elif os.path.exists(tp):
        bs,_=from_text(open(tp,'rb').read().decode('utf-8','replace')); src='text'
    else: return i,{'error':'no source'},None
    bs=drop_title_page(drop_lists(bs),title,author)
    method=None; chs=None
    if src=='html':
        chs=from_headings(bs); method='headings' if chs else None
    if chs is None:
        blocks=[heading_text(b['t']) or b['t'] if b['k']=='h' else b['t'] for b in bs]
        blocks=[re.sub(r'\s*\n\s*',' ',b) for b in blocks if b]
        chs=chapterize_scripture(blocks) if is_scripture(blocks) else text_chapterize(blocks); method=(src+'-patterns')
        chs=[{'t':c['t'],'p':c['p'],'g':c.get('g')} for c in chs]
    chs,scr=post.scripture_split(chs)
    if not scr: chs=post.footnote_anchors(chs)
    if scr: method+='+scripture'
    chs=post.fold_notes(chs); chs=post.dedupe(chs); chs=post.number_groups(chs); chs=post.fold_empty(chs); chs=post.split_huge(chs); chs=post.merge_tiny_runs(chs); chs=post.finish(chs)
    src_words=sum(len(b['t'].split()) for b in bs if b['k']=='p')
    w=sum(sum(len(p.split()) for p in c['p']) for c in chs)
    rec={'id':i,'title':title,'author':author,'lang':(entry.get('lang') or ['en'])[0] if isinstance(entry.get('lang'),list) else entry.get('lang','en'),
         'words':w,'source':f'Public-domain transcription, source eBook #{i}','pipeline':PIPELINE,'method':method,'chapters':chs}
    # versioning: v = previous v + 1, remap from the previous split so saved positions move across
    prevf=f'{prev_dir}/{i}.json.gz' if prev_dir else None
    if prevf and os.path.exists(prevf):
        old=json.load(gzip.open(prevf,'rt')); rec['v']=(old.get('v') or 1)+1
        idx={}
        for ci,c in enumerate(chs):
            for pi,pp in enumerate(c['p']): idx.setdefault(pp[:60],(ci,pi))
        remap=[]
        for oc in old['chapters']:
            hit=next((idx[pp[:60]] for pp in oc['p'][:8] if pp[:60] in idx),None) or (remap[-1] if remap else (0,0))
            remap.append(list(hit))
        rec['remap']=remap
    else: rec['v']=1
    return i,rec,dict(src=src,method=method,n=len(chs),srcw=src_words,w=w)
def job(arg):
    c,prev=arg
    try: return build(c,prev)
    except Exception as e:
        import traceback; return c['id'],{'error':traceback.format_exc()[-300:]},None
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('out'); ap.add_argument('--prev'); ap.add_argument('--catalog',default='/workspace/leonelibrary/public/data/catalog.json'); ap.add_argument('--only'); ap.add_argument('-j',type=int,default=6)
    a=ap.parse_args(); os.makedirs(a.out+'/books',exist_ok=True)
    cat=json.load(open(a.catalog)); only={int(x) for x in a.only.split(',')} if a.only else None
    todo=[c for c in cat if not only or c['id'] in only]
    rep={}; man={}
    with cf.ProcessPoolExecutor(a.j) as ex:
        for i,rec,info in ex.map(job,[(c,a.prev) for c in todo],chunksize=4):
            if 'error' in rec: rep[i]=rec; print('ERROR',i,rec['error'],file=sys.stderr); continue
            data=json.dumps(rec,ensure_ascii=False,separators=(',',':')).encode()
            with gzip.open(f"{a.out}/books/{i}.json.gz",'wb',compresslevel=9) as g: g.write(data)
            man[i]={'v':rec['v'],'sha':hashlib.sha256(data).hexdigest()[:16],'chapters':len(rec['chapters']),'words':rec['words'],'title':rec['title'],'author':rec['author']}
            rep[i]=info
    # catalogue: counts/titles/authors come from the generated books, never typed in by hand
    for c in cat:
        m=man.get(c['id'])
        if not m:
            f=f"{a.out}/books/{c['id']}.json.gz"
            if not os.path.exists(f): continue
            b=json.load(gzip.open(f,'rt')); m={'chapters':len(b['chapters']),'words':b['words'],'title':b['title'],'author':b['author']}
        c['chapters']=m['chapters']; c['words']=m['words']; c['title']=m['title']; c['author']=m['author']
    json.dump(cat,open(f'{a.out}/catalog.json','w'),ensure_ascii=False,separators=(',',':'))
    old={}
    if os.path.exists(f'{a.out}/manifest.json'): old=json.load(open(f'{a.out}/manifest.json')).get('books',{})
    old.update({str(k):v for k,v in man.items()})
    json.dump({'pipeline':PIPELINE,'books':old},open(f'{a.out}/manifest.json','w'))
    json.dump({str(k):v for k,v in rep.items()},open(f'{a.out}/report.json','w'))
    from collections import Counter
    print(Counter((v or {}).get('method','error') for v in rep.values()))
if __name__=='__main__': main()
