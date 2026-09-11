"use client";
import { usePathname, useSearchParams } from "next/navigation";
/** Filters applied to an already authorized client-side result set. */
export function useUrlFilter(
  key: string,
  fallback = "",
): [string, (value: string) => void] {
  const query = useSearchParams();
  const path = usePathname();
  const value = query.get(key) ?? fallback;
  return [
    value,
    (next) => {
      const params = new URLSearchParams(query);
      if (next === fallback || !next) params.delete(key);
      else params.set(key, next);
      params.delete("page");
      window.history.replaceState(
        null,
        "",
        `${path}${params.size ? `?${params}` : ""}`,
      );
    },
  ];
}
