import os
from dotenv import load_dotenv
from supabase import create_client


# ==========================================
# SUPABASE CONNECTION
# ==========================================

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "SUPABASE_URL or SUPABASE_KEY missing from .env"
    )

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ==========================================
# FETCH ALL SLOs
# ==========================================

def fetch_slos():

    response = (
        supabase
        .table("slos")
        .select(
            "id, slo_code, chapter, topic, statement"
        )
        .order("slo_code")
        .execute()
    )

    return response.data


# ==========================================
# TEST
# ==========================================

if __name__ == "__main__":

    slos = fetch_slos()

    print("\n" + "=" * 50)
    print("SLO RETRIEVAL TEST")
    print("=" * 50)

    print("Total SLOs fetched:", len(slos))

    print("\nFirst 5 SLOs:\n")

    for slo in slos[:5]:

        print(
            f"{slo['slo_code']} -> "
            f"{slo['statement']}"
        )