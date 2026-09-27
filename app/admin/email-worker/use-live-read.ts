"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Result } from "@/lib/shared/types";
import { runServerAction } from "@/lib/deployment/client";

/** Serial reads coalesce refreshes and query changes; an older response cannot replace newer filters. */
export function useLiveRead<T>(
  key: string,
  load: () => Promise<Result<T>>,
  enabled: boolean,
  onAccessDenied: () => void,
) {
  const [data, setData] = useState<T | null>(null);
  const [dataKey, setDataKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const desired = useRef({ key, load, enabled });
  const alive = useRef(false);
  const running = useRef(false);
  const queued = useRef(false);

  const pump = useCallback(async () => {
    if (running.current || !alive.current) return;
    running.current = true;
    setLoading(true);
    try {
      while (alive.current && queued.current && desired.current.enabled) {
        queued.current = false;
        const request = desired.current;
        try {
          const response = await runServerAction(request.load);
          if (!alive.current || response === undefined) continue;
          if (!response.success && (response.code === "UNAUTHORIZED" || response.code === "PERMISSION_DENIED")) {
            setData(null);
            setDataKey(null);
            queued.current = false;
            onAccessDenied();
            break;
          }
          if (desired.current.key !== request.key || !desired.current.enabled) continue;
          if (response.success) {
            setData(response.data);
            setDataKey(request.key);
            setLoadedAt(new Date());
            setError(null);
            setErrorKey(null);
          } else {
            // Server actions return sanitized user-facing errors.
            setError(response.error);
            setErrorKey(request.key);
          }
        } catch {
          if (alive.current && desired.current.key === request.key && desired.current.enabled) {
            setError("เชื่อมต่อไม่สำเร็จ กรุณารีเฟรชเพื่อลองอีกครั้ง");
            setErrorKey(request.key);
          }
        }
      }
    } finally {
      running.current = false;
      if (alive.current) setLoading(false);
    }
  }, [onAccessDenied]);

  const refresh = useCallback(() => {
    if (!desired.current.enabled || !alive.current) return;
    queued.current = true;
    void pump();
  }, [pump]);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; queued.current = false; };
  }, []);

  useEffect(() => {
    desired.current = { key, load, enabled };
    if (enabled) refresh();
    else queued.current = false;
  }, [key, load, enabled, refresh]);

  useEffect(() => {
    const refreshVisible = () => { if (document.visibilityState === "visible") refresh(); };
    // Do not queue repeated poll requests while a request is still running.
    const timer = setInterval(() => { if (!running.current) refreshVisible(); }, 15_000);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", refreshVisible); };
  }, [refresh]);

  return { data, dataKey, error: errorKey === key ? error : null, loading, loadedAt, refresh };
}
