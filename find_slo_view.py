import subprocess

def git(*args):
    r = subprocess.run(['git']+list(args), capture_output=True, text=True, errors='replace')
    return (r.stdout or '') + (r.stderr or '')

out = git('show','HEAD:frontend/components/study-workspace.tsx')
lines = out.splitlines()
print('committed total lines:', len(lines))
# Find SLO-related markers
for i, line in enumerate(lines, 1):
    if any(k in line for k in ['Explore Your Syllabus','selectedSloGrade','selectedSloSubject','sloList','SLOs(','loadSlos','fetchSlos','/slos','closeSLOs','openSLOs','sloSubject','SLO_SUBJECTS']):
        print(i, line.strip()[:110])