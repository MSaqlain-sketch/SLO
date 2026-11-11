import "server-only";

export function authConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Authentication is not configured.");
  if (key.startsWith("sb_secret_")) throw new Error("Use a Supabase publishable key for authentication.");
  return { url, key };
}

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : "");
  if (!configured) throw new Error("Authentication site URL is not configured.");
  const url = new URL(configured);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("Authentication site URL must use HTTPS.");
  }
  if (url.username || url.password) throw new Error("Invalid authentication site URL.");
  return url.origin;
}

export const authCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
