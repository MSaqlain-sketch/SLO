import subprocess, os, json

def git(*args):
    r = subprocess.run(['git']+list(args), capture_output=True, text=True, errors='replace')
    return (r.stdout or '') + (r.stderr or '')

print('=== .gitignore ===')
print(open('.gitignore').read())

print()
print('=== root files of interest ===')
for p in ['package.json','docker-compose.yml','docker-compose.yaml','supabase/config.toml','run.sh','start.sh','backend/requirements.txt']:
    print(' ', p, 'EXISTS' if os.path.exists(p) else 'missing')

print()
print('=== files mentioning 54321/uvicorn/backend.main/NEXT_PUBLIC_LOCAL_API_URL ===')
hits=[]
for root,dirs,files in os.walk('.'):
    dirs[:] = [d for d in dirs if d not in ('node_modules','.git','__pycache__','data/rag_index','data/data')]
    for f in files:
        p=os.path.join(root,f)
        try:
            with open(p,encoding='utf-8',errors='ignore') as fh:
                t=fh.read()
        except Exception:
            continue
        if '54321' in t or 'uvicorn' in t or 'backend.main' in t or 'NEXT_PUBLIC_LOCAL_API_URL' in t:
            hits.append(p)
for h in hits: print('   ', h)