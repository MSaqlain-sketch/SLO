import subprocess, os, json

def git(*args):
    r = subprocess.run(['git']+list(args), capture_output=True, text=True, errors='replace')
    return (r.stdout or '') + (r.stderr or '')

out = git('show','HEAD:frontend/components/study-workspace.tsx')
with open('committed_sw.txt','w',encoding='utf-8',errors='replace') as f:
    f.write(out)

out2 = git('show','HEAD:frontend/.env.development')
with open('committed_env.txt','w',encoding='utf-8',errors='replace') as f:
    f.write(out2)

print('=== committed .env.development ===')
print(out2[:1000])
print()
print('=== working .env.development ===')
p='frontend/.env.development'
print(open(p).read()[:1000] if os.path.exists(p) else 'MISSING')
print()
print('=== backend endpoints ===')
src=open('backend/main.py').read()
import re
for m in re.finditer(r'@app\.(get|post)\("([^"]+)"', src):
    print('  ', m.group(2))
print()
print('=== frontend package.json scripts ===')
pj=json.load(open('frontend/package.json'))
print(json.dumps(pj.get('scripts',{}), indent=2))