"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import StudyWorkspace from "./study-workspace";
import {
  classLevelToGrade,
  parseStudySelection,
  subjectLabel,
  type SchoolClass,
} from "../lib/curriculum";
import { useSelection } from "../lib/selection-context";
import { useLocationSearch } from "../lib/use-location-search";

export type FeatureName =
  | "chat"
  | "chapters"
  | "slos"
  | "past-papers"
  | "practice"
  | "progress"
  | "login";

const FEATURE_TITLES: Record<FeatureName, string> = {
  chat: "Ask a Question",
  chapters: "Study by Chapter",
  slos: "View Learning Outcomes",
  "past-papers": "AKU-EB Past Papers",
  practice: "Practice Questions",
  progress: "My Progress",
  login: "Log in",
};

function ComingSoon({
  title,
  message,
  schoolClass,
  subject,
}: {
  title: string;
  message: string;
  schoolClass: SchoolClass | null;
  subject: string | null;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-10">
        <Link
          href="/"
          className="text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Babul Learn
        </Link>
        <h1 className="mt-7 font-serif text-3xl font-bold">{title}</h1>
        {schoolClass && subject && (
          <p className="mt-3 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Class {schoolClass} · {subject}
          </p>
        )}
        <p className="mt-5 leading-7 text-slate-600 dark:text-slate-300">{message}</p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300 to-emerald-500 px-5 font-semibold text-emerald-950 outline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500"
        >
          Choose another class
        </Link>
      </section>
    </main>
  );
}

export function ChatFeaturePage() {
  const searchParams = useSearchParams();
  return <FeaturePage feature="chat" chatSearch={searchParams?.toString() ?? null} />;
}

export default function FeaturePage({ feature, chatSearch }: {
  feature: FeatureName;
  chatSearch?: string | null;
}) {
  const router = useRouter();
  const locationSearch = useLocationSearch();
  const search = feature === "chat" && chatSearch !== undefined ? chatSearch : locationSearch;
  const {
    selection: storedSelection,
    hydrated: selectionHydrated,
    setSelection,
  } = useSelection();
  const title = FEATURE_TITLES[feature];
  const searchParams = new URLSearchParams(search ?? "");
  const querySelection = parseStudySelection(
    searchParams.get("class"),
    searchParams.get("subject"),
  );
  const selection = querySelection ?? storedSelection;
  const schoolClass = selection?.classLevel ?? null;
  const subject = selection
    ? subjectLabel(selection.subjectSlug)
    : null;
  const grade = schoolClass ? classLevelToGrade(schoolClass) : null;

  useEffect(() => {
    if (querySelection) setSelection(querySelection);
  }, [querySelection?.classLevel, querySelection?.subjectSlug, setSelection]);

  useEffect(() => {
    if (
      search !== null &&
      selectionHydrated &&
      !selection &&
      feature !== "login" &&
      feature !== "progress"
    ) {
      router.replace("/?message=choose-selection");
    }
  }, [feature, router, search, selection, selectionHydrated]);

  if (search === null || !selectionHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        Loading Babul Learn...
      </main>
    );
  }

  if (feature === "login") {
    return (
      <ComingSoon
        title="Account access is coming soon"
        message="You can explore Babul Learn study features without signing in for now."
        schoolClass={schoolClass}
        subject={subject}
      />
    );
  }

  if (feature === "progress") {
    return (
      <ComingSoon
        title="Progress tracking is coming soon"
        message="This area will show your learning activity once progress tracking is available."
        schoolClass={schoolClass}
        subject={subject}
      />
    );
  }

  if (!selection || !schoolClass || !subject || grade === null) {
    return (
      <ComingSoon
        title="Choose your class and subject"
        message={`Select a class and subject on the home page to open ${title.toLowerCase()} with your study context.`}
        schoolClass={schoolClass}
        subject={subject}
      />
    );
  }

  const supportedSubject = [
    "Computer Science",
    "Mathematics",
    "Physics",
    "Statistics",
  ].includes(subject);
  const quizIsSupported =
    (feature !== "past-papers" && feature !== "practice") ||
    (grade === 12 && subject === "Computer Science");
  const supportedClassLevel =
    schoolClass === "XI" || schoolClass === "XII" ? schoolClass : null;
  if (
    grade < 11 ||
    !supportedClassLevel ||
    !supportedSubject ||
    !quizIsSupported
  ) {
    return (
      <ComingSoon
        title={`${title} is not available for this selection yet`}
        message="The selected class and subject are not supported by the current study services. Choose an available Grade XI or XII syllabus to continue."
        schoolClass={schoolClass}
        subject={subject}
      />
    );
  }

  const initialView = feature === "chapters"
    ? "study"
    : feature === "slos"
      ? "slos"
      : feature === "past-papers" || feature === "practice"
        ? "quiz"
        : "chat";

  return (
    <StudyWorkspace
      initialView={initialView}
      initialClassLevel={supportedClassLevel}
      initialSubjectSlug={selection.subjectSlug}
    />
  );
}
