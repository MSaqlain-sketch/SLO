import { Suspense } from "react";
import AuthScreen, { type AuthSearch } from "../../components/auth/auth-screen";

export default function Page(props: { searchParams: AuthSearch }) {
  return <Suspense fallback={<p className="p-6">Loading...</p>}><AuthScreen mode="reset" {...props} /></Suspense>;
}
