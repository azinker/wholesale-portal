"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * When an approved wholesale customer loads the dashboard, trigger a tier
 * recalc in the background (rate-limited to once per 15 min per account).
 * After recalc completes, refresh the page data so qualifying order count
 * and tier are up to date.
 */
export function DashboardRecalcTrigger({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    fetch("/api/portal/tier-recalc")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data.skipped && data.count7d !== undefined) {
          router.refresh();
        }
      })
      .catch(() => {
        // Silent: don't block or annoy user if recalc fails
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, router]);

  return null;
}
