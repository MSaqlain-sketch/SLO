
import json
import os
import pickle
import sys
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "data"))

from rag_tutor import (
    INDEX_FILE,
    retrieve,
    ask_groq,
    load_slos,
    find_slo,
)

load_dotenv(ROOT / ".env")

SLO_FILE = ROOT / "data" / "grade_12_slos.json"
SLO_FILES = {
    (12, "computer-science"): SLO_FILE,
    (11, "computer-science"): ROOT / "data" / "grade_11_computer_science_slos.json",
    (11, "mathematics"): ROOT / "data" / "grade_11_mathematics_slos.json",
    (12, "mathematics"): ROOT / "data" / "grade_12_mathematics_slos.json",
    (11, "statistics"): ROOT / "data" / "grade_11_statistics_slos.json",
    (12, "statistics"): ROOT / "data" / "grade_12_statistics_slos.json",
    (11, "physics"): ROOT / "data" / "grade_11_physics_slos.json",
    (12, "physics"): ROOT / "data" / "grade_12_physics_slos.json",
}
app = FastAPI(title="AKU Learn API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class QuestionRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    grade: int = Field(default=12, ge=11, le=12)
    subject: str = Field(default="computer-science")


class QuizRequest(BaseModel):
    chapter: int = Field(ge=1, le=30)
    count: int = Field(default=10, ge=1, le=10)
    grade: int = Field(default=12, ge=11, le=12)
    subject: str = Field(default="computer-science")


class MCQ(BaseModel):
    question: str = Field(min_length=1)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(min_length=1)
    slo_code: str = Field(min_length=1)


class QuizOutput(BaseModel):
    mcqs: list[MCQ]


def read_slo_data(grade: int = 12, subject: str = "computer-science"):
    slo_path = SLO_FILES.get((grade, subject))

    if slo_path is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported grade or subject",
        )

    if not slo_path.is_file():
        raise HTTPException(
            status_code=503,
            detail=f"SLO data not available for Grade {grade} - {subject}",
        )

    try:
        with slo_path.open("r", encoding="utf-8") as file:
            data = json.load(file)

        if not isinstance(data, list):
            raise ValueError("SLO data must be a list")

        return data

    except (OSError, ValueError):
        raise HTTPException(
            status_code=500,
            detail="Unable to read SLO data",
        )


@app.get("/")
def home():
    return {"message": "AKU Learn Backend is running!"}


@app.get("/api/chapters")
def get_chapters(
    grade: int = 12,
    subject: str = "computer-science",
):
    slos = read_slo_data(grade, subject)
    chapters = {}

    try:
        for slo in slos:
            chapter = slo["chapter"]
            key = str(chapter)

            if key not in chapters:
                chapters[key] = {
                    "chapter": chapter,
                    "title": f"Chapter {chapter}",
                    "slos": [],
                }

            chapters[key]["slos"].append({
                "slo_code": slo["slo_code"],
                "topic": slo["topic"],
                "statement": slo["statement"],
                "page": slo.get("page"),
            })

        result = sorted(
            chapters.values(),
            key=lambda item: int(item["chapter"]),
        )

        return {
            "total_chapters": len(result),
            "total_slos": sum(
                len(chapter["slos"]) for chapter in result
            ),
            "chapters": result,
        }

    except (KeyError, TypeError, ValueError):
        raise HTTPException(
            status_code=500,
            detail="Invalid SLO data structure",
        )


@app.post("/api/ask")
def ask(request: QuestionRequest):
    if request.grade != 12 or request.subject != "computer-science":
        raise HTTPException(
            status_code=503,
            detail=(
                f"AI Chat is not yet available for "
                f"Grade {request.grade} - {request.subject}"
            ),
        )

    if not INDEX_FILE.exists():
        raise HTTPException(
            status_code=503,
            detail="Textbook index missing",
        )

    key = os.getenv("GROQ_API_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="Groq API key missing",
        )

    try:
        with INDEX_FILE.open("rb") as file:
            index = pickle.load(file)

        matches = retrieve(request.question, index)
        slos = load_slos()
        slo = find_slo(request.question, index, slos)

        client = Groq(api_key=key)
        model = os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        )

        answer = ask_groq(
            request.question,
            matches,
            client,
            model,
            slo=slo,
        )

        return {
            "question": request.question,
            "answer": answer,
            "source_pages": sorted(
                set(doc["page"] for doc, _ in matches)
            ),
        }

    except Exception:
        raise HTTPException(
            status_code=500,
            detail="Answer generation failed",
        )


@app.post("/api/quiz/generate")
def generate_quiz(request: QuizRequest):
    if request.grade != 12 or request.subject != "computer-science":
        raise HTTPException(
            status_code=503,
            detail=(
                f"AI Quiz is not yet available for "
                f"Grade {request.grade} - {request.subject}"
            ),
        )

    slos = read_slo_data(request.grade, request.subject)

    chapter_slos = [
        slo for slo in slos
        if str(slo.get("chapter")) == str(request.chapter)
    ]

    if not chapter_slos:
        raise HTTPException(
            status_code=404,
            detail="Chapter not found in syllabus",
        )

    key = os.getenv("GROQ_API_KEY")

    if not key:
        raise HTTPException(
            status_code=503,
            detail="Groq API key missing",
        )

    allowed_codes = {
        str(slo["slo_code"]) for slo in chapter_slos
    }

    slo_context = "\n".join(
        f"{slo['slo_code']}: {slo['statement']}"
        for slo in chapter_slos
    )

    system_prompt = (
        "You are an educational MCQ generator for Grade 12 "
        "Computer Science students. Generate practice questions "
        "using ONLY the supplied syllabus learning outcomes. "
        "Do not claim that questions or answers are verified "
        "against a textbook. "
        "Return ONLY valid JSON, without Markdown fences, "
        "matching this structure: "
        '{"mcqs":[{"question":"...",'
        '"options":["...","...","...","..."],'
        '"correct_index":0,'
        '"explanation":"...",'
        '"slo_code":"..."}]}. '
        "correct_index must be 0, 1, 2, or 3. "
        "Every question must have exactly four distinct options "
        "and one intended correct answer. "
        "Use only the supplied SLO codes. "
        "Avoid duplicate questions."
    )

    user_prompt = (
        f"Generate exactly {request.count} MCQs "
        f"for Chapter {request.chapter}.\n\n"
        f"SYLLABUS SLOs:\n{slo_context}\n\n"
        "Return JSON only."
    )

    try:
        client = Groq(api_key=key)
        model = os.getenv(
            "GROQ_MODEL",
            "openai/gpt-oss-120b",
        )

        result = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.2,
            max_tokens=4500,
        )

        content = result.choices[0].message.content

        if not content:
            raise ValueError("AI returned empty content")

        # Remove optional Markdown code fences
        cleaned = content.strip()

        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[-1]
            cleaned = cleaned.rsplit("```", 1)[0].strip()

        parsed = json.loads(cleaned)
        quiz = QuizOutput.model_validate(parsed)

        if len(quiz.mcqs) != request.count:
            raise ValueError("Incorrect MCQ count")

        for mcq in quiz.mcqs:
            if mcq.slo_code not in allowed_codes:
                raise ValueError("Unknown SLO code")

            if len(set(option.strip().lower() for option in mcq.options)) != 4:
                raise ValueError("Duplicate MCQ options")

        return {
            "chapter": request.chapter,
            "count": len(quiz.mcqs),
            "verification": "AI-generated; not textbook-verified",
            "mcqs": [
                mcq.model_dump() for mcq in quiz.mcqs
            ],
        }

    except (ValueError, json.JSONDecodeError):
        raise HTTPException(
            status_code=502,
            detail="AI generated an invalid quiz. Please retry.",
        )

    except Exception:
        raise HTTPException(
            status_code=502,
            detail="Quiz generation failed. Please retry.",
        )

# Step 5A: Multi-grade and multi-subject catalog

@app.get("/api/catalog")
def get_catalog():
    catalog_file = ROOT / "data" / "catalog.json"

    if not catalog_file.exists():
        raise HTTPException(
            status_code=503,
            detail="Subject catalog is not available",
        )

    try:
        with catalog_file.open("r", encoding="utf-8") as file:
            catalog = json.load(file)

        if not isinstance(catalog, dict):
            raise ValueError("Invalid catalog format")

        if not isinstance(catalog.get("grades"), list):
            raise ValueError("Catalog grades must be a list")

        return catalog

    except (OSError, ValueError):
        raise HTTPException(
            status_code=500,
            detail="Unable to load subject catalog",
        )
