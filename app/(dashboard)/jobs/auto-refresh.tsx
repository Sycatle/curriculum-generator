"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Invisible client component that fires a single background refresh of stale
 * sources when the dashboard mounts. Server route is responsible for the
 * cooldown so re-mounts within the window are cheap (the SQL filter returns 0
 * sources). On success with new postings, triggers a soft router refresh.
 */
export function AutoRefresh() {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/jobs/sources/refresh-stale", {
          method: "POST",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as { ok?: number; inserted?: number };
        if ((data.inserted ?? 0) > 0 || (data.ok ?? 0) > 0) {
          router.refresh();
        }
      } catch {
        // silent — auto-refresh is best-effort
      }
    })();

    return () => controller.abort();
  }, [router]);

  return null;
}
