import Link from "next/link";
import SiteNavbar from "../site-navbar";
import SubmitButton from "./submit-button";
import AuthPasswordField from "./auth-password-field";
import { login, signup, googleLogin, forgotPassword, resendVerification, resetPassword } from "../../app/auth/actions";
import { safeNext } from "../../lib/auth/paths";
import { requireVerifiedUser } from "../../lib/auth/authorization";
import { authConfig } from "../../lib/auth/config";

export type AuthMode = "login" | "signup" | "forgot" | "reset";
export type AuthSearch = Promise<Record<string, string | string[] | undefined>>;
const messages: Record<string, string> = {
  invalid: "Check your details. New passwords must have 8-128 characters and match the confirmation.",
  "login-failed": "Unable to log in. Check your credentials and verify your email before trying again.",
  "signup-failed": "Unable to complete signup. Try again, or log in if you already have an account.",
  "verify-email": "Please verify your email before logging in.",
  "check-email": "If your address is eligible, a verification email will arrive shortly. Check your inbox and spam folder.",
  "reset-sent": "If an account exists for that address, a password reset email will arrive shortly.",
  "oauth-failed": "Google sign-in is unavailable. Please try again or log in with email.",
  "callback-failed": "The sign-in link could not be completed. Please try again.",
  "confirmation-failed": "The email link is invalid or expired. Request a new verification or password reset email.",
  "reset-failed": "Your password could not be updated. Request a new reset link and try again.",
  "password-updated": "Your password was updated. Log in with your new password.",
  "logged-out": "You have logged out.",
};
export default async function AuthScreen({ mode, searchParams }: { mode: AuthMode; searchParams: AuthSearch }) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const status = typeof params.status === "string" ? messages[params.status] : null;
  let configured = true;
  try { authConfig(); } catch { configured = false; }
  if (mode === "reset" && configured) await requireVerifiedUser("/reset-password");
  const title = { login: "Log in", signup: "Create your account", forgot: "Reset your password", reset: "Choose a new password" }[mode];
  const action = { login, signup, forgot: forgotPassword, reset: resetPassword }[mode];
  const link = (path: string) => `${path}?${new URLSearchParams({ next })}`;
  return (
    <div className="auth-page">
      <SiteNavbar />
      <main className="auth-wrap">
        <section className="auth-card" aria-labelledby="auth-title">
          <div className="auth-heading">
            <h1 id="auth-title">{title}</h1>
            <p>{mode === "login" ? "Welcome back. Continue your AKU-EB preparation." : mode === "signup" ? "Start your AKU-EB preparation with Babul Learn." : mode === "forgot" ? "Enter your email and we will send a secure reset link." : "Choose a strong password for your account."}</p>
          </div>
          {status && <p role="status" className="auth-status">{status}</p>}
          {!configured ? <p role="alert" className="mt-4 text-sm">Authentication is temporarily unavailable. Please try again later.</p> : <>
            {(mode === "login" || mode === "signup") && <form action={googleLogin} className="auth-google-form">
              <input type="hidden" name="next" value={next} />
              <button className="auth-google-button" type="submit">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.5 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.8V6.5H1.4a12 12 0 0 0 0 10.9z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.5l4 3.1C6.3 6.9 8.9 4.8 12 4.8z"/></svg>
                Continue with Google
              </button>
            </form>}
            {(mode === "login" || mode === "signup") && <div className="auth-divider"><span>or use email</span></div>}
            <form action={action} className="auth-form">
              <input type="hidden" name="next" value={next} />
              {mode === "signup" && <label className="auth-field">Display name<input name="display_name" maxLength={80} autoComplete="name" /></label>}
              {mode !== "reset" && <label className="auth-field">Email<input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="m.saqlain@example.com" /></label>}
              {mode !== "forgot" && <AuthPasswordField label="Password" name="password" required minLength={mode === "login" ? 1 : 8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} />}
              {mode === "reset" && <AuthPasswordField label="Confirm password" name="confirm_password" required minLength={8} maxLength={128} autoComplete="new-password" />}
              {mode === "login" && <div className="auth-forgot"><Link href={link("/forgot-password")}>Forgot password?</Link></div>}
              <SubmitButton>{title}</SubmitButton>
            </form>
            <div className="auth-links">
              {mode === "login" ? <p>New to Babul Learn? <Link href={link("/signup")}>Create an account</Link></p> : <p><Link href={link("/login")}>Back to login</Link></p>}
              <Link href="/account">Your account</Link>
            </div>
            {mode === "login" && <details className="auth-details">
              <summary>Resend verification email</summary>
              <form action={resendVerification} className="auth-resend-form">
                <input type="hidden" name="next" value={next} />
                <label className="auth-field">Email<input type="email" name="email" required maxLength={254} autoComplete="email" placeholder="m.saqlain@example.com" /></label>
                <SubmitButton>Send verification email</SubmitButton>
              </form>
            </details>}
          </>}
        </section>
      </main>
    </div>
  );
}
