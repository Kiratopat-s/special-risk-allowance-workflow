import { act } from "@testing-library/react";
import { vi } from "vitest";
import { DESKTOP_PICKER_QUERY } from "@/lib/hooks/use-desktop-picker";

export function installPickerMedia(initialDesktop = false) {
  let desktop = initialDesktop;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === DESKTOP_PICKER_QUERY && desktop;
    },
    media: query,
    onchange: null,
    addEventListener: (_event: string, callback: () => void) =>
      listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) =>
      listeners.delete(callback),
    addListener: (callback: () => void) => listeners.add(callback),
    removeListener: (callback: () => void) => listeners.delete(callback),
    dispatchEvent: () => true,
  }));
  return (next: boolean) =>
    act(() => {
      desktop = next;
      listeners.forEach((listener) => listener());
    });
}
