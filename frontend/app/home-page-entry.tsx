"use client";

import HomePage from "./home-page";
import {
  parseStudySelection,
} from "../lib/curriculum";
import { useSelection } from "../lib/selection-context";
import { useLocationSearch } from "../lib/use-location-search";

export default function HomePageEntry() {
  const search = useLocationSearch();
  const { selection: storedSelection } = useSelection();
  const searchParams = new URLSearchParams(search ?? "");
  const selection = parseStudySelection(
    searchParams.get("class"),
    searchParams.get("subject"),
  ) ?? storedSelection;

  return (
    <HomePage
      key={`${search ?? "server"}-${selection?.classLevel ?? ""}-${selection?.subjectSlug ?? ""}`}
      initialClass={selection?.classLevel ?? null}
      initialSubject={selection?.subjectSlug ?? null}
      showSelectionMessage={searchParams.get("message") === "choose-selection"}
    />
  );
}
