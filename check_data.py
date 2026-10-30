import subprocess, json, os

def git(*args):
    r = subprocess.run(['git']+list(args), capture_output=True, text=True, errors='replace')
    return (r.stdout or '') + (r.stderr or '')

# What data files are tracked in HEAD?
print('=== Tracked data/*.json in HEAD ===')
out = git('ls-tree','-r','HEAD','--name-only')
for line in out.splitlines():
    if 'data/' in line and line.endswith('.json'):
        print('  ', line)

print()
print('=== Is data/grade_12_slos.json tracked? size in HEAD ===')
out = git('show','HEAD:data/grade_12_slos.json')
try:
    d = json.loads(out)
    print('  HEAD grade_12_slos.json: type=%s len=%s' % (type(d).__name__, len(d) if isinstance(d,list) else 'dict'))
except Exception as e:
    print('  parse error:', str(e)[:100], '| first 80 chars:', out[:80])

print()
print('=== Working tree data/grade_12_slos.json ===')
p='data/grade_12_slos.json'
raw = open(p, encoding='utf-8').read()
print('  size=%d bytes, content=%r' % (len(raw), raw[:80]))
try:
    d = json.loads(raw)
    print('  parsed: type=%s len=%s' % (type(d).__name__, len(d) if isinstance(d,list) else list(d.keys())))
except Exception as e:
    print('  parse error:', str(e)[:100])

print()
print('=== Working tree data/grade_12_slos.backup.json ===')
p2='data/grade_12_slos.backup.json'
raw2 = open(p2, encoding='utf-8').read()
d2 = json.loads(raw2)
print('  len=%d, first slo_code=%s' % (len(d2), d2[0].get('slo_code') if d2 else None))