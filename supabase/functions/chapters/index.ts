
// @ts-ignore Deno resolves npm: specifiers at runtime.
import { createClient } from "@supabase/supabase-js";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json",
};

const chapterTitles: Record<string, Record<number, string>> = {
  "computer-science:11": {
    1: "Computing Systems",
    2: "Computational Thinking and Algorithm",
    3: "Programming Fundamentals (Python)",
    4: "Data and Analysis",
    5: "Applications of Computer Science",
    6: "Impacts of Computing",
    7: "Digital Literacy",
    8: "Entrepreneurship in the Digital Age",
  },
  "computer-science:12": {
    9: "Computing Systems",
    10: "Computational Thinking and Algorithm",
    11: "Programming Fundamentals (Python)",
    12: "Data and Analysis",
    13: "Applications of Computer Science",
    14: "Impacts of Computing",
    15: "Digital Literacy",
    16: "Entrepreneurship in the Digital Age",
  },
  "mathematics:11": {
    1: "Complex Numbers",
    2: "Matrices and Determinants",
    3: "Sequence and Series",
    4: "Miscellaneous Series",
    5: "Permutation and Combination",
    6: "Mathematical Induction and Binomial Theorem",
    7: "Factor and Remainder Theorems",
    8: "Trigonometric Identities",
    9: "Trigonometric Functions and their Graphs",
    10: "Inverse Trigonometric Functions and Trigonometric Equations",
    11: "Vectors",
  },
  "mathematics:12": {
    12: "Straight Line",
    13: "Functions and Limits",
    14: "Differentiation",
    15: "Higher Order Derivatives and their Applications",
    16: "Vector Differentiation",
    17: "Integration",
    18: "Numerical Solution of Nonlinear Equations",
    19: "Circles",
    20: "Parabola",
    21: "Ellipse",
    22: "Hyperbola",
    23: "MAPLE",
  },
  "statistics:11": {
    1: "Introduction to Statistics",
    2: "Presentation of Statistical Data",
    3: "Measures of Central Tendency",
    4: "Measures of Dispersion",
    5: "Index Numbers",
    6: "Time-Series",
    7: "Regression and Correlation",
  },
  "statistics:12": {
    8: "Counting Techniques",
    9: "Probability",
    10: "Random Variables",
    11: "Probability Distributions",
    12: "Sampling and Sampling Distributions",
    13: "Estimation",
    14: "Statistical Inference",
  },
  "physics:11": {
    1: "Physical Quantities and Measurement",
    2: "Scalars and Vectors",
    3: "Motion in One Dimension",
    4: "Motion in Two Dimensions",
    5: "Deformation in Solids",
    6: "Fluids Dynamics",
    7: "Oscillations",
    8: "Waves",
    9: "Physical Optics",
    10: "Thermodynamics",
  },
  "physics:12": {
    11: "Gravitation",
    12: "Electrostatics",
    13: "Electric Current",
    14: "Electromagnetism",
    15: "Electromagnetic Induction and Alternating Current",
    16: "Quantum Mechanics",
    17: "Nuclear Physics",
    18: "Particle Physics",
    19: "Medical and Space Physics",
    20: "Nature of Science",
  },
};

const deno = (globalThis as typeof globalThis & {
  Deno: {
    serve: (handler: (req: Request) => Promise<Response>) => void;
    env: { get: (name: string) => string | undefined };
  };
}).Deno;

deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ detail: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  const url = new URL(req.url);
  const grade = Number(url.searchParams.get("grade") ?? 12);
  const subject = url.searchParams.get("subject") ?? "computer-science";
  const subjectGrade = `${subject}:${grade}`;

  if (
    (grade !== 11 && grade !== 12) ||
    !Object.hasOwn(chapterTitles, subjectGrade)
  ) {
    return new Response(
      JSON.stringify({ detail: "Unsupported grade or subject" }),
      { status: 400, headers },
    );
  }

  const supabaseUrl = deno.env.get("SUPABASE_URL");
  const serviceRoleKey = deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Chapters function is missing Supabase configuration.");
    return new Response(
      JSON.stringify({ detail: "Study data service is not configured" }),
      { status: 503, headers },
    );
  }

  try {
    const db = createClient(supabaseUrl, serviceRoleKey);
    const { data, error } = await db
      .from("slos")
      .select("chapter, topic, slo_code, statement, source_page")
      .eq("grade", grade)
      .eq("subject", subject)
      .order("chapter", { ascending: true })
      .range(0, 999);

    if (error) throw error;

    const chapters: Record<
      string,
      {
        chapter: number;
        title: string;
        slos: Array<{
          slo_code: string;
          topic: string;
          statement: string;
          page: number | null;
        }>;
      }
    > = {};

    for (const slo of data ?? []) {
      const chapter = slo.chapter;
      const key = String(chapter);

      if (!chapters[key]) {
        chapters[key] = {
          chapter,
          title:
            chapterTitles[subjectGrade][chapter] ?? `Chapter ${chapter}`,
          slos: [],
        };
      }

      chapters[key].slos.push({
        slo_code: slo.slo_code,
        topic: slo.topic ?? "",
        statement: slo.statement,
        page: slo.source_page ?? null,
      });
    }

    // Sort SLO codes numerically, e.g. 11.2.1 before 11.10.1
const compareSloCodes = (a: string, b: string): number => {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const difference = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
};

const result = Object.values(chapters)
  .sort((a, b) => a.chapter - b.chapter)
  .map((chapter) => ({
    ...chapter,
    slos: chapter.slos.sort((a, b) =>
      compareSloCodes(a.slo_code, b.slo_code)
    ),
  }));

    return new Response(
      JSON.stringify({
        total_chapters: result.length,
        total_slos: data?.length ?? 0,
        chapters: result,
      }),
      { headers },
    );
  } catch (error) {
    console.error("Chapters database error:", error);
    return new Response(
      JSON.stringify({ detail: "Unable to load SLOs" }),
      { status: 500, headers },
    );
  }
});
