#!/usr/bin/env python3
"""Download pinned demo SQL scripts. This does not connect to or change any database."""
import argparse, hashlib, json, pathlib, urllib.request
root=pathlib.Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out', type=pathlib.Path, required=True)
args=parser.parse_args()
args.out.mkdir(parents=True,exist_ok=True)
for source in json.loads((root/'public-data.lock.json').read_text())['sources']:
    target=args.out/(source['id']+'.sql')
    if target.exists(): raise SystemExit('Refusing to overwrite '+str(target))
    data=urllib.request.urlopen(source['url'], timeout=90).read()
    if hashlib.sha256(data).hexdigest()!=source['sha256']: raise SystemExit('Source integrity mismatch')
    target.write_bytes(data)
print('Downloaded verified scripts. Read their licence notices and review SQL before loading into a dedicated empty demo database.')
