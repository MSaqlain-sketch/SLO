import json
import os


import re
import pdfplumber


# ============================================================
# CONFIG
# ============================================================

PDF_PATH = "source_pdfs/computer_science_hssc_syllabus.pdf"

# Example:
# 9.1.1
# 11.12.2
# 16.1.7
SLO_PATTERN = re.compile(r"\b\d+\.\d+\.\d+\b")


# SLO statements normally start with one of these action verbs
ACTION_VERBS = (
    "define",
    "describe",
    "explain",
    "differentiate",
    "compare",
    "analyse",
    "analyze",
    "apply",
    "write",
    "evaluate",
    "design",
    "use",
    "illustrate",
    "construct",
    "identify",
    "demonstrate",
    "develop",
    "discuss",
    "calculate",
    "create"
)


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def clean_text(text):
    """
    Extra spaces/newlines remove karta hai.
    """

    if not text:
        return ""

    text = text.replace("\n", " ")
    text = re.sub(r"\s+", " ", text)

    return text.strip()


def get_grade(code):
    """
    SLO code se grade identify karo.

    Chapters 1-8   = Grade XI
    Chapters 9-16  = Grade XII
    """

    chapter = int(code.split(".")[0])

    if 1 <= chapter <= 8:
        return "XI"

    if 9 <= chapter <= 16:
        return "XII"

    return None


def recover_statements_from_page(page, codes):
    """
    Agar PDF table extraction statement ko miss kar de,
    to raw page text se exact SLO code ke baad statement
    recover karo.

    Example:

    11.12.1 explain the process of connecting a database
    with Python; *

    11.12.2 write a program to connect a database
    with Python. A
    """

    text = page.extract_text()

    if not text:
        return []

    recovered = []

    for code in codes:

        pattern = re.compile(
            rf"\b{re.escape(code)}\s+(.+?)(?=\s+\*|\s+A(?:\s|$)|\n|$)"
        )

        match = pattern.search(text)

        if not match:
            return []

        statement = clean_text(match.group(1))

        if not statement:
            return []

        recovered.append(statement)

    return recovered


# ============================================================
# STORAGE
# ============================================================

all_records = []
problem_rows = []


# ============================================================
# OPEN PDF
# ============================================================

with pdfplumber.open(PDF_PATH) as pdf:

    total_pages = len(pdf.pages)

    print("Total pages:", total_pages)

    # ========================================================
    # PROCESS EVERY PAGE
    # ========================================================

    for page_number, page in enumerate(pdf.pages, start=1):

        print(
            f"Processing page "
            f"{page_number}/{total_pages}..."
        )

        tables = page.extract_tables()

        # ====================================================
        # PROCESS TABLES
        # ====================================================

        for table in tables:

            for row in table:

                if not row:
                    continue

                # None cells -> empty strings
                cells = [
                    cell.strip() if cell else ""
                    for cell in row
                ]

                # ============================================
                # FIND CELL CONTAINING SLO CODES
                # ============================================

                code_cell_index = None
                codes = []

                for index, cell in enumerate(cells):

                    found = SLO_PATTERN.findall(cell)

                    if found:

                        code_cell_index = index
                        codes = found

                        break

                if not codes:
                    continue

                # ============================================
                # CURRENT PROJECT = GRADE XII ONLY
                # ============================================

                grade_12_codes = [
                    code
                    for code in codes
                    if get_grade(code) == "XII"
                ]

                if not grade_12_codes:
                    continue

                # ============================================
                # FIND STATEMENT CELL
                # ============================================

                statement_block = ""

                # SLO code cell ke baad wale cells scan karo.
                #
                # PDF kabhi empty columns insert karta hai,
                # isliye simply code_cell_index + 1 use
                # nahi karenge.

                for i in range(
                    code_cell_index + 1,
                    len(cells)
                ):

                    candidate = cells[i].strip()

                    if not candidate:
                        continue

                    words = candidate.split()

                    if not words:
                        continue

                    first_word = words[0].lower()

                    if first_word in ACTION_VERBS:

                        statement_block = candidate

                        break

                # ============================================
                # FALLBACK:
                # TABLE DID NOT PROVIDE STATEMENT
                # ============================================

                if not statement_block:

                    recovered_statements = (
                        recover_statements_from_page(
                            page,
                            grade_12_codes
                        )
                    )

                    # If fallback successfully recovered
                    # every SLO statement
                    if (
                        len(recovered_statements)
                        == len(grade_12_codes)
                    ):

                        for code, statement in zip(
                            grade_12_codes,
                            recovered_statements
                        ):

                            all_records.append({
                                "grade": "XII",
                                "chapter": int(
                                    code.split(".")[0]
                                ),
                                "topic": ".".join(
                                    code.split(".")[:2]
                                ),
                                "slo_code": code,
                                "statement": statement,
                                "page": page_number
                            })

                    else:

                        problem_rows.append({
                            "page": page_number,
                            "codes": grade_12_codes,
                            "raw_cells": cells,
                            "reason": (
                                "No statement block and "
                                "page-text fallback failed"
                            )
                        })

                    # This row is finished
                    continue

                # ============================================
                # SPLIT STATEMENT BLOCK INTO LINES
                # ============================================

                statement_lines = [
                    line.strip()
                    for line
                    in statement_block.split("\n")
                    if line.strip()
                ]

                # ============================================
                # SMART SLO STATEMENT SPLITTING
                # ============================================

                statements = []
                current = []

                for line in statement_lines:

                    cleaned_line = line.strip()

                    if not cleaned_line:
                        continue

                    words = cleaned_line.split()

                    if not words:
                        continue

                    first_word = words[0].lower()

                    # ----------------------------------------
                    # New action verb = new SLO
                    # ----------------------------------------

                    if first_word in ACTION_VERBS:

                        # Save previous statement first
                        if current:

                            statements.append(
                                clean_text(
                                    " ".join(current)
                                )
                            )

                        # Start new statement
                        current = [cleaned_line]

                    else:

                        # ------------------------------------
                        # Not an action verb:
                        #
                        # a. list
                        # b. array
                        # c. tree
                        #
                        # etc.
                        #
                        # These belong to previous SLO.
                        # ------------------------------------

                        current.append(cleaned_line)

                # Save final statement
                if current:

                    statements.append(
                        clean_text(
                            " ".join(current)
                        )
                    )

                # ============================================
                # NORMAL CODE ↔ STATEMENT MAPPING
                # ============================================

                if (
                    len(statements)
                    == len(grade_12_codes)
                ):

                    for code, statement in zip(
                        grade_12_codes,
                        statements
                    ):

                        all_records.append({
                            "grade": "XII",
                            "chapter": int(
                                code.split(".")[0]
                            ),
                            "topic": ".".join(
                                code.split(".")[:2]
                            ),
                            "slo_code": code,
                            "statement": statement,
                            "page": page_number
                        })

                # ============================================
                # TABLE SPLITTING FAILED
                # TRY PAGE-TEXT FALLBACK
                # ============================================

                else:

                    recovered_statements = (
                        recover_statements_from_page(
                            page,
                            grade_12_codes
                        )
                    )

                    if (
                        len(recovered_statements)
                        == len(grade_12_codes)
                    ):

                        for code, statement in zip(
                            grade_12_codes,
                            recovered_statements
                        ):

                            all_records.append({
                                "grade": "XII",
                                "chapter": int(
                                    code.split(".")[0]
                                ),
                                "topic": ".".join(
                                    code.split(".")[:2]
                                ),
                                "slo_code": code,
                                "statement": statement,
                                "page": page_number
                            })

                    else:

                        problem_rows.append({
                            "page": page_number,
                            "codes": grade_12_codes,
                            "statements_found": statements,
                            "raw_cells": cells,
                            "reason": (
                                f"{len(grade_12_codes)} "
                                f"codes but "
                                f"{len(statements)} "
                                f"statements; "
                                f"page-text fallback "
                                f"also failed"
                            )
                        })


# ============================================================
# REMOVE EXACT DUPLICATE SLO CODES
# ============================================================

unique_records = {}

for record in all_records:

    code = record["slo_code"]

    if code not in unique_records:
        unique_records[code] = record


all_records = list(unique_records.values())


# ============================================================
# SORT RECORDS NUMERICALLY
# ============================================================

def slo_sort_key(record):

    return tuple(
        int(part)
        for part in record["slo_code"].split(".")
    )


all_records.sort(key=slo_sort_key)


# ============================================================
# PRINT SUCCESSFULLY MAPPED SLOs
# ============================================================

print("\n")
print("=" * 60)
print("SUCCESSFULLY MAPPED")
print("=" * 60)


for record in all_records:

    print(
        f"\n[OK] {record['slo_code']}"
    )

    print(
        record["statement"]
    )


# ============================================================
# PRINT PROBLEM ROWS
# ============================================================

print("\n")
print("=" * 60)
print("ROWS NEEDING REVIEW")
print("=" * 60)


if not problem_rows:

    print("\nNone")

else:

    for problem in problem_rows:

        print(
            "\nPage:",
            problem["page"]
        )

        print(
            "Codes:",
            problem["codes"]
        )

        print(
            "Reason:",
            problem["reason"]
        )

        if "raw_cells" in problem:

            print("\nRAW PDF CELLS:")

            for index, cell in enumerate(
                problem["raw_cells"]
            ):

                if cell:

                    print(
                        f"\nCELL {index}:"
                    )

                    print(cell)

        if "statements_found" in problem:

            print(
                "\nDETECTED STATEMENTS:"
            )

            for index, statement in enumerate(
                problem["statements_found"],
                start=1
            ):

                print(
                    f"{index}. {statement}"
                )

        print(
            "\n" + "-" * 60
        )


# ============================================================
# VALIDATION
# ============================================================

mapped_codes = [
    record["slo_code"]
    for record in all_records
]

unique_mapped_codes = set(
    mapped_codes
)

duplicate_count = (
    len(mapped_codes)
    - len(unique_mapped_codes)
)


EXPECTED_GRADE_12_SLOS = 103

missing_count = (
    EXPECTED_GRADE_12_SLOS
    - len(unique_mapped_codes)
)


print("\n")
print("=" * 60)
print("VALIDATION")
print("=" * 60)

print(
    "Successfully mapped:",
    len(all_records)
)

print(
    "Unique mapped codes:",
    len(unique_mapped_codes)
)

print(
    "Duplicate mappings:",
    duplicate_count
)

print(
    "Rows needing review:",
    len(problem_rows)
)

print(
    "Expected Grade XII SLOs:",
    EXPECTED_GRADE_12_SLOS
)

print(
    "Still missing:",
    missing_count
)

print("\n" + "=" * 60)
print("QUALITY CHECK")
print("=" * 60)

check_codes = {
    "9.1.1",
    "11.12.1",
    "11.12.2",
    "12.3.1",
    "14.1.3",
    "16.1.7"
}

for record in all_records:
    if record["slo_code"] in check_codes:
        print(f"\n{record['slo_code']}")
        print(record["statement"])
        print("Page:", record["page"])
        
        
# ============================================================
# EXPORT CLEAN SLO DATA
# ============================================================

os.makedirs("data", exist_ok=True)

OUTPUT_FILE = "data/grade_12_slos.json"

with open(OUTPUT_FILE, "w", encoding="utf-8") as file:
    json.dump(
        all_records,
        file,
        indent=4,
        ensure_ascii=False
    )

print("\n" + "=" * 60)
print("EXPORT")
print("=" * 60)

print(f"Saved {len(all_records)} SLOs to:")
print(OUTPUT_FILE)