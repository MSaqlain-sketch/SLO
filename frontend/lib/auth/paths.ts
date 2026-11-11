export const DEFAULT_AUTH_DESTINATION = "/exam-prep";

export function safeNext(value: unknown, fallback = DEFAULT_AUTH_DESTINATION): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  let decoded = value;
  try {
    for (let i = 0; i < 3; i++) {
      if (!decoded.startsWith("/") || decoded.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(decoded)) return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    const url = new URL(value, "https://babul.invalid");
    if (url.pathname.startsWith("//") || url.origin !== "https://babul.invalid" || /^\/(?:auth(?:\/|$)|login(?:\/|$)|signup(?:\/|$)|forgot-password(?:\/|$))/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}

export function loginPath(next: string, status?: string): string {
  const params = new URLSearchParams({ next: safeNext(next) });
  if (status) params.set("status", status);
  return `/login?${params}`;
}

export function isExamPath(path: string): boolean {
  return path === "/exam-prep" || path.startsWith("/exam-prep/");
}
