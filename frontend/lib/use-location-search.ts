"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function getSnapshot() {
  return window.location.search;
}

function getServerSnapshot() {
  return null;
}

export function useLocationSearch() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
