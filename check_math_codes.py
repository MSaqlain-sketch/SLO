"""Check whether the 'extra' Math codes exist in the PDF text with spacing quirks."""
import re

SLO_RE = re.compile(r'\b(\d+\.\d+\s*\.\d+)\b')

def find_all(path, codes_to_find):
    import pdfplumber
    found = {}
    with pdfplumber.open(path) as pdf:
        for page_no, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ''
            for m in SLO_RE.finditer(text):
                raw = m.group(1)
                compact = re.sub(r'\s+', '', raw)
                if compact in codes_to_find:
                    found.setdefault(compact, []).append((page_no, raw))
    return found

math_pdf = 'source_pdfs/Mathematics HSSC I Syllabus 2025_.pdf'
targets = ['1.3.3','1.4.3','4.1.3','5.2.3','5.2.6','14.3.1','14.5.1','14.5.2']
res = find_all(math_pdf, targets)
for c in targets:
    print('%s -> %s' % (c, res.get(c, 'NOT FOUND')))

# Also count total with the relaxed regex
all_codes = set()
with pdfplumber.open(math_pdf) as pdf:
    for page in pdf.pages:
        text = page.extract_text() or ''
        for m in SLO_RE.finditer(text):
            all_codes.add(re.sub(r'\s+', '', m.group(1)))
xi = sorted(c for c in all_codes if 1 <= int(c.split('.')[0]) <= 11, key=lambda c:[int(x) for x in c.split('.')])
xii = sorted(c for c in all_codes if 12 <= int(c.split('.')[0]) <= 23, key=lambda c:[int(x) for x in c.split('.')])
print('\nTotal unique codes (relaxed regex):', len(all_codes))
print('XI codes:', len(xi))
print('XII codes:', len(xii))