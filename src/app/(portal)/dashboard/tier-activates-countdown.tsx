"use client";

import { useEffect, useState } from "react";

function getTimeRemaining(expiresAt: string) {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return null;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);
  const hrs = hours % 24;
  return { days, hrs, minutes, total: diff };
}

/** Compact "Active in X days Y hr" countdown for the tier card */
export function TierActivatesCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState(getTimeRemaining(expiresAt));

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getTimeRemaining(expiresAt);
      setRemaining(r);
      if (!r) clearInterval(interval);
    }, 60_000); // update every minute
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (!remaining) return <span className="text-xs text-muted-foreground">Active after welcome ends</span>;

  const parts: string[] = [];
  if (remaining.days > 0) parts.push(`${remaining.days} day${remaining.days !== 1 ? "s" : ""}`);
  parts.push(`${remaining.hrs} hr${remaining.hrs !== 1 ? "s" : ""}`);

  return (
    <span className="text-xs text-purple-600 font-medium">
      Active in {parts.join(" ")}
    </span>
  );
}
