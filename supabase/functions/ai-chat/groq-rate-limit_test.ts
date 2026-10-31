import { createGroqFetcher, GroqRateLimitError } from "./groq-rate-limit.ts";
import { isSyllabusRelevant, isAnswerTextbookSupported } from "./scope.ts";

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

for (const [name, headers, body, expectedDelay] of [
  ["short Retry-After", { "retry-after": "1" }, "", 1000],
  ["token reset fallback", { "x-ratelimit-reset-tokens": "1s250ms" }, "", 1250],
  ["respect longer exhausted token reset", { "retry-after": "0.1", "x-ratelimit-remaining-tokens": "0", "x-ratelimit-reset-tokens": "2s" }, "", 2000],
  ["long wait", { "retry-after": "3" }, "", null],
  ["long compound reset", { "x-ratelimit-reset-tokens": "1m2s" }, "", null],
  ["daily requests", { "retry-after": "1", "x-ratelimit-remaining-requests": "0", "x-ratelimit-reset-requests": "1s" }, "", null],
  ["daily tokens", { "retry-after": "1" }, "Rate limit reached for tokens per day (TPD)", null],
  ["missing timing", {}, "", null],
  ["malformed timing", { "retry-after": "invalid" }, "", null],
  ["HTTP date", { "retry-after": new Date(0).toUTCString() }, "", 0],
] as const) {
  Deno.test(name, async () => {
    let calls = 0;
    const waits: number[] = [];
    const fetcher = createGroqFetcher(async () => {
      calls++;
      return calls === 1 ? new Response(body, { status: 429, headers }) : new Response("ok");
    }, async (ms) => { waits.push(ms); });
    const result = await fetcher("https://example.test");
    equal(calls, expectedDelay === null ? 1 : 2);
    equal(waits, expectedDelay === null ? [] : [expectedDelay]);
    equal(result.status, expectedDelay === null ? 429 : 200);
  });
}

Deno.test("persistent 429 consumes only one retry across all calls", async () => {
  let calls = 0;
  let waits = 0;
  const fetcher = createGroqFetcher(async () => {
    calls++;
    return new Response("", { status: 429, headers: { "retry-after": "0" } });
  }, async () => { waits++; });
  equal((await fetcher("https://example.test")).status, 429);
  equal((await fetcher("https://example.test")).status, 429);
  equal(calls, 3);
  equal(waits, 1);
});

Deno.test("success and other failures are never retried", async () => {
  for (const status of [200, 400, 401, 500, 502]) {
    let calls = 0;
    const fetcher = createGroqFetcher(async () => {
      calls++;
      return new Response("", { status });
    }, async () => { throw new Error("Unexpected wait"); });
    equal((await fetcher("https://example.test")).status, status);
    equal(calls, 1);
  }
});

Deno.test("both validation calls expose typed 429 errors without provider content", async () => {
  const fetcher: typeof fetch = async () => new Response("private provider body", { status: 429 });
  for (const request of [
    () => isSyllabusRelevant("question", [], [], "test-key", "model", 12, "physics", fetcher),
    () => isAnswerTextbookSupported("question", "answer", [], "test-key", "model", fetcher),
  ]) {
    try {
      await request();
      throw new Error("Expected rate limit error");
    } catch (error) {
      if (!(error instanceof GroqRateLimitError)) throw error;
      equal(error.message.includes("private"), false);
    }
  }
});
