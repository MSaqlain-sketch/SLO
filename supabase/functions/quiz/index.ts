
// @ts-ignore Deno resolves npm: specifiers at runtime.
import { createClient } from "@supabase/supabase-js";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

const validOptions = ["A", "B", "C", "D"];

declare const Deno: {
  serve(handler: (req: Request) => Response | Promise<Response>): void;
  env: { get(name: string): string | undefined };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const action = body.action ?? "start";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "for_slos") {
      if (
        !Array.isArray(body.slo_codes) ||
        body.slo_codes.length === 0 ||
        body.slo_codes.length > 100 ||
        body.slo_codes.some(
          (code: unknown) =>
            typeof code !== "string" ||
            code.length === 0 ||
            code.length > 50,
        )
      ) {
        return json({ error: "A valid slo_codes array is required" }, 400);
      }

      const sloCodes = [...new Set(body.slo_codes as string[])];
      const { data, error } = await supabase
        .from("quiz_questions")
        .select(
          "id, model_year, paper, question_number, slo_code, question, option_a, option_b, option_c, option_d, source_page",
        )
        .eq("grade", 12)
        .eq("subject", "computer-science")
        .eq("source_type", "official_model_paper")
        .eq("paper", "paper-1")
        .eq("answer_verified", true)
        .in("slo_code", sloCodes);

      if (error) throw error;

      const questions = (data ?? [])
        .sort(
          (
            a: { slo_code: string; question_number: number },
            b: { slo_code: string; question_number: number },
          ) =>
            a.slo_code.localeCompare(b.slo_code) ||
            a.question_number - b.question_number,
        )
        .map((q: {
          id: number;
          model_year: number;
          paper: string;
          question_number: number;
          slo_code: string;
          question: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          source_page: number | null;
        }) => ({
          id: q.id,
          model_year: q.model_year,
          paper: q.paper,
          question_number: q.question_number,
          slo_code: q.slo_code,
          question: q.question,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d,
          },
          source_page: q.source_page,
        }));

      return json({ mode: "official_model_paper", questions });
    }

    if (action === "question") {
      if (!Number.isSafeInteger(body.question_id) || body.question_id < 1) {
        return json({ error: "A valid question_id is required" }, 400);
      }

      const { data, error } = await supabase
        .from("quiz_questions")
        .select(
          "id, question_number, question, option_a, option_b, option_c, option_d, source_page",
        )
        .eq("id", body.question_id)
        .eq("grade", 12)
        .eq("subject", "computer-science")
        .eq("source_type", "official_model_paper")
        .eq("paper", "paper-1")
        .eq("answer_verified", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return json({ error: "Verified model-paper question not found" }, 404);

      return json({
        mode: "official_model_paper",
        question: {
          id: data.id,
          question_number: data.question_number,
          question: data.question,
          options: {
            A: data.option_a,
            B: data.option_b,
            C: data.option_c,
            D: data.option_d,
          },
          source_page: data.source_page,
        },
      });
    }

    if (action === "start" || action === "more") {
      const excludedIds = Array.isArray(body.exclude_ids)
        ? body.exclude_ids.filter(
            (id: unknown) => Number.isSafeInteger(id),
          )
        : [];

     
      const { data, error } = await supabase
        .from("quiz_questions")
        .select(
          "id, question_number, question, option_a, option_b, option_c, option_d, source_page",
        )
        .eq("source_type", "official_model_paper")
        .eq("paper", "paper-1")
        .eq("answer_verified", true);

      if (error) throw error;

      
const available = (data ?? [])
  .filter((q: { id: number }) => !excludedIds.includes(q.id))
  .sort(
    (
      a: { question_number: number },
      b: { question_number: number },
    ) => a.question_number - b.question_number,
  )
  .slice(0, 3);


      return json({
        mode: "official_model_paper",
        questions: available.map((q: {
          id: number;
          question_number: number;
          question: string;
          option_a: string;
          option_b: string;
          option_c: string;
          option_d: string;
          source_page: number | null;
        }) => ({
          id: q.id,
          question_number: q.question_number,
          question: q.question,
          options: {
            A: q.option_a,
            B: q.option_b,
            C: q.option_c,
            D: q.option_d,
          },
          source_page: q.source_page,
        })),
      });
    }

    if (action === "submit") {
      if (!Array.isArray(body.answers)) {
        return json({ error: "answers array required" }, 400);
      }

      const answers = body.answers;

      if (
        answers.length === 0 ||
        answers.length > 50 ||
        answers.some(
          (a: { id?: unknown; selected?: unknown }) =>
            !Number.isSafeInteger(a?.id) ||
            !validOptions.includes(String(a?.selected)),
        )
      ) {
        return json({ error: "Invalid answers" }, 400);
      }

      const ids = answers.map((a: { id: number }) => a.id);

      if (new Set(ids).size !== ids.length) {
        return json({ error: "Duplicate question IDs" }, 400);
      }

      const { data, error } = await supabase
        .from("quiz_questions")
        .select("id, correct_option, explanation")
        .in("id", ids)
        .eq("source_type", "official_model_paper")
        .eq("paper", "paper-1")
        .eq("answer_verified", true);

      if (error) throw error;

      if (!data || data.length !== ids.length) {
        return json({ error: "Invalid question IDs" }, 400);
      }

      const answerMap = new Map(
        answers.map((a: { id: number; selected: string }) => [
          a.id,
          a.selected,
        ]),
      );

      const results = data.map((q: {
        id: number;
        correct_option: string;
        explanation: string | null;
      }) => ({
        id: q.id,
        selected: answerMap.get(q.id),
        correct_option: q.correct_option,
        correct: answerMap.get(q.id) === q.correct_option,
        explanation: q.explanation ?? null,
      }));

      const correct = results.filter((r: { correct: boolean }) => r.correct).length;

      return json({
        total: results.length,
        correct,
        incorrect: results.length - correct,
        percentage: Math.round((correct / results.length) * 100),
        results,
        retry_ids: results
          .filter((r: { correct: boolean }) => !r.correct)
          .map((r: { id: number }) => r.id),
      });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (error) {
    console.error("Quiz error:", error);
    return json({ error: "Quiz request failed" }, 500);
  }
});
