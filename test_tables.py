import pdfplumber

PDF_PATH = "source_pdfs/computer_science_hssc_syllabus.pdf"

with pdfplumber.open(PDF_PATH) as pdf:

    print("Total pages:", len(pdf.pages))

    # Grade XII SLO section ki ek page test
    page = pdf.pages[27]

    tables = page.extract_tables()

    print("Tables found:", len(tables))

    for table_number, table in enumerate(tables):

        print(f"\n--- TABLE {table_number + 1} ---")

        for row in table:
            print(row)