import { Suspense } from "react";
import Link from "next/link";
import SiteNavbar from "../../components/site-navbar";
import { requireVerifiedUser } from "../../lib/auth/authorization";
import { logout } from "../auth/actions";

async function ProtectedExamPreparation() {
  await requireVerifiedUser("/exam-prep");
  return <div className="babul-home min-h-screen"><SiteNavbar /><main className="mx-auto max-w-3xl px-5 py-12">
    <h1 className="text-3xl font-bold">Exam Preparation</h1>
    <p className="mt-4">You are signed in. Exam preparation and evaluation tools are coming soon.</p>
    <Link href="/account" className="mt-6 inline-block font-semibold text-emerald-700 underline">Your account</Link>
    <form action={logout} className="mt-6"><button className="rounded-lg border px-4 py-2">Log out</button></form>
  </main></div>;
}

export default function ExamPreparationPage() {
  return <Suspense fallback={<p className="p-6">Loading your account...</p>}><ProtectedExamPreparation /></Suspense>;
}