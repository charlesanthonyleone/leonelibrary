import json,csv,time,urllib.request,urllib.parse,os,sys
UA='LeoneLibrary/1.0 (https://library.leoneuniversity.org; charlesanthonyleone@users.noreply.github.com)'
def summ(url):
    t=url.split('/wiki/',1)[1]
    req=urllib.request.Request('https://en.wikipedia.org/api/rest_v1/page/summary/'+t,headers={'User-Agent':UA})
    for k in range(3):
        try: return json.load(urllib.request.urlopen(req,timeout=20))
        except urllib.error.HTTPError as e:
            if e.code==404: return None
            time.sleep(5)
        except Exception: time.sleep(5)
cache=json.load(open('sumcache.json')) if os.path.exists('sumcache.json') else {}
am=json.load(open('authormap.json'))
cat=json.load(open('/workspace/ll-gut1/public/data/catalog.json'))
b=json.load(open('/workspace/ll-cat-stage/beyond-candidates.json'))
ids={c['id'] for c in cat+b}
urls=[v['wp'] for v in am.values()]
for r in csv.DictReader(open('works.csv')):
    if r['art'] and int(r['gid']) in ids: urls.append(r['art'])
urls=list(dict.fromkeys(urls)); print(len(urls),flush=True)
for n,u in enumerate(urls):
    if u in cache: continue
    s=summ(u); cache[u]=s and {k:s.get(k) for k in ('title','type','description','extract','content_urls','titles')}
    print(n,u,bool(s),flush=True)
    if n%100==0: json.dump(cache,open('sumcache.json','w')); print(n,flush=True)
    time.sleep(0.25)
json.dump(cache,open('sumcache.json','w')); print('done')
