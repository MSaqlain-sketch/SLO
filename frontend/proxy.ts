import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, authCookieOptions } from "./lib/auth/config";
import { isExamPath, loginPath } from "./lib/auth/paths";

export async function proxy(request: NextRequest) {
  const destination = request.nextUrl.pathname + request.nextUrl.search;
  const requestHeaders = new Headers(request.headers);
  // Overwrite incoming values; never trust a client-supplied return destination.
  requestHeaders.set("x-babul-auth-path", destination);
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Cache-Control", "private, no-store");
  const protectedPath = isExamPath(request.nextUrl.pathname) || request.nextUrl.pathname === "/account" || request.nextUrl.pathname === "/reset-password";
  try {
    const { url, key } = authConfig();
    const client = createServerClient(url, key, {
      cookieOptions: authCookieOptions,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(values) {
          for (const { name, value } of values) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          response.headers.set("Cache-Control", "private, no-store");
          for (const { name, value, options } of values) response.cookies.set(name, value, options);
        },
      },
    });
    const { data, error } = await client.auth.getUser();
    if (protectedPath && (error || !data.user?.email_confirmed_at)) {
      const result = NextResponse.redirect(new URL(loginPath(destination), request.url), 303);
      for (const cookie of response.cookies.getAll()) result.cookies.set(cookie);
      result.headers.set("Cache-Control", "private, no-store");
      return result;
    }
    return response;
  } catch {
    // Fail closed; no provider errors, credentials or tokens go to responses/logs.
    if (protectedPath) return new NextResponse("Authentication is temporarily unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
    return response;
  }
}

export const config = {
  matcher: ["/login", "/signup", "/forgot-password", "/reset-password", "/account", "/auth/:path*", "/exam-prep/:path*"],
};
