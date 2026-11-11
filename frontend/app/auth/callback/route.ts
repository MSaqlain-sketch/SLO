import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "../../../lib/auth/server";
import { safeNext, loginPath } from "../../../lib/auth/paths";

export async function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const code = request.nextUrl.searchParams.get("code");
  const client = await createAuthClient();
  if (code && code.length < 4096) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data } = await client.auth.getUser();
      if (data.user?.email_confirmed_at) return finish(next);
      await client.auth.signOut({ scope: "local" });
    }
  }
  return finish(loginPath(next, "callback-failed"));
  function finish(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url), 303);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  }
}
