"""Inspect raw text of Math PDF pages, writing sanitized UTF-8 output."""
import pdfplumber, unicodedata

path = 'source_pdfs/Mathematics HSSC I Syllabus 2025_.pdf'

def clean(s):
    # Replace private-use and non-printable chars with a marker
    out = []
    for ch in s:
        o = ord(ch)
        if 0xE000 <= o <= 0xF8FF or o < 32 and ch not in '\n\r\t':
            out.append('<glyph>')
        else:
            out.append(ch)
    return ''.join(out)

with pdfplumber.open(path) as pdf:
    with open('math_inspect.txt', 'w', encoding='utf-8') as out:
        for i in [9, 10, 11, 27, 28, 29]:
            if i >= len(pdf.pages):
                continue
            p = pdf.pages[i]
            t = p.extract_text() or ''
            out.write('\n===== PAGE %d =====\n' % (i+1))
            out.write(clean(t[:1600]))
            out.write('\n')
print('done')