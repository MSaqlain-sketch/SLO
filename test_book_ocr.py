import os
import pytesseract

from pdf2image import convert_from_path


# ==========================================
# CONFIG
# ==========================================

PDF_PATH = "/home/babul/Desktop/slo ai/Data/source_pdfs/computer_science_hssc_syllabus.pdf"

# PDF page numbers to test
START_PAGE = 10
END_PAGE = 12


# ==========================================
# CHECK PDF
# ==========================================

if not os.path.exists(PDF_PATH):
    raise FileNotFoundError(
        f"PDF not found: {PDF_PATH}"
    )


print("PDF found successfully!")
print(f"Testing pages {START_PAGE} to {END_PAGE}...")


# ==========================================
# CONVERT PDF PAGES TO IMAGES
# ==========================================

pages = convert_from_path(
    PDF_PATH,
    dpi=250,
    first_page=START_PAGE,
    last_page=END_PAGE
)


print("Pages converted to images:", len(pages))


# ==========================================
# OCR
# ==========================================

for index, image in enumerate(pages):

    page_number = START_PAGE + index

    print("\n" + "=" * 60)
    print(f"PAGE {page_number}")
    print("=" * 60)

    text = pytesseract.image_to_string(
        image,
        lang="eng",
        config="--psm 6"
    )

    print(text)

    print(
        "\nCharacters extracted:",
        len(text)
    )