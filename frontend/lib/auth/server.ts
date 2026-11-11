import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { authConfig, authCookieOptions } from "./config";

export async function createAuthClient() {
  // Supabase session initialization reads the clock; run it only for a request.
  await connection();
  const store = await cookies();
  const { url, key } = authConfig();
  return createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) store.set(name, value, options);
        } catch {
          // Server Components cannot write cookies; the auth Proxy refreshes them.
        }
      },
    },
  });
}
