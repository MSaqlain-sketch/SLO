import { Suspense } from "react";
import { headers } from "next/headers";
import { requireVerifiedUser } from "../../lib/auth/authorization";

async function ProtectedExamLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-babul-auth-path") || "/exam-prep";
  await requireVerifiedUser(path);
  return children;
}
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p className="p-6">Loading your account...</p>}><ProtectedExamLayout>{children}</ProtectedExamLayout></Suspense>;
}
