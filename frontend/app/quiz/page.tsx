
"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import Link from "next/link";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://fltaxhryfwthjlvltffr.supabase.co/functions/v1";
type Question = {
  id: number;
  question_number: number;
  question: string;
  options: Record<"A" | "B" | "C" | "D", string>;
  source_page: number | null;
};

type Result = {
  id: number;
  selected: string;
  correct_option: string;
  correct: boolean;
  explanation: string | null;
};

type Score = {
  total: number;
  correct: number;
  incorrect: number;
  percentage: number;
  results: Result[];
  retry_ids: number[];
};

const letters = ["A", "B", "C", "D"] as const;

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const [score, setScore] = useState<Score | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);

  async function callQuiz(body: object) {
    if (!API_URL) throw new Error("API URL is missing");

    const response = await fetch(`${API_URL}/quiz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  if (!response.ok) {
  const errorText = await response.text();

  throw new Error(
    `Quiz API Error ${response.status}: ${errorText}`
  );
}

    return response.json();
  }

  async function loadQuestions(more = false) {
    setLoading(true);
    setError("");

    try {
      const data = await callQuiz({
        action: more ? "more" : "start",
       exclude_ids: more ? seenIds : [],
      });

      const incoming: Question[] = data.questions ?? [];

      if (incoming.length === 0) {
  setError(
        "Quiz completed. You have finished all available Model Paper MCQs."
  );
  return;
}

      setQuestions(incoming);
      setQuestions(incoming);
setSeenIds((previous) =>
  more
    ? [...new Set([...previous, ...incoming.map((q) => q.id)])]
    : incoming.map((q) => q.id)
);
setAnswers({});
setAnswers({});
setScore(null);
setStarted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function loadQuestion(questionId: number) {
    setLoading(true);
    setError("");

    try {
      const data: { question?: Question } = await callQuiz({
        action: "question",
        question_id: questionId,
      });

      if (!data.question) {
        throw new Error("Verified model-paper question was not found.");
      }

      setQuestions([data.question]);
      setSeenIds([data.question.id]);
      setAnswers({});
      setScore(null);
      setStarted(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load the model-paper question."
      );
      setStarted(true);
    } finally {
      setLoading(false);
    }
  }

  // Initialize once from the URL; subsequent question loads are user-triggered.
  useEffect(() => {
    async function initializeQuiz() {
      const requestedQuestionId = new URLSearchParams(
        window.location.search,
      ).get("questionId");

      if (requestedQuestionId === null) {
        await loadQuestions();
        return;
      }

      const questionId = Number(requestedQuestionId);
      if (!Number.isSafeInteger(questionId) || questionId < 1) {
        setError("Invalid model-paper question link.");
        setStarted(true);
        return;
      }

      await loadQuestion(questionId);
    }

    void initializeQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function chooseAnswer(id: number, letter: string) {
    if (score) return;
    setAnswers((previous) => ({ ...previous, [id]: letter }));
  }

  async function submitQuiz() {
    if (questions.some((q) => !answers[q.id])) {
      setError("Please answer all questions first.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data: Score = await callQuiz({
        action: "submit",
        answers: questions.map((q) => ({
          id: q.id,
          selected: answers[q.id],
        })),
      });

      setScore(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit quiz");
    } finally {
      setLoading(false);
    }
  }

  function retryWrong() {
    if (!score) return;

    const wrongIds = new Set(score.retry_ids);
    setQuestions((previous) =>
      previous.filter((q) => wrongIds.has(q.id))
    );
    setAnswers({});
    setScore(null);
    setError("");
  }

  const resultMap = new Map(score?.results.map((r) => [r.id, r]) ?? []);

  return (
    <main className="babul-quiz min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="babul-quiz-header mb-6 flex items-center justify-between">
          <Link href="/" className="text-sm font-medium text-blue-700">
            ← Back to Chat
          </Link>
          <div className="flex items-center gap-2">
            <Image
              src="/babul-learn-logo.png"
              alt="Babul Tech logo"
              width={34}
              height={34}
            />
            <span className="text-sm font-semibold">Babul Learn</span>
          </div>
        </div>

        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Model Paper MCQ Practice</h1>
          <p className="mt-2 text-sm text-slate-600">
            Practice Grade XII Computer Science MCQs.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-3">
              <p className="font-semibold">Official Model Paper</p>
              <p className="mt-1 text-xs text-slate-600">
                AKU-EB 2027 onwards
              </p>
            </div>
            <div className="rounded-xl border p-3 opacity-50">
              <p className="font-semibold">SLO-Based Quiz</p>
              <p className="mt-1 text-xs">Coming soon</p>
            </div>
            <div className="rounded-xl border p-3 opacity-50">
              <p className="font-semibold">AI-Generated Quiz</p>
              <p className="mt-1 text-xs">Coming soon</p>
            </div>
          </div>
        </div>

        
        {loading && !started && (
          <p className="text-center">Loading questions...</p>
        )}
        {error && questions.length === 0 && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
{questions.length > 0 && (
  <div className="mb-4 rounded-xl bg-white p-4 shadow-sm">
    <div className="mb-2 flex justify-between text-sm">
      <span className="font-medium">Quiz Progress</span>
      <span className="text-slate-600">
        {questions.filter((q) => answers[q.id]).length}
        /{questions.length} Answered
      </span>
    </div>

    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className="h-full rounded-full bg-blue-600 transition-all"
        style={{
          width: `${
            (questions.filter((q) => answers[q.id]).length /
              questions.length) *
            100
          }%`,
        }}
      />
    </div>
  </div>
)}
        {questions.map((q, index) => {
          const result = resultMap.get(q.id);

          return (
            <section
              key={q.id}
              className="mb-4 rounded-2xl bg-white p-5 shadow-sm"
            >
              <div className="mb-3 flex justify-between gap-3 text-xs text-slate-500">
                <span>Question {index + 1}</span>
                <span>
                  Paper I · Q{q.question_number}
                  {q.source_page ? ` · Page ${q.source_page}` : ""}
                </span>
              </div>

              <h2 className="mb-4 whitespace-pre-wrap font-semibold leading-7">
                {q.question}
              </h2>

              <div className="space-y-2">
                {letters.map((letter) => {
                  const selected = answers[q.id] === letter;
                  const correct = result?.correct_option === letter;

                  let style = "border-slate-200 hover:bg-slate-50";

                  if (score && correct) {
                    style = "border-green-500 bg-green-50";
                  } else if (score && selected && !correct) {
                    style = "border-red-500 bg-red-50";
                  } else if (selected) {
                    style = "border-blue-600 bg-blue-50";
                  }

                  return (
                    <button
                      key={letter}
                      type="button"
                      disabled={!!score || loading}
                      onClick={() => chooseAnswer(q.id, letter)}
                      aria-pressed={selected}
                      className={`flex w-full items-start gap-3 rounded-xl border-2 p-3 text-left text-sm transition ${style}`}
                    >
                      <span className="font-bold">{letter}.</span>
                      <span className="whitespace-pre-wrap">
                        {q.options[letter]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {result && !result.correct && (
                <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm">
                  <p className="font-semibold">
                    Correct answer: {result.correct_option}
                  </p>
                  <p className="mt-1">
                    {result.explanation ??
                      "Review this topic and try the question again."}
                  </p>
                </div>
              )}
            </section>
          );
        })}

        {score && (
          <div className="mb-5 rounded-2xl bg-white p-6 text-center shadow-sm">
            <h2 className="text-xl font-bold">Your Result</h2>
            <p className="my-3 text-4xl font-bold text-blue-700">
              {score.percentage}%
            </p>
            <p className="text-sm">
              {score.correct} correct · {score.incorrect} incorrect
            </p>
            {score.incorrect > 0 && (
              <button
                type="button"
                onClick={retryWrong}
                className="mt-4 rounded-xl bg-amber-500 px-5 py-3 font-semibold text-white"
              >
                Retry Wrong Questions
              </button>
            )}
          </div>
        )}

        {questions.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {!score && (
              <button
                type="button"
                disabled={loading}
                onClick={submitQuiz}
                className="rounded-xl bg-blue-700 px-6 py-3 font-semibold text-white disabled:opacity-50"
              >
                {loading ? "Please wait..." : "Submit Quiz"}
              </button>
            )}
{error && (
  <p
    role="alert"
    className="w-full rounded-xl bg-red-50 p-3 text-sm text-red-700"
  >
    {error}
  </p>
)}
            <button
              type="button"
              disabled={loading}
              onClick={() => loadQuestions(true)}
              className="rounded-xl border border-blue-700 bg-white px-6 py-3 font-semibold text-blue-700 disabled:opacity-50"
            >
              {score ? "Continue to Next 3 MCQs" : "Next 3 MCQs"}
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => loadQuestions(false)}
              className="rounded-xl border px-6 py-3 font-semibold"
            >
              New Quiz
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
