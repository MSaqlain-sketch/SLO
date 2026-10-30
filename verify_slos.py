import json, re
from collections import Counter

SLO_RE = re.compile(r'\b(\d+\.\d+\.\d+)\b')
COG_RE = re.compile(r'\s+\d*[RUAEC]{1,3}(?:FA\d?)?\s*$')
FA_RE = re.compile(r'\s+FA\d?\s*$')

def norm(s):
    s = s.replace('\n', ' ')
    s = re.sub(r'\s+', ' ', s)
    s = s.replace('\uf03d', '=').replace('\uf022', '').replace('\uf0ce', '<=').replace('\uf0b9', '>')
    s = COG_RE.sub('', s)
    s = FA_RE.sub('', s)
    s = s.strip()
    s = (s.replace('\u221a', 'sqrt').replace('\u03b8', 'theta')
           .replace('\u2013', '-').replace('\u2014', '-')
           .replace('\u00b0', 'deg'))
    s = re.sub(r'\s+([.;,:])', r'\1', s)
    return s.strip()

def extract(path, lo, hi):
    import pdfplumber
    recs = []
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ''
            if not text:
                continue
            matches = list(SLO_RE.finditer(text))
            for idx, m in enumerate(matches):
                code = m.group(1)
                chap = int(code.split('.')[0])
                if not (lo <= chap <= hi):
                    continue
                start = m.end()
                end = matches[idx+1].start() if idx+1 < len(matches) else len(text)
                raw = text[start:end]
                stmt = norm(raw)
                if not stmt:
                    continue
                recs.append({'slo_code': code, 'statement': stmt, 'page': page_no})
    seen = {}
    for r in recs:
        seen.setdefault(r['slo_code'], r)
    return list(seen.values())

def compare(pdf_recs, json_path, grade, subject):
    with open(json_path, encoding='latin-1') as f:
        jdata = json.load(f)
    pmap = {r['slo_code']: r for r in pdf_recs}
    jmap = {r['slo_code']: r for r in jdata}
    out = []
    out.append('\n=== %s Grade %s ===' % (subject, grade))
    out.append('  PDF codes=%d  JSON codes=%d' % (len(pmap), len(jmap)))
    only_p = sorted(set(pmap)-set(jmap), key=lambda c:[int(x) for x in c.split('.')])
    only_j = sorted(set(jmap)-set(pmap), key=lambda c:[int(x) for x in c.split('.')])
    out.append('  ONLY in PDF (missing from JSON): %s' % (only_p or 'none'))
    out.append('  ONLY in JSON (extra): %s' % (only_j or 'none'))
    diffs = []
    for code in sorted(set(pmap)&set(jmap), key=lambda c:[int(x) for x in c.split('.')]):
        a, b = norm(pmap[code]['statement']), norm(jmap[code]['statement'])
        if a != b:
            diffs.append((code, a, b))
    out.append('  Normalized statement diffs: %d' % len(diffs))
    for code, a, b in diffs[:12]:
        out.append('    %s:' % code)
        out.append('      PDF : %r' % a[:160])
        out.append('      JSON: %r' % b[:160])
    chd = [(c, jmap[c]['chapter'], int(c.split('.')[0]))
           for c in sorted(set(pmap)&set(jmap), key=lambda c:[int(x) for x in c.split('.')])
           if jmap[c]['chapter'] != int(c.split('.')[0])]
    out.append('  Chapter mismatches: %s' % (chd or 'none'))
    jorder = [r['slo_code'] for r in jdata]
    porder = [r['slo_code'] for r in pdf_recs]
    out.append('  JSON order == PDF order: %s' % (jorder == porder))
    pc = Counter(int(c.split('.')[0]) for c in pmap)
    jc = Counter(r['chapter'] for r in jdata)
    out.append('  Per-chapter PDF : %s' % dict(sorted(pc.items())))
    out.append('  Per-chapter JSON: %s' % dict(sorted(jc.items())))
    return '\n'.join(out)

if __name__ == '__main__':
    jobs = [
        ('source_pdfs/Mathematics HSSC I Syllabus 2025_.pdf', 'data/grade_11_mathematics_slos.json', 1, 11, 'Mathematics'),
        ('source_pdfs/Mathematics HSSC I Syllabus 2025_.pdf', 'data/grade_12_mathematics_slos.json', 12, 23, 'Mathematics'),
        ('source_pdfs/physics-hssc-i-syllabus-2025.pdf', 'data/grade_11_physics_slos.json', 1, 10, 'Physics'),
        ('source_pdfs/physics-hssc-i-syllabus-2025.pdf', 'data/grade_12_physics_slos.json', 11, 20, 'Physics'),
        ('source_pdfs/Statistics HSSC I Syllabus.pdf', 'data/grade_11_statistics_slos.json', 1, 7, 'Statistics'),
        ('source_pdfs/Statistics HSSC I Syllabus.pdf', 'data/grade_12_statistics_slos.json', 8, 14, 'Statistics'),
    ]
    with open('verify_out.txt', 'w', encoding='utf-8') as f:
        for pdf, js, lo, hi, subj in jobs:
            recs = extract(pdf, lo, hi)
            f.write(compare(recs, js, lo, subj))
            f.write('\n')
    print('done')