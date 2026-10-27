import { Suspense } from "react";
import HomePage from "./home-page";
import HomePageEntry from "./home-page-entry";

export default function Page() {
  return (
    <Suspense fallback={<HomePage initialClass={null} initialSubject={null} />}>
      <HomePageEntry />
    </Suspense>
  );
}
