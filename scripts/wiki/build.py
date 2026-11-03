"""Build public/data/authors.json and public/data/descriptions.json from English Wikipedia lead summaries (CC BY-SA 4.0).
Matching is exact, never by guess: authors through their Project Gutenberg agent id (Wikidata P1938, agent ids read from
the Gutenberg RDF), books through their Gutenberg ebook number (Wikidata P2034). Disambiguation pages and empty extracts are dropped.
Inputs (made by the wd/ helpers in the staging dir): authormap.json {PG name: {qid, wp}}, works.csv (SPARQL), sumcache.json (REST summaries).
Usage: python3 scripts/wiki/build.py STAGEDIR"""
import json,csv,sys,urllib.parse
st=sys.argv[1]; cat=json.load(open('public/data/catalog.json'))
S=json.load(open(f'{st}/sumcache.json')); am=json.load(open(f'{st}/authormap.json'))
def rec(url,qid):
    s=S.get(url)
    if not s or s.get('type')!='standard' or not (s.get('extract') or '').strip(): return None
    page=(s.get('content_urls') or {}).get('desktop',{}).get('page') or url
    return {'text':s['extract'].strip(),'desc':s.get('description') or '','title':s.get('title') or urllib.parse.unquote(url.rsplit('/',1)[1]).replace('_',' '),'url':page,'qid':qid}
names={a['name'] for c in cat for a in c['authors']}
A={n:r for n in sorted(names) if n in am and (r:=rec(am[n]['wp'],am[n]['qid']))}
ids={c['id'] for c in cat}; W={}
for r in csv.DictReader(open(f'{st}/works.csv')):
    g=int(r['gid'])
    if g in ids and r['art']: W.setdefault(g,set()).add((r['art'],r['item'].rsplit('/',1)[1]))
D={}
for g,v in sorted(W.items()):
    if len({a for a,_ in v})!=1: continue  # more than one article claims this ebook: skip rather than guess
    a,q=sorted(v)[0]; r=rec(a,q)
    if r: D[str(g)]=r
for f,o in (('authors',A),('descriptions',D)):
    json.dump(o,open(f'public/data/{f}.json','w'),ensure_ascii=False,separators=(',',':'))
print('authors',len(A),'of',len(names),'descriptions',len(D),'of',len(ids))
