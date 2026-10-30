import subprocess, os, json

def git(*args):
    r = subprocess.run(['git']+list(args), capture_output=True, text=True, errors='replace')
    return (r.stdout or '') + (r.stderr or '')

print('=== git log for supabase SQL files ===')
print(git('log','--oneline','--','supabase/remote_data.sql','supabase/slos.csv','supabase/migrations')[:800])

print()
print('=== files in HEAD supabase/ ===')
print(git('ls-tree','-r','HEAD','--name-only','supabase/')[:800])

print()
print('=== committed study-workspace.tsx: does it have an SLO/slos view? ===')
out = git('show','HEAD:frontend/components/study-workspace.tsx')
print('  total lines:', len(out.splitlines()))
for i, line in enumerate(out.splitlines(), 1):
    if any(k in line for k in ['Explore Your Syllabus','selectedSloGrade','selectedSloSubject','closeSLOs','SLO_SUBJECTS','/slos','sloList']):
        print('   L%d: %s' % (i, line.strip()[:100]))

print()
print('=== committed import_slos_to_supabase.py (first 30 lines) ===')
out2 = git('show','HEAD:import_slos_to_supabase.py')
print('\n'.join(out2.splitlines()[:30]))

print()
print('=== committed data/grade_12_slos.json: first record ===')
out3 = git('show','HEAD:data/grade_12_slos.json')
d = json.loads(out3)
print('  len:', len(d), 'first:', json.dumps(d[0])[:120])

print()
print('=== committed data/grade_12_slos.backup.json ===')
out4 = git('show','HEAD:data/grade_12_slos.backup.json')
d4 = json.loads(out4)
print('  len:', len(d4))