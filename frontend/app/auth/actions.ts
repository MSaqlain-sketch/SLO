"use server";

import { redirect } from "next/navigation";
import { createAuthClient } from "../../lib/auth/server";
import { siteOrigin } from "../../lib/auth/config";
import { safeNext } from "../../lib/auth/paths";
import { requireVerifiedUser } from "../../lib/auth/authorization";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
function statusRedirect(path: string, status: string, next: string): never {
  redirect(`${path}?${new URLSearchParams({ status, next: safeNext(next) })}`);
}
function confirmUrl(next: string) {
  return `${siteOrigin()}/auth/confirm?${new URLSearchParams({ next: safeNext(next) })}`;
}

export async function login(form: FormData) {
  const next = safeNext(field(form, "next"));
  const email = field(form, "email").trim();
  const password = field(form, "password");
  if (!validEmail(email) || !password || password.length > 128) statusRedirect("/login", "invalid", next);
  const client = await createAuthClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) statusRedirect("/login", "login-failed", next);
  if (!data.user.email_confirmed_at) {
    await client.auth.signOut({ scope: "local" });
    statusRedirect("/login", "verify-email", next);
  }
  redirect(next);
}

export async function signup(form: FormData) {
  const next = safeNext(field(form, "next"));
  const email = field(form, "email").trim();
  const password = field(form, "password");
  const displayName = field(form, "display_name").trim();
  if (!validEmail(email) || password.length < 8 || password.length > 128 || displayName.length > 80) statusRedirect("/signup", "invalid", next);
  const client = await createAuthClient();
  const { error } = await client.auth.signUp({ email, password, options: {
    emailRedirectTo: confirmUrl(next), data: { display_name: displayName },
  } });
  if (error) statusRedirect("/signup", "signup-failed", next);
  // Signup never signs a student directly into protected pages.
  await client.auth.signOut({ scope: "local" });
  statusRedirect("/login", "check-email", next);
}

export async function googleLogin(form: FormData) {
  const next = safeNext(field(form, "next"));
  const client = await createAuthClient();
  const { data, error } = await client.auth.signInWithOAuth({ provider: "google", options: {
    redirectTo: `${siteOrigin()}/auth/callback?${new URLSearchParams({ next })}`,
  } });
  if (error || !data.url) statusRedirect("/login", "oauth-failed", next);
  redirect(data.url);
}

export async function forgotPassword(form: FormData) {
  const next = safeNext(field(form, "next"));
  const email = field(form, "email").trim();
  if (!validEmail(email)) statusRedirect("/forgot-password", "invalid", next);
  const client = await createAuthClient();
  // Same response for existing and nonexistent accounts.
  await client.auth.resetPasswordForEmail(email, { redirectTo: confirmUrl(`/reset-password?${new URLSearchParams({ next })}`) });
  statusRedirect("/forgot-password", "reset-sent", next);
}

export async function resendVerification(form: FormData) {
  const next = safeNext(field(form, "next"));
  const email = field(form, "email").trim();
  if (!validEmail(email)) statusRedirect("/login", "invalid", next);
  const client = await createAuthClient();
  await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: confirmUrl(next) } });
  statusRedirect("/login", "check-email", next);
}

export async function resetPassword(form: FormData) {
  const next = safeNext(field(form, "next"));
  await requireVerifiedUser(`/reset-password?${new URLSearchParams({ next })}`);
  const password = field(form, "password");
  if (password.length < 8 || password.length > 128 || password !== field(form, "confirm_password")) statusRedirect("/reset-password", "invalid", next);
  const client = await createAuthClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) statusRedirect("/reset-password", "reset-failed", next);
  await client.auth.signOut({ scope: "global" });
  statusRedirect("/login", "password-updated", next);
}

export async function logout() {
  const client = await createAuthClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) redirect("/account?status=logout-failed");
  redirect("/login?status=logged-out");
}

export async function updateProfile(form: FormData) {
  const user = await requireVerifiedUser("/account");
  const displayName = field(form, "display_name").trim();
  if (displayName.length > 80) redirect("/account?status=invalid");
  const client = await createAuthClient();
  const { error } = await client.from("profiles").update({ display_name: displayName }).eq("id", user.id);
  redirect(`/account?status=${error ? "profile-failed" : "profile-saved"}`);
}
