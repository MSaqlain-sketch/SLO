# import os
# import sqlite3

# from dotenv import load_dotenv
# from groq import Groq
# from sentence_transformers import SentenceTransformer
# from sentence_transformers.util import cos_sim


# # =========================
# # 1. GROQ API KEY LOAD
# # =========================

# load_dotenv()

# client = Groq(
#     api_key=os.getenv("GROQ_API_KEY")
# )


# # =========================
# # 2. LEARNING DATA READ
# # =========================

# # =========================
# # LEARNING DATA FROM DATABASE
# # =========================

# conn = sqlite3.connect("slo_ai.db")
# cursor = conn.cursor()

# cursor.execute("""
# SELECT learning_content
# FROM slos
# WHERE slo_code = ?
# """, ("9.1.1",))

# result = cursor.fetchone()

# conn.close()

# if result is None:
#     print("SLO not found.")
#     exit()

# learning_content = result[0]


# # =========================
# # 3. CHUNKING
# # =========================

# raw_chunks = learning_content.split("\n\n")

# chunks = []

# for chunk in raw_chunks:
#     chunk = chunk.strip()

#     # Sirf useful chunks rakho
#     if len(chunk.split()) >= 5:
#         chunks.append(chunk)


# # =========================
# # 4. EMBEDDINGS
# # =========================

# model = SentenceTransformer("all-MiniLM-L6-v2")

# chunk_vectors = model.encode(chunks)


# # =========================
# # 5. USER QUESTION
# # =========================

# question = input("Ask your question: ")
# # =========================
# # SPELLING / WORD ORDER FIX
# # =========================

# normalization = client.chat.completions.create(
#     model="openai/gpt-oss-20b",
#     messages=[
#         {
#             "role": "system",
#             "content": """
# Correct only spelling mistakes and obvious word-order mistakes.

# Do not answer the question.
# Do not add new information.
# Do not change the meaning of the question.
# Do not turn an unrelated question into a course-related question.

# Return only the corrected sentence.
# """
#         },
#         {
#             "role": "user",
#             "content": question
#         }
#     ]
# )

# normalized_question = normalization.choices[0].message.content.strip()

# print("Understood as:", normalized_question)

# # =========================
# # 6. QUESTION EMBEDDING
# # =========================

# question_vector = model.encode(normalized_question)

# # =========================
# # 7. RELEVANT DATA SEARCH
# # =========================

# scores = cos_sim(question_vector, chunk_vectors)[0]

# top_indices = scores.argsort(descending=True)[:3]
# best_score = scores[top_indices[0]].item()

# print("Best similarity score:", best_score)

# if best_score < 0.35:
#     print("\nAI Tutor:")
#     print("Sorry, this question is outside the available course material.")
#     exit()

# relevant_chunks = []

# for index in top_indices:
#     relevant_chunks.append(chunks[index.item()])

# context = "\n\n".join(relevant_chunks)

# print("\nRetrieved Context:")
# print(context)

# # =========================
# # 8. GROQ LLM
# # =========================

# response = client.chat.completions.create(
#     model="openai/gpt-oss-20b",

#     messages=[
#         {
#             "role": "system",
#             "content": """
# You are a syllabus-grounded educational AI tutor.

# Answer ONLY using the provided CONTEXT.

# Do not answer general knowledge questions outside the provided course material.

# Do not add factual information, definitions, or examples from your own knowledge.

# If the provided context is insufficient, respond:
# "The available course material does not contain enough information."

# You may generate MCQs and practice questions, but all facts and correct
# answers must be supported by the provided context.

# Never claim an AI-generated question is a verified past-paper question.
# """
#         },

#         {
#             "role": "user",
#             "content": f"""
# CONTEXT:
# {context}

# STUDENT REQUEST:
# {question}
# """
#         }
#     ]
# )


# # =========================
# # 9. FINAL ANSWER
# # =========================

# answer = response.choices[0].message.content

# print("\nAI Tutor:")
# print(answer)


import os

from dotenv import load_dotenv
from groq import Groq
from supabase import create_client
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim


# ============================================================
# 1. ENVIRONMENT
# ============================================================

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY missing from .env")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError(
        "SUPABASE_URL or SUPABASE_KEY missing from .env"
    )


# ============================================================
# 2. CLIENTS
# ============================================================

client = Groq(api_key=GROQ_API_KEY)

supabase = create_client(
    SUPABASE_URL,
    SUPABASE_KEY
)


# ============================================================
# 3. FETCH ALL SLOs
# ============================================================

response = (
    supabase
    .table("slos")
    .select(
        "id, slo_code, chapter, topic, statement"
    )
    .execute()
)

slos = response.data

if not slos:
    raise ValueError("No SLOs found in Supabase.")

print(f"Loaded {len(slos)} SLOs from Supabase.")


# ============================================================
# 4. EMBEDDING MODEL
# ============================================================

model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

slo_statements = [
    slo["statement"]
    for slo in slos
]

slo_vectors = model.encode(
    slo_statements
)


# ============================================================
# 5. INTENT DETECTION
# ============================================================

def detect_intents(question):

    text = question.lower()

    intents = []

    if any(word in text for word in [
        "mcq",
        "mcqs",
        "multiple choice",
        "multiple-choice"
    ]):
        intents.append("mcq")

    if any(word in text for word in [
        "crq",
        "crqs",
        "constructed response"
    ]):
        intents.append("crq")

    if any(word in text for word in [
        "example",
        "examples",
        "misal",
        "misaal"
    ]):
        intents.append("example")

    if any(word in text for word in [
        "what is",
        "what are",
        "define",
        "explain",
        "describe",
        "samjhao",
        "samjha",
        "meaning",
        "kya hai",
        "kia hai"
    ]):
        intents.append("explanation")

    if not intents:
        intents.append("explanation")

    return intents


# ============================================================
# 6. NORMALIZE QUESTION
# ============================================================

def normalize_question(question):

    normalization = client.chat.completions.create(

        model="openai/gpt-oss-20b",

        messages=[
            {
                "role": "system",
                "content": """
Correct only spelling mistakes and obvious word-order mistakes.

Do not answer the question.
Do not add new information.
Do not change the meaning.
Do not turn an unrelated question into a course-related question.

Return only the corrected sentence.
"""
            },
            {
                "role": "user",
                "content": question
            }
        ]
    )

    return (
        normalization
        .choices[0]
        .message
        .content
        .strip()
    )


# ============================================================
# 7. FIND BEST SLO
# ============================================================

def find_best_slo(question):

    question_vector = model.encode(question)

    scores = cos_sim(
        question_vector,
        slo_vectors
    )[0]

    best_index = scores.argmax().item()

    best_score = scores[
        best_index
    ].item()

    best_slo = slos[
        best_index
    ]

    return best_slo, best_score


# ============================================================
# 8. FETCH LEARNING CONTENT
# ============================================================

def fetch_learning_content(slo_id):

    response = (
        supabase
        .table("learning_content")
        .select(
            "content_type, content, source_type, "
            "source_name, source_page, verified"
        )
        .eq("slo_id", slo_id)
        .execute()
    )

    return response.data


# ============================================================
# 9. BUILD ANSWER
# ============================================================

def answer_from_material(
    question,
    selected_slo,
    intents,
    learning_content
):

    context_parts = []

    for item in learning_content:

        context_parts.append(
            f"""
CONTENT TYPE:
{item['content_type']}

CONTENT:
{item['content']}
"""
        )

    context = "\n\n".join(context_parts)

    response = client.chat.completions.create(

        model="openai/gpt-oss-20b",

        messages=[
            {
                "role": "system",
                "content": """
You are an AKU-EB Grade XII Computer Science tutor.

The selected SLO defines the student's required
scope and learning level.

The provided course material is your factual
knowledge boundary.

Answer using the provided course material.

You may simplify, reorganize, summarize and explain
the material in student-friendly language.

Do not introduce factual concepts, definitions or
examples that are unsupported by the provided
course material.

Do not teach beyond the scope required by the
selected SLO.

If the material is insufficient, respond:

"The available course material does not contain
enough information."

If MCQs or CRQs are requested, their facts and
correct answers must be supported by the provided
course material.
"""
            },

            {
                "role": "user",
                "content": f"""
SELECTED SLO:
{selected_slo['slo_code']}

SLO STATEMENT:
{selected_slo['statement']}

REQUEST TYPES:
{", ".join(intents)}

COURSE MATERIAL:
{context}

STUDENT REQUEST:
{question}
"""
            }
        ]
    )

    return (
        response
        .choices[0]
        .message
        .content
    )


# ============================================================
# 10. CONVERSATION
# ============================================================

SLO_THRESHOLD = 0.35

# Session memory
current_slo = None


print("\n" + "=" * 60)
print("SLO AI TUTOR")
print("=" * 60)

print("Type 'exit' to close the tutor.")


while True:

    # --------------------------------------------------------
    # Student input
    # --------------------------------------------------------

    question = input("\nYou: ").strip()

    if not question:
        continue

    if question.lower() in [
        "exit",
        "quit"
    ]:
        print("\nAI Tutor: Goodbye!")
        break


    # --------------------------------------------------------
    # Normalize
    # --------------------------------------------------------

    normalized_question = normalize_question(
        question
    )

    print(
        "Understood as:",
        normalized_question
    )


    # --------------------------------------------------------
    # Intent
    # --------------------------------------------------------

    intents = detect_intents(
        normalized_question
    )

    print(
        "Request type:",
        ", ".join(intents)
    )


    # --------------------------------------------------------
    # Try matching current message to an SLO
    # --------------------------------------------------------

    candidate_slo, score = find_best_slo(
        normalized_question
    )


    # --------------------------------------------------------
    # Decide whether to use new SLO or previous SLO
    # --------------------------------------------------------

    if score >= SLO_THRESHOLD:

        # Current message contains enough topic information.
        current_slo = candidate_slo

        print(
            "Selected SLO:",
            current_slo["slo_code"]
        )

        print(
            "Statement:",
            current_slo["statement"]
        )

        print(
            "Similarity:",
            round(score, 3)
        )

    else:

        # Current message may be a follow-up:
        # "give example"
        # "give 5 mcqs"
        # etc.

        if current_slo is not None:

            print(
                "Using previous SLO:",
                current_slo["slo_code"]
            )

            print(
                "Statement:",
                current_slo["statement"]
            )

        else:

            print("\nAI Tutor:")

            print(
                "Which Computer Science topic "
                "would you like help with?"
            )

            continue


    # --------------------------------------------------------
    # Get material for remembered/current SLO
    # --------------------------------------------------------

    learning_content = fetch_learning_content(
        current_slo["id"]
    )


    # --------------------------------------------------------
    # Material isn't imported yet
    # --------------------------------------------------------

    if not learning_content:

        print("\nAI Tutor:")

        print(
            f"I understood that you're asking about "
            f"SLO {current_slo['slo_code']}, but its "
            f"learning material has not been added yet."
        )

        continue


    # --------------------------------------------------------
    # Generate grounded response
    # --------------------------------------------------------

    answer = answer_from_material(
        question=question,
        selected_slo=current_slo,
        intents=intents,
        learning_content=learning_content
    )

    print("\nAI Tutor:")
    print(answer)