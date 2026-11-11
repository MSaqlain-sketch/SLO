import { NextResponse, type NextRequest } from "next/server";
import { createAuthClient } from "../../../lib/auth/server";
import { safeNext, loginPath } from "../../../lib/auth/paths";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = safeNext(request.nextUrl.searchParams.get("next"));
  const recoveryNext = new URL(requestedNext, "https://babul.invalid").pathname === "/reset-password" ? requestedNext : "/reset-password";
  const next = type === "recovery" ? recoveryNext : requestedNext;
  const client = await createAuthClient();
  let destination = loginPath(next, "confirmation-failed");
  if (token && token.length <= 1024 && (type === "email" || type === "signup" || type === "recovery")) {
    const { error } = await client.auth.verifyOtp({ token_hash: token, type });
    if (!error) {
      const { data } = await client.auth.getUser();
      if (data.user?.email_confirmed_at) destination = next;
      else await client.auth.signOut({ scope: "local" });
    }
  }
  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
