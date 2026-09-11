"use client";

import { useSyncExternalStore } from "react";

export const DESKTOP_PICKER_QUERY = "(hover: hover) and (pointer: fine)";
function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const media = window.matchMedia(DESKTOP_PICKER_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function getSnapshot() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia(DESKTOP_PICKER_QUERY).matches
  );
}
const getServerSnapshot = () => false;

/** Native markup is shared by SSR and the first hydration render. */
export function useDesktopPicker() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
