import { Suspense } from "react";
import SiteNavbar from "../../components/site-navbar";
import { requireVerifiedUser } from "../../lib/auth/authorization";
import { createAuthClient } from "../../lib/auth/server";
import { logout, updateProfile } from "../auth/actions";
import SubmitButton from "../../components/auth/submit-button";
import type { AuthSearch } from "../../components/auth/auth-screen";

async function Account({ searchParams }: { searchParams: AuthSearch }) {
  const user = await requireVerifiedUser("/account");
  const client = await createAuthClient();
  const { data: profile, error } = await client.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
  const params = await searchParams;
  const statuses: Record<string, string> = { "profile-saved": "Profile saved.", "profile-failed": "Your profile could not be saved.", invalid: "Display names must be at most 80 characters.", "logout-failed": "Logout could not be completed. Please try again." };
  return <div className="babul-home min-h-screen"><SiteNavbar /><main className="mx-auto max-w-lg px-5 py-12">
    <h1 className="text-2xl font-bold">Your account</h1><p className="mt-3">{user.email}</p>
    {typeof params.status === "string" && statuses[params.status] && <p role="status" className="mt-3">{statuses[params.status]}</p>}
    {error || !profile ? <p className="mt-5">Your profile is temporarily unavailable.</p> : <form action={updateProfile} className="mt-6 space-y-4">
      <label className="block text-sm font-medium">Display name<input name="display_name" maxLength={80} defaultValue={profile.display_name} className="mt-2 w-full rounded-lg border bg-white p-3 text-slate-900" /></label>
      <SubmitButton>Save profile</SubmitButton>
    </form>}
    <form action={logout} className="mt-6"><SubmitButton>Log out</SubmitButton></form>
  </main></div>;
}
export default function AccountPage(props: { searchParams: AuthSearch }) {
  return <Suspense fallback={<p className="p-6">Loading your account...</p>}><Account {...props} /></Suspense>;
}
