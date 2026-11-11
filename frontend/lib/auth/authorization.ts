import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createAuthClient } from "./server";
import { loginPath } from "./paths";

// React cache is request-scoped. Never put user sessions in a shared cache.
export const verifiedUser = cache(async () => {
  const client = await createAuthClient();
  const { data, error } = await client.auth.getUser();
  return !error && data.user?.email_confirmed_at ? data.user : null;
});

export async function requireVerifiedUser(next = "/exam-prep") {
  const user = await verifiedUser();
  if (!user) redirect(loginPath(next));
  return user;
}

export async function requireAdmin(next = "/exam-prep") {
  const user = await requireVerifiedUser(next);
  const client = await createAuthClient();
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", user.id).maybeSingle();
  if (error || data?.role !== "admin") throw new Error("Administrator access required.");
  return user;
}
