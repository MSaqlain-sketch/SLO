import json
import sqlite3


# ==========================================
# CONFIG
# ==========================================

JSON_FILE = "data/grade_12_slos.json"
DATABASE_FILE = "slo_ai.db"


# ==========================================
# LOAD JSON
# ==========================================

with open(JSON_FILE, "r", encoding="utf-8") as file:
    slos = json.load(file)

print(f"Loaded {len(slos)} SLOs from JSON")


# ==========================================
# CONNECT DATABASE
# ==========================================

connection = sqlite3.connect(DATABASE_FILE)

cursor = connection.cursor()


# ==========================================
# CREATE SLO TABLE
# ==========================================

cursor.execute("""
CREATE TABLE IF NOT EXISTS slos (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    subject TEXT NOT NULL,

    grade TEXT NOT NULL,

    chapter INTEGER NOT NULL,

    topic TEXT NOT NULL,

    slo_code TEXT NOT NULL UNIQUE,

    statement TEXT NOT NULL,

    source_page INTEGER

)
""")


# ==========================================
# INSERT SLOs
# ==========================================

inserted = 0
updated = 0


for slo in slos:

    # Check whether this SLO already exists
    cursor.execute(
        "SELECT id FROM slos WHERE slo_code = ?",
        (slo["slo_code"],)
    )

    existing = cursor.fetchone()

    if existing:

        cursor.execute("""
        UPDATE slos

        SET
            subject = ?,
            grade = ?,
            chapter = ?,
            topic = ?,
            statement = ?,
            source_page = ?

        WHERE slo_code = ?
        """, (
            "Computer Science",
            slo["grade"],
            slo["chapter"],
            slo["topic"],
            slo["statement"],
            slo["page"],
            slo["slo_code"]
        ))

        updated += 1

    else:

        cursor.execute("""
        INSERT INTO slos (
            subject,
            grade,
            chapter,
            topic,
            slo_code,
            statement,
            source_page
        )

        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "Computer Science",
            slo["grade"],
            slo["chapter"],
            slo["topic"],
            slo["slo_code"],
            slo["statement"],
            slo["page"]
        ))

        inserted += 1


# ==========================================
# SAVE DATABASE
# ==========================================

connection.commit()


# ==========================================
# VALIDATE
# ==========================================

cursor.execute("""
SELECT COUNT(*)
FROM slos
WHERE subject = ?
AND grade = ?
""", (
    "Computer Science",
    "XII"
))

total = cursor.fetchone()[0]


print("\n" + "=" * 50)
print("DATABASE BUILD COMPLETE")
print("=" * 50)

print("Inserted:", inserted)
print("Updated:", updated)
print("Grade XII Computer Science SLOs:", total)


if total == 103:
    print("Validation: PASS ✅")
else:
    print("Validation: FAIL ❌")


connection.close()