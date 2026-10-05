import os
import json

from dotenv import load_dotenv
from supabase import create_client


# ==========================================
# LOAD ENVIRONMENT VARIABLES
# ==========================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "SUPABASE_URL or SUPABASE_KEY missing from .env"
    )


# ==========================================
# CONNECT TO SUPABASE
# ==========================================

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)

print("Connected to Supabase successfully!")


# ==========================================
# LOAD 103 SLOs
# ==========================================

JSON_FILE = "data/grade_12_slos.json"

with open(JSON_FILE, "r", encoding="utf-8") as file:
    slos = json.load(file)

print(f"Loaded {len(slos)} SLOs from JSON")

if len(slos) != 103:
    raise ValueError(
        f"Expected 103 SLOs, but JSON contains {len(slos)}"
    )

# ==========================================
# DEBUG: CHECK DATABASE CONTENT
# ==========================================

test = (
    supabase
    .table("subjects")
    .select("*")
    .execute()
)

print("\nSubjects visible to Python:")
print(test.data)
# ==========================================
# FIND SUBJECT
# ==========================================

response = (
    supabase
    .table("subjects")
    .select("id")
    .eq("name", "Computer Science")
    .eq("grade", "XII")
    .eq("board", "AKU-EB")
    .execute()
)

if not response.data:
    raise ValueError(
        "Computer Science XII AKU-EB subject not found"
    )

subject_id = response.data[0]["id"]

print("Subject ID:", subject_id)


# ==========================================
# PREPARE SLO DATA
# ==========================================

records = []

for slo in slos:

    records.append({
        "subject_id": subject_id,
        "chapter": slo["chapter"],
        "topic": slo["topic"],
        "slo_code": slo["slo_code"],
        "statement": slo["statement"],
        "source_page": slo["page"]
    })


# ==========================================
# INSERT / UPDATE SLOs
# ==========================================

response = (
    supabase
    .table("slos")
    .upsert(
        records,
        on_conflict="subject_id,slo_code"
    )
    .execute()
)

print("SLO upload completed!")


# ==========================================
# VALIDATION
# ==========================================

response = (
    supabase
    .table("slos")
    .select(
        "id",
        count="exact"
    )
    .eq("subject_id", subject_id)
    .execute()
)

total = response.count

print("\n" + "=" * 50)
print("VALIDATION")
print("=" * 50)

print("Expected SLOs: 103")
print("Database SLOs:", total)

if total == 103:
    print("Validation: PASS")
else:
    print("Validation: FAIL")