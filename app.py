import os
import sqlite3

from dotenv import load_dotenv
from groq import Groq
from sentence_transformers import SentenceTransformer
from sentence_transformers.util import cos_sim


# =========================
# 1. GROQ API KEY LOAD
# =========================

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
)


# =========================
# 2. LEARNING DATA READ
# =========================

# =========================
# LEARNING DATA FROM DATABASE
# =========================

conn = sqlite3.connect("slo_ai.db")
cursor = conn.cursor()

cursor.execute("""
SELECT learning_content
FROM slos
WHERE slo_code = ?
""", ("9.1.1",))

result = cursor.fetchone()

conn.close()

if result is None:
    print("SLO not found.")
    exit()

learning_content = result[0]


# =========================
# 3. CHUNKING
# =========================

raw_chunks = learning_content.split("\n\n")

chunks = []

for chunk in raw_chunks:
    chunk = chunk.strip()

    # Sirf useful chunks rakho
    if len(chunk.split()) >= 5:
        chunks.append(chunk)


# =========================
# 4. EMBEDDINGS
# =========================

model = SentenceTransformer("all-MiniLM-L6-v2")

chunk_vectors = model.encode(chunks)


# =========================
# 5. USER QUESTION
# =========================

question = input("Ask your question: ")
# =========================
# SPELLING / WORD ORDER FIX
# =========================

normalization = client.chat.completions.create(
    model="openai/gpt-oss-20b",
    messages=[
        {
            "role": "system",
            "content": """
Correct only spelling mistakes and obvious word-order mistakes.

Do not answer the question.
Do not add new information.
Do not change the meaning of the question.
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

normalized_question = normalization.choices[0].message.content.strip()

print("Understood as:", normalized_question)

# =========================
# 6. QUESTION EMBEDDING
# =========================

question_vector = model.encode(normalized_question)

# =========================
# 7. RELEVANT DATA SEARCH
# =========================

scores = cos_sim(question_vector, chunk_vectors)[0]

top_indices = scores.argsort(descending=True)[:3]
best_score = scores[top_indices[0]].item()

print("Best similarity score:", best_score)

if best_score < 0.35:
    print("\nAI Tutor:")
    print("Sorry, this question is outside the available course material.")
    exit()

relevant_chunks = []

for index in top_indices:
    relevant_chunks.append(chunks[index.item()])

context = "\n\n".join(relevant_chunks)

print("\nRetrieved Context:")
print(context)

# =========================
# 8. GROQ LLM
# =========================

response = client.chat.completions.create(
    model="openai/gpt-oss-20b",

    messages=[
        {
            "role": "system",
            "content": """
You are a syllabus-grounded educational AI tutor.

Answer ONLY using the provided CONTEXT.

Do not answer general knowledge questions outside the provided course material.

Do not add factual information, definitions, or examples from your own knowledge.

If the provided context is insufficient, respond:
"The available course material does not contain enough information."

You may generate MCQs and practice questions, but all facts and correct
answers must be supported by the provided context.

Never claim an AI-generated question is a verified past-paper question.
"""
        },

        {
            "role": "user",
            "content": f"""
CONTEXT:
{context}

STUDENT REQUEST:
{question}
"""
        }
    ]
)


# =========================
# 9. FINAL ANSWER
# =========================

answer = response.choices[0].message.content

print("\nAI Tutor:")
print(answer)