import tarfile,re,json
out={}
with tarfile.open('/workspace/llimport/rdf.tar.bz2','r|bz2') as t:
    for m in t:
        if not m.name.endswith('.rdf'): continue
        s=t.extractfile(m).read().decode('utf-8','replace')
        i=re.search(r'ebooks/(\d+)"',s)
        if not i: continue
        ag=re.findall(r'<pgterms:agent rdf:about="\d+/agents/(\d+)">\s*.*?<pgterms:name>(.*?)</pgterms:name>',s,re.S)
        if ag: out[int(i.group(1))]=ag
json.dump(out,open('ebook_agents.json','w'))
print(len(out))
