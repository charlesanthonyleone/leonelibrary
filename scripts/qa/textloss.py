#!/usr/bin/env python3
"""Text-preservation check between two book dirs: share of old paragraph text (>200 letters) not found in the new book.
Usage: textloss.py OLD_DIR NEW_DIR IDS [threshold]"""
import json,gzip,re,sys
O,Nw,ids=sys.argv[1:4]; th=float(sys.argv[4]) if len(sys.argv)>4 else 0.02
N=lambda s:re.sub(r'[\W\d_]','',re.sub(r'\{[^}]*\}|\[[^\]]*\]','',s.lower()))
bad=0
for i in ids.split(','):
    a=json.load(gzip.open(f'{O}/{i}.json.gz')); b=json.load(gzip.open(f'{Nw}/{i}.json.gz'))
    T=N(''.join(p for c in b['chapters'] for p in c['p']))
    lost=[(c['t'],p) for c in a['chapters'] for p in c['p'] if len(N(p))>200 and N(p)[40:100] not in T]
    A=len(N(''.join(p for c in a['chapters'] for p in c['p']))) or 1; L=sum(len(N(p)) for _,p in lost)
    if L/A>th: bad+=1; print(i,round(L/A,3),len(lost),lost[0][0][:25],'|',lost[0][1][:110])
print('books over threshold:',bad)
