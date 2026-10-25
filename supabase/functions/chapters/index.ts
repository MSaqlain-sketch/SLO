
// @ts-ignore Deno resolves npm: specifiers at runtime.
import { createClient } from "@supabase/supabase-js";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Content-Type": "application/json",
};

const deno = (globalThis as typeof globalThis & {
  Deno: {
    serve: (handler: (req: Request) => Promise<Response>) => void;
    env: { get: (name: string) => string | undefined };
  };
}).Deno;

deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers });

  const url = new URL(req.url);
  const grade = Number(url.searchParams.get("grade") ?? 12);
  const subject = url.searchParams.get("subject") ?? "computer-science";

  const db = createClient(
    deno.env.get("SUPABASE_URL")!,
    deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await db
    .from("slos")
    .select("*")
    .eq("grade", grade)
    .eq("subject", subject);

 if (error) {
  console.error("Chapters database error:", error);

  return new Response(
    JSON.stringify({
      detail: "Unable to load SLOs",
    }),
    { status: 500, headers }
  );
}
  const chapters: Record<
  string,
  {
    chapter: number;
    title: string;
    slos: unknown[];
  }
> = {};
  for (const slo of data ?? []) {
    const chapter = slo.chapter;
    const key = String(chapter);

    if (!chapters[key])
      chapters[key] = {
        chapter,
        title: `Chapter ${chapter}`,
        slos: [],
      };

    chapters[key].slos.push({
      slo_code: slo.slo_code,
      topic: slo.topic ?? "",
      statement: slo.statement,
      page: slo.page ?? null,
    });
  }

  const result = Object.values(chapters).sort(
    (a, b) => Number(a.chapter) - Number(b.chapter)
  );

  return new Response(JSON.stringify({
    total_chapters: result.length,
    total_slos: data?.length ?? 0,
    chapters: result,
  }), { headers });
});
