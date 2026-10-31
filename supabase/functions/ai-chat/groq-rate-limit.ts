// One retry allowance shared by all Groq calls in a single chat request.
export const RATE_LIMIT_MESSAGE = "AI is temporarily busy. Please try again shortly.";

export class GroqRateLimitError extends Error {
  constructor() {
    super(RATE_LIMIT_MESSAGE);
    this.name = "GroqRateLimitError";
  }
}

function durationMs(value: string | null): number | null {
  if (!value) return null;
  const parts = [...value.matchAll(/(\d+(?:\.\d+)?)(ms|s|m|h|d)/g)];
  if (!parts.length || parts.map((part) => part[0]).join("") !== value) return null;
  const units: Record<string, number> = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 };
  const result = parts.reduce((total, part) => total + Number(part[1]) * units[part[2]], 0);
  return Number.isFinite(result) ? result : null;
}

async function retryDelay(response: Response): Promise<number | null> {
  // Groq's remaining-requests header refers to requests per day.
  if (response.headers.get("x-ratelimit-remaining-requests") === "0") return null;
  // Daily token exhaustion is reported in the error message, not the TPM headers.
  // Inspect only; never return or log the provider body.
  const body = await response.clone().text();
  if (/\b(?:RPD|TPD)\b|(?:requests|tokens) per day|daily.{0,40}(?:limit|quota)|(?:limit|quota).{0,40}daily/i.test(body)) return null;

  const delays: number[] = [];
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = /^\d+(?:\.\d+)?$/.test(retryAfter) ? Number(retryAfter) : NaN;
    const delay = Number.isFinite(seconds)
      ? seconds * 1000
      : Date.parse(retryAfter) - Date.now();
    if (!Number.isFinite(delay)) return null;
    delays.push(Math.max(0, delay));
  }
  const tokenReset = response.headers.get("x-ratelimit-reset-tokens");
  // Without Retry-After, the token reset is the only short-window signal.
  if (response.headers.get("x-ratelimit-remaining-tokens") === "0" || !delays.length) {
    const delay = durationMs(tokenReset);
    if (delay !== null) delays.push(delay);
    else if (response.headers.get("x-ratelimit-remaining-tokens") === "0") return null;
  }
  if (!delays.length) return null;
  const delay = Math.ceil(Math.max(...delays));
  return delay <= 2000 ? delay : null;
}

export function createGroqFetcher(
  fetcher: typeof fetch = fetch,
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  let retryUsed = false;
  return async (input, init) => {
    const response = await fetcher(input, init);
    if (response.status !== 429 || retryUsed) return response;
    const delay = await retryDelay(response);
    if (delay === null) return response;
    retryUsed = true;
    await response.body?.cancel();
    await sleep(delay);
    return fetcher(input, init);
  };
}
