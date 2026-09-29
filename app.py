import os

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

with open("text book/slo 9.1.1 content.txt", "r") as file:
    learning_content = file.read()


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
# 6. QUESTION EMBEDDING
# =========================

question_vector = model.encode(question)


# =========================
# 7. RELEVANT DATA SEARCH
# =========================

scores = cos_sim(question_vector, chunk_vectors)[0]

best_index = scores.argmax().item()

context = chunks[best_index]

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
You are an educational AI tutor.

Use the provided educational context as your primary source.

If the student asks for an explanation,
explain the concept simply and clearly.

If the student asks for MCQs,
generate MCQs based on the provided context.

If the student asks for practice questions,
generate practice questions based on the context.

Never claim that an AI-generated question is
a verified past-paper question.
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