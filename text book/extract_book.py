import pdfplumber
import os


# ==========================================
# CONFIG
# ==========================================

PDF_PATH = "/home/babul/Desktop/slo ai/Data/text book/12 Computer Science Book FBISE (Study++).pdf"
OUTPUT_PATH = "data/grade_12_book_text.txt"


# ==========================================
# CHECK PDF
# ==========================================

if not os.path.exists(PDF_PATH):
    raise FileNotFoundError(
        f"Book PDF not found: {PDF_PATH}"
    )


# ==========================================
# EXTRACT TEXT
# ==========================================

all_pages = []

with pdfplumber.open(PDF_PATH) as pdf:

    total_pages = len(pdf.pages)

    print("PDF loaded successfully!")
    print("Total pages:", total_pages)

    for page_number, page in enumerate(pdf.pages, start=1):

        print(
            f"Extracting page {page_number}/{total_pages}..."
        )

        text = page.extract_text()

        if not text:
            text = ""

        all_pages.append({
            "page": page_number,
            "text": text
        })


# ==========================================
# STATISTICS
# ==========================================

total_characters = sum(
    len(page["text"])
    for page in all_pages
)

pages_with_text = sum(
    1
    for page in all_pages
    if page["text"].strip()
)

empty_pages = total_pages - pages_with_text


print("\n" + "=" * 60)
print("EXTRACTION SUMMARY")
print("=" * 60)

print("Total pages:", total_pages)
print("Pages with text:", pages_with_text)
print("Empty pages:", empty_pages)
print("Total characters:", total_characters)


# ==========================================
# SAVE EXTRACTED TEXT
# ==========================================

os.makedirs("data", exist_ok=True)

with open(
    OUTPUT_PATH,
    "w",
    encoding="utf-8"
) as file:

    for page in all_pages:

        file.write(
            f"\n\n===== PAGE {page['page']} =====\n\n"
        )

        file.write(page["text"])


print("\nExtracted text saved to:")
print(OUTPUT_PATH)


# ==========================================
# SHOW SAMPLE
# ==========================================

print("\n" + "=" * 60)
print("TEXT SAMPLE")
print("=" * 60)

shown = 0

for page in all_pages:

    if page["text"].strip():

        print(f"\nPAGE {page['page']}:\n")

        print(page["text"][:1500])

        shown += 1

        if shown == 2:
            break