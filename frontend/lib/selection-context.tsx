"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  parseStudySelection,
  type StudySelection,
} from "./curriculum";

const STORAGE_KEY = "babul-learn-selection";

type SelectionSnapshot = {
  selection: StudySelection | null;
  hydrated: boolean;
};

type SelectionContextValue = SelectionSnapshot & {
  setSelection: (selection: StudySelection) => void;
};

const SERVER_SNAPSHOT: SelectionSnapshot = {
  selection: null,
  hydrated: false,
};

let cachedRaw: string | null | undefined;
let currentSnapshot: SelectionSnapshot = SERVER_SNAPSHOT;
const listeners = new Set<() => void>();

function readSnapshot(): SelectionSnapshot {
  if (typeof window === "undefined") return SERVER_SNAPSHOT;

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return currentSnapshot;

  cachedRaw = raw;
  let selection: StudySelection | null = null;
  if (raw) {
    try {
      const stored: unknown = JSON.parse(raw);
      if (
        stored &&
        typeof stored === "object" &&
        "classLevel" in stored &&
        typeof stored.classLevel === "string" &&
        "subjectSlug" in stored &&
        typeof stored.subjectSlug === "string"
      ) {
        selection = parseStudySelection(stored.classLevel, stored.subjectSlug);
      }
    } catch (error) {
      console.error("Could not parse the saved class and subject selection.", error);
    }

    if (!selection) {
      console.error("The saved class and subject selection is invalid.");
    }
  }

  currentSnapshot = { selection, hydrated: true };
  return currentSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", handleStorageChange);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorageChange);
  };
}

function handleStorageChange(event: StorageEvent) {
  if (event.key !== STORAGE_KEY) return;
  cachedRaw = undefined;
  notifyListeners();
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

function saveSelection(selection: StudySelection) {
  const parsed = parseStudySelection(selection.classLevel, selection.subjectSlug);
  if (
    !parsed ||
    parsed.classLevel !== selection.classLevel ||
    parsed.subjectSlug !== selection.subjectSlug
  ) {
    throw new Error("Cannot save an invalid class and subject selection.");
  }

  const raw = JSON.stringify(parsed);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  currentSnapshot = { selection: parsed, hydrated: true };
  notifyListeners();
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribe,
    readSnapshot,
    () => SERVER_SNAPSHOT,
  );
  const setSelection = useCallback(saveSelection, []);
  const value = useMemo(
    () => ({ ...snapshot, setSelection }),
    [snapshot, setSelection],
  );

  return (
    <SelectionContext.Provider value={value}>
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("useSelection must be used inside SelectionProvider.");
  }
  return context;
}
